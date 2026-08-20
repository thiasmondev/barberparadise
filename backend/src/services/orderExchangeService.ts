import { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";

const EXCHANGE_ELIGIBLE_STATUSES = new Set(["processing", "shipped", "delivered"]);
const ACTIVE_EXCHANGE_STATUSES = [
  "initiated",
  "return_in_transit",
  "return_received",
  "settlement_pending",
  "ready_to_ship",
  "replacement_shipped",
] as const;

type Db = Prisma.TransactionClient;

export type ExchangeInitiationInput = {
  orderId: string;
  returnedOrderItemId: string;
  quantity: number;
  replacementProductId: string;
  replacementVariantId?: string | null;
  actorEmail?: string | null;
  notes?: string | null;
};

export type ExchangeSettlementMode = "real" | "internal" | "gift";

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateOrderExchangeFinancials(input: {
  returnedUnitPrice: number;
  returnedLineDiscount: number;
  returnedLineQuantity: number;
  exchangeQuantity: number;
  replacementPublicUnitPrice: number;
  replacementProfessionalUnitPrice?: number | null;
  isB2B: boolean;
  vatRate: number;
}) {
  const allocatedReturnDiscount = money((input.returnedLineDiscount * input.exchangeQuantity) / input.returnedLineQuantity);
  const returnValue = money(input.returnedUnitPrice * input.exchangeQuantity - allocatedReturnDiscount);
  const replacementUnitPrice = input.isB2B
    ? money(input.replacementProfessionalUnitPrice ?? input.replacementPublicUnitPrice / (1 + input.vatRate / 100))
    : money(input.replacementPublicUnitPrice);
  const replacementValue = money(replacementUnitPrice * input.exchangeQuantity);
  return {
    allocatedReturnDiscount,
    returnValue,
    replacementUnitPrice,
    replacementValue,
    differenceAmount: money(replacementValue - returnValue),
  };
}

function exchangeEventMessage(type: string, values: Record<string, string | number | null | undefined> = {}): string {
  const compact = Object.entries(values)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `${key} : ${value}`)
    .join(" · ");
  return compact ? `${type} — ${compact}` : type;
}

async function appendOrderExchangeNote(tx: Db, orderId: string, message: string) {
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { notes: true } });
  if (!order) return;
  const timestamp = new Date().toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  const line = `[Échange ${timestamp}] ${message}`;
  await tx.order.update({
    where: { id: orderId },
    data: { notes: order.notes?.trim() ? `${order.notes.trim()}\n${line}` : line },
  });
}

async function addExchangeEvent(
  tx: Db,
  exchangeId: string,
  type: string,
  message: string,
  actorEmail?: string | null,
  metadata?: Prisma.InputJsonValue
) {
  await tx.orderExchangeEvent.create({
    data: { exchangeId, type, message, actorEmail: actorEmail || null, metadata },
  });
}

export function isOrderExchangeEligible(input: { status: string; channel?: string | null; noShipping?: boolean | null }) {
  // Une vente POS payée est remise immédiatement : elle suit le parcours retour/renvoi en boutique.
  if (input.channel === "pos") return input.status === "paid" || EXCHANGE_ELIGIBLE_STATUSES.has(input.status);
  // Une commande web sans livraison (retrait / déjà remis) n’a pas de retour physique à gérer.
  if (input.noShipping) return false;
  return EXCHANGE_ELIGIBLE_STATUSES.has(input.status);
}

function assertEligibleOrderStatus(input: { status: string; channel?: string | null; noShipping?: boolean | null }) {
  if (!isOrderExchangeEligible(input)) {
    throw new Error("Seules les commandes expédiées, livrées ou les ventes POS remises en boutique peuvent faire l’objet d’un échange.");
  }
}

async function reserveReplacementStock(tx: Db, productId: string, variantId: string | null | undefined, quantity: number) {
  if (variantId) {
    const decremented = await tx.productVariant.updateMany({
      where: { id: variantId, productId, stock: { gte: quantity }, inStock: true },
      data: { stock: { decrement: quantity } },
    });
    if (decremented.count !== 1) {
      throw new Error("La variante de remplacement n’est plus disponible en quantité suffisante.");
    }
    const variant = await tx.productVariant.findUniqueOrThrow({ where: { id: variantId }, select: { stock: true } });
    const activeVariantCount = await tx.productVariant.count({ where: { productId, stock: { gt: 0 }, inStock: true } });
    await tx.product.update({ where: { id: productId }, data: { inStock: activeVariantCount > 0 } });
    return { remainingStock: variant.stock };
  }

  const decremented = await tx.product.updateMany({
    where: { id: productId, stockCount: { gte: quantity }, inStock: true },
    data: { stockCount: { decrement: quantity } },
  });
  if (decremented.count !== 1) {
    throw new Error("L’article de remplacement n’est plus disponible en quantité suffisante.");
  }
  const product = await tx.product.findUniqueOrThrow({ where: { id: productId }, select: { stockCount: true } });
  await tx.product.update({ where: { id: productId }, data: { inStock: product.stockCount > 0 } });
  return { remainingStock: product.stockCount };
}

