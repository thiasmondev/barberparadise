import { Router, Request, Response } from "express";
import { prisma } from "../utils/prisma";
import { formatPaymentMethod, getCustomerName, sendOrderConfirmationEmail } from "../services/emailService";
import { ensureProInvoiceForOrder } from "../services/proInvoiceService";
import { ensureB2CInvoiceForOrder, generateB2CInvoicePdfBuffer } from "../services/b2cInvoiceService";
import promotionService from "../services/promotionService";
import { notifyAdminNewOrder } from "../services/adminNotificationService";

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

export async function markOrderPaidFromCapture(orderId: string, provider: WebhookProvider, providerPaymentId?: string): Promise<{ changed: boolean; channel: string | null }> {
  return markOrderPaid(orderId, provider, providerPaymentId);
}

export async function runPostPaymentEffectsFromCapture(orderId: string, orderNumber: string, channel: string | null, changed: boolean): Promise<void> {
  return runPostPaymentEffects(orderId, orderNumber, channel, changed);
}

async function markOrderCanceled(orderId: string, providerPaymentId?: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true, providerPaymentId: true, orderNumber: true } });
  if (!order) return;
  
  // Règle 1: Ne jamais écraser une commande déjà payée, expédiée, livrée ou remboursée
  if (["paid", "processing", "shipped", "delivered", "refunded", "partially_refunded"].includes(order.status)) {
    console.log(`[webhook] markOrderCanceled IGNORÉ — Commande ${order.orderNumber} est déjà au statut '${order.status}' (paymentId reçu: ${providerPaymentId}, paymentId actif: ${order.providerPaymentId})`);
    return;
  }

  // Règle 2: Ne traiter l'annulation que si le webhook concerne le dernier paiement initié (ou si aucun n'est stocké)
  if (providerPaymentId && order.providerPaymentId && providerPaymentId !== order.providerPaymentId) {
    console.log(`[webhook] markOrderCanceled IGNORÉ — Le paymentId reçu (${providerPaymentId}) ne correspond pas au paymentId actif de la commande (${order.providerPaymentId})`);
    return;
  }

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
          // Vérification atomique anti-race-condition : si le stock est insuffisant au moment
          // de la décrémentation, on log l'anomalie mais on ne bloque pas (le paiement est déjà confirmé)
          if (variant.stock < item.quantity) {
            console.warn(`[stock] Race condition détectée : commande ${orderId}, variante ${item.variantId}, stock=${variant.stock}, qté=${item.quantity}`);
          }
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
          // Initialiser paidAmount au total de la commande lors du premier paiement
          paidAmount: order.totalTTC || order.total || 0,
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

async function sendOrderPaidEmail(orderId: string, orderNumber: string, invoiceAttachment?: { filename: string; content: string } | null): Promise<void> {
  console.log(`[email] Chargement commande pour email confirmation — orderId=${orderId} orderNumber=${orderNumber}`);
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, shippingAddress: true, customer: true },
  });
  if (!order?.email) {
    console.warn(`[email] Pas d'adresse email pour la commande ${orderNumber} — email non envoyé`);
    return;
  }

  console.log(`[email] Envoi confirmation pour ${orderNumber} → ${order.email} (pièce jointe: ${invoiceAttachment ? invoiceAttachment.filename : "aucune"})`);
  const result = await sendOrderConfirmationEmail({
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
    relayPointId: order.relayPointId || null,
    relayPointName: order.relayPointName || null,
    relayPointAddress: order.relayPointAddress || null,
    attachments: invoiceAttachment ? [invoiceAttachment] : undefined,
  });
  console.log(`[email] Résultat envoi confirmation ${orderNumber}: sent=${result.sent} provider=${result.provider || "?"} id=${result.id || "?"}`);
}

