import type { CartItem } from "@/types";

export type CartStockConstraint = {
  productId: string;
  variantId?: string | null;
  availableStock: number | null;
  requestedQuantity?: number;
  code?: string;
  message?: string;
};

export type CartStockAdjustment = CartStockConstraint & {
  variantId: string | null;
  requestedQuantity: number;
  quantity: number;
  code: string;
  message: string;
  blocked: boolean;
};

export type CartStockReconciliation = {
  items: CartItem[];
  adjustments: CartStockAdjustment[];
  quantitiesChanged: boolean;
  changed: boolean;
};

export type CartStockOptions = { preserveDraftQuantities?: boolean };

type StockAwareCartItem = CartItem & { availableStock?: number | null };
export const UNKNOWN_STOCK_QUANTITY_LIMIT = 999;

export function getCartStockLineKey(productId: string, variantId?: string | null) {
  return `${productId}::${variantId || "product"}`;
}

export function getCartItemVariantId(item: CartItem): string | null {
  return item.variantId || item.variant?.id || null;
}

function validStock(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

/** null means unknown, never sold out. An explicit live constraint is authoritative. */
export function getAvailableStock(item: CartItem): number | null {
  if (item.isCustomSale) return null;
  if (Object.prototype.hasOwnProperty.call(item, "availableStock")) {
    return validStock((item as StockAwareCartItem).availableStock);
  }
  const variant = item.variant || item.product.variants?.find((candidate) => candidate.id === getCartItemVariantId(item));
  if (variant?.inStock === false) return 0;
  // A selected variant is a distinct SKU: unknown variant stock must not inherit
  // a parent count that may belong to another variant.
  if (variant) return validStock(variant.stock);
  if (item.product.inStock === false) return 0;
  return validStock(item.product.stockCount);
}

export function getCartQuantityLimit(item: CartItem): number {
  const stock = getAvailableStock(item);
  return stock === null ? UNKNOWN_STOCK_QUANTITY_LIMIT : Math.min(UNKNOWN_STOCK_QUANTITY_LIMIT, stock);
}

export function isCartStockBlocked(item: CartItem): boolean {
  if (item.isCustomSale) return false;
  const stock = getAvailableStock(item);
  const stockUnresolved = stock === null && !Object.prototype.hasOwnProperty.call(item, "availableStock");
  return stockUnresolved || stock === 0 || !Number.isInteger(item.quantity) || item.quantity < 1 || (stock !== null && item.quantity > stock);
}

/** Keep unavailable lines visible with valid cart-session quantities, never delete them. */
export function constrainCartStock(
  items: CartItem[],
  constraints: CartStockConstraint[] = [],
  options: CartStockOptions = {},
): CartStockReconciliation {
  const live = new Map(constraints.map((stock) => [getCartStockLineKey(stock.productId, stock.variantId), stock]));
  const adjustments: CartStockAdjustment[] = [];
  let quantitiesChanged = false;
  let changed = false;
  const nextItems = items.map((item) => {
    const variantId = getCartItemVariantId(item);
    const constraint = live.get(getCartStockLineKey(item.product.id, variantId));
    let next: StockAwareCartItem = item;
    if (constraint) {
      const availableStock = validStock(constraint.availableStock);
      if (!Object.prototype.hasOwnProperty.call(item, "availableStock") || getAvailableStock(item) !== availableStock) {
        next = { ...item, availableStock };
      }
    }
    const stock = getAvailableStock(next);
    const requested = item.quantity;
    const safeRequested = Number.isFinite(requested) ? Math.min(UNKNOWN_STOCK_QUANTITY_LIMIT, Math.max(1, Math.floor(requested))) : 1;
    const quantity = options.preserveDraftQuantities ? requested : stock !== null && stock > 0 ? Math.min(safeRequested, stock) : safeRequested;
    if (quantity !== requested) {
      next = { ...next, quantity };
      quantitiesChanged = true;
    }
    const unresolvedIssue = !item.isCustomSale && !!constraint?.code && !(constraint.code === "INSUFFICIENT_STOCK" && stock !== null && stock > 0 && quantity <= stock);
    const blocked = isCartStockBlocked(next) || unresolvedIssue;
    if (blocked || quantity !== requested || constraint?.code) {
      const stockLimited = stock !== null && stock > 0 && requested > stock;
      const message = stock === 0
        ? "Rupture de stock · article conservé dans votre panier. Retirez-le pour continuer."
        : stockLimited && quantity !== requested
          ? `Plus que ${stock} en stock · quantité ramenée de ${requested} à ${quantity}`
          : stock === null
            ? "Stock à vérifier · la commande est bloquée jusqu’à confirmation."
            : constraint?.message || (blocked ? "Quantité à vérifier avant de commander." : `Quantité ramenée de ${requested} à ${quantity}`);
      adjustments.push({
        productId: item.product.id, variantId, availableStock: stock,
        requestedQuantity: requested, quantity,
        code: stock === 0 ? "OUT_OF_STOCK" : stock === null ? "STOCK_UNKNOWN" : constraint?.code || (blocked ? "QUANTITY_INVALID" : "STOCK_ADJUSTED"),
        message, blocked,
      });
    }
    if (next !== item) changed = true;
    return next;
  });
  return { items: changed ? nextItems : items, adjustments, quantitiesChanged, changed };
}
