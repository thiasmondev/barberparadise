import { Router, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { requireAdmin, AuthRequest } from "../middleware/auth";
import { prisma } from "../utils/prisma";
import {
  buildShipmentQuotes,
  createOfficialShipmentLabel,
  LOGISTICS_CARRIERS,
  LogisticsCarrier,
  ShipmentAddress,
} from "../services/logisticsCarrierService";
import { sendEmail } from "../services/emailService";
import {
  cancelOrderExchange,
  completeOrderExchange,
  initiateOrderExchange,
  markOrderExchangeReplacementShipped,
  markOrderExchangeReturnReceived,
  recordOrderExchangeRealRefund,
  registerOrderExchangeSettlementPayment,
  settleOrderExchangeInternally,
} from "../services/orderExchangeService";

export const orderExchangesRouter = Router();

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const activeCarrier = (value: unknown): value is LogisticsCarrier =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(LOGISTICS_CARRIERS, value);

function sendError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : "Erreur lors du traitement de l’échange.";
  res.status(400).json({ error: message });
}

function companyAddress(): ShipmentAddress {
  return {
    firstName: "Barber",
    lastName: "Paradise",
    companyName: process.env.LOGISTICS_SENDER_COMPANY || "Barber Paradise",
    address: process.env.LOGISTICS_SENDER_ADDRESS || "",
    extension: process.env.LOGISTICS_SENDER_ADDRESS_2 || "",
    postalCode: process.env.LOGISTICS_SENDER_POSTAL_CODE || "",
    city: process.env.LOGISTICS_SENDER_CITY || "",
    country: "France",
    phone: process.env.LOGISTICS_SENDER_PHONE || "",
    email: process.env.LOGISTICS_SENDER_EMAIL || "contact@barberparadise.fr",
  };
}

function shippingAddressToLabel(address: {
  firstName: string;
  lastName: string;
  address: string;
  extension: string | null;
  postalCode: string;
  city: string;
  country: string;
  phone: string | null;
}, email: string): ShipmentAddress {
  return {
    firstName: address.firstName,
    lastName: address.lastName,
    address: address.address,
    extension: address.extension,
    postalCode: address.postalCode,
    city: address.city,
    country: address.country,
    phone: address.phone,
    email,
  };
}

function exchangeHtml(title: string, content: string) {
  return `<!doctype html><html lang="fr"><body style="font-family:Arial,sans-serif;color:#202020;line-height:1.5"><h1 style="font-size:20px">${title}</h1>${content}<p>Barber Paradise</p></body></html>`;
}

async function getExchange(id: string) {
  return prisma.orderExchange.findUnique({
    where: { id },
    include: {
      order: { include: { shippingAddress: true, customer: true } },
      returnProduct: true,
      returnVariant: true,
      replacementProduct: true,
      replacementVariant: true,
      shipments: true,
      events: { orderBy: { createdAt: "asc" } },
    },
  });
}

