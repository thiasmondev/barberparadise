/** Checkout-only safeguards. No financial fee calculation is performed in the browser. */
export type CheckoutStockIssue = {
  productId: string | null;
  variantId?: string | null;
  requestedQuantity: number;
  availableStock: number | null;
  productName?: string;
  message?: string;
  code?: string;
};

export type CheckoutStock = {
  productId: string;
  variantId?: string | null;
  stockCount?: number | null;
  realStockCount?: number | null;
  availableQuantity?: number | null;
  inStock?: boolean;
};

export type CheckoutFeeQuote = {
  baseTotalTTC: number;
  paymentFeeTTC: number;
  totalTTC: number;
  paymentFeePercent?: number;
  stockIssues?: CheckoutStockIssue[];
  items?: Array<{ productId: string | null; variantId?: string | null; availableStock?: number | null }>;
};

export const DRAFT_STOCK_NOTICE = "Offre initiale conservée : faites corriger le brouillon par Barber Paradise, puis rechargez ce lien. Les quantités disponibles affichées ne modifient ni les prix, ni les remises, ni les totaux de l’offre initiale. Le paiement reste bloqué jusque-là.";
export const PAYMENT_AMOUNT_UPDATED_MESSAGE = "Le montant a été mis à jour. Vérifiez le total puis confirmez à nouveau.";

export function checkoutLineKey(productId: string | null, variantId?: string | null): string {
  return `${productId}::${variantId || "product"}`;
}

export function getCheckoutStockIssue(issues: CheckoutStockIssue[], productId: string, variantId?: string | null): CheckoutStockIssue | undefined {
  return issues.find((issue) => checkoutLineKey(issue.productId, issue.variantId) === checkoutLineKey(productId, variantId));
}

export function stockIssueMessage(issue: CheckoutStockIssue, draft = false): string {
  if (issue.availableStock === null) return "Stock à vérifier : paiement suspendu jusqu’à confirmation.";
  return `Stock insuffisant : ${issue.requestedQuantity} demandé(s), ${issue.availableStock} disponible(s). ${draft ? "Quantité disponible affichée ; montant de l’offre initiale inchangé." : "Vérifiez la quantité dans votre panier avant de payer."}`;
}

/** Correct only the visible quantity: never rewrite the draft's financial lines. */
export function getAvailableDisplayQuantity(quantity: number, issue?: CheckoutStockIssue): number {
  return issue && issue.availableStock !== null ? Math.min(quantity, Math.max(0, Math.floor(issue.availableStock))) : quantity;
}

export function getDraftStockIssues(items: Array<{
  id: string; productId?: string | null; variantId?: string | null; quantity: number;
  name: string; availableStock?: number | null; realStockCount?: number | null; stockCount?: number | null; inStock?: boolean;
  isCustomSale?: boolean; variants?: Array<{ id: string; stock: number }>;
}>, provided: CheckoutStockIssue[] = []): CheckoutStockIssue[] {
  const issues = new Map(provided.map((issue) => [checkoutLineKey(issue.productId, issue.variantId), issue]));
  for (const item of items) {
    if (item.isCustomSale) continue;
    const stock = Object.prototype.hasOwnProperty.call(item, "availableStock") ? item.availableStock : item.realStockCount ?? (item.variantId ? item.variants?.find((variant) => variant.id === item.variantId)?.stock : item.stockCount);
    const available = item.inStock === false ? 0 : typeof stock === "number" && Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : null;
    if (available !== null && available < item.quantity) {
      const issue = { productId: item.productId || item.id, variantId: item.variantId, requestedQuantity: item.quantity, availableStock: available, productName: item.name };
      issues.set(checkoutLineKey(issue.productId, issue.variantId), issue);
    }
  }
  return Array.from(issues.values());
}

/** Race against a timer as well as aborting fetch, so even an unresponsive request settles. */
export async function withCheckoutTimeout<T>(request: (signal: AbortSignal) => Promise<T>, {
  signal,
  timeoutMs = 15000,
  timeoutMessage = "Le calcul a pris trop de temps. Réessayez ; vos derniers prix sont conservés.",
}: { signal?: AbortSignal; timeoutMs?: number; timeoutMessage?: string } = {}): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const interruption = new Promise<never>((_, reject) => {
    onAbort = () => {
      controller.abort();
      const error = new Error("Requête annulée");
      error.name = "AbortError";
      reject(error);
    };
    if (signal?.aborted) { onAbort(); return; }
    signal?.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => {
      // Reject first so the useful timeout message wins over fetch's AbortError.
      reject(new Error(timeoutMessage));
      controller.abort();
    }, timeoutMs);
  });
  try {
    return await Promise.race([interruption, signal?.aborted ? new Promise<T>(() => {}) : request(controller.signal)]);
  } finally {
    if (timer) clearTimeout(timer);
    if (onAbort) signal?.removeEventListener("abort", onAbort);
  }
}

export async function getCheckoutFeeQuote({
  apiUrl, payload, customerToken, signal, timeoutMs,
}: { apiUrl: string; payload: Record<string, unknown>; customerToken?: string | null; signal?: AbortSignal; timeoutMs?: number }): Promise<CheckoutFeeQuote> {
  return withCheckoutTimeout(async (requestSignal) => {
    const response = await fetch(`${apiUrl}/api/checkout/payment-quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(customerToken ? { Authorization: `Bearer ${customerToken}` } : {}) },
      body: JSON.stringify(payload), signal: requestSignal,
    });
    const quote = await response.json().catch(() => null) as (CheckoutFeeQuote & { error?: string }) | null;
    if (!response.ok) throw new Error(quote?.error || "Impossible de vérifier les frais de paiement. Réessayez.");
    if (!quote || ![quote.baseTotalTTC, quote.paymentFeeTTC, quote.totalTTC].every((amount) => typeof amount === "number" && Number.isFinite(amount) && amount >= 0)) {
      throw new Error("Le devis de frais reçu est incomplet. Réessayez avant de payer.");
    }
    return quote;
  }, { signal, timeoutMs, timeoutMessage: "Le calcul des frais a pris trop de temps. Réessayez avant de payer." });
}
