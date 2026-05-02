import { Router, Request, Response } from "express";
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
import { calculateShippingOptions } from "../services/shippingCalculator";

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
};

const CURRENCY = "EUR";
const VAT_RATE = 20;

function generateOrderNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const rand = Math.floor(Math.random() * 100000).toString().padStart(5, "0");
  return `BP-${year}-${rand}`;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getFrontendUrl(): string {
  return (process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "https://barberparadise.fr").replace(/\/$/, "");
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
  const isB2B = req.query.isB2B === "true";
  const methods = getAvailableMethods(country, isB2B);
  res.json({ methods, country, isB2B });
});

checkoutRouter.get("/shipping-options", (req: Request, res: Response): void => {
  const country = normalizeCountry(typeof req.query.country === "string" ? req.query.country : "FR");
  const totalParam = typeof req.query.total === "string" ? Number(req.query.total) : 0;
  const orderTotal = Number.isFinite(totalParam) ? totalParam : 0;
  const options = calculateShippingOptions(country, orderTotal);
  res.json({ options, country, orderTotal });
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
    const isB2B = Boolean(body.isB2B);
    const allowedMethods = getAvailableMethods(country, isB2B);
    if (!allowedMethods.includes(body.paymentMethod)) {
      res.status(400).json({ error: "Méthode non disponible pour ce pays/profil" });
      return;
    }

    const orderItems = [];
    let subtotalTTC = 0;
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
      subtotalTTC += product.price * item.quantity;
      orderItems.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        image: JSON.parse(product.images || "[]")[0] || "",
      });
    }

    subtotalTTC = money(subtotalTTC);
    const shippingOptions = calculateShippingOptions(country, subtotalTTC);
    const selectedShippingOption = shippingOptions.find((option) => option.id === body.shippingOptionId) || shippingOptions[0];
    if (!selectedShippingOption) {
      res.status(400).json({ error: "Aucune option de livraison disponible pour ce pays" });
      return;
    }
    const shipping = selectedShippingOption.price;
    const totalTTC = money(subtotalTTC + shipping);
    const totalHT = money(totalTTC / (1 + VAT_RATE / 100));
    const vatAmount = money(totalTTC - totalHT);
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
        subtotal: subtotalTTC,
        shipping,
        total: totalTTC,
        totalHT,
        vatRate: VAT_RATE,
        vatAmount,
        totalTTC,
        currency: CURRENCY,
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

    res.status(201).json({ orderId: order.id, orderNumber: order.orderNumber, checkoutUrl: checkout.checkoutUrl, provider });
  } catch (err) {
    console.error("Erreur initialisation checkout", err);
    const message = err instanceof Error ? err.message : "Erreur initialisation paiement";
    const status = message.includes("Variable d'environnement manquante") ? 503 : 500;
    res.status(status).json({ error: message });
  }
});