async function generateB2CInvoiceAttachment(orderId: string, orderNumber: string): Promise<{ filename: string; content: string } | null> {
  try {
    console.log(`[invoice] Génération facture B2C pour ${orderNumber} — orderId=${orderId}`);
    const invoice = await ensureB2CInvoiceForOrder(orderId);
    if (!invoice) {
      console.log(`[invoice] Pas de facture B2C générée pour ${orderNumber} (commande B2B ou non éligible)`);
      return null;
    }

    const pdfBuffer = invoice.pdfBuffer ?? await generateB2CInvoicePdfBuffer(orderId, invoice.invoiceNumber);
    if (!pdfBuffer) {
      console.warn(`[invoice] PDF facture B2C introuvable pour la pièce jointe — orderId=${orderId} invoiceNumber=${invoice.invoiceNumber}`);
      return null;
    }

    console.log(`[invoice] Facture B2C prête — ${invoice.invoiceNumber} (${pdfBuffer.length} bytes)`);
    return {
      filename: `${invoice.invoiceNumber}.pdf`,
      content: pdfBuffer.toString("base64"),
    };
  } catch (err) {
    console.error(`[invoice] Erreur génération facture B2C pour ${orderNumber}:`, err instanceof Error ? err.message : err);
    return null; // Ne pas bloquer l'email de confirmation si la facture échoue
  }
}

async function runPostPaymentEffects(orderId: string, orderNumber: string, channel: string | null, changed: boolean): Promise<void> {
  // "pos" = vente en caisse, pas d'email de confirmation e-commerce
  // Mais on génère quand même la facture (B2C ou B2B)
  if (channel === "pos") {
    console.log(`[webhook] Commande POS ${orderNumber} — génération facture POS (pas d'email e-commerce)`);
    try {
      const posOrder = await prisma.order.findUnique({ where: { id: orderId }, select: { isB2B: true } });
      if (posOrder?.isB2B) {
        await ensureProInvoiceForOrder(orderId, { sendInvoiceEmail: false });
        console.log(`[webhook][POS] Facture B2B générée — ${orderNumber}`);
      } else {
        await ensureB2CInvoiceForOrder(orderId);
        console.log(`[webhook][POS] Facture B2C générée — ${orderNumber}`);
      }
    } catch (invoiceErr) {
      console.error(`[webhook][POS] Erreur génération facture pour ${orderNumber}:`, invoiceErr instanceof Error ? invoiceErr.message : invoiceErr);
    }
    return;
  }

  console.log(`[webhook] runPostPaymentEffects — orderId=${orderId} orderNumber=${orderNumber} channel=${channel} changed=${changed}`);

  // Génération facture B2C (non bloquante — erreur loggée mais ne bloque pas l'email)
  const invoiceAttachment = await generateB2CInvoiceAttachment(orderId, orderNumber);

  // N'envoyer l'email de confirmation et les notifications que si le statut vient de changer
  if (changed) {
    // Enregistrement de l'usage de la promotion
    try {
      await recordPromotionUsageForPaidOrder(orderId);
    } catch (err) {
      console.error(`[webhook] Erreur enregistrement promotion pour ${orderNumber}:`, err instanceof Error ? err.message : err);
    }

    // Email de confirmation client
    try {
      await sendOrderPaidEmail(orderId, orderNumber, invoiceAttachment);
    } catch (err) {
      console.error(`[email] Erreur envoi confirmation pour ${orderNumber}:`, err instanceof Error ? err.message : err);
    }

    // Notification admin (email + Telegram) — non bloquant
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true, customer: true },
      });
      if (order) {
        void notifyAdminNewOrder({
          orderId: order.id,
          orderNumber: order.orderNumber,
          createdAt: order.createdAt,
          customerName: getCustomerName(order.customer, order.email),
          customerEmail: order.email || order.customerEmail || "",
          isB2B: order.isB2B,
          items: order.items.map((item: { name: string; quantity: number }) => ({
            name: item.name,
            quantity: item.quantity,
          })),
          totalTTC: order.total,
          paymentMethod: order.paymentMethod,
        });
      }
    } catch (err) {
      console.error(`[webhook] Erreur notification admin pour ${orderNumber}:`, err instanceof Error ? err.message : err);
    }
  } else {
    console.log(`[webhook] Commande ${orderNumber} déjà payée — email de confirmation non renvoyé (idempotence)`);
  }

  // Toujours s'assurer que la facture pro est générée (idempotente)
  try {
    await ensureProInvoiceForOrder(orderId);
  } catch (err) {
    console.error(`[invoice] Erreur génération facture pro pour ${orderNumber}:`, err instanceof Error ? err.message : err);
  }
}

async function findOrderIdByProviderPaymentId(providerPaymentId: string): Promise<string | null> {
  const order = await prisma.order.findFirst({ where: { providerPaymentId }, select: { id: true } });
  return order?.id || null;
}

