export type DiscountType = "fixed" | "percent";
type DiscountInput = { type: unknown; value: unknown };
export type SavedDiscountItem = {
  id: string; name: string; price: number; quantity: number; isCustomSale?: boolean;
  discountAmount?: number | null; lineDiscountType?: string | null; lineDiscountValue?: number | null;
};
export type SavedDiscountOrder = {
  id: string; updatedAt: Date; total: number; shipping: number; isB2B: boolean; channel: string;
  status: string; vatRate: number; paidAmount?: number | null; refundedAmount?: number;
  paymentFeeHT?: number; paymentFeeVatAmount?: number; paymentFeeTTC?: number;
  discountAmount?: number; discountTotal?: number; orderDiscountType?: string | null;
  orderDiscountValue?: number | null; items: SavedDiscountItem[];
};
export type OrderDiscountPayload = {
  items?: Array<{ id?: unknown; lineDiscountType?: unknown; lineDiscountValue?: unknown }>;
  orderDiscountType?: unknown; orderDiscountValue?: unknown; expectedUpdatedAt?: unknown;
};

function money(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function normalize(input: DiscountInput) {
  if (input.value === null || input.value === undefined || input.value === "" || Number(input.value) === 0) {
    return { type: null as DiscountType | null, value: null as number | null };
  }
  const value = Number(input.value);
  if (!Number.isFinite(value) || value < 0 || (input.type !== "fixed" && input.type !== "percent") || (input.type === "percent" && value > 100)) {
    throw new Error("Remise invalide : renseignez un montant positif ou un pourcentage entre 0 et 100.");
  }
  return { type: input.type as DiscountType, value: money(value) };
}
function amount(type: DiscountType | null, value: number | null, base: number) {
  if (!type || !value) return 0;
  // Fixed is once for the whole LINE, never once per unit.
  return money(Math.min(Math.max(base, 0), type === "percent" ? base * value / 100 : value));
}

export function getSavedLineDiscount(item: SavedDiscountItem) {
  return item.lineDiscountType && item.lineDiscountValue != null
    ? normalize({ type: item.lineDiscountType, value: item.lineDiscountValue })
    : normalize({ type: "fixed", value: item.discountAmount ?? 0 });
}
export function getSavedOrderDiscount(order: Pick<SavedDiscountOrder, "channel" | "items" | "discountAmount" | "discountTotal" | "orderDiscountType" | "orderDiscountValue">) {
  const aggregate = Number(order.discountTotal || order.discountAmount || 0);
  const lineTotal = money(order.items.reduce((sum, item) => sum + Number(item.discountAmount || 0), 0));
  // Historical POS quick sales wrote the SAME single discount at both levels.
  const isQuickSaleMirror = order.channel === "pos" && order.items.length === 1 && order.items[0].isCustomSale &&
    aggregate > 0 && Math.abs(aggregate - lineTotal) < 0.01;
  if (isQuickSaleMirror) return { type: null, value: null };
  if (order.orderDiscountValue != null) {
    return normalize({ type: order.orderDiscountType || "fixed", value: order.orderDiscountValue });
  }
  // Aggregate includes line reductions. Only its residual is a legacy global discount.
  return normalize({ type: "fixed", value: money(Math.max(aggregate - lineTotal, 0)) });
}
export function getOrderDiscountForm(order: SavedDiscountOrder) {
  const taxLabel = order.isB2B && order.channel !== "pos" ? "HT" : "TTC";
  const global = getSavedOrderDiscount(order);
  return {
    orderId: order.id, updatedAt: order.updatedAt.toISOString(), oldTotal: order.total,
    paidAmount: order.paidAmount ?? null, priceTaxLabel: taxLabel,
    orderDiscountType: global.type, orderDiscountValue: global.value,
    items: order.items.map((item) => {
      const discount = getSavedLineDiscount(item);
      return { id: item.id, name: item.name, price: item.price, quantity: item.quantity,
        lineDiscountType: discount.type, lineDiscountValue: discount.value,
        priceTaxLabel: item.isCustomSale ? "TTC" : taxLabel };
    }),
  };
}

export function calculateOrderDiscountCorrection(order: SavedDiscountOrder, input: OrderDiscountPayload) {
  if (!Array.isArray(input.items) || input.items.length !== order.items.length || order.items.length === 0) {
    throw new Error("Renseignez une remise pour chaque ligne existante, sans ajouter ni supprimer d’article.");
  }
  const byId = new Map(order.items.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const multiplier = 1 + order.vatRate / 100;
  if (!Number.isFinite(multiplier) || multiplier <= 0) throw new Error("Taux de TVA de la commande invalide.");
  const usesHT = order.isB2B && order.channel !== "pos";
  let netHT = 0;
  let netTTC = 0;
  let lineDiscountTotal = 0;
  let grossDisplay = 0;
  const lines = input.items.map((entry) => {
    const id = typeof entry?.id === "string" ? entry.id : "";
    const item = byId.get(id);
    if (!item || seen.has(id)) throw new Error("Ligne inconnue ou dupliquée. Actualisez la commande.");
    seen.add(id);
    if (!Number.isFinite(item.price) || item.price < 0 || !Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error("Prix ou quantité historique invalide. Une vérification de la commande est nécessaire.");
    }
    const discount = normalize({ type: entry.lineDiscountType, value: entry.lineDiscountValue });
    const lineUsesHT = usesHT && !item.isCustomSale;
    const gross = money(item.price * item.quantity);
    const discountAmount = amount(discount.type, discount.value, gross);
    const net = money(gross - discountAmount);
    const lineHT = lineUsesHT ? net : money(net / multiplier);
    const lineTTC = lineUsesHT ? money(net * multiplier) : net;
    netHT += lineHT;
    netTTC += lineTTC;
    grossDisplay += usesHT && !lineUsesHT ? money(gross / multiplier) : gross;
    lineDiscountTotal += usesHT && !lineUsesHT ? money(discountAmount / multiplier) : discountAmount;
    return { id, lineDiscountType: discount.type, lineDiscountValue: discount.value, discountAmount };
  });
  netHT = money(netHT);
  netTTC = money(netTTC);
  const global = normalize({ type: input.orderDiscountType, value: input.orderDiscountValue });
  const orderDiscountAmount = amount(global.type, global.value, usesHT ? netHT : netTTC);
  netHT = money(Math.max(0, netHT - (usesHT ? orderDiscountAmount : money(orderDiscountAmount / multiplier))));
  netTTC = money(Math.max(0, netTTC - (usesHT ? money(orderDiscountAmount * multiplier) : orderDiscountAmount)));
  // Retain existing fees EXACTLY; never recalculate a payment fee on a corrected sale.
  const feeHT = Number(order.paymentFeeHT || 0);
  const feeVat = Number(order.paymentFeeVatAmount || 0);
  const feeTTC = Number(order.paymentFeeTTC || 0);
  const vatAmount = money(netTTC - netHT + feeVat);
  const totalHT = money(netHT + feeHT);
  const totalTTC = money(netTTC + order.shipping + feeTTC);
  const discountTotal = money(lineDiscountTotal + orderDiscountAmount);
  const knownPaid = order.paidAmount == null ? null : money(Math.max(0, order.paidAmount - (order.refundedAmount || 0)));
  return {
    lines, orderDiscountType: global.type, orderDiscountValue: global.value,
    oldTotal: order.total, newTotal: totalTTC, diff: money(totalTTC - order.total),
    subtotal: order.channel === "pos" ? money(grossDisplay) : usesHT ? netHT : netTTC,
    totalHT, vatAmount, totalTTC, discountTotal,
    remainingAmount: knownPaid === null ? null : money(Math.max(0, totalTTC - knownPaid)),
    overpaidAmount: knownPaid === null ? null : money(Math.max(0, knownPaid - totalTTC)),
  };
}
