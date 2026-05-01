import { Router, Request, Response } from "express";
import { prisma } from "../utils/prisma";
import { assertSupportedPaymentMethod, getPaymentProvider, PaymentMethod, PaymentProvider } from "../services/paymentRouter";

export const checkoutRouter = Router();

type CheckoutCartItem = {
  productId: string;
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
  cardCountry?: string;
  isB2B?: boolean;
};

const CURRENCY = "EUR";
const VAT_RATE = 20;
const SHIPPING_PRICE = 5.9;
const FREE_SHIPPING_THRESHOLD = 49;

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
  return process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "http://localhost:3000";
}

function getBackendUrl(req: Request): string {
  return process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`;
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

async function createMollieCheckout(params: { orderId: string; orderNumber: string; totalTTC: number; frontendUrl: string; backendUrl: string }) {
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
      locale: "fr_FR",
      method: ["creditcard", "bancontact", "ideal", "paypal", "klarna"],
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

async function createPaypalCheckout(params: { orderId: string; totalTTC: number; frontendUrl: string }) {
  const baseUrl = process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const accessToken = await getPaypalAccessToken();
  const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: params.orderId,
          amount: { currency_code: CURRENCY, value: params.totalTTC.toFixed(2) },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
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

async function createFintectureCheckout(params: { orderId: string; orderNumber: string; totalTTC: number; frontendUrl: string }) {
  const baseUrl = process.env.FINTECTURE_ENV === "live" ? "https://api.fintechture.com" : "https://api-sandbox.fintechture.com";
  const response = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "App-Id": requireEnv("FINTECTURE_APP_ID"),
      "App-Secret": requireEnv("FINTECTURE_APP_SECRET"),
    },
    body: JSON.stringify({
      amount: params.totalTTC,
      currency: CURRENCY,
      communication: `Commande BP #${params.orderNumber}`,
      redirect_uri: `${params.frontendUrl}/commande/succes?orderId=${params.orderId}`,
      origin_uri: `${params.frontendUrl}/panier`,
      metadata: { orderId: params.orderId },
    }),
  });
  const session = await parseJsonResponse<{ id?: string; meta?: { url?: string }; url?: string }>(response, "fintecture");
  return { providerPaymentId: session.id || params.orderId, checkoutUrl: session.meta?.url || session.url };
}

async function createGoCardlessCheckout(params: { orderId: string; orderNumber: string; totalTTC: number; frontendUrl: string }) {
  const baseUrl = process.env.GOCARDLESS_ENV === "live" ? "https://api.gocardless.com" : "https://api-sandbox.gocardless.com";
  const headers = {
    Authorization: `Bearer ${requireEnv("GOCARDLESS_ACCESS_TOKEN")}`,
    "Content-Type": "application/json",
    "GoCardless-Version": "2015-07-06",
  };
  const billingRequestResponse = await fetch(`${baseUrl}/billing_requests`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      billing_requests: {
        payment_request: {
          amount: Math.round(params.totalTTC * 100),
          currency: CURRENCY,
          description: `Commande BP #${params.orderNumber}`,
        },
        metadata: { orderId: params.orderId },
      },
    }),
  });
  const billingRequest = await parseJsonResponse<{ billing_requests: { id: string } }>(billingRequestResponse, "gocardless");
  const flowResponse = await fetch(`${baseUrl}/billing_request_flows`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      billing_request_flows: {
        redirect_uri: `${params.frontendUrl}/commande/succes?orderId=${params.orderId}`,
        links: { billing_request: billingRequest.billing_requests.id },
      },
    }),
  });
  const flow = await parseJsonResponse<{ billing_request_flows: { id: string; authorisation_url?: string } }>(flowResponse, "gocardless");
  return { providerPaymentId: flow.billing_request_flows.id, checkoutUrl: flow.billing_request_flows.authorisation_url };
}

async function createCheckoutComSession(params: { orderId: string; totalTTC: number; frontendUrl: string }) {
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
    }),
  });
  const session = await parseJsonResponse<{ id?: string; url?: string; _links?: { redirect?: { href?: string } } }>(response, "checkout");
  return { providerPaymentId: session.id || params.orderId, checkoutUrl: session.url || session._links?.redirect?.href };
}

async function createProviderCheckout(provider: PaymentProvider, params: { orderId: string; orderNumber: string; totalTTC: number; frontendUrl: string; backendUrl: string }) {
  if (provider === "mollie") return createMollieCheckout(params);
  if (provider === "paypal") return createPaypalCheckout(params);
  if (provider === "fintecture") return createFintectureCheckout(params);
  if (provider === "gocardless") return createGoCardlessCheckout(params);
  return createCheckoutComSession(params);
}

checkoutRouter.post("/initiate", async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as CheckoutRequestBody;
    assertSupportedPaymentMethod(body.paymentMethod);

    if (!body.customerEmail || !Array.isArray(body.cartItems) || body.cartItems.length === 0) {
      res.status(400).json({ error: "Email client et panier requis" });
      return;
    }

    if (body.paymentMethod === "sepa_debit" && !body.isB2B) {
      res.status(400).json({ error: "Le prélèvement SEPA est réservé aux clients professionnels" });
      return;
    }

    const shippingAddress = body.shippingAddress;
    if (!shippingAddress?.firstName || !shippingAddress?.lastName || !shippingAddress?.address || !shippingAddress?.city || !shippingAddress?.postalCode) {
      res.status(400).json({ error: "Adresse de livraison incomplète" });
      return;
    }

    const orderItems = [];
    let subtotalTTC = 0;
    for (const item of body.cartItems) {
      if (!item.productId || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        res.status(400).json({ error: "Article de panier invalide" });
        return;
      }
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product || product.status !== "active" || !product.inStock) {
        res.status(400).json({ error: `Produit indisponible : ${item.productId}` });
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
    const shipping = subtotalTTC >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_PRICE;
    const totalTTC = money(subtotalTTC + shipping);
    const totalHT = money(totalTTC / (1 + VAT_RATE / 100));
    const vatAmount = money(totalTTC - totalHT);
    const provider = getPaymentProvider({ method: body.paymentMethod, cardCountry: body.cardCountry, isB2B: body.isB2B });

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        email: body.customerEmail,
        customerEmail: body.customerEmail,
        customerId: body.customerId || null,
        status: "pending_payment",
        paymentMethod: body.paymentMethod,
        paymentProvider: provider,
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
            country: shippingAddress.country || "France",
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