async function createExchangeShipmentLabel(params: {
  exchangeId: string;
  direction: "return" | "replacement";
  carrier: LogisticsCarrier;
  offerId: string;
  relayPointId?: string | null;
  insuranceValueCents?: number;
  totalWeightG: number;
  orderValue: number;
  recipient: ShipmentAddress;
  sender?: ShipmentAddress | null;
  orderNumber: string;
  customerEmail: string;
  actorEmail?: string | null;
}) {
  const result = await createOfficialShipmentLabel({
    carrier: params.carrier,
    offerId: params.offerId,
    insuranceValueCents: Math.max(0, params.insuranceValueCents || 0),
    relayPointId: params.relayPointId || null,
    orderNumber: params.orderNumber,
    customerEmail: params.customerEmail,
    recipient: params.recipient,
    sender: params.sender || null,
    totalWeightG: Math.max(100, params.totalWeightG),
    orderValueCents: Math.max(0, Math.round(params.orderValue * 100)),
  });

  const shipment = await prisma.orderExchangeShipment.upsert({
    where: { exchangeId_direction: { exchangeId: params.exchangeId, direction: params.direction } },
    create: {
      exchangeId: params.exchangeId,
      direction: params.direction,
      carrier: params.carrier,
      carrierShipmentId: result.carrierShipmentId,
      trackingNumber: result.trackingNumber,
      trackingUrl: result.trackingUrl,
      totalWeightG: Math.max(100, params.totalWeightG),
      offerId: result.offerId,
      serviceCode: result.serviceCode,
      deliveryMode: result.deliveryMode,
      relayPointId: result.relayPointId,
      labelPriceCents: result.priceCents,
      labelCurrency: result.currency,
      insuranceValueCents: result.insuranceValueCents,
      labelPdfBase64: result.labelPdfBase64,
      labelFormat: result.labelFormat,
      labelSource: result.labelSource,
      labelStatus: result.labelStatus,
      labelGeneratedAt: result.labelGeneratedAt,
      carrierRawResponse: result.rawResponse as Prisma.InputJsonValue | undefined,
      lastTrackingStatus: "Étiquette créée",
      shippedBy: params.actorEmail || null,
    },
    update: {
      carrier: params.carrier,
      carrierShipmentId: result.carrierShipmentId,
      trackingNumber: result.trackingNumber,
      trackingUrl: result.trackingUrl,
      totalWeightG: Math.max(100, params.totalWeightG),
      offerId: result.offerId,
      serviceCode: result.serviceCode,
      deliveryMode: result.deliveryMode,
      relayPointId: result.relayPointId,
      labelPriceCents: result.priceCents,
      labelCurrency: result.currency,
      insuranceValueCents: result.insuranceValueCents,
      labelPdfBase64: result.labelPdfBase64,
      labelFormat: result.labelFormat,
      labelSource: result.labelSource,
      labelStatus: result.labelStatus,
      labelGeneratedAt: result.labelGeneratedAt,
      carrierRawResponse: result.rawResponse as Prisma.InputJsonValue | undefined,
      lastTrackingStatus: "Étiquette créée",
      shippedBy: params.actorEmail || null,
    },
  });

  await prisma.orderExchangeEvent.create({
    data: {
      exchangeId: params.exchangeId,
      type: `${params.direction}_label_created`,
      message: `Étiquette ${params.direction === "return" ? "de retour" : "de remplacement"} créée — ${LOGISTICS_CARRIERS[params.carrier]} · suivi ${result.trackingNumber}.`,
      actorEmail: params.actorEmail || null,
      metadata: { shipmentId: shipment.id, trackingNumber: result.trackingNumber, carrier: params.carrier },
    },
  });

  return { shipment, result };
}

// GET /api/admin/exchanges/orders/:orderId
orderExchangesRouter.get("/orders/:orderId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const exchanges = await prisma.orderExchange.findMany({
    where: { orderId: req.params.orderId },
    include: { shipments: true, events: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ exchanges });
});

// POST /api/admin/exchanges/orders/:orderId
orderExchangesRouter.post("/orders/:orderId", requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const exchange = await initiateOrderExchange({
      orderId: req.params.orderId,
      returnedOrderItemId: String(req.body?.returnedOrderItemId || ""),
      quantity: Number(req.body?.quantity || 0),
      replacementProductId: String(req.body?.replacementProductId || ""),
      replacementVariantId: req.body?.replacementVariantId ? String(req.body.replacementVariantId) : null,
      notes: typeof req.body?.notes === "string" ? req.body.notes : null,
      actorEmail: req.user?.email || null,
    });
    res.status(201).json({ exchange });
  } catch (error) {
    sendError(res, error);
  }
});

// GET /api/admin/exchanges/:exchangeId
orderExchangesRouter.get("/:exchangeId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const exchange = await getExchange(req.params.exchangeId);
  if (!exchange) {
    res.status(404).json({ error: "Dossier d’échange introuvable." });
    return;
  }
  res.json({ exchange });
});

