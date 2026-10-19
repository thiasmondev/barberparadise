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
import { getCustomerName, sendEmail, sendOrderShippedEmail } from "../services/emailService";
import {
  cancelOrderExchange,
  completeOrderExchange,
  initiateOrderExchange,
  markOrderExchangeReplacementShipped,
  markOrderExchangeReturnReceived,
  recordOrderExchangeRealRefund,
  registerOrderExchangeSettlementPayment,
  settleOrderExchangeManually,
  settleOrderExchangeInternally,
} from "../services/orderExchangeService";
import { isManualPaymentMethod } from "../utils/manualPaymentBreakdown";

export const orderExchangesRouter = Router();

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const activeCarrier = (value: unknown): value is LogisticsCarrier =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(LOGISTICS_CARRIERS, value);
const MIN_EXCHANGE_PARCEL_WEIGHT_G = 100;
const MAX_EXCHANGE_PARCEL_WEIGHT_G = 30_000;

/**
 * Exchange labels must never silently fall back to a catalog product weight.
 * The admin weighs the closed parcel and sends a whole-gram value, used both
 * to price the quote and to create the carrier label.
 */
function parseRequiredExchangeParcelWeightG(value: unknown): number {
  const weightG = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isInteger(weightG) || weightG < MIN_EXCHANGE_PARCEL_WEIGHT_G || weightG > MAX_EXCHANGE_PARCEL_WEIGHT_G) {
    throw new Error("Renseignez le poids réel du colis emballé, entre 0,100 kg et 30 kg.");
  }
  return weightG;
}

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

type LabelAddress = {
  firstName: string;
  lastName: string;
  address: string;
  extension?: string | null;
  postalCode: string;
  city: string;
  country: string;
  phone?: string | null;
};

function shippingAddressToLabel(address: LabelAddress, email: string): ShipmentAddress {
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

function snapshotLabelAddress(value: unknown): LabelAddress | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const address = value as Partial<LabelAddress>;
  return typeof address.firstName === "string" && typeof address.lastName === "string"
    && typeof address.address === "string" && typeof address.postalCode === "string"
    && typeof address.city === "string" && typeof address.country === "string"
    ? address as LabelAddress
    : null;
}

function exchangeShippingAddress(exchange: Awaited<ReturnType<typeof getExchange>>): LabelAddress | null {
  if (!exchange) return null;
  return snapshotLabelAddress(exchange.shippingAddressSnapshot) || exchange.order.shippingAddress;
}