webhooksRouter.post("/mollie", async (req: Request, res: Response): Promise<void> => {
  const paymentId = req.body?.id;
  console.log(`[webhook][mollie] Réception — paymentId=${paymentId}`);

  if (!paymentId) {
    res.status(400).json({ error: "Identifiant paiement Mollie manquant" });
    return;
  }

  // Étape 1 : Vérifier le paiement auprès de Mollie
  let payment: { id: string; status?: string; metadata?: { orderId?: string }; orderNumber?: string };
  try {
    const response = await fetch(`https://api.mollie.com/v2/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${requireEnv("MOLLIE_API_KEY")}` },
    });
    payment = (await response.json()) as { id: string; status?: string; metadata?: { orderId?: string } };
    if (!response.ok) {
      console.error(`[webhook][mollie] Vérification paiement échouée — paymentId=${paymentId} status=${response.status}`);
      res.status(401).json({ error: "Webhook Mollie non vérifié" });
      return;
    }
    console.log(`[webhook][mollie] Paiement vérifié — paymentId=${paymentId} status=${payment.status} orderId=${payment.metadata?.orderId || "via lookup"}`);
  } catch (err) {
    console.error(`[webhook][mollie] Erreur appel API Mollie — paymentId=${paymentId}:`, err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Erreur vérification paiement Mollie" });
    return;
  }

  // Étape 2 : Trouver la commande
  const orderId = payment.metadata?.orderId || (await findOrderIdByProviderPaymentId(payment.id));
  const isComplement = (payment as { metadata?: { orderId?: string; type?: string } }).metadata?.type === "complement";

  if (payment.status === "paid" && orderId && isComplement) {
    // ── Paiement COMPLÉMENTAIRE confirmé ──────────────────────────────────────
    // Mettre à jour paidAmount et effacer le complément en attente
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { orderNumber: true, paidAmount: true, pendingComplementAmount: true, pendingComplementPaymentId: true, notes: true },
      });
      if (!order) throw new Error(`Commande introuvable : ${orderId}`);

      // Vérifier que le paymentId correspond bien au complément en attente
      if (order.pendingComplementPaymentId !== payment.id) {
        console.warn(`[webhook][mollie] Complément IGNORÉ — paymentId=${payment.id} ne correspond pas au complément en attente (${order.pendingComplementPaymentId}) pour commande ${order.orderNumber}`);
        res.json({ received: true });
        return;
      }

      const newPaidAmount = (order.paidAmount || 0) + (order.pendingComplementAmount || 0);
      const complementNote = `[Complément de paiement confirmé — ${new Date().toLocaleDateString("fr-FR")} — +${(order.pendingComplementAmount || 0).toFixed(2)}€ — Total payé : ${newPaidAmount.toFixed(2)}€]`;
      await prisma.order.update({
        where: { id: orderId },
        data: {
          paidAmount: newPaidAmount,
          pendingComplementAmount: null,
          pendingComplementPaymentId: null,
          notes: order.notes ? `${order.notes}\n${complementNote}` : complementNote,
        },
      });
      console.log(`[webhook][mollie] Complément confirmé — orderId=${orderId} orderNumber=${order.orderNumber} +${order.pendingComplementAmount}€ → paidAmount=${newPaidAmount}€`);
    } catch (err) {
      console.error(`[webhook][mollie] Erreur traitement complément — orderId=${orderId}:`, err instanceof Error ? err.stack : err);
      res.status(500).json({ error: "Erreur traitement complément de paiement" });
      return;
    }
    res.json({ received: true });
    return;
  }

  if (payment.status === "paid" && orderId) {
    // ── Paiement INITIAL ──────────────────────────────────────────────────────
    // Vérification de sécurité: le paymentId du webhook correspond-il à la commande ?
    const orderRef = await prisma.order.findUnique({ where: { id: orderId }, select: { providerPaymentId: true, orderNumber: true } });
    if (orderRef && orderRef.providerPaymentId && orderRef.providerPaymentId !== payment.id) {
      console.log(`[webhook][mollie] Paiement 'paid' IGNORÉ — Le paymentId reçu (${payment.id}) ne correspond pas au paymentId actif de la commande ${orderRef.orderNumber} (${orderRef.providerPaymentId})`);
      res.json({ received: true });
      return;
    }

    // Étape 3 : Marquer comme payé (critique — si ça échoue, renvoyer 500 pour que Mollie retente)
    let result: { changed: boolean; channel: string | null };
    let orderNumber = orderId;
    try {
      result = await markOrderPaid(orderId, "mollie", payment.id);
      // Récupérer le orderNumber pour les logs
      const orderRef = await prisma.order.findUnique({ where: { id: orderId }, select: { orderNumber: true } });
      orderNumber = orderRef?.orderNumber || orderId;
      console.log(`[webhook][mollie] Commande marquée payée — orderId=${orderId} orderNumber=${orderNumber} changed=${result.changed} channel=${result.channel}`);
    } catch (err) {
      console.error(`[webhook][mollie] Erreur critique markOrderPaid — orderId=${orderId}:`, err instanceof Error ? err.stack : err);
      res.status(500).json({ error: "Erreur marquage commande payée" });
      return;
    }

    // Étape 4 : Répondre 200 à Mollie IMMÉDIATEMENT (avant les effets secondaires)
    res.json({ received: true });

    // Étape 5 : Effets secondaires (facture, email, notification) — non bloquants pour Mollie
    try {
      await runPostPaymentEffects(orderId, orderNumber, result.channel, result.changed);
    } catch (err) {
      // Ne jamais laisser une erreur ici remonter — Mollie a déjà reçu son 200
      console.error(`[webhook][mollie] Erreur runPostPaymentEffects — orderId=${orderId} orderNumber=${orderNumber}:`, err instanceof Error ? err.stack : err);
    }
    return;
  }

  if (["failed", "canceled", "expired"].includes(payment.status || "") && orderId) {
    try {
      await markOrderCanceled(orderId, payment.id);
      console.log(`[webhook][mollie] Commande annulée — orderId=${orderId} status=${payment.status}`);
    } catch (err) {
      console.error(`[webhook][mollie] Erreur markOrderCanceled — orderId=${orderId}:`, err instanceof Error ? err.message : err);
    }
  }

  res.json({ received: true });
});

