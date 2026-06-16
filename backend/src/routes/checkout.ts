import { Router, Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "../utils/prisma";
import {
  assertSupportedPaymentMethod,
  getAvailableMethods,
  getMollieLocale,
  getProvider,
  MOLLIE_METHOD_MAP,
  normalizeCountry,
  PaymentMethod,
  PaymentProvider,
} from "../services/paymentRouter";
import { calculateFreeShippingRemaining, calculateShippingOptions, getFreeShippingThresholdForCountry } from "../services/shippingCalculator";
import { getVatRate } from "../services/vatCalculator";
import { calculateDiscountAmount } from "../services/marketingAgentService";
import promotionService, { PromotionValidationResult } from "../services/promotionService";
import {
  normalizeAbandonedCartItems,
  verifyAbandonedCartToken,
} from "../services/abandonedCartReminderService";

export const checkoutRouter = Router();

type CheckoutCartItem = {
  productId?: string;
  id?: string;
  quantity: number;
};

type CheckoutAddress = {
  firstName: string;
  lastName: string;
  address: string;
  extension?: string;
  city: string;
  postalCode: string;
  country?: string;
  phone?: string;
};

type CheckoutRequestBody = {
  cartItems: CheckoutCartItem[];
  customerEmail: string;
  customerId?: string;
  shippingAddress: CheckoutAddress;
  billingAddress?: CheckoutAddress;
  paymentMethod: PaymentMethod;
  shippingOptionId?: string;
  isB2B?: boolean;
  vatNumber?: string;
  promoCode?: string;
  cartSessionId?: string;
  draftToken?: string;
};

const CURRENCY = "EUR";
const STANDARD_VAT_RATE = 20;
const PRO_MINIMUM_ORDER_HT = 200;

function generateOrderNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const rand = Math.floor(Math.random() * 100000).toString().padStart(5, "0");
  return `BP-${year}-${rand}`;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizePromoCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32);
}

async function resolvePromoCode(code: string | undefined, baseAmount: number, shipping: number) {
  const normalized = normalizePromoCode(code || "");
  if (!normalized) return { promoCode: null, discountAmount: 0 };
  const promoCode = await prisma.promoCode.findUnique({ where: { code: normalized } });
  if (!promoCode || !promoCode.active) throw new Error("Code promo introuvable ou inactif");
  const now = new Date();
  if ((promoCode.startsAt && promoCode.startsAt > now) || (promoCode.endsAt && promoCode.endsAt < now)) {
    throw new Error("Code promo hors période de validité");
  }
  if (promoCode.maxUses !== null && promoCode.usedCount >= promoCode.maxUses) {
    throw new Error("Code promo épuisé");
  }
  if (promoCode.minAmount !== null && baseAmount < promoCode.minAmount) {
    throw new Error(`Minimum d'achat requis : ${promoCode.minAmount} €`);
  }
  const discountAmount = calculateDiscountAmount({ subtotal: baseAmount, shipping, type: promoCode.type, value: promoCode.value });
  return { promoCode, discountAmount: money(discountAmount) };
}

async function resolveCheckoutPromotion(params: {
  code?: string;
  baseAmount: number;
  shipping: number;
  cartItems: Array<{ productId: string; categoryId?: string | null; quantity: number; price: number }>;
  customerId?: string;
  customerEmail: string;
  customerType: "b2c" | "b2b";
}): Promise<{
  promoCode: Awaited<ReturnType<typeof resolvePromoCode>>["promoCode"];
  promotion: PromotionValidationResult | null;
  discountAmount: number;
  discountType?: string;
}> {
  const normalized = normalizePromoCode(params.code || "");
  if (!normalized) return { promoCode: null, promotion: null, discountAmount: 0 };

  const promotion = await promotionService.validateCode({
    code: normalized,
    cartTotal: params.baseAmount,
    cartItems: params.cartItems,
    customerId: params.customerId,
    customerEmail: params.customerEmail,
    customerType: params.customerType,
    shipping: params.shipping,
  });

  if (promotion.valid) {
    return {
      promoCode: null,
      promotion,
      discountAmount: money(promotion.discount || 0),
      discountType: promotion.discountType,
    };
  }

  try {
    const legacy = await resolvePromoCode(normalized, params.baseAmount, params.shipping);
    return { promoCode: legacy.promoCode, promotion: null, discountAmount: legacy.discountAmount };
  } catch (error) {
    throw new Error(promotion.message || (error instanceof Error ? error.message : "Code promo invalide"));
  }
}

