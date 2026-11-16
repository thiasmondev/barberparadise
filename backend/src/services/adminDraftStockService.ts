export type DraftStockProduct = {
  id: string;
  status?: string;
  inStock?: boolean;
  stockCount?: number | null;
  variants?: Array<{ id: string; name?: string; inStock?: boolean; stock?: number | null }>;
};

export type DraftStockLine = {
  productId?: string | null;
  variantId?: string | null;
  name?: string;
  quantity: number;
  isCustomSale?: boolean;
  isCustomItem?: boolean;
  product?: DraftStockProduct | null;
};

export type AdminDraftStockIssue = {
  productId: string;
  variantId: string | null;
  requestedQuantity: number;
  availableStock: number;
  message: string;
};

/** Inspect availability only: prices, discounts, taxes and saved quantities stay untouched. */
export function inspectAdminDraftStock(lines: DraftStockLine[]): AdminDraftStockIssue[] {
  const grouped = new Map<string, DraftStockLine>();
  for (const line of lines) {
    if (line.isCustomSale || line.isCustomItem || !line.productId) continue;
    const key = `${line.productId}::${line.variantId || 'product'}`;
    const previous = grouped.get(key);
    grouped.set(key, previous ? { ...previous, quantity: previous.quantity + line.quantity } : { ...line });
  }
  const issues: AdminDraftStockIssue[] = [];
  for (const line of grouped.values()) {
    const product = line.product;
    const variant = line.variantId ? product?.variants?.find(item => item.id === line.variantId) : null;
    const unavailable = !product || (product.status !== undefined && product.status !== 'active')
      || (line.variantId ? !variant || variant.inStock === false : product.inStock === false);
    const rawStock = unavailable ? 0 : line.variantId ? variant?.stock : product?.stockCount;
    const availableStock = typeof rawStock === 'number' && Number.isFinite(rawStock) ? Math.max(0, Math.floor(rawStock)) : null;
    if (availableStock === null || line.quantity <= availableStock) continue;
    issues.push({
      productId: line.productId!,
      variantId: line.variantId || null,
      requestedQuantity: line.quantity,
      availableStock,
      message: availableStock === 0
        ? `${line.name || 'Article'} : rupture de stock. Corrigez cette ligne avant l’envoi.`
        : `${line.name || 'Article'} : plus que ${availableStock} en stock pour ${line.quantity} demandé(s). Corrigez cette ligne avant l’envoi.`,
    });
  }
  return issues;
}
