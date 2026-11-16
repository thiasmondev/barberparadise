export type CheckoutStockIssue = {
  productId: string | null;
  variantId: string | null;
  availableStock: number | null;
  requestedQuantity: number;
  code: "INSUFFICIENT_STOCK" | "PRODUCT_UNAVAILABLE" | "VARIANT_UNAVAILABLE";
  message: string;
};

export type CheckoutStockLine = {
  productId: string | null;
  variantId: string | null;
  availableStock: number | null;
  requestedQuantity: number;
  stockIssues: CheckoutStockIssue[];
};

export type StockCatalogProduct = {
  id: string;
  name: string;
  status: string;
  inStock: boolean;
  stockCount?: number | null;
  variants: Array<{ id: string; name: string; inStock: boolean; stock?: number | null }>;
};

export type StockRequestedItem = {
  productId: string | null;
  variantId?: string | null;
  quantity: number;
  isCustomSale?: boolean;
};

/** false is an explicit outage; null/undefined is unknown, not zero/unlimited. */
export function normalizeAvailableStock(inStock: boolean | undefined, stock: unknown): number | null {
  if (inStock === false) return 0;
  return typeof stock === "number" && Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : null;
}

/** Variants use their own availability, never a parent stock count or flag. */
export function resolveCheckoutStock(
  items: StockRequestedItem[],
  products: StockCatalogProduct[],
): { items: CheckoutStockLine[]; stockIssues: CheckoutStockIssue[] } {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const requestedBySku = new Map<string, number>();
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) throw new Error("Article de panier invalide");
    if (item.isCustomSale || !item.productId) continue;
    const key = JSON.stringify([item.productId, item.variantId || null]);
    requestedBySku.set(key, (requestedBySku.get(key) || 0) + item.quantity);
  }
  const lines = items.map((item): CheckoutStockLine => {
    const productId = item.isCustomSale ? null : item.productId;
    const variantId = item.isCustomSale ? null : item.variantId || null;
    const line: CheckoutStockLine = { productId, variantId, requestedQuantity: item.quantity, availableStock: null, stockIssues: [] };
    if (!productId) return line;
    const product = productsById.get(productId);
    const variant = variantId ? product?.variants.find((candidate) => candidate.id === variantId) : null;
    let code: CheckoutStockIssue["code"] | null = null;
    let message = "";
    const requestedQuantity = requestedBySku.get(JSON.stringify([productId, variantId]))!;
    if (!product || product.status !== "active") {
      line.availableStock = 0;
      code = "PRODUCT_UNAVAILABLE";
      message = `Produit indisponible : ${product?.name || productId}`;
    } else if ((variantId && !variant) || (product.variants.length > 0 && !variant)) {
      line.availableStock = 0;
      code = "VARIANT_UNAVAILABLE";
      message = `La variante sélectionnée n’est plus disponible pour ${product.name}.`;
    } else {
      line.availableStock = variant
        ? normalizeAvailableStock(variant.inStock, variant.stock)
        : normalizeAvailableStock(product.inStock, product.stockCount);
      if (line.availableStock !== null && requestedQuantity > line.availableStock) {
        code = "INSUFFICIENT_STOCK";
        message = `Stock insuffisant pour ${product.name}${variant ? ` - ${variant.name}` : ""}`;
      }
    }
    if (code) line.stockIssues.push({ productId, variantId, availableStock: line.availableStock, requestedQuantity, code, message });
    return line;
  });
  // One issue per SKU, even when the caller submitted duplicate basket lines.
  const issuesBySku = new Map<string, CheckoutStockIssue>();
  for (const line of lines) for (const issue of line.stockIssues) issuesBySku.set(JSON.stringify([issue.productId, issue.variantId]), issue);
  return { items: lines, stockIssues: [...issuesBySku.values()] };
}

export class CheckoutStockError extends Error {
  readonly code = "INSUFFICIENT_STOCK";
  constructor(readonly stockIssues: CheckoutStockIssue[]) {
    super("Certains articles ne sont plus disponibles dans les quantités demandées. Vérifiez les stocks de votre panier.");
    this.name = "CheckoutStockError";
  }
}

export function assertCheckoutStockAvailable(stockIssues: CheckoutStockIssue[]): void {
  if (stockIssues.length) throw new CheckoutStockError(stockIssues);
}