webhooksRouter.post("/paypal", async (req: Request, res: Response): Promise<void> => {
  const eventType = req.body?.event_type;
  console.log(`[webhook][paypal] Réception — eventType=${eventType}`);

  try {
    if (!(await verifyPaypalSignature(req))) {
      console.warn(`[webhook][paypal] Signature invalide — eventType=${eventType}`);
      res.status(401).json({ error: "Signature PayPal invalide" });
      return;
    }
  } catch (err) {
    console.error(`[webhook][paypal] Erreur vérification signature:`, err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Erreur vérification signature PayPal" });
    return;
  }

  const resource = req.body?.resource;
  const orderId = resource?.supplementary_data?.related_ids?.order_id
    ? await findOrderIdByProviderPaymentId(resource.supplementary_data.related_ids.order_id)
    : resource?.custom_id || resource?.invoice_id || resource?.purchase_units?.[0]?.reference_id;

  if (eventType === "PAYMENT.CAPTURE.COMPLETED" && orderId) {
    // Étape 3 : Marquer comme payé
    let result: { changed: boolean; channel: string | null };
    let orderNumber = orderId;
    try {
      result = await markOrderPaid(orderId, "paypal", resource?.id || resource?.supplementary_data?.related_ids?.order_id);
      const orderRef = await prisma.order.findUnique({ where: { id: orderId }, select: { orderNumber: true } });
      orderNumber = orderRef?.orderNumber || orderId;
      console.log(`[webhook][paypal] Commande marquée payée — orderId=${orderId} orderNumber=${orderNumber} changed=${result.changed} channel=${result.channel}`);
    } catch (err) {
      console.error(`[webhook][paypal] Erreur critique markOrderPaid — orderId=${orderId}:`, err instanceof Error ? err.stack : err);
      res.status(500).json({ error: "Erreur marquage commande payée" });
      return;
    }

    // Répondre 200 à PayPal IMMÉDIATEMENT
    res.json({ received: true });

    // Effets secondaires non bloquants
    try {
      await runPostPaymentEffects(orderId, orderNumber, result.channel, result.changed);
    } catch (err) {
      console.error(`[webhook][paypal] Erreur runPostPaymentEffects — orderId=${orderId} orderNumber=${orderNumber}:`, err instanceof Error ? err.stack : err);
    }
    return;
  }

  res.json({ received: true });
});
