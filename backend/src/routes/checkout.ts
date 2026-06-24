import { Router, Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "../utils/prisma";
import { getFrontendUrl } from "../utils/frontendUrl";
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
import { calculateFreeShippingRemaining, calculateShippingOptions, getFreeShippingThresholdForCountry, ShippingOption } from "../services/shippingCalculator";
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
  variantId?: string | null;
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

function normalizeShipmentCarrier(option?: Pick<ShippingOption, "carrier" | "label" | "id"> | null): string {
  const raw = [option?.carrier, option?.label, option?.id].filter(Boolean).join(" ").toLowerCase();
  if (raw.includes("mondial")) return "mondial_relay";
  if (raw.includes("colissimo") && raw.includes("international")) return "colissimo_international";
  if (raw.includes("colissimo")) return "colissimo";
  return option?.carrier || option?.label || "livraison_standard";
}

function resolveShippingOptionForPaidOrder(options: ShippingOption[], selectedId: string | undefined, chargedShipping: number): ShippingOption | undefined {
  return options.find((option) => option.id === selectedId)
    || options.find((option) => money(option.price) === money(chargedShipping))
    || options[0];
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

function normalizeCheckoutItemsSignature(items: CheckoutCartItem[]): string {
  return items
    .map((item) => ({ productId: item.productId || item.id || "", variantId: item.variantId || "product", quantity: item.quantity }))
    .filter((item) => item.productId && Number.isInteger(item.quantity) && item.quantity > 0)
    .sort((a, b) => `${a.productId}:${a.variantId}`.localeCompare(`${b.productId}:${b.variantId}`))
    .map((item) => `${item.productId}:${item.variantId}:${item.quantity}`)
    .join("|");
}

function normalizeDraftItemsSignature(items: Array<{ productId: string | null; variantId?: string | null; quantity: number }>): string {
  return items
    .map((item) => ({ productId: item.productId || "", variantId: item.variantId || "product", quantity: item.quantity }))
    .filter((item) => item.productId && Number.isInteger(item.quantity) && item.quantity > 0)
    .sort((a, b) => `${a.productId}:${a.variantId}`.localeCompare(`${b.productId}:${b.variantId}`))
    .map((item) => `${item.productId}:${item.variantId}:${item.quantity}`)
    .join("|");
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
  method: Exclude<PaymentMethod, "paypal" | "paypal_4x">;
  country: string;
}) {
  const mollieMethod = MOLLIE_METHOD_MAP[params.method];
  const isGooglePay = params.method === "google_pay";

  if (isGooglePay) {
    console.log(`[mollie] Google Pay — début appel API Mollie, orderId: ${params.orderId}, montant: ${params.totalTTC}€, méthode Mollie: ${JSON.stringify(mollieMethod)}`);
  }

  const requestBody = {
    amount: { currency: CURRENCY, value: params.totalTTC.toFixed(2) },
    description: `Commande Barber Paradise #${params.orderNumber}`,
    redirectUrl: `${params.frontendUrl}/commande/succes?orderId=${params.orderId}`,
    cancelUrl: `${params.frontendUrl}/commande/annulation?orderId=${params.orderId}`,
    webhookUrl: `${params.backendUrl}/api/webhooks/mollie`,
    metadata: { orderId: params.orderId },
    locale: getMollieLocale(params.country),
    method: mollieMethod,
  };

  const response = await fetch("https://api.mollie.com/v2/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("MOLLIE_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (isGooglePay) {
    const statusText = response.status;
    console.log(`[mollie] Google Pay — réponse Mollie: HTTP ${statusText}`);
    if (!response.ok) {
      const errorText = await response.text().catch(() => "(impossible de lire le corps)");
      console.error(`[mollie] Google Pay — erreur Mollie: ${errorText}`);
      throw new Error(`Mollie Google Pay erreur ${statusText}: ${errorText}`);
    }
  }

  const payment = await parseJsonResponse<{ id: string; _links?: { checkout?: { href?: string } } }>(response, "mollie");

  if (isGooglePay) {
    console.log(`[mollie] Google Pay — paiement créé: ${payment.id}, checkoutUrl: ${payment._links?.checkout?.href ? "OK" : "MANQUANT"}`);
  }

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

async function createPaypalCheckout(params: { orderId: string; orderNumber: string; totalTTC: number; frontendUrl: string; backendUrl: string; method: PaymentMethod }) {
  const baseUrl = process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const accessToken = await getPaypalAccessToken();
  const isPayLater = params.method === "paypal_4x";

  // La return_url pointe vers le backend pour déclencher la capture des fonds avant la redirection
  // PayPal 4x (Pay Later / Pay in 4) : utilise payment_source.pay_later
  // PayPal standard : utilise payment_source.paypal
  const captureReturnUrl = `${params.backendUrl}/api/checkout/paypal/capture?orderId=${params.orderId}&frontendUrl=${encodeURIComponent(params.frontendUrl)}`;
  const paymentSource = isPayLater
    ? {
        pay_later: {
          experience_context: {
            brand_name: "Barber Paradise",
            locale: "fr-FR",
            shipping_preference: "GET_FROM_FILE",
            user_action: "PAY_NOW",
            return_url: captureReturnUrl,
            cancel_url: `${params.frontendUrl}/commande/annulation?orderId=${params.orderId}`,
          },
        },
      }
    : {
        paypal: {
          experience_context: {
            payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
            brand_name: "Barber Paradise",
            locale: "fr-FR",
            landing_page: "LOGIN",
            shipping_preference: "GET_FROM_FILE",
            user_action: "PAY_NOW",
            return_url: captureReturnUrl,
            cancel_url: `${params.frontendUrl}/commande/annulation?orderId=${params.orderId}`,
          },
        },
      };

  console.log(`[paypal] Création commande PayPal — méthode: ${params.method}, isPayLater: ${isPayLater}, montant: ${params.totalTTC}€, orderId: ${params.orderId}`);

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
      payment_source: paymentSource,
    }),
  });
  const order = await parseJsonResponse<{ id: string; links?: Array<{ rel: string; href: string }> }>(response, "paypal");
  const checkoutUrl = order.links?.find((link) => link.rel === "payer-action" || link.rel === "approve")?.href;
  console.log(`[paypal] Commande PayPal créée — id: ${order.id}, checkoutUrl: ${checkoutUrl ? "OK" : "MANQUANT"}`);
  return { providerPaymentId: order.id, checkoutUrl };
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
    if (params.method === "paypal" || params.method === "paypal_4x") {
      throw new Error("Méthode Mollie invalide : PayPal doit passer par le provider PayPal");
    }
    return createMollieCheckout({ ...params, method: params.method as Exclude<PaymentMethod, "paypal" | "paypal_4x"> });
  }
  if (provider === "paypal") return createPaypalCheckout({ ...params, method: params.method, backendUrl: params.backendUrl });
  throw new Error(`Prestataire de paiement non supporté : ${provider}`);
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
        items: { include: { product: { include: { variants: { orderBy: { order: "asc" } } } } } },
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
        isB2B: draft.isB2B,
        subtotal: draft.subtotal,
        shipping: draft.shipping,
        total: draft.totalTTC || draft.total,
        totalHT: draft.totalHT,
        vatRate: draft.vatRate,
        vatAmount: draft.vatAmount,
        totalTTC: draft.totalTTC || draft.total,
        discountAmount: draft.discountAmount,
        orderDiscountType: draft.orderDiscountType,
        orderDiscountValue: draft.orderDiscountValue,
        discountTotal: draft.discountTotal,
        shippingAddress: draft.shippingAddress,
        items: draft.items.map((item) => {
          const images = parseProductImages(item.product?.images);
          return {
            id: item.productId || item.id,
            productId: item.productId,
            variantId: item.variantId,
            variantLabel: item.variantLabel,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            discountAmount: item.discountAmount,
            lineDiscountType: item.lineDiscountType,
            lineDiscountValue: item.lineDiscountValue,
            discountedLineTotal: money(Math.max(0, item.price * item.quantity - item.discountAmount)),
            image: item.image || images[0] || "",
            slug: item.product?.slug || "",
            brand: item.product?.brand || "",
            images: images.length ? images : item.image ? [item.image] : [],
            variants: item.product?.variants?.map((variant) => ({
              id: variant.id,
              productId: variant.productId,
              name: variant.name,
              type: variant.type,
              color: variant.color || "",
              colorHex: variant.colorHex || "",
              size: variant.size || "",
              price: variant.price,
              priceProEur: variant.priceProEur,
              pricePublic: variant.price ?? item.product?.price ?? item.price,
              stock: variant.stock,
              inStock: variant.inStock,
              sku: variant.sku || "",
              image: variant.image || "",
              order: variant.order,
            })) || [],
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
      ? await prisma.product.findMany({ where: { id: { in: productIds } }, include: { variants: { orderBy: { order: "asc" } } } })
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
            variantId: item.variantId || null,
            variantLabel: item.variantLabel || null,
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
              variants: product?.variants?.map((variant) => ({
                id: variant.id,
                productId: variant.productId,
                name: variant.name,
                type: variant.type,
                color: variant.color || "",
                colorHex: variant.colorHex || "",
                size: variant.size || "",
                price: variant.price,
                priceProEur: variant.priceProEur,
                pricePublic: variant.price ?? product.price,
                stock: variant.stock,
                inStock: variant.inStock,
                sku: variant.sku || "",
                image: variant.image || "",
                order: variant.order,
              })) || [],
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
            variantId: typeof item.variantId === "string" && item.variantId.trim() ? item.variantId.trim() : null,
            quantity: Number.isInteger(item.quantity) && item.quantity > 0 ? item.quantity : 0,
          }))
          .filter((item) => item.productId && item.quantity > 0)
      : [];

    const products = normalizedItems.length
      ? await prisma.product.findMany({
          where: { id: { in: normalizedItems.map((item) => item.productId as string) } },
          select: { id: true, name: true, price: true, variants: { select: { id: true, name: true, price: true, image: true } } },
        })
      : [];
    const productById = new Map(products.map((product) => [product.id, product]));
    const items = normalizedItems
      .map((item) => {
        const product = productById.get(item.productId as string);
        if (!product) return null;
        const hasVariants = product.variants.length > 0;
        const variant = item.variantId ? product.variants.find((candidate) => candidate.id === item.variantId) : null;
        if (hasVariants && !variant) return null;
        return {
          productId: product.id,
          name: product.name,
          variantId: variant?.id || null,
          variantLabel: variant?.name || null,
          price: variant?.price ?? product.price,
          quantity: item.quantity,
        };
      })
      .filter(Boolean) as Array<{ productId: string; name: string; variantId: string | null; variantLabel: string | null; price: number; quantity: number }>;

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

    const draftTokenValue = typeof body.draftToken === "string" ? body.draftToken.trim() : "";
    const draftTokenHash = draftTokenValue ? hashDraftShareToken(draftTokenValue) : "";
    const checkoutDraft = draftTokenHash
      ? await prisma.order.findFirst({
          where: {
            status: "draft",
            draftShareTokenHash: draftTokenHash,
            draftShareExpiresAt: { gt: new Date() },
            draftShareConvertedAt: null,
          },
          include: { items: true, shipment: true },
        })
      : null;
    const shouldUseDraftPricing = Boolean(
      checkoutDraft && normalizeCheckoutItemsSignature(body.cartItems) === normalizeDraftItemsSignature(checkoutDraft.items),
    );

    if (checkoutDraft && shouldUseDraftPricing) {
      const provider = getProvider(body.paymentMethod, country);
      const orderTotalTTC = money(checkoutDraft.totalTTC || checkoutDraft.total);
      const draftShippingOptions = await calculateShippingOptions(country, checkoutDraft.isB2B ? checkoutDraft.subtotal : Math.max(0, orderTotalTTC - checkoutDraft.shipping), checkoutDraft.isB2B);
      const draftShippingOption = resolveShippingOptionForPaidOrder(draftShippingOptions, body.shippingOptionId, checkoutDraft.shipping);
      const order = await prisma.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          email: body.customerEmail,
          customerEmail: body.customerEmail,
          customerId: body.customerId || null,
          status: "pending",
          paymentMethod: body.paymentMethod,
          paymentProvider: provider,
          isB2B: checkoutDraft.isB2B,
          subtotal: checkoutDraft.subtotal,
          shipping: checkoutDraft.shipping,
          total: checkoutDraft.total,
          totalHT: checkoutDraft.totalHT,
          vatRate: checkoutDraft.vatRate,
          vatAmount: checkoutDraft.vatAmount,
          totalTTC: orderTotalTTC,
          currency: CURRENCY,
          vatNumber: vatNumber || checkoutDraft.vatNumber || null,
          discountAmount: checkoutDraft.discountAmount,
          orderDiscountType: checkoutDraft.orderDiscountType,
          orderDiscountValue: checkoutDraft.orderDiscountValue,
          discountTotal: checkoutDraft.discountTotal,
          billingAddress: (body.billingAddress || shippingAddress) as object,
          notes: checkoutDraft.notes || null,
          items: {
            create: checkoutDraft.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              variantLabel: item.variantLabel,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              image: item.image,
              discountAmount: item.discountAmount,
              lineDiscountType: item.lineDiscountType,
              lineDiscountValue: item.lineDiscountValue,
              isCustomSale: item.isCustomSale,
            })),
          },
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
          shipment: {
            create: {
              // Priorité : option choisie par le client > option du brouillon > fallback par montant
              carrier: normalizeShipmentCarrier(draftShippingOption) || checkoutDraft.shipment?.carrier || "livraison_standard",
              totalWeightG: checkoutDraft.shipment?.totalWeightG || null,
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

      await prisma.order.update({
        where: { id: checkoutDraft.id },
        data: { draftShareConvertedAt: new Date() },
      });

      let checkout: { providerPaymentId?: string; checkoutUrl?: string };
      try {
        checkout = await createProviderCheckout(provider, {
          orderId: order.id,
          orderNumber: order.orderNumber,
          totalTTC: orderTotalTTC,
          frontendUrl: getFrontendUrl(),
          backendUrl: getBackendUrl(req),
          method: body.paymentMethod,
          country,
          customerEmail: body.customerEmail,
        });
      } catch (providerErr) {
        // Supprimer la commande créée en base pour éviter les commandes fantômes
        console.error(`[checkout] Échec création paiement ${provider} pour commande ${order.orderNumber} — suppression de la commande orpheline`, providerErr);
        await prisma.order.delete({ where: { id: order.id } }).catch((delErr) =>
          console.error(`[checkout] Impossible de supprimer la commande orpheline ${order.id}:`, delErr)
        );
        throw providerErr;
      }

      if (!checkout.checkoutUrl) {
        await prisma.order.delete({ where: { id: order.id } }).catch((delErr) =>
          console.error(`[checkout] Impossible de supprimer la commande orpheline ${order.id}:`, delErr)
        );
        throw new Error(`URL de paiement introuvable pour ${provider}`);
      }

      await prisma.order.update({
        where: { id: order.id },
        data: { providerPaymentId: checkout.providerPaymentId || null },
      });

      res.status(201).json({
        orderId: order.id,
        orderNumber: order.orderNumber,
        checkoutUrl: checkout.checkoutUrl,
        provider,
        discountAmount: checkoutDraft.discountTotal,
      });
      return;
    }

    const orderItems = [];
    const promotionCartItems: Array<{ productId: string; categoryId?: string | null; quantity: number; price: number }> = [];
    let subtotalTTC = 0;
    let subtotalHT = 0;
    for (const item of body.cartItems) {
      const productId = item.productId || item.id;
      const variantId = typeof item.variantId === "string" && item.variantId.trim() ? item.variantId.trim() : null;
      if (!productId || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        res.status(400).json({ error: "Article de panier invalide" });
        return;
      }
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: { variants: { orderBy: { order: "asc" } } },
      });
      if (!product || product.status !== "active") {
        res.status(400).json({ error: `Produit indisponible : ${productId}` });
        return;
      }

      const hasVariants = product.variants.length > 0;
      const selectedVariant = variantId ? product.variants.find((variant) => variant.id === variantId) : null;
      if (hasVariants && !selectedVariant) {
        res.status(400).json({
          error: `L’article ${product.name} est incomplet dans votre panier. Retirez-le puis ajoutez-le à nouveau depuis sa fiche produit avec une variante.`,
          code: "VARIANT_SELECTION_REQUIRED",
          productId: product.id,
          productName: product.name,
        });
        return;
      }
      if (selectedVariant) {
        if (!selectedVariant.inStock || selectedVariant.stock <= 0) {
          res.status(400).json({ error: `Variante indisponible : ${product.name} - ${selectedVariant.name}` });
          return;
        }
        if (selectedVariant.stock < item.quantity) {
          res.status(400).json({ error: `Stock insuffisant pour ${product.name} - ${selectedVariant.name}` });
          return;
        }
      } else {
        if (!product.inStock) {
          res.status(400).json({ error: `Produit indisponible : ${product.name}` });
          return;
        }
        if (product.stockCount > 0 && product.stockCount < item.quantity) {
          res.status(400).json({ error: `Stock insuffisant pour ${product.name}` });
          return;
        }
      }

      const publicTtcPrice = selectedVariant?.price ?? product.price;
      const proHtPrice = selectedVariant?.priceProEur ?? product.priceProEur ?? publicTtcPrice / (1 + STANDARD_VAT_RATE / 100);
      const unitHT = isB2B ? money(proHtPrice) : money(publicTtcPrice / (1 + STANDARD_VAT_RATE / 100));
      const unitTTC = isB2B ? money(unitHT * (1 + getVatRate(country, true, vatNumber) / 100)) : publicTtcPrice;
      subtotalHT += unitHT * item.quantity;
      subtotalTTC += unitTTC * item.quantity;

      const productImages = JSON.parse(product.images || "[]");
      orderItems.push({
        productId: product.id,
        variantId: selectedVariant?.id || null,
        variantLabel: selectedVariant?.name || null,
        name: selectedVariant ? `${product.name} - ${selectedVariant.name}` : product.name,
        price: isB2B ? unitHT : publicTtcPrice,
        quantity: item.quantity,
        image: selectedVariant?.image || productImages[0] || "",
      });
      promotionCartItems.push({
        productId: product.id,
        categoryId: product.category || null,
        quantity: item.quantity,
        price: isB2B ? unitHT : publicTtcPrice,
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
        shipment: {
          create: {
            carrier: normalizeShipmentCarrier(selectedShippingOption) || "livraison_standard",
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

    let checkout: { providerPaymentId?: string; checkoutUrl?: string };
    try {
      checkout = await createProviderCheckout(provider, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalTTC,
        frontendUrl: getFrontendUrl(),
        backendUrl: getBackendUrl(req),
        method: body.paymentMethod,
        country,
        customerEmail: body.customerEmail,
      });
    } catch (providerErr) {
      // Supprimer la commande créée en base pour éviter les commandes fantômes
      console.error(`[checkout] Échec création paiement ${provider} pour commande ${order.orderNumber} — suppression de la commande orpheline`, providerErr);
      await prisma.order.delete({ where: { id: order.id } }).catch((delErr) =>
        console.error(`[checkout] Impossible de supprimer la commande orpheline ${order.id}:`, delErr)
      );
      throw providerErr;
    }

    if (!checkout.checkoutUrl) {
      await prisma.order.delete({ where: { id: order.id } }).catch((delErr) =>
        console.error(`[checkout] Impossible de supprimer la commande orpheline ${order.id}:`, delErr)
      );
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

// ─── Route de capture PayPal ──────────────────────────────────────────────────
// PayPal redirige le client vers cette URL après approbation du paiement.
// Le backend capture les fonds, met à jour la commande, puis redirige vers la page de succès.
checkoutRouter.get("/paypal/capture", async (req: Request, res: Response): Promise<void> => {
  const { orderId, token, frontendUrl } = req.query as { orderId?: string; token?: string; frontendUrl?: string };
  const safeFrontendUrl = frontendUrl ? decodeURIComponent(frontendUrl) : getFrontendUrl();

  console.log(`[paypal][capture] Réception retour PayPal — orderId=${orderId} token=${token}`);

  if (!orderId || !token) {
    console.error(`[paypal][capture] Paramètres manquants — orderId=${orderId} token=${token}`);
    res.redirect(`${safeFrontendUrl}/commande/annulation?error=missing_params`);
    return;
  }

  try {
    const baseUrl = process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
    const accessToken = await getPaypalAccessToken();

    console.log(`[paypal][capture] Appel API capture — paypalOrderId=${token}`);
    const captureResponse = await fetch(`${baseUrl}/v2/checkout/orders/${token}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `capture-${orderId}`,
      },
    });

    const captureData = await captureResponse.json() as {
      status?: string;
      id?: string;
      purchase_units?: Array<{ payments?: { captures?: Array<{ id: string; status: string }> } }>;
      details?: Array<{ issue?: string; description?: string }>;
    };

    console.log(`[paypal][capture] Réponse PayPal — status=${captureResponse.status} paypalStatus=${captureData.status}`);

    if (!captureResponse.ok || captureData.status !== "COMPLETED") {
      const detail = captureData.details?.[0];
      const errMsg = detail?.issue || detail?.description || captureData.status || "Capture échouée";
      console.error(`[paypal][capture] Échec capture — orderId=${orderId} paypalOrderId=${token} erreur=${errMsg}`);
      res.redirect(`${safeFrontendUrl}/commande/annulation?orderId=${orderId}&error=capture_failed`);
      return;
    }

    const captureId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id || token;
    console.log(`[paypal][capture] Capture réussie — captureId=${captureId} orderId=${orderId}`);

    // Marquer la commande comme payée
    const { markOrderPaidFromCapture, runPostPaymentEffectsFromCapture } = await import("./webhooks");
    const result = await markOrderPaidFromCapture(orderId, "paypal", captureId);
    const orderRef = await prisma.order.findUnique({ where: { id: orderId }, select: { orderNumber: true } });
    const orderNumber = orderRef?.orderNumber || orderId;
    console.log(`[paypal][capture] Commande marquée payée — orderId=${orderId} orderNumber=${orderNumber} changed=${result.changed}`);

    // Rediriger immédiatement vers la page de succès
    res.redirect(`${safeFrontendUrl}/commande/succes?orderId=${orderId}`);

    // Effets secondaires non bloquants
    try {
      await runPostPaymentEffectsFromCapture(orderId, orderNumber, result.channel, result.changed);
    } catch (err) {
      console.error(`[paypal][capture] Erreur runPostPaymentEffects — orderId=${orderId}:`, err instanceof Error ? err.stack : err);
    }
  } catch (err) {
    console.error(`[paypal][capture] Erreur inattendue — orderId=${orderId}:`, err instanceof Error ? err.stack : err);
    res.redirect(`${safeFrontendUrl}/commande/annulation?orderId=${orderId}&error=internal_error`);
  }
});