function snapshotRelayPointId(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const id = (value as { id?: unknown }).id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function snapshotRelayPoint(value: unknown) {
  if (!isRecord(value)) return null;
  const id = typeof value.id === "string" ? value.id.trim() : "";
  if (!id) return null;
  const name = typeof value.name === "string" && value.name.trim() ? value.name.trim() : "Point relais";
  const address = typeof value.address === "string" ? value.address.trim() : "";
  const postalCode = typeof value.postalCode === "string" ? value.postalCode.trim() : "";
  const city = typeof value.city === "string" ? value.city.trim() : "";
  const country = typeof value.country === "string" && value.country.trim() ? value.country.trim() : "France";
  return {
    id,
    name,
    address,
    postalCode,
    city,
    country,
    fullAddress: [address, `${postalCode} ${city}`.trim(), country].filter(Boolean).join(", "),
  };
}

function assertShipmentWorkflow(exchange: NonNullable<Awaited<ReturnType<typeof getExchange>>>) {
  if (exchange.fulfillmentMode !== "shipment") {
    throw new Error("Cet échange est traité en boutique : aucune opération de transport n’est nécessaire.");
  }
  if (exchange.order.channel === "pos" && exchange.fulfillmentMode !== "shipment") {
    throw new Error("Une vente POS ne peut utiliser le transport que lorsque l’échange a été créé en mode shipment.");
  }
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

/**
 * Keeps the public admin contract independent from the persisted JSON snapshot
 * names, while returning the immutable destination selected for the exchange.
 */
function serializeExchange<T extends {
  shippingAddressSnapshot: Prisma.JsonValue | null;
  relayPointSnapshot: Prisma.JsonValue | null;
  settlementManualPayment: Prisma.JsonValue | null;
  settlementStatus: string;
  settlementHandledAt: Date | null;
}>(exchange: T) {
  const manualSettlement = isRecord(exchange.settlementManualPayment) ? exchange.settlementManualPayment : null;
  const isFinanciallyFinal = ["not_required", "paid", "refunded", "internal", "gift"].includes(exchange.settlementStatus);
  return {
    ...exchange,
    shippingAddress: snapshotLabelAddress(exchange.shippingAddressSnapshot),
    relayPoint: snapshotRelayPoint(exchange.relayPointSnapshot),
    settlementPaymentMethod: typeof manualSettlement?.method === "string" ? manualSettlement.method : null,
    settlementReceivedAt: typeof manualSettlement?.receivedAt === "string" ? manualSettlement.receivedAt : null,
    settlementReference: typeof manualSettlement?.reference === "string" ? manualSettlement.reference : null,
    settlementNote: typeof manualSettlement?.note === "string" ? manualSettlement.note : null,
    financialStatus: exchange.settlementStatus,
    financialFinalizedAt: isFinanciallyFinal ? exchange.settlementHandledAt : null,
  };
}

async function createExchangeShipmentLabel(params: {
  exchangeId: string;
  orderId: string;
  direction: "return" | "replacement";
  carrier: LogisticsCarrier;
  offerId: string;
  relayPointId?: string | null;
  relayPointSnapshot?: Prisma.InputJsonValue | null;
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
    totalWeightG: params.totalWeightG,
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
      totalWeightG: params.totalWeightG,
      offerId: result.offerId,
      serviceCode: result.serviceCode,
      deliveryMode: result.deliveryMode,
      relayPointId: result.relayPointId,
      relayPointSnapshot: params.relayPointSnapshot || Prisma.DbNull,
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
      totalWeightG: params.totalWeightG,
      offerId: result.offerId,
      serviceCode: result.serviceCode,
      deliveryMode: result.deliveryMode,
      relayPointId: result.relayPointId,
      relayPointSnapshot: params.relayPointSnapshot || Prisma.DbNull,
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
  // La liste des commandes est triée par dernière activité. L’achat d’une
  // étiquette d’échange doit donc remettre la commande source en tête de file.
  await prisma.order.update({
    where: { id: params.orderId },
    data: { updatedAt: new Date() },
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
  res.json({ exchanges: exchanges.map(serializeExchange) });
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
      fulfillmentMode: typeof req.body?.fulfillmentMode === "string" ? req.body.fulfillmentMode : null,
      deliveryMode: typeof req.body?.deliveryMode === "string" ? req.body.deliveryMode : null,
      shippingAddress: req.body?.shippingAddress || null,
      relayPoint: req.body?.relayPoint || req.body?.relayData || null,
      notes: typeof req.body?.notes === "string" ? req.body.notes : null,
      actorEmail: req.user?.email || null,
    });
    const fullExchange = await getExchange(exchange.id);
    res.status(201).json({ exchange: fullExchange ? serializeExchange(fullExchange) : exchange });
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
  res.json({ exchange: serializeExchange(exchange) });
});

// GET /api/admin/exchanges/:exchangeId/:direction/quotes
orderExchangesRouter.get("/:exchangeId/:direction/quotes", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const direction = req.params.direction;
    if (direction !== "return" && direction !== "replacement") throw new Error("Direction d’étiquette invalide.");
    const exchange = await getExchange(req.params.exchangeId);
    if (!exchange) throw new Error("Dossier d’échange introuvable.");
    assertShipmentWorkflow(exchange);
    const destination = exchangeShippingAddress(exchange);
    if (!destination) throw new Error("Adresse d’expédition introuvable pour cet échange.");
    if (direction === "return" && !["initiated", "return_in_transit"].includes(exchange.status)) {
      throw new Error("Les offres de retour ne sont plus disponibles à cette étape.");
    }
    if (direction === "replacement" && exchange.status !== "ready_to_ship") {
      throw new Error("Les offres de renvoi ne sont disponibles qu’une fois l’échange prêt à expédier.");
    }

    const isReturn = direction === "return";
    const recipient = isReturn
      ? companyAddress()
      : shippingAddressToLabel(destination, exchange.order.email);
    const value = isReturn ? exchange.returnValue : exchange.replacementValue;
    const totalWeightG = parseRequiredExchangeParcelWeightG(req.query?.totalWeightG);
    const quotes = buildShipmentQuotes({
      orderNumber: `${exchange.order.orderNumber}-${isReturn ? "RET" : "ECH"}-${exchange.id.slice(-6)}`,
      customerEmail: exchange.order.email,
      recipient,
      totalWeightG,
      orderValueCents: Math.max(0, Math.round(value * 100)),
      // The replacement label already applies this coverage when purchased;
      // include it in the quote so the price shown remains the price charged.
      requestedInsuranceValueCents: isReturn ? 0 : Math.max(0, Math.round(exchange.replacementValue * 100)),
    });
    const eligibleQuotes = !isReturn && exchange.deliveryMode
      ? quotes.filter((quote) => quote.deliveryMode === exchange.deliveryMode)
      : quotes;
    res.json({ quotes: eligibleQuotes, totalWeightG, direction });
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
    const totalWeightG = parseRequiredExchangeParcelWeightG(req.body?.totalWeightG);

    const exchange = await getExchange(req.params.exchangeId);
    if (!exchange) throw new Error("Dossier d’échange introuvable.");
    assertShipmentWorkflow(exchange);
    const destination = exchangeShippingAddress(exchange);
    if (!destination) throw new Error("Adresse client introuvable pour l’étiquette de retour.");
    if (!["initiated", "return_in_transit"].includes(exchange.status)) throw new Error("L’étiquette de retour ne peut être créée qu’au début de l’échange.");

    const customerAddress = shippingAddressToLabel(destination, exchange.order.email);
    const { shipment, result } = await createExchangeShipmentLabel({
      exchangeId: exchange.id,
      orderId: exchange.orderId,
      direction: "return",
      carrier,
      offerId,
      relayPointId: req.body?.relayPointId ? String(req.body.relayPointId) : null,
      insuranceValueCents: 0,
      totalWeightG,
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
    if (fullExchange && fullExchange.order.channel !== "pos") {
      await sendEmail({
        to: fullExchange.order.email,
        subject: `Retour reçu — échange ${fullExchange.order.orderNumber}`,
        html: exchangeHtml("Votre retour a été reçu", `<p>Nous avons reçu et inspecté <strong>${fullExchange.returnName}</strong>.</p><p>${exchange.status === "ready_to_ship" ? "Votre article de remplacement est en préparation." : "Nous vous contacterons pour finaliser la différence éventuelle avant l’envoi du remplacement."}</p>`),
      });
    }
    const refreshed = await getExchange(exchange.id);
    res.json({ success: true, exchange: refreshed ? serializeExchange(refreshed) : exchange });
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
      const refreshed = await getExchange(updated.id);
      res.json({ success: true, exchange: refreshed ? serializeExchange(refreshed) : updated });
      return;
    }

    if (exchange.differenceAmount > 0) {
      // Un lien déjà actif est réutilisé : un double clic ou une requête répétée
      // ne doit ni créer un second encaissement ni envoyer un second email.
      if (exchange.settlementPaymentUrl) {
        res.json({ success: true, exchange: serializeExchange(exchange), paymentUrl: exchange.settlementPaymentUrl, alreadySent: true });
        return;
      }
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
      const refreshed = await getExchange(updated.id);
      res.json({ success: true, exchange: refreshed ? serializeExchange(refreshed) : updated, paymentUrl });
      return;
    }

    // Différence négative : remboursement réel séparé de la commande mais sur le paiement d’origine.
    if (exchange.order.paymentProvider !== "mollie" || !exchange.order.providerPaymentId) {
      throw new Error("Le remboursement réel automatisé n’est pas disponible pour le moyen de paiement initial. Utilisez un ajustement interne ou un geste commercial.");
    }
    const amount = money(Math.abs(exchange.differenceAmount));
    const refundResponse = await fetch(`https://api.mollie.com/v2/payments/${exchange.order.providerPaymentId}/refunds`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.MOLLIE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: { currency: exchange.currency, value: amount.toFixed(2) } }),
    });
    if (!refundResponse.ok) throw new Error("Le remboursement réel de l’échange a été refusé.");
    const updated = await recordOrderExchangeRealRefund(exchange.id, amount, req.user?.email || null);
    const refreshed = await getExchange(updated.id);
    res.json({ success: true, exchange: refreshed ? serializeExchange(refreshed) : updated });
  } catch (error) {
    sendError(res, error);
  }
});