async function restoreReturnedStock(tx: Db, exchange: {
  returnProductId: string | null;
  returnVariantId: string | null;
  returnQuantity: number;
}) {
  if (!exchange.returnProductId) {
    throw new Error("L’article retourné ne correspond plus à un produit catalogue stockable.");
  }
  if (exchange.returnVariantId) {
    const variant = await tx.productVariant.update({
      where: { id: exchange.returnVariantId },
      data: { stock: { increment: exchange.returnQuantity } },
      select: { stock: true },
    });
    await tx.productVariant.update({ where: { id: exchange.returnVariantId }, data: { inStock: variant.stock > 0 } });
    await tx.product.update({ where: { id: exchange.returnProductId }, data: { inStock: true } });
    return;
  }

  const product = await tx.product.update({
    where: { id: exchange.returnProductId },
    data: { stockCount: { increment: exchange.returnQuantity } },
    select: { stockCount: true },
  });
  await tx.product.update({ where: { id: exchange.returnProductId }, data: { inStock: product.stockCount > 0 } });
}

async function releaseReplacementStock(tx: Db, exchange: {
  replacementProductId: string;
  replacementVariantId: string | null;
  replacementQuantity: number;
}) {
  if (exchange.replacementVariantId) {
    const variant = await tx.productVariant.update({
      where: { id: exchange.replacementVariantId },
      data: { stock: { increment: exchange.replacementQuantity } },
      select: { stock: true },
    });
    await tx.productVariant.update({ where: { id: exchange.replacementVariantId }, data: { inStock: variant.stock > 0 } });
    await tx.product.update({ where: { id: exchange.replacementProductId }, data: { inStock: true } });
    return;
  }

  const product = await tx.product.update({
    where: { id: exchange.replacementProductId },
    data: { stockCount: { increment: exchange.replacementQuantity } },
    select: { stockCount: true },
  });
  await tx.product.update({ where: { id: exchange.replacementProductId }, data: { inStock: product.stockCount > 0 } });
}

