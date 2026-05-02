import { Router, Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "../utils/prisma";
import { formatPaymentMethod, getCustomerName, sendOrderConfirmationEmail } from "../services/emailService";

export const webhooksRouter = Router();

type WebhookProvider = "mollie" | "paypal" | "checkout";

function timingSafeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function verifyHmacSignature(payload: unknown, signature: string | undefined, secret: string | undefined): boolean {
  if (!signature || !secret) return false;
  const body = JSON.stringify(payload);
  const hex = crypto.createHmac("sha256", secret).update(body).digest("hex");
  const base64 = crypto.createHmac("sha256", secret).update(body).digest("base64");
  const normalized = signature.replace(/^sha256=/, "");
  return timingSafeEqual(normalized, hex) || timingSafeEqual(normalized, base64);
}

function getHeader(req: Request, names: string[]): string | undefined {
  for (const name of names) {
    const value = req.get(name);
    if (value) return value;
  }
  return undefined;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
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
  const data = (await response.json()) as { access_token?: string };
  if (!response.ok || !data.access_token) throw new Error("Impossible d'obtenir un jeton PayPal");
  return data.access_token;
}

async function verifyPaypalSignature(req: Request): Promise<boolean> {
  const baseUrl = process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const transmissionId = req.get("paypal-transmission-id");
  const transmissionTime = req.get("paypal-transmission-time");
  const certUrl = req.get("paypal-cert-url");
  const authAlgo = req.get("paypal-auth-algo");
  const transmissionSig = req.get("paypal-transmission-sig");
  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig || !process.env.PAYPAL_WEBHOOK_ID) return false;

  const accessToken = await getPaypalAccessToken();
  const response = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: process.env.PAYPAL_WEBHOOK_ID,
      webhook_event: req.body,
    }),
  });
  const data = (await response.json()) as { verification_status?: string };
  return response.ok && data.verification_status === "SUCCESS";
}

async function markOrderCanceled(orderId: string, providerPaymentId?: string): Promise<void> {
  await prisma.order.update({
    where: { id: orderId },
    data: { status: "canceled", providerPaymentId },
  });
}

async function markOrderPaid(orderId: string, provider: WebhookProvider, providerPaymentId?: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) throw new Error(`Commande introuvable : ${orderId}`);
    if (order.status === "paid" || order.status === "processing") return false;

    for (const item of order.items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product) continue;
      const nextStock = Math.max(0, product.stockCount - item.quantity);
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stockCount: nextStock,
          inStock: nextStock > 0,
        },
      });
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "paid",
        paymentProvider: provider,
        providerPaymentId: providerPaymentId || order.providerPaymentId,
      },
    });

    return true;
  });
}

async function sendOrderPaidEmail(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, shippingAddress: true, customer: true },
  });
  if (!order?.email) return;

  await sendOrderConfirmationEmail({
    to: order.email,
    orderNumber: order.orderNumber,
    customerName: getCustomerName(order.customer, order.email),
    items: order.items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      image: item.image,
    })),
    totalHT: order.totalHT || order.subtotal,
    vatAmount: order.vatAmount,
    vatRate: order.vatRate,
    vatNumber: order.vatNumber,
    isB2B: order.isB2B,
    totalTTC: order.total,
    shippingCost: order.shipping,
    shippingAddress: order.shippingAddress,
    paymentMethod: formatPaymentMethod(order.paymentMethod),
  });
}

async function findOrderIdByProviderPaymentId(providerPaymentId: string): Promise<string | null> {
  const order = await prisma.order.findFirst({ where: { providerPaymentId }, select: { id: true } });
  return order?.id || null;
}

webhooksRouter.post("/mollie", async (req: Request, res: Response): Promise<void> => {
  try {
    const paymentId = req.body?.id;
    if (!paymentId) {
      res.status(400).json({ error: "Identifiant paiement Mollie manquant" });
      return;
    }

    const response = await fetch(`https://api.mollie.com/v2/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${requireEnv("MOLLIE_API_KEY")}` },
    });
    const payment = (await response.json()) as { id: string; status?: string; metadata?: { orderId?: string } };
    if (!response.ok) {
      res.status(401).json({ error: "Webhook Mollie non vérifié" });
      return;
    }

    const orderId = payment.metadata?.orderId || (await findOrderIdByProviderPaymentId(payment.id));
    if (payment.status === "paid" && orderId) {
      const changed = await markOrderPaid(orderId, "mollie", payment.id);
      if (changed) await sendOrderPaidEmail(orderId);
      console.log("Webhook Mollie paid", { orderId, paymentId: payment.id, changed });
    }
    if (["failed", "canceled", "expired"].includes(payment.status || "") && orderId) {
      await markOrderCanceled(orderId, payment.id);
    }
    res.json({ received: true });
  } catch (err) {
    console.error("Erreur webhook Mollie", err);
    res.status(500).json({ error: "Erreur webhook Mollie" });
  }
});

webhooksRouter.post("/paypal", async (req: Request, res: Response): Promise<void> => {
  try {
    if (!(await verifyPaypalSignature(req))) {
      res.status(401).json({ error: "Signature PayPal invalide" });
      return;
    }

    const eventType = req.body?.event_type;
    const resource = req.body?.resource;
    const orderId = resource?.supplementary_data?.related_ids?.order_id
      ? await findOrderIdByProviderPaymentId(resource.supplementary_data.related_ids.order_id)
      : resource?.custom_id || resource?.invoice_id || resource?.purchase_units?.[0]?.reference_id;

    if (eventType === "PAYMENT.CAPTURE.COMPLETED" && orderId) {
      const changed = await markOrderPaid(orderId, "paypal", resource?.id || resource?.supplementary_data?.related_ids?.order_id);
      if (changed) await sendOrderPaidEmail(orderId);
      console.log("Webhook PayPal paid", { orderId, eventType, changed });
    }
    res.json({ received: true });
  } catch (err) {
    console.error("Erreur webhook PayPal", err);
    res.status(500).json({ error: "Erreur webhook PayPal" });
  }
});

webhooksRouter.post("/checkout", async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = getHeader(req, ["cko-signature", "checkout-signature", "x-checkout-signature"]);
    if (!verifyHmacSignature(req.body, signature, process.env.CHECKOUT_WEBHOOK_SECRET)) {
      res.status(401).json({ error: "Signature Checkout.com invalide" });
      return;
    }

    const type = req.body?.type || req.body?.event_type;
    const orderId = req.body?.data?.reference || req.body?.reference;
    if (["payment_approved", "payment_captured", "payment_capture_pending"].includes(type) && orderId) {
      const changed = await markOrderPaid(orderId, "checkout", req.body?.data?.id || req.body?.id);
      if (changed) await sendOrderPaidEmail(orderId);
      console.log("Webhook Checkout.com paid", { orderId, type, changed });
    }
    res.json({ received: true });
  } catch (err) {
    console.error("Erreur webhook Checkout.com", err);
    res.status(500).json({ error: "Erreur webhook Checkout.com" });
  }
});