// POST /api/admin/exchanges/:exchangeId/settlement/manual
// Deliberately distinct from /orders/:id/mark-paid-manual: it settles the
// exchange difference and never changes the source Order.paidAmount.
async function handleManualSettlement(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.body?.confirmed !== true) {
      throw new Error("Confirmez avoir constaté l’encaissement réel avant de valider le règlement manuel.");
    }
    const paymentMethod = typeof req.body?.paymentMethod === "string" ? req.body.paymentMethod.trim().toLowerCase() : "";
    if (!isManualPaymentMethod(paymentMethod)) {
      throw new Error("Moyen de paiement manuel invalide.");
    }
    const rawReceivedAt = req.body?.receivedAt;
    let receivedAt: Date | null = null;
    if (rawReceivedAt !== undefined && rawReceivedAt !== null && rawReceivedAt !== "") {
      receivedAt = new Date(String(rawReceivedAt));
      if (Number.isNaN(receivedAt.getTime())) throw new Error("Date de réception du paiement invalide.");
    }
    const exchange = await settleOrderExchangeManually({
      exchangeId: req.params.exchangeId,
      amount: req.body?.amount === undefined || req.body?.amount === null || req.body?.amount === ""
        ? undefined
        : Number(req.body.amount),
      paymentMethod,
      receivedAt,
      reference: typeof req.body?.reference === "string" ? req.body.reference.trim().slice(0, 250) || null : null,
      note: typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 2000) || null : null,
      actorEmail: req.user?.email || null,
    });
    const refreshed = await getExchange(exchange.id);
    res.json({
      success: true,
      exchange: refreshed ? serializeExchange(refreshed) : exchange,
      settlement: exchange.settlementManualPayment,
    });
  } catch (error) {
    sendError(res, error);
  }
}