// GET /api/admin/exchanges/:exchangeId/:direction/quotes
orderExchangesRouter.get("/:exchangeId/:direction/quotes", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const direction = req.params.direction;
    if (direction !== "return" && direction !== "replacement") throw new Error("Direction d’étiquette invalide.");
    const exchange = await getExchange(req.params.exchangeId);
    if (!exchange?.order.shippingAddress) throw new Error("Adresse d’expédition introuvable.");
    if (direction === "return" && !["initiated", "return_in_transit"].includes(exchange.status)) {
      throw new Error("Les offres de retour ne sont plus disponibles à cette étape.");
    }
    if (direction === "replacement" && exchange.status !== "ready_to_ship") {
      throw new Error("Les offres de renvoi ne sont disponibles qu’une fois l’échange prêt à expédier.");
    }

    const isReturn = direction === "return";
    const recipient = isReturn
      ? companyAddress()
      : shippingAddressToLabel(exchange.order.shippingAddress, exchange.order.email);
    const product = isReturn ? exchange.returnProduct : exchange.replacementProduct;
    const quantity = isReturn ? exchange.returnQuantity : exchange.replacementQuantity;
    const value = isReturn ? exchange.returnValue : exchange.replacementValue;
    const totalWeightG = Math.max(100, (product?.weightG || 100) * quantity);
    const quotes = buildShipmentQuotes({
      orderNumber: `${exchange.order.orderNumber}-${isReturn ? "RET" : "ECH"}-${exchange.id.slice(-6)}`,
      customerEmail: exchange.order.email,
      recipient,
      totalWeightG,
      orderValueCents: Math.max(0, Math.round(value * 100)),
    });
    res.json({ quotes, totalWeightG, direction });
  } catch (error) {
    sendError(res, error);
  }
});

// POST /api/admin/exchanges/:exchangeId/return-label
orderExchangesRouter.post("/:exchangeId/return-label", requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const carrier = req.body?.carrier;
    const offerId = String(req.body?.offerId || "").trim();
    if (!activeCarrier(carrier) || !offerId) throw new Error("Transporteur et offre de retour obligatoires.");

    const exchange = await getExchange(req.params.exchangeId);
    if (!exchange?.order.shippingAddress) throw new Error("Adresse client introuvable pour l’étiquette de retour.");
    if (!["initiated", "return_in_transit"].includes(exchange.status)) throw new Error("L’étiquette de retour ne peut être créée qu’au début de l’échange.");

    const customerAddress = shippingAddressToLabel(exchange.order.shippingAddress, exchange.order.email);
    const returnWeight = exchange.returnVariant?.productId === exchange.returnProductId
      ? exchange.returnProduct?.weightG || 100
      : exchange.returnProduct?.weightG || 100;
    const { shipment, result } = await createExchangeShipmentLabel({
      exchangeId: exchange.id,
      direction: "return",
      carrier,
      offerId,
      relayPointId: req.body?.relayPointId ? String(req.body.relayPointId) : null,
      insuranceValueCents: 0,
      totalWeightG: returnWeight,
      orderValue: exchange.returnValue,
      recipient: companyAddress(),
      sender: customerAddress,
      orderNumber: `${exchange.order.orderNumber}-RET-${exchange.id.slice(-6)}`,
      customerEmail: exchange.order.email,
      actorEmail: req.user?.email || null,
    });

    await prisma.orderExchange.update({ where: { id: exchange.id }, data: { status: "return_in_transit" } });
    await sendEmail({
      to: exchange.order.email,
      subject: `Étiquette de retour — échange ${exchange.order.orderNumber}`,
      html: exchangeHtml("Votre retour est prêt", `<p>Nous vous transmettons l’étiquette de retour pour <strong>${exchange.returnName}</strong>.</p><p>Déposez le colis selon les instructions du transporteur. Dès réception et inspection, nous préparerons la suite de votre échange.</p>`),
      attachments: result.labelPdfBase64 ? [{ filename: `retour-${exchange.order.orderNumber}.pdf`, content: result.labelPdfBase64 }] : undefined,
    });
    res.json({ success: true, shipment, downloadUrl: `/api/admin/exchanges/shipments/${shipment.id}/label.pdf` });
  } catch (error) {
    sendError(res, error);
  }
});

// POST /api/admin/exchanges/:exchangeId/return-received
orderExchangesRouter.post("/:exchangeId/return-received", requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const exchange = await markOrderExchangeReturnReceived(req.params.exchangeId, req.user?.email || null);
    const fullExchange = await getExchange(exchange.id);
    if (fullExchange) {
      await sendEmail({
        to: fullExchange.order.email,
        subject: `Retour reçu — échange ${fullExchange.order.orderNumber}`,
        html: exchangeHtml("Votre retour a été reçu", `<p>Nous avons reçu et inspecté <strong>${fullExchange.returnName}</strong>.</p><p>${exchange.status === "ready_to_ship" ? "Votre article de remplacement est en préparation." : "Nous vous contacterons pour finaliser la différence éventuelle avant l’envoi du remplacement."}</p>`),
      });
    }
    res.json({ success: true, exchange });
  } catch (error) {
    sendError(res, error);
  }
});