function getFrontendUrl(): string {
  return (process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "https://barberparadise.fr").replace(/\/$/, "");
}

function hashDraftShareToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function parseProductImages(images: string | null | undefined): string[] {
  if (!images) return [];
  try {
    const parsed = JSON.parse(images);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return images ? [images] : [];
  }
}

function parseProductStringArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return value ? [value] : [];
  }
}

function getBackendUrl(req: Request): string {
  return (process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return value;
}

async function parseJsonResponse<T>(response: globalThis.Response, provider: PaymentProvider): Promise<T> {
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = typeof data?.detail === "string" ? data.detail : typeof data?.message === "string" ? data.message : text;
    throw new Error(`Erreur ${provider}: ${message || response.statusText}`);
  }
  return data as T;
}

async function createMollieCheckout(params: {
  orderId: string;
  orderNumber: string;
  totalTTC: number;
  frontendUrl: string;
  backendUrl: string;
  method: Exclude<PaymentMethod, "paypal_4x" | "card_international">;
  country: string;
}) {
  const mollieMethod = MOLLIE_METHOD_MAP[params.method];
  const response = await fetch("https://api.mollie.com/v2/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("MOLLIE_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: { currency: CURRENCY, value: params.totalTTC.toFixed(2) },
      description: `Commande Barber Paradise #${params.orderNumber}`,
      redirectUrl: `${params.frontendUrl}/commande/succes?orderId=${params.orderId}`,
      cancelUrl: `${params.frontendUrl}/commande/annulation?orderId=${params.orderId}`,
      webhookUrl: `${params.backendUrl}/api/webhooks/mollie`,
      metadata: { orderId: params.orderId },
      locale: getMollieLocale(params.country),
      method: mollieMethod,
    }),
  });

  const payment = await parseJsonResponse<{ id: string; _links?: { checkout?: { href?: string } } }>(response, "mollie");
  return { providerPaymentId: payment.id, checkoutUrl: payment._links?.checkout?.href };
}

async function getPaypalAccessToken(): Promise<string> {
  const baseUrl = process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const credentials = Buffer.from(`${requireEnv("PAYPAL_CLIENT_ID")}:${requireEnv("PAYPAL_CLIENT_SECRET")}`).toString("base64");
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await parseJsonResponse<{ access_token: string }>(response, "paypal");
  return data.access_token;
}

async function createPaypalCheckout(params: { orderId: string; orderNumber: string; totalTTC: number; frontendUrl: string }) {
  const baseUrl = process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const accessToken = await getPaypalAccessToken();
  const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": params.orderId,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: params.orderId,
          description: `Commande Barber Paradise #${params.orderNumber}`,
          amount: { currency_code: CURRENCY, value: params.totalTTC.toFixed(2) },
        },
      ],
      payment_source: {
        pay_later: {
          experience_context: {
            payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
            brand_name: "Barber Paradise",
            locale: "fr-FR",
            landing_page: "LOGIN",
            return_url: `${params.frontendUrl}/commande/succes?orderId=${params.orderId}`,
            cancel_url: `${params.frontendUrl}/commande/annulation?orderId=${params.orderId}`,
          },
        },
      },
    }),
  });
  const order = await parseJsonResponse<{ id: string; links?: Array<{ rel: string; href: string }> }>(response, "paypal");
  return { providerPaymentId: order.id, checkoutUrl: order.links?.find((link) => link.rel === "payer-action" || link.rel === "approve")?.href };
}

