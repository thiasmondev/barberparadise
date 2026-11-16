import type { Product, ProductVariant } from '@/types';

export function getAdminDraftLineStockWarning(line: {
  quantity: number;
  variantId?: string | null;
  isCustomItem?: boolean;
  product?: Product;
  stockProduct?: Product;
}, loadedVariants: ProductVariant[] = []): string | null {
  if (line.isCustomItem) return null;
  const product = line.stockProduct || line.product;
  const variants = loadedVariants.length ? loadedVariants : product?.variants || [];
  const variant = line.variantId ? variants.find(item => item.id === line.variantId) : null;
  if (line.variantId && !variant) return null; // The server checks missing/deleted variants.
  const inStock = line.variantId ? variant?.inStock : product?.inStock;
  const rawStock = inStock === false ? 0 : line.variantId ? variant?.stock : product?.stockCount;
  if (typeof rawStock !== 'number' || !Number.isFinite(rawStock)) return null;
  const available = Math.max(0, Math.floor(rawStock));
  if (line.quantity <= available) return null;
  return available === 0
    ? 'Rupture de stock : corrigez la ligne avant l’envoi au client.'
    : `Plus que ${available} en stock pour ${line.quantity} demandé(s). Corrigez la quantité avant l’envoi au client.`;
}