// POST /api/admin/exchanges/:exchangeId/settlement
orderExchangesRouter.post("/:exchangeId/settlement", requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const mode = String(req.body?.mode || "");
    if (!["real", "internal", "gift"].includes(mode)) throw new Error("Mode de règlement invalide.");
    const exchange = await getExchange(req.params.exchangeId);
    if (!exchange) throw new Error("Dossier d’échange introuvable.");
    if (exchange.status !== "settlement_pending") throw new Error("Le règlement de cet échange n’est pas en attente.");

    if (mode === "internal" || mode === "gift") {
      const updated = await settleOrderExchangeInternally(exchange.id, mode, req.user?.email || null);
      res.json({ success: true, exchange: updated });
      return;
    }

    if (exchange.differenceAmount > 0) {
      // Le complément est une nouvelle opération sécurisée, indépendante du moyen de paiement initial.
      const frontendUrl = process.env.FRONTEND_URL || "https://barberparadise.fr";
      const backendUrl = process.env.BACKEND_URL || "https://api.barberparadise.fr";
      const response = await fetch("https://api.mollie.com/v2/payments", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.MOLLIE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: { currency: exchange.currency, value: money(exchange.differenceAmount).toFixed(2) },
          description: `Règlement d’échange — Commande Barber Paradise #${exchange.order.orderNumber}`,
          redirectUrl: `${frontendUrl}/commande/succes?exchangeId=${exchange.id}`,
          webhookUrl: `${backendUrl}/api/webhooks/mollie`,
          metadata: { exchangeId: exchange.id, type: "exchange_settlement" },
        }),
      });
      if (!response.ok) throw new Error("Impossible de créer le lien de règlement sécurisé pour cet échange.");
      const payment = await response.json() as { id: string; _links?: { checkout?: { href?: string } } };
      const paymentUrl = payment._links?.checkout?.href;
      if (!paymentUrl) throw new Error("Le service de paiement n’a pas retourné de lien de règlement.");
      const updated = await registerOrderExchangeSettlementPayment(exchange.id, payment.id, paymentUrl, req.user?.email || null);
      await sendEmail({
        to: exchange.order.email,
        subject: `Règlement nécessaire — échange ${exchange.order.orderNumber}`,
        html: exchangeHtml("Finaliser votre échange", `<p>Un complément de <strong>${exchange.differenceAmount.toFixed(2)} ${exchange.currency}</strong> est nécessaire avant l’envoi de votre article de remplacement.</p><p><a href="${paymentUrl}">Régler le complément en toute sécurité</a></p>`),
      });
      res.json({ success: true, exchange: updated, paymentUrl });
      return;
    }

    // Différence négative : remboursement réel séparé de la commande mais sur le paiement d’origine.
    if (exchange.order.paymentProvider !== "mollie" || !exchange.order.providerPaymentId) {
      throw new Error("Le remboursement réel automatisé n’est pas disponible pour ce moyen de paiement initial. Utilisez un règlement interne ou un geste commercial.");
    }
    const amount = money(Math.abs(exchange.differenceAmount));
    const refundResponse = await fetch(`https://api.mollie.com/v2/payments/${exchange.order.providerPaymentId}/refunds`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.MOLLIE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: { currency: exchange.currency, value: amount.toFixed(2) } }),
    });
    if (!refundResponse.ok) throw new Error("Le remboursement réel de l’échange a été refusé.");
    const updated = await recordOrderExchangeRealRefund(exchange.id, amount, req.user?.email || null);
    res.json({ success: true, exchange: updated });
  } catch (error) {
    sendError(res, error);
  }
});