async function createCheckoutComSession(params: { orderId: string; totalTTC: number; frontendUrl: string; customerEmail: string }) {
  const baseUrl = process.env.CHECKOUT_ENV === "live" ? "https://api.checkout.com" : "https://api.sandbox.checkout.com";
  const response = await fetch(`${baseUrl}/payment-sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("CHECKOUT_SECRET_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.round(params.totalTTC * 100),
      currency: CURRENCY,
      reference: params.orderId,
      success_url: `${params.frontendUrl}/commande/succes?orderId=${params.orderId}`,
      cancel_url: `${params.frontendUrl}/commande/annulation?orderId=${params.orderId}`,
      customer: { email: params.customerEmail },
    }),
  });
  const session = await parseJsonResponse<{ id?: string; url?: string; _links?: { redirect?: { href?: string } } }>(response, "checkout");
  return { providerPaymentId: session.id || params.orderId, checkoutUrl: session.url || session._links?.redirect?.href };
}

async function createProviderCheckout(
  provider: PaymentProvider,
  params: {
    orderId: string;
    orderNumber: string;
    totalTTC: number;
    frontendUrl: string;
    backendUrl: string;
    method: PaymentMethod;
    country: string;
    customerEmail: string;
  },
) {
  if (provider === "mollie") {
    if (params.method === "paypal_4x" || params.method === "card_international") {
      throw new Error("Méthode Mollie invalide");
    }
    return createMollieCheckout({ ...params, method: params.method });
  }
  if (provider === "paypal") return createPaypalCheckout(params);
  return createCheckoutComSession(params);
}

checkoutRouter.get("/available-methods", (req: Request, res: Response): void => {
  const country = normalizeCountry(typeof req.query.country === "string" ? req.query.country : "FR");
  const isPro = req.query.isPro === "true";
  const isB2B = req.query.isB2B === "true" || isPro;
  const methods = getAvailableMethods(country, isB2B);
  res.json({ methods, country, isB2B, isPro });
});

checkoutRouter.get("/shipping-options", async (req: Request, res: Response): Promise<void> => {
  try {
    const country = normalizeCountry(typeof req.query.country === "string" ? req.query.country : "FR");
    const totalParam = typeof req.query.total === "string" ? Number(req.query.total) : 0;
    const orderTotal = Number.isFinite(totalParam) ? Math.max(0, totalParam) : 0;
    const isPro = req.query.isPro === "true";
    const isB2B = req.query.isB2B === "true" || isPro;
    const amountBasis = isB2B ? "HT" : "TTC";
    const freeShippingFrom = await getFreeShippingThresholdForCountry(country, isB2B);
    const options = await calculateShippingOptions(country, orderTotal, isB2B);
    res.json({
      options,
      country,
      orderTotal,
      amountBasis,
      isB2B,
      isPro,
      freeShippingFrom,
      freeShippingRemaining: await calculateFreeShippingRemaining(country, orderTotal, isB2B),
    });
  } catch (err) {
    console.error("Erreur options livraison", err);
    res.status(500).json({ error: "Erreur calcul options livraison" });
  }
});

checkoutRouter.post("/promo/validate", async (req: Request, res: Response): Promise<void> => {
  try {
    const subtotal = Number(req.body?.subtotal || 0);
    const shipping = Number(req.body?.shipping || 0);
    const { promoCode, discountAmount } = await resolvePromoCode(req.body?.code, subtotal, shipping);
    if (!promoCode) {
      res.status(400).json({ error: "Code promo requis" });
      return;
    }
    res.json({ promoCode, discountAmount });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Code promo invalide" });
  }
});


checkoutRouter.get("/draft/:token", async (req: Request, res: Response): Promise<void> => {
  try {
    const token = String(req.params.token || "").trim();
    if (!token || token.length < 32) {
      res.status(400).json({ error: "Lien de brouillon invalide" });
      return;
    }

    const tokenHash = hashDraftShareToken(token);
    const draft = await prisma.order.findFirst({
      where: {
        status: "draft",
        draftShareTokenHash: tokenHash,
      },
      include: {
        items: { include: { product: true } },
        shippingAddress: true,
      },
    });

    if (!draft || !draft.draftShareExpiresAt || draft.draftShareExpiresAt <= new Date() || draft.draftShareConvertedAt) {
      res.status(404).json({ error: "Lien de brouillon expiré ou introuvable" });
      return;
    }

    await prisma.order.update({
      where: { id: draft.id },
      data: { draftShareLastAccessedAt: new Date() },
    });

    res.json({
      draft: {
        orderNumber: draft.orderNumber,
        email: draft.email || draft.customerEmail,
        expiresAt: draft.draftShareExpiresAt,
        subtotal: draft.subtotal,
        shipping: draft.shipping,
        total: draft.totalTTC || draft.total,
        shippingAddress: draft.shippingAddress,
        items: draft.items.map((item) => {
          const images = parseProductImages(item.product?.images);
          return {
            id: item.productId || item.id,
            productId: item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            image: item.image || images[0] || "",
            slug: item.product?.slug || "",
            brand: item.product?.brand || "",
            images: images.length ? images : item.image ? [item.image] : [],
          };
        }),
      },
    });
  } catch (err) {
    console.error("Erreur chargement brouillon client", err);
    res.status(500).json({ error: "Erreur chargement brouillon" });
  }
});

checkoutRouter.get("/abandoned-cart/restore", async (req: Request, res: Response): Promise<void> => {
  try {
    const token = typeof req.query.token === "string" ? req.query.token.trim() : "";
    const payload = verifyAbandonedCartToken(token, "restore");
    if (!payload) {
      res.status(400).json({ error: "Lien de panier invalide ou expiré" });
      return;
    }

    const cart = await prisma.abandonedCartSession.findUnique({ where: { id: payload.sid } });
    if (!cart || cart.convertedAt || cart.unsubscribed || cart.itemCount <= 0) {
      res.status(404).json({ error: "Panier introuvable, converti ou indisponible" });
      return;
    }

    const normalizedItems = normalizeAbandonedCartItems(cart.items);
    const productIds = Array.isArray(cart.items)
      ? cart.items
          .map((item) => {
            if (!item || typeof item !== "object" || Array.isArray(item)) return null;
            const productId = (item as { productId?: unknown; id?: unknown }).productId || (item as { productId?: unknown; id?: unknown }).id;
            return typeof productId === "string" ? productId : null;
          })
          .filter((id): id is string => Boolean(id))
      : [];

    const products = productIds.length
      ? await prisma.product.findMany({ where: { id: { in: productIds } } })
      : [];
    const productById = new Map(products.map((product) => [product.id, product]));

    res.json({
      cart: {
        id: cart.id,
        email: cart.email,
        total: cart.total,
        expiresAt: new Date(payload.exp).toISOString(),
        items: normalizedItems.map((item, index) => {
          const productId = productIds[index];
          const product = productId ? productById.get(productId) : null;
          const images = parseProductImages(product?.images);
          return {
            quantity: item.quantity,
            product: {
              id: product?.id || productId || `restored-${index}`,
              handle: product?.handle || product?.slug || "",
              name: product?.name || item.name,
              slug: product?.slug || "",
              brand: product?.brand || "",
              brandId: product?.brandId || null,
              category: product?.category || "",
              subcategory: product?.subcategory || "",
              subsubcategory: product?.subsubcategory || "",
              price: product?.price ?? item.price,
              pricePublic: product?.price || item.price,
              priceProEur: product?.priceProEur ?? null,
              originalPrice: product?.originalPrice ?? null,
              compareAtPrice: product?.compareAtPrice ?? null,
              images: images.length ? images : item.image ? [item.image] : [],
              description: product?.description || "",
              shortDescription: product?.shortDescription || "",
              features: parseProductStringArray(product?.features),
              inStock: product?.inStock ?? true,
              stockCount: product?.stockCount ?? 0,
              rating: product?.rating || 0,
              reviewCount: product?.reviewCount || 0,
              isNew: product?.isNew || false,
              isPromo: product?.isPromo || false,
              tags: parseProductStringArray(product?.tags),
              status: product?.status || "active",
              createdAt: product?.createdAt?.toISOString?.() || new Date().toISOString(),
              updatedAt: product?.updatedAt?.toISOString?.() || new Date().toISOString(),
            },
          };
        }),
      },
    });
  } catch (err) {
    console.error("Erreur restauration panier abandonné", err);
    res.status(500).json({ error: "Erreur restauration panier" });
  }
});

checkoutRouter.post("/abandoned-cart/unsubscribe", async (req: Request, res: Response): Promise<void> => {
  try {
    const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    const payload = verifyAbandonedCartToken(token, "unsubscribe");
    if (!payload) {
      res.status(400).json({ error: "Lien de désinscription invalide ou expiré" });
      return;
    }

    await prisma.abandonedCartSession.updateMany({
      where: { id: payload.sid },
      data: { unsubscribed: true },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Erreur désinscription relance panier", err);
    res.status(500).json({ error: "Erreur désinscription" });
  }
});

checkoutRouter.post("/cart-session", async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as {
      sessionId?: string;
      email?: string;
      cartItems?: CheckoutCartItem[];
    };

    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim().slice(0, 80) : "";
    if (!sessionId) {
      res.status(400).json({ error: "Session panier requise" });
      return;
    }

    const normalizedItems = Array.isArray(body.cartItems)
      ? body.cartItems
          .map((item) => ({
            productId: item.productId || item.id,
            quantity: Number.isInteger(item.quantity) && item.quantity > 0 ? item.quantity : 0,
          }))
          .filter((item) => item.productId && item.quantity > 0)
      : [];

    const products = normalizedItems.length
      ? await prisma.product.findMany({
          where: { id: { in: normalizedItems.map((item) => item.productId as string) } },
          select: { id: true, name: true, price: true },
        })
      : [];
    const productById = new Map(products.map((product) => [product.id, product]));
    const items = normalizedItems
      .map((item) => {
        const product = productById.get(item.productId as string);
        if (!product) return null;
        return {
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: item.quantity,
        };
      })
      .filter(Boolean) as Array<{ productId: string; name: string; price: number; quantity: number }>;

    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const total = money(items.reduce((sum, item) => sum + item.price * item.quantity, 0));
    const email = typeof body.email === "string" && body.email.includes("@") ? body.email.trim().toLowerCase() : null;

    await prisma.abandonedCartSession.upsert({
      where: { id: sessionId },
      update: {
        email: email || undefined,
        items,
        itemCount,
        total,
        lastSeenAt: new Date(),
      },
      create: {
        id: sessionId,
        email,
        items,
        itemCount,
        total,
      },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Erreur suivi panier abandonné", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

checkoutRouter.post("/initiate", async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as CheckoutRequestBody;
    assertSupportedPaymentMethod(body.paymentMethod);

    if (!body.customerEmail || !Array.isArray(body.cartItems) || body.cartItems.length === 0) {
      res.status(400).json({ error: "Email client et panier requis" });
      return;
    }

    const shippingAddress = body.shippingAddress;
    if (!shippingAddress?.firstName || !shippingAddress?.lastName || !shippingAddress?.address || !shippingAddress?.city || !shippingAddress?.postalCode) {
      res.status(400).json({ error: "Adresse de livraison incomplète" });
      return;
    }

    const country = normalizeCountry(shippingAddress.country);
    const requestedB2B = Boolean(body.isB2B);
    const proAccount = body.customerId
      ? await prisma.proAccount.findUnique({ where: { customerId: body.customerId } })
      : null;
    const isApprovedPro = proAccount?.status === "approved";

    if (requestedB2B && !isApprovedPro) {
      res.status(403).json({ error: "Compte professionnel non approuvé" });
      return;
    }

    const isB2B = isApprovedPro;
    const vatNumber = typeof body.vatNumber === "string" ? body.vatNumber.trim().toUpperCase() : proAccount?.vatNumber || undefined;
    const allowedMethods = getAvailableMethods(country, isB2B);
    if (!allowedMethods.includes(body.paymentMethod)) {
      res.status(400).json({ error: "Méthode non disponible pour ce pays/profil" });
      return;
    }

    const orderItems = [];
    const promotionCartItems: Array<{ productId: string; categoryId?: string | null; quantity: number; price: number }> = [];
    let subtotalTTC = 0;
    let subtotalHT = 0;
    for (const item of body.cartItems) {
      const productId = item.productId || item.id;
      if (!productId || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        res.status(400).json({ error: "Article de panier invalide" });
        return;
      }
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product || product.status !== "active" || !product.inStock) {
        res.status(400).json({ error: `Produit indisponible : ${productId}` });
        return;
      }
      if (product.stockCount > 0 && product.stockCount < item.quantity) {
        res.status(400).json({ error: `Stock insuffisant pour ${product.name}` });
        return;
      }

      const unitHT = isB2B ? money(product.priceProEur ?? product.price / (1 + STANDARD_VAT_RATE / 100)) : money(product.price / (1 + STANDARD_VAT_RATE / 100));
      const unitTTC = isB2B ? money(unitHT * (1 + getVatRate(country, true, vatNumber) / 100)) : product.price;
      subtotalHT += unitHT * item.quantity;
      subtotalTTC += unitTTC * item.quantity;

      orderItems.push({
        productId: product.id,
        name: product.name,
        price: isB2B ? unitHT : product.price,
        quantity: item.quantity,
        image: JSON.parse(product.images || "[]")[0] || "",
      });
      promotionCartItems.push({
        productId: product.id,
        categoryId: product.category || null,
        quantity: item.quantity,
        price: isB2B ? unitHT : product.price,
      });
    }

    subtotalHT = money(subtotalHT);
    subtotalTTC = money(subtotalTTC);

    if (isB2B && subtotalHT < PRO_MINIMUM_ORDER_HT) {
      res.status(400).json({ error: `Le minimum de commande professionnel est de ${PRO_MINIMUM_ORDER_HT} € HT` });
      return;
    }

    const shippingOptions = await calculateShippingOptions(country, isB2B ? subtotalHT : subtotalTTC, isB2B);
    const selectedShippingOption = shippingOptions.find((option) => option.id === body.shippingOptionId) || shippingOptions[0];
    if (!selectedShippingOption) {
      res.status(400).json({ error: "Aucune option de livraison disponible pour ce pays" });
      return;
    }
    const shipping = selectedShippingOption.price;
    const promoResolution = await resolveCheckoutPromotion({
      code: body.promoCode,
      baseAmount: isB2B ? subtotalHT : subtotalTTC,
      shipping,
      cartItems: promotionCartItems,
      customerId: body.customerId,
      customerEmail: body.customerEmail,
      customerType: isB2B ? "b2b" : "b2c",
    });
    const discountAmount = promoResolution.discountAmount;
    const shippingDiscount = promoResolution.discountType === "free_shipping" ? Math.min(shipping, discountAmount) : 0;
    const productDiscount = promoResolution.discountType === "free_shipping" ? 0 : discountAmount;
    const chargedShipping = money(Math.max(0, shipping - shippingDiscount));
    const totalHT = money(isB2B ? Math.max(0, subtotalHT - productDiscount) : subtotalHT);
    const vatRate = getVatRate(country, isB2B, vatNumber);
    const vatAmount = money(totalHT * (vatRate / 100));
    const totalTTC = money(Math.max(0, totalHT + vatAmount + chargedShipping - (isB2B ? 0 : productDiscount)));
    const provider = getProvider(body.paymentMethod, country);

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        email: body.customerEmail,
        customerEmail: body.customerEmail,
        customerId: body.customerId || null,
        status: "pending",
        paymentMethod: body.paymentMethod,
        paymentProvider: provider,
        isB2B,
        subtotal: isB2B ? subtotalHT : subtotalTTC,
        shipping: chargedShipping,
        total: totalTTC,
        totalHT,
        promoCodeId: promoResolution.promoCode?.id || null,
        promotionId: promoResolution.promotion?.promotionId || null,
        discountAmount,
        vatRate,
        vatAmount,
        totalTTC,
        currency: CURRENCY,
        vatNumber: vatNumber || null,
        billingAddress: (body.billingAddress || shippingAddress) as object,
        items: { create: orderItems },
        shippingAddress: {
          create: {
            firstName: shippingAddress.firstName,
            lastName: shippingAddress.lastName,
            address: shippingAddress.address,
            extension: shippingAddress.extension || "",
            city: shippingAddress.city,
            postalCode: shippingAddress.postalCode,
            country,
            phone: shippingAddress.phone || "",
          },
        },
      },
    });

    if (body.cartSessionId) {
      await prisma.abandonedCartSession.updateMany({
        where: { id: body.cartSessionId },
        data: { convertedOrderId: order.id, convertedAt: new Date(), itemCount: 0 },
      });
    }

    if (body.draftToken) {
      const draftTokenHash = hashDraftShareToken(String(body.draftToken).trim());
      await prisma.order.updateMany({
        where: {
          status: "draft",
          draftShareTokenHash: draftTokenHash,
          draftShareExpiresAt: { gt: new Date() },
          draftShareConvertedAt: null,
        },
        data: { draftShareConvertedAt: new Date() },
      });
    }

    if (promoResolution.promoCode) {
      await prisma.promoCode.update({ where: { id: promoResolution.promoCode.id }, data: { usedCount: { increment: 1 } } });
    }

    const checkout = await createProviderCheckout(provider, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalTTC,
      frontendUrl: getFrontendUrl(),
      backendUrl: getBackendUrl(req),
      method: body.paymentMethod,
      country,
      customerEmail: body.customerEmail,
    });

    if (!checkout.checkoutUrl) {
      throw new Error(`URL de paiement introuvable pour ${provider}`);
    }

    await prisma.order.update({
      where: { id: order.id },
      data: { providerPaymentId: checkout.providerPaymentId || null },
    });

    res.status(201).json({ orderId: order.id, orderNumber: order.orderNumber, checkoutUrl: checkout.checkoutUrl, provider, discountAmount });
  } catch (err) {
    console.error("Erreur initialisation checkout", err);
    const message = err instanceof Error ? err.message : "Erreur initialisation paiement";
    const status = message.includes("Variable d'environnement manquante") ? 503 : 500;
    res.status(status).json({ error: message });
  }
});
