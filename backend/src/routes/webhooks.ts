import { Router, Request, Response } from "express";
import { prisma } from "../utils/prisma";
import { formatPaymentMethod, getCustomerName, sendOrderConfirmationEmail } from "../services/emailService";
import { ensureProInvoiceForOrder } from "../services/proInvoiceService";
import { ensureB2CInvoiceForOrder, generateB2CInvoicePdfBuffer } from "../services/b2cInvoiceService";
import promotionService from "../services/promotionService";

export const webhooksRouter = Router();

type WebhookProvider = "mollie" | "paypal";

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
    data: { status: "cancelled", providerPaymentId, posPaymentStatus: "canceled" },
  });
}

async function recordPromotionUsageForPaidOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, promotionId: true, customerId: true, email: true, customerEmail: true, discountAmount: true },
  });
  if (!order?.promotionId || order.discountAmount <= 0) return;
  await promotionService.recordUsage({
    promotionId: order.promotionId,
    orderId: order.id,
    customerId: order.customerId,
    customerEmail: order.customerEmail || order.email,
    discountAmount: order.discountAmount,
  });
}

async function markOrderPaid(orderId: string, provider: WebhookProvider, providerPaymentId?: string): Promise<{ changed: boolean; channel: string | null }> {
  return prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) throw new Error(`Commande introuvable : ${orderId}`);

    const alreadyPaid = ["paid", "processing", "shipped", "delivered"].includes(order.status);

    if (!alreadyPaid) {
      for (const item of order.items) {
        if (!item.productId) continue;

        if (item.variantId) {
          const variant = await tx.productVariant.findUnique({ where: { id: item.variantId } });
          if (!variant) continue;
          const nextVariantStock = Math.max(0, variant.stock - item.quantity);
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: nextVariantStock, inStock: nextVariantStock > 0 },
          });

          const remainingActiveVariants = await tx.productVariant.count({
            where: { productId: item.productId, inStock: true, stock: { gt: 0 } },
          });
          await tx.product.update({
            where: { id: item.productId },
            data: { inStock: remainingActiveVariants > 0 },
          });
          continue;
        }

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
          posPaymentStatus: order.channel === "pos" ? "paid" : order.posPaymentStatus,
          posPaidAt: order.channel === "pos" ? new Date() : order.posPaidAt,
        },
      });

      if (order.channel === "pos" && order.posSessionId) {
        await tx.posSession.update({
          where: { id: order.posSessionId },
          data: {
            totalSales: { increment: order.totalTTC || order.total || 0 },
            totalOrders: { increment: 1 },
          },
        });
      }
    }

    return { changed: !alreadyPaid, channel: order.channel };
  });
}

async function sendOrderPaidEmail(orderId: string, invoiceAttachment?: { filename: string; content: string }): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, shippingAddress: true, customer: true },
  });
  if (!order?.email) return;

  await sendOrderConfirmationEmail({
    to: order.email,
    orderNumber: order.orderNumber,
    customerName: getCustomerName(order.customer, order.email),
    items: order.items.map((item: { name: string; quantity: number; price: number; image: string | null }) => ({
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
    attachments: invoiceAttachment ? [invoiceAttachment] : undefined,
  });
}

async function generateB2CInvoiceAttachment(orderId: string): Promise<{ filename: string; content: string } | undefined> {
  // ensureB2CInvoiceForOrder retourne pdfBuffer uniquement lors de la création.
  // Si la facture existe déjà en base, on re-génère le PDF en mémoire via generateB2CInvoicePdfBuffer.
  const invoice = await ensureB2CInvoiceForOrder(orderId);
  if (!invoice) return undefined;

  const pdfBuffer = invoice.pdfBuffer ?? await generateB2CInvoicePdfBuffer(orderId, invoice.invoiceNumber);
  if (!pdfBuffer) {
    console.warn("[email] PDF facture B2C introuvable pour la pièce jointe", { orderId });
    return undefined;
  }

  return {
    filename: `${invoice.invoiceNumber}.pdf`,
    content: pdfBuffer.toString("base64"),
  };
}

async function runPostPaymentEffects(orderId: string, channel: string | null, changed: boolean): Promise<void> {
  // "pos" = vente en caisse, pas d'email de confirmation e-commerce
  if (channel === "pos") return;

  // Bug fix: channel peut être null pour les anciennes commandes ou "online" pour les nouvelles.
  // On génère la facture B2C pour tout canal non-POS et non-B2B (vérifié dans ensureB2CInvoiceForOrder).
  const invoiceAttachment = await generateB2CInvoiceAttachment(orderId);

  // N'envoyer l'email de confirmation que si le statut vient de changer
  if (changed) {
    await recordPromotionUsageForPaidOrder(orderId);
    await sendOrderPaidEmail(orderId, invoiceAttachment);
  }

  // Toujours s'assurer que la facture pro est générée (idempotente)
  await ensureProInvoiceForOrder(orderId);
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
      const result = await markOrderPaid(orderId, "mollie", payment.id);
      await runPostPaymentEffects(orderId, result.channel, result.changed);
      console.log("Webhook Mollie paid", { orderId, paymentId: payment.id, changed: result.changed, channel: result.channel });
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
      const result = await markOrderPaid(orderId, "paypal", resource?.id || resource?.supplementary_data?.related_ids?.order_id);
      await runPostPaymentEffects(orderId, result.channel, result.changed);
      console.log("Webhook PayPal paid", { orderId, eventType, changed: result.changed, channel: result.channel });
    }
    res.json({ received: true });
  } catch (err) {
    console.error("Erreur webhook PayPal", err);
    res.status(500).json({ error: "Erreur webhook PayPal" });
  }
});