// POST /api/admin/exchanges/:exchangeId/replacement-label
orderExchangesRouter.post("/:exchangeId/replacement-label", requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const carrier = req.body?.carrier;
    const offerId = String(req.body?.offerId || "").trim();
    if (!activeCarrier(carrier) || !offerId) throw new Error("Transporteur et offre de remplacement obligatoires.");
    const exchange = await getExchange(req.params.exchangeId);
    if (!exchange?.order.shippingAddress) throw new Error("Adresse client introuvable.");
    if (exchange.status !== "ready_to_ship") throw new Error("Le remplacement n’est pas encore prêt à être expédié.");

    const replacementWeight = exchange.replacementVariant?.productId === exchange.replacementProductId
      ? exchange.replacementProduct.weightG || 100
      : exchange.replacementProduct.weightG || 100;
    const { shipment } = await createExchangeShipmentLabel({
      exchangeId: exchange.id,
      direction: "replacement",
      carrier,
      offerId,
      relayPointId: req.body?.relayPointId ? String(req.body.relayPointId) : null,
      insuranceValueCents: Math.max(0, Math.round(exchange.replacementValue * 100)),
      totalWeightG: replacementWeight,
      orderValue: exchange.replacementValue,
      recipient: shippingAddressToLabel(exchange.order.shippingAddress, exchange.order.email),
      orderNumber: `${exchange.order.orderNumber}-ECH-${exchange.id.slice(-6)}`,
      customerEmail: exchange.order.email,
      actorEmail: req.user?.email || null,
    });
    res.json({ success: true, shipment, downloadUrl: `/api/admin/exchanges/shipments/${shipment.id}/label.pdf` });
  } catch (error) {
    sendError(res, error);
  }
});

// POST /api/admin/exchanges/:exchangeId/replacement-shipped
orderExchangesRouter.post("/:exchangeId/replacement-shipped", requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const fullExchange = await getExchange(req.params.exchangeId);
    if (!fullExchange) throw new Error("Dossier d’échange introuvable.");
    const replacementShipment = fullExchange.shipments.find(shipment => shipment.direction === "replacement");
    if (!replacementShipment?.trackingNumber) throw new Error("Créez d’abord l’étiquette de remplacement.");
    const exchange = await markOrderExchangeReplacementShipped(fullExchange.id, req.user?.email || null);
    await prisma.orderExchangeShipment.update({
      where: { id: replacementShipment.id },
      data: { shippedAt: new Date(), shippedBy: req.user?.email || null, lastTrackingStatus: "Remplacement expédié" },
    });
    await sendEmail({
      to: fullExchange.order.email,
      subject: `Votre remplacement est expédié — échange ${fullExchange.order.orderNumber}`,
      html: exchangeHtml("Votre article de remplacement est expédié", `<p>Votre remplacement <strong>${fullExchange.replacementName}</strong> a été expédié via ${LOGISTICS_CARRIERS[replacementShipment.carrier as LogisticsCarrier]}.</p><p>Numéro de suivi : <strong>${replacementShipment.trackingNumber}</strong></p>${replacementShipment.trackingUrl ? `<p><a href="${replacementShipment.trackingUrl}">Suivre mon colis</a></p>` : ""}`),
    });
    res.json({ success: true, exchange });
  } catch (error) {
    sendError(res, error);
  }
});

// POST /api/admin/exchanges/:exchangeId/complete
orderExchangesRouter.post("/:exchangeId/complete", requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const exchange = await completeOrderExchange(req.params.exchangeId, req.user?.email || null);
    res.json({ success: true, exchange });
  } catch (error) {
    sendError(res, error);
  }
});

// POST /api/admin/exchanges/:exchangeId/cancel
orderExchangesRouter.post("/:exchangeId/cancel", requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const exchange = await cancelOrderExchange(req.params.exchangeId, req.user?.email || null);
    res.json({ success: true, exchange });
  } catch (error) {
    sendError(res, error);
  }
});

// GET /api/admin/exchanges/shipments/:shipmentId/label.pdf
orderExchangesRouter.get("/shipments/:shipmentId/label.pdf", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const shipment = await prisma.orderExchangeShipment.findUnique({ where: { id: req.params.shipmentId } });
  if (!shipment?.labelPdfBase64) {
    res.status(404).json({ error: "Étiquette PDF introuvable." });
    return;
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${shipment.direction}-exchange-${shipment.id}.pdf"`);
  res.send(Buffer.from(shipment.labelPdfBase64, "base64"));
});