export async function initiateOrderExchange(input: ExchangeInitiationInput) {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new Error("La quantité à échanger doit être un entier strictement positif.");
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      include: {
        shipment: true,
        items: { include: { product: true, variant: true } },
      },
    });
    if (!order) throw new Error("Commande introuvable.");
    assertEligibleOrderStatus({ status: order.status, channel: order.channel, noShipping: order.noShipping });
    if (order.channel !== "pos" && !order.shipment?.shippedAt && !["shipped", "delivered"].includes(order.status)) {
      throw new Error("La commande doit avoir une expédition confirmée avant de créer un échange.");
    }

    const returnedItem = order.items.find(item => item.id === input.returnedOrderItemId);
    if (!returnedItem) throw new Error("Article d’origine introuvable sur cette commande.");
    if (!returnedItem.productId || returnedItem.isCustomSale) {
      throw new Error("Seuls les articles catalogue peuvent être échangés avec gestion de stock.");
    }
    if (input.quantity > returnedItem.quantity) {
      throw new Error("La quantité à échanger ne peut pas dépasser la quantité expédiée.");
    }

    const activeExchange = await tx.orderExchange.findFirst({
      where: {
        returnedOrderItemId: returnedItem.id,
        status: { in: [...ACTIVE_EXCHANGE_STATUSES] },
      },
      select: { id: true },
    });
    if (activeExchange) {
      throw new Error("Un échange est déjà en cours pour cet article de commande.");
    }

    const replacementProduct = await tx.product.findUnique({
      where: { id: input.replacementProductId },
      include: { variants: true },
    });
    if (!replacementProduct || replacementProduct.status !== "active") {
      throw new Error("Article de remplacement introuvable ou indisponible.");
    }

    const replacementVariant = input.replacementVariantId
      ? replacementProduct.variants.find(variant => variant.id === input.replacementVariantId)
      : null;
    if (replacementProduct.variants.length > 0 && !replacementVariant) {
      throw new Error("Sélectionnez une variante disponible pour l’article de remplacement.");
    }
    if (input.replacementVariantId && !replacementVariant) {
      throw new Error("La variante sélectionnée ne correspond pas à l’article de remplacement.");
    }

    const publicUnitPrice = replacementVariant?.price ?? replacementProduct.price;
    const professionalUnitPrice = replacementVariant?.priceProEur ?? replacementProduct.priceProEur;
    const { allocatedReturnDiscount, returnValue, replacementUnitPrice, replacementValue, differenceAmount } = calculateOrderExchangeFinancials({
      returnedUnitPrice: returnedItem.price,
      returnedLineDiscount: returnedItem.discountAmount,
      returnedLineQuantity: returnedItem.quantity,
      exchangeQuantity: input.quantity,
      replacementPublicUnitPrice: publicUnitPrice,
      replacementProfessionalUnitPrice: professionalUnitPrice,
      isB2B: order.isB2B,
      vatRate: order.vatRate,
    });

    await reserveReplacementStock(tx, replacementProduct.id, replacementVariant?.id || null, input.quantity);

    const exchange = await tx.orderExchange.create({
      data: {
        orderId: order.id,
        returnedOrderItemId: returnedItem.id,
        status: "initiated",
        returnProductId: returnedItem.productId,
        returnVariantId: returnedItem.variantId,
        returnVariantLabel: returnedItem.variantLabel,
        returnName: returnedItem.name,
        returnImage: returnedItem.image,
        returnQuantity: input.quantity,
        returnUnitPrice: returnedItem.price,
        returnDiscountAmount: allocatedReturnDiscount,
        returnValue,
        replacementProductId: replacementProduct.id,
        replacementVariantId: replacementVariant?.id || null,
        replacementVariantLabel: replacementVariant?.name || null,
        replacementName: replacementProduct.name,
        replacementImage: replacementVariant?.image || replacementProduct.images,
        replacementQuantity: input.quantity,
        replacementUnitPrice,
        replacementValue,
        differenceAmount,
        vatRate: order.vatRate,
        priceTaxLabel: order.isB2B ? "HT" : "TTC",
        currency: order.currency,
        settlementStatus: differenceAmount === 0 ? "not_required" : "pending",
        replacementStockReserved: true,
        initiatedBy: input.actorEmail || null,
        notes: input.notes?.trim() || null,
      },
      include: { shipments: true, events: true },
    });

    const message = exchangeEventMessage("Échange initié", {
      retour: `${input.quantity} × ${returnedItem.name}`,
      remplacement: `${input.quantity} × ${replacementProduct.name}${replacementVariant ? ` — ${replacementVariant.name}` : ""}`,
      différence: `${differenceAmount.toFixed(2)} ${order.currency}`,
    });
    await addExchangeEvent(tx, exchange.id, "initiated", message, input.actorEmail, {
      returnValue,
      replacementValue,
      differenceAmount,
    });
    await appendOrderExchangeNote(tx, order.id, message);

    return exchange;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function markOrderExchangeReturnReceived(exchangeId: string, actorEmail?: string | null) {
  return prisma.$transaction(async (tx) => {
    const exchange = await tx.orderExchange.findUnique({ where: { id: exchangeId } });
    if (!exchange) throw new Error("Dossier d’échange introuvable.");
    if (["cancelled", "completed", "replacement_shipped"].includes(exchange.status)) {
      throw new Error("Cet échange ne peut plus recevoir de retour.");
    }

    if (!exchange.returnedStockRestored) {
      await restoreReturnedStock(tx, exchange);
    }

    const nextStatus = Math.abs(exchange.differenceAmount) <= 0.01 ? "ready_to_ship" : "settlement_pending";
    const settlementStatus = Math.abs(exchange.differenceAmount) <= 0.01 ? "not_required" : exchange.settlementStatus;
    const updated = await tx.orderExchange.update({
      where: { id: exchange.id },
      data: {
        status: nextStatus,
        settlementStatus,
        returnedStockRestored: true,
        returnReceivedAt: exchange.returnReceivedAt || new Date(),
      },
    });

    const message = exchangeEventMessage("Retour reçu et inspecté", {
      article: `${exchange.returnQuantity} × ${exchange.returnName}`,
      suite: nextStatus === "ready_to_ship" ? "prêt à expédier" : "règlement requis",
    });
    await addExchangeEvent(tx, exchange.id, "return_received", message, actorEmail);
    await appendOrderExchangeNote(tx, exchange.orderId, message);
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function settleOrderExchangeInternally(exchangeId: string, mode: Exclude<ExchangeSettlementMode, "real">, actorEmail?: string | null) {
  return prisma.$transaction(async (tx) => {
    const exchange = await tx.orderExchange.findUnique({ where: { id: exchangeId } });
    if (!exchange) throw new Error("Dossier d’échange introuvable.");
    if (exchange.status !== "settlement_pending") {
      throw new Error("Le règlement de cet échange n’est pas en attente.");
    }
    if (!exchange.returnedStockRestored) {
      throw new Error("Le retour doit être reçu et inspecté avant de régler la différence.");
    }

    const updated = await tx.orderExchange.update({
      where: { id: exchange.id },
      data: {
        status: "ready_to_ship",
        settlementMode: mode,
        settlementStatus: mode,
        settlementHandledAt: new Date(),
      },
    });
    const message = exchangeEventMessage("Différence d’échange validée", {
      mode: mode === "gift" ? "geste commercial" : "règlement interne",
      montant: `${exchange.differenceAmount.toFixed(2)} ${exchange.currency}`,
    });
    await addExchangeEvent(tx, exchange.id, "settlement_recorded", message, actorEmail);
    await appendOrderExchangeNote(tx, exchange.orderId, message);
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function cancelOrderExchange(exchangeId: string, actorEmail?: string | null) {
  return prisma.$transaction(async (tx) => {
    const exchange = await tx.orderExchange.findUnique({ where: { id: exchangeId } });
    if (!exchange) throw new Error("Dossier d’échange introuvable.");
    if (["completed", "replacement_shipped"].includes(exchange.status)) {
      throw new Error("Un échange déjà expédié ou terminé ne peut pas être annulé.");
    }
    if (exchange.status === "cancelled") return exchange;

    if (exchange.replacementStockReserved && !exchange.replacementStockReleased) {
      await releaseReplacementStock(tx, exchange);
    }

    const updated = await tx.orderExchange.update({
      where: { id: exchange.id },
      data: {
        status: "cancelled",
        replacementStockReleased: exchange.replacementStockReserved || exchange.replacementStockReleased,
        cancelledAt: new Date(),
      },
    });
    const message = "Échange annulé ; la réservation de l’article de remplacement a été libérée.";
    await addExchangeEvent(tx, exchange.id, "cancelled", message, actorEmail);
    await appendOrderExchangeNote(tx, exchange.orderId, message);
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function markOrderExchangeReplacementShipped(
  exchangeId: string,
  actorEmail?: string | null,
  fulfillment: "shipment" | "in_store" = "shipment",
) {
  return prisma.$transaction(async (tx) => {
    const exchange = await tx.orderExchange.findUnique({ where: { id: exchangeId } });
    if (!exchange) throw new Error("Dossier d’échange introuvable.");
    if (exchange.status !== "ready_to_ship") {
      throw new Error("Le remplacement ne peut être expédié qu’une fois le retour reçu et le règlement validé.");
    }

    const updated = await tx.orderExchange.update({
      where: { id: exchange.id },
      data: { status: "replacement_shipped", replacementShippedAt: new Date() },
    });
    const message = fulfillment === "in_store"
      ? `Remplacement remis en boutique : ${exchange.replacementQuantity} × ${exchange.replacementName}.`
      : `Remplacement expédié : ${exchange.replacementQuantity} × ${exchange.replacementName}.`;
    await addExchangeEvent(tx, exchange.id, fulfillment === "in_store" ? "replacement_handed_over" : "replacement_shipped", message, actorEmail);
    await appendOrderExchangeNote(tx, exchange.orderId, message);
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function completeOrderExchange(exchangeId: string, actorEmail?: string | null) {
  return prisma.$transaction(async (tx) => {
    const exchange = await tx.orderExchange.findUnique({ where: { id: exchangeId } });
    if (!exchange) throw new Error("Dossier d’échange introuvable.");
    if (exchange.status !== "replacement_shipped") {
      throw new Error("Seul un échange dont le remplacement est expédié peut être clôturé.");
    }
    const updated = await tx.orderExchange.update({
      where: { id: exchange.id },
      data: { status: "completed", completedAt: new Date() },
    });
    const message = "Échange clôturé.";
    await addExchangeEvent(tx, exchange.id, "completed", message, actorEmail);
    await appendOrderExchangeNote(tx, exchange.orderId, message);
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function confirmOrderExchangeRealSettlement(exchangeId: string, paymentId: string) {
  return prisma.$transaction(async (tx) => {
    const exchange = await tx.orderExchange.findUnique({ where: { id: exchangeId } });
    if (!exchange) throw new Error(`Échange introuvable : ${exchangeId}`);
    if (exchange.settlementPaymentId !== paymentId) {
      throw new Error("Le paiement reçu ne correspond pas au règlement en attente de cet échange.");
    }
    if (exchange.settlementStatus === "paid" && exchange.status === "ready_to_ship") return exchange;
    if (exchange.status !== "settlement_pending") {
      throw new Error("Cet échange n’attend pas de règlement.");
    }

    const updated = await tx.orderExchange.update({
      where: { id: exchange.id },
      data: {
        status: "ready_to_ship",
        settlementMode: "real",
        settlementStatus: "paid",
        settlementHandledAt: new Date(),
      },
    });
    const message = `Complément de paiement d’échange confirmé : +${exchange.differenceAmount.toFixed(2)} ${exchange.currency}.`;
    await addExchangeEvent(tx, exchange.id, "settlement_paid", message, null, { paymentId });
    await appendOrderExchangeNote(tx, exchange.orderId, message);
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function markOrderExchangeRealSettlementFailed(exchangeId: string, paymentId: string, paymentStatus: string) {
  return prisma.$transaction(async (tx) => {
    const exchange = await tx.orderExchange.findUnique({ where: { id: exchangeId } });
    if (!exchange || exchange.settlementPaymentId !== paymentId) return null;
    if (exchange.status !== "settlement_pending" || exchange.settlementStatus !== "pending") return exchange;

    const message = `Lien de règlement d’échange ${paymentStatus} ; un nouveau lien ou un autre mode peut être choisi.`;
    const updated = await tx.orderExchange.update({
      where: { id: exchange.id },
      data: { settlementPaymentUrl: null },
    });
    await addExchangeEvent(tx, exchange.id, "settlement_payment_failed", message, null, { paymentId, paymentStatus });
    await appendOrderExchangeNote(tx, exchange.orderId, message);
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function registerOrderExchangeSettlementPayment(exchangeId: string, paymentId: string, paymentUrl: string, actorEmail?: string | null) {
  return prisma.$transaction(async (tx) => {
    const exchange = await tx.orderExchange.findUnique({ where: { id: exchangeId } });
    if (!exchange) throw new Error("Dossier d’échange introuvable.");
    if (exchange.status !== "settlement_pending" || exchange.differenceAmount <= 0) {
      throw new Error("Cet échange ne requiert pas de complément de paiement.");
    }
    if (exchange.settlementStatus === "paid") return exchange;

    const updated = await tx.orderExchange.update({
      where: { id: exchange.id },
      data: {
        settlementMode: "real",
        settlementStatus: "pending",
        settlementPaymentId: paymentId,
        settlementPaymentUrl: paymentUrl,
      },
    });
    const message = `Lien de règlement d’échange créé : +${exchange.differenceAmount.toFixed(2)} ${exchange.currency}.`;
    await addExchangeEvent(tx, exchange.id, "settlement_link_created", message, actorEmail, { paymentId });
    await appendOrderExchangeNote(tx, exchange.orderId, message);
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function recordOrderExchangeRealRefund(exchangeId: string, refundedAmount: number, actorEmail?: string | null) {
  return prisma.$transaction(async (tx) => {
    const exchange = await tx.orderExchange.findUnique({ where: { id: exchangeId } });
    if (!exchange) throw new Error("Dossier d’échange introuvable.");
    if (exchange.status !== "settlement_pending" || exchange.differenceAmount >= 0) {
      throw new Error("Cet échange ne requiert pas de remboursement réel.");
    }
    const expected = money(Math.abs(exchange.differenceAmount));
    if (Math.abs(money(refundedAmount) - expected) > 0.01) {
      throw new Error("Le montant remboursé ne correspond pas à la différence d’échange attendue.");
    }

    const updated = await tx.orderExchange.update({
      where: { id: exchange.id },
      data: {
        status: "ready_to_ship",
        settlementMode: "real",
        settlementStatus: "refunded",
        settlementRefundedAmount: expected,
        settlementHandledAt: new Date(),
      },
    });
    const message = `Remboursement d’échange confirmé : -${expected.toFixed(2)} ${exchange.currency}.`;
    await addExchangeEvent(tx, exchange.id, "settlement_refunded", message, actorEmail, { refundedAmount: expected });
    await appendOrderExchangeNote(tx, exchange.orderId, message);
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
