import type { OrderItem } from "@/types";

export type DiscountType = "fixed" | "percent";
export type DiscountFields = { lineDiscountType?: DiscountType | null; lineDiscountValue?: number | null; discountAmount?: number | null; price?: number; quantity?: number; isCustomSale?: boolean };
export type OrderDiscountSource = {
  channel?: string | null;
  orderDiscountType?: DiscountType | null;
  orderDiscountValue?: number | null;
  discountAmount?: number | null;
  discountTotal?: number | null;
  items?: DiscountFields[];
};

function nonNegative(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}
function money(value: number): number { return Math.round((value + Number.EPSILON) * 100) / 100; }

/** Fixed discounts apply once to the whole line, never once per unit. */
export function calculateLineDiscount(type: DiscountType | null | undefined, value: number | null | undefined, gross: number): number {
  const base = nonNegative(gross);
  const amount = nonNegative(value);
  return money(Math.min(base, type === "percent" ? base * Math.min(100, amount) / 100 : type === "fixed" ? amount : 0));
}

export function lineDiscountFields(item: DiscountFields): { lineDiscountType: DiscountType | null; lineDiscountValue: number | null } {
  // Explicit zero is authoritative: do not resurrect an old computed amount.
  if (item.lineDiscountValue != null) {
    const value = nonNegative(item.lineDiscountValue);
    return { lineDiscountType: value > 0 ? item.lineDiscountType || "fixed" : null, lineDiscountValue: value > 0 ? value : null };
  }
  const amount = nonNegative(item.discountAmount);
  return { lineDiscountType: amount > 0 ? "fixed" : null, lineDiscountValue: amount > 0 ? amount : null };
}

/** Never turn the aggregate of line discounts into a second global discount.
 * Both discountTotal and discountAmount are aggregate, including catalogue POS.
 * A historical single-custom POS mirror represents one line discount, not two.
 */
export function orderDiscountFields(order: OrderDiscountSource): { orderDiscountType: DiscountType | null; orderDiscountValue: number | null } {
  const aggregate = nonNegative(order.discountTotal) > 0 ? nonNegative(order.discountTotal) : nonNegative(order.discountAmount);
  const storedLineTotal = money((order.items || []).reduce((sum, item) => sum + nonNegative(item.discountAmount), 0));
  if (order.channel === "pos" && order.items?.length === 1 && order.items[0].isCustomSale && aggregate > 0 && Math.abs(aggregate - storedLineTotal) < 0.01) {
    return { orderDiscountType: null, orderDiscountValue: null };
  }
  if (order.orderDiscountValue != null) {
    const value = nonNegative(order.orderDiscountValue);
    return { orderDiscountType: value > 0 ? order.orderDiscountType || "fixed" : null, orderDiscountValue: value > 0 ? value : null };
  }
  const lines = (order.items || []).reduce((sum, item) => {
    if (item.discountAmount != null) return sum + nonNegative(item.discountAmount);
    const fields = lineDiscountFields(item);
    return sum + calculateLineDiscount(fields.lineDiscountType, fields.lineDiscountValue, nonNegative(item.price) * nonNegative(item.quantity));
  }, 0);
  const amount = money(Math.max(0, aggregate - lines));
  return { orderDiscountType: amount > 0 ? "fixed" : null, orderDiscountValue: amount > 0 ? amount : null };
}

/** Keep custom lines as custom lines when saving addresses/notes. */
export function orderItemToDraftPayload(item: OrderItem, defaultVatRate = 20) {
  const discount = lineDiscountFields(item);
  if (item.isCustomSale) {
    return {
      isCustomItem: true as const,
      customName: item.name,
      customPriceTTC: item.price,
      customVatRate: item.customVatRate ?? defaultVatRate,
      quantity: item.quantity,
      ...discount,
    };
  }
  return { productId: item.productId, variantId: item.variantId ?? null, quantity: item.quantity, ...discount };
}