orderExchangesRouter.post("/:exchangeId/settlement/manual", requireAdmin, handleManualSettlement);
// Compatibility alias for any admin tab using the endpoint released during the first rollout.
orderExchangesRouter.post("/:exchangeId/manual-settlement", requireAdmin, handleManualSettlement);

// POST /api/admin/exchanges/:exchangeId/replacement-label
orderExchangesRouter.post("/:exchangeId/replacement-label", requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const carrier = req.body?.carrier;
    const offerId = String(req.body?.offerId || "").trim();
    if (!activeCarrier(carrier) || !offerId) throw new Error("Transporteur et offre de remplacement obligatoires.");
    const totalWeightG = parseRequiredExchangeParcelWeightG(req.body?.totalWeightG);
    const exchange = await getExchange(req.params.exchangeId);
    if (!exchange) throw new Error("Dossier d’échange introuvable.");
    assertShipmentWorkflow(exchange);
    const destination = exchangeShippingAddress(exchange);
    if (!destination) throw new Error("Adresse client introuvable pour cet échange.");
    if (exchange.status !== "ready_to_ship") throw new Error("Le remplacement n’est pas encore prêt à être expédié.");
    const relayPointId = exchange.deliveryMode === "relay"
      ? snapshotRelayPointId(exchange.relayPointSnapshot)
      : null;
    if (exchange.deliveryMode === "relay" && !relayPointId) {
      throw new Error("Le point relais sélectionné pour cet échange est introuvable.");
    }
    if (exchange.deliveryMode === "home" && carrier === "mondial_relay") {
      throw new Error("Choisissez une offre de livraison à domicile pour cette destination.");
    }
    if (exchange.deliveryMode === "relay" && carrier !== "mondial_relay") {
      throw new Error("Choisissez une offre point relais pour cette destination.");
    }

    const { shipment } = await createExchangeShipmentLabel({
      exchangeId: exchange.id,
      orderId: exchange.orderId,
      direction: "replacement",
      carrier,
      offerId,
      // The relay is selected and frozen at exchange creation. Do not let a later
      // label request silently redirect the replacement to a different location.
      relayPointId,
      relayPointSnapshot: exchange.relayPointSnapshot === null
        ? null
        : exchange.relayPointSnapshot as Prisma.InputJsonValue,
      insuranceValueCents: Math.max(0, Math.round(exchange.replacementValue * 100)),
      totalWeightG,
      orderValue: exchange.replacementValue,
      recipient: shippingAddressToLabel(destination, exchange.order.email),
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
    if (fullExchange.fulfillmentMode === "in_store") {
      const exchange = await markOrderExchangeReplacementShipped(fullExchange.id, req.user?.email || null, "in_store");
      const refreshed = await getExchange(exchange.id);
      res.json({ success: true, exchange: refreshed ? serializeExchange(refreshed) : exchange });
      return;
    }

    assertShipmentWorkflow(fullExchange);
    const replacementShipment = fullExchange.shipments.find(shipment => shipment.direction === "replacement");
    if (!replacementShipment?.trackingNumber) throw new Error("Créez d’abord l’étiquette de remplacement.");
    const exchange = await markOrderExchangeReplacementShipped(fullExchange.id, req.user?.email || null);
    await prisma.orderExchangeShipment.update({
      where: { id: replacementShipment.id },
      data: { shippedAt: new Date(), shippedBy: req.user?.email || null, lastTrackingStatus: "Remplacement expédié" },
    });
    await sendOrderShippedEmail({
      to: fullExchange.order.email,
      orderNumber: fullExchange.order.orderNumber,
      customerName: getCustomerName(fullExchange.order.customer, fullExchange.order.email),
      carrier: LOGISTICS_CARRIERS[replacementShipment.carrier as LogisticsCarrier],
      trackingNumber: replacementShipment.trackingNumber,
    });
    const refreshed = await getExchange(exchange.id);
    res.json({ success: true, exchange: refreshed ? serializeExchange(refreshed) : exchange });
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
