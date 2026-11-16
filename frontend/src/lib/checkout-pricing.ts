import { API_URL } from "@/lib/api";
import { CUSTOMER_TOKEN_KEY } from "@/lib/customer-api";
import { getCartStockLineKey, type CartStockConstraint } from "@/lib/cart-stock";

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
  availableStock?: number | null;
};

export type PricingQuoteStockIssue = CartStockConstraint & {
  requestedQuantity: number;
  code: string;
  message: string;
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
  stockIssues?: PricingQuoteStockIssue[];
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

/** Stock issues take precedence over the corresponding line stock. */
export function getPricingQuoteStockConstraints(quote: CheckoutPricingQuote): CartStockConstraint[] {
  const constraints = new Map<string, CartStockConstraint>();
  for (const item of quote.items) {
    if (!Object.prototype.hasOwnProperty.call(item, "availableStock")) continue;
    constraints.set(getCartStockLineKey(item.productId, item.variantId), {
      productId: item.productId, variantId: item.variantId || null,
      availableStock: item.availableStock ?? null, requestedQuantity: item.quantity,
    });
  }
  for (const issue of quote.stockIssues || []) {
    constraints.set(getCartStockLineKey(issue.productId, issue.variantId), issue);
  }
  return Array.from(constraints.values());
}

export function pricingQuoteMatchesCart(quote: CheckoutPricingQuote | null, cartItems: PricingQuoteCartItem[], isB2B: boolean): boolean {
  if (!quote || quote.isB2B !== isB2B || quote.items.length !== cartItems.length) return false;
  const keys = new Set(quote.items.map((item) => getLineKey(item.productId, item.variantId)));
  return keys.size === quote.items.length && cartItems.every((item) => {
    const line = getPricingQuoteItem(quote, item.productId, item.variantId);
    return line?.quantity === item.quantity;
  });
}

function validQuote(data: unknown): data is CheckoutPricingQuote {
  if (!data || typeof data !== "object") return false;
  const quote = data as CheckoutPricingQuote;
  const finite = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0;
  const stock = (value: unknown) => value === null || (finite(value) && Number.isInteger(value));
  return typeof quote.isB2B === "boolean" && ["pro", "retail"].includes(quote.pricingTier)
    && [quote.thresholdHT, quote.qualifyingSubtotalHT, quote.remainingHT, quote.progressPercent,
      quote.subtotalHT, quote.subtotalTTC, quote.vatRate, quote.vatAmount, quote.discountTotal, quote.totalTTC].every(finite)
    && Array.isArray(quote.items) && quote.items.every((item) => item && typeof item.productId === "string"
      && (item.variantId == null || typeof item.variantId === "string")
      && Number.isInteger(item.quantity) && item.quantity >= 1
      && [item.retailUnitTTC, item.retailUnitHT, item.appliedUnitHT, item.appliedUnitTTC].every(finite)
      && (item.proUnitHT === null || finite(item.proUnitHT)) && ["pro", "retail"].includes(item.priceSource)
      && (!Object.prototype.hasOwnProperty.call(item, "availableStock") || stock(item.availableStock)))
    && (quote.stockIssues === undefined || (Array.isArray(quote.stockIssues) && quote.stockIssues.every((issue) => issue
      && typeof issue.productId === "string" && (issue.variantId == null || typeof issue.variantId === "string")
      && stock(issue.availableStock) && Number.isInteger(issue.requestedQuantity) && issue.requestedQuantity >= 1
      && typeof issue.code === "string" && typeof issue.message === "string")));
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
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const bounded = new Promise<never>((_, reject) => {
    onAbort = () => {
      controller.abort();
      const error = new Error("Vérification annulée");
      error.name = "AbortError";
      reject(error);
    };
    if (signal?.aborted) { onAbort(); return; }
    signal?.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("La vérification du tarif et du stock a expiré. Réessayez."));
    }, 15_000);
  });
  try {
    return await Promise.race([bounded, (async () => {
      const response = await fetch(`${API_URL}/api/checkout/pricing-quote?${params.toString()}`, {
        signal: controller.signal,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await response.json().catch(() => null) as (CheckoutPricingQuote & { error?: string; message?: string }) | null;
      if (!response.ok) {
        throw new Error(data?.error || data?.message || "Impossible de récupérer le devis de tarification");
      }
      if (!validQuote(data) || !pricingQuoteMatchesCart(data, cartItems, isB2B)) {
        throw new Error("Le devis de tarification reçu est incomplet ou ne correspond plus au panier. Réessayez.");
      }
      return data;
    })()]);
  } finally {
    if (timer) clearTimeout(timer);
    if (onAbort) signal?.removeEventListener("abort", onAbort);
  }
}
