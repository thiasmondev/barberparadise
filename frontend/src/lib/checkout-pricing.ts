import { API_URL } from "@/lib/api";
import { CUSTOMER_TOKEN_KEY } from "@/lib/customer-api";

export type PricingQuoteCartItem = {
  productId: string;
  variantId?: string | null;
  quantity: number;
};

export type PricingQuoteItem = {
  productId: string;
  variantId?: string | null;
  quantity: number;
  retailUnitTTC: number;
  retailUnitHT: number;
  proUnitHT: number | null;
  appliedUnitHT: number;
  appliedUnitTTC: number;
  priceSource: "pro" | "retail";
};

export type CheckoutPricingQuote = {
  isB2B: boolean;
  pricingTier: "pro" | "retail";
  thresholdHT: number;
  qualifyingSubtotalHT: number;
  remainingHT: number;
  progressPercent: number;
  items: PricingQuoteItem[];
  subtotalHT: number;
  subtotalTTC: number;
  vatRate: number;
  vatAmount: number;
  discountTotal: number;
  totalTTC: number;
};

function getLineKey(productId: string, variantId?: string | null): string {
  return `${productId}::${variantId || "product"}`;
}

export function getPricingQuoteItem(
  quote: CheckoutPricingQuote | null,
  productId: string,
  variantId?: string | null,
): PricingQuoteItem | undefined {
  if (!quote) return undefined;
  const lineKey = getLineKey(productId, variantId);
  return quote.items.find((item) => getLineKey(item.productId, item.variantId) === lineKey);
}

export async function getCheckoutPricingQuote({
  cartItems,
  isB2B,
  signal,
}: {
  cartItems: PricingQuoteCartItem[];
  isB2B: boolean;
  signal?: AbortSignal;
}): Promise<CheckoutPricingQuote> {
  const params = new URLSearchParams({
    cartItems: JSON.stringify(cartItems.map((item) => ({
      productId: item.productId,
      ...(item.variantId ? { variantId: item.variantId } : {}),
      quantity: item.quantity,
    }))),
    isB2B: String(isB2B),
  });
  const token = typeof window !== "undefined" ? window.localStorage.getItem(CUSTOMER_TOKEN_KEY) : null;
  const response = await fetch(`${API_URL}/api/checkout/pricing-quote?${params.toString()}`, {
    signal,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const data = await response.json().catch(() => null) as (CheckoutPricingQuote & { error?: string; message?: string }) | null;

  if (!response.ok) {
    throw new Error(data?.error || data?.message || "Impossible de récupérer le devis de tarification");
  }
  if (!data || !Array.isArray(data.items)) {
    throw new Error("Le devis de tarification reçu est incomplet");
  }

  return data;
}
