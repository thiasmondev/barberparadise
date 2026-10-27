/**
 * Professional account status and the applied tariff are deliberately separate.
 *
 * A professional account keeps B2B invoicing/tax/payment rules. Its basket only
 * receives an explicit professional SKU price once the qualifying HT subtotal
 * reaches the configured threshold. Items without their own professional price
 * always keep their retail value (converted to HT for a B2B invoice).
 */

export type PricingTier = "pro" | "retail";
export type PriceSource = "pro" | "retail";

export type PricingCatalogItem = {
  productId: string;
  variantId?: string | null;
  quantity: number;
  publicUnitTTC: number;
  /** Own professional price only. A selected variant never inherits its parent. */
  ownProfessionalUnitHT?: number | null;
};

export type ResolvedPricingLine = {
  productId: string;
  variantId: string | null;
  quantity: number;
  retailUnitTTC: number;
  retailUnitHT: number;
  proUnitHT: number | null;
  appliedUnitHT: number;
  appliedUnitTTC: number;
  priceSource: PriceSource;
};

export type ProfessionalPricingResolution = {
  isB2B: boolean;
  pricingTier: PricingTier;
  thresholdHT: number;
  qualifyingSubtotalHT: number;
  remainingHT: number;
  progressPercent: number;
  lines: ResolvedPricingLine[];
};

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Environment-backed so the policy can be adjusted without a code deployment.
 * Invalid or absent configuration intentionally falls back to the agreed €200 HT.
 */
export function getProfessionalPricingThresholdHT(): number {
  const configured = Number(process.env.PRO_PRICE_THRESHOLD_HT || "200");
  return Number.isFinite(configured) && configured >= 0 ? money(configured) : 200;
}

function validOwnProfessionalPrice(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? money(value)
    : null;
}

/**
 * Resolves the basket with a non-circular qualifying base: own pro HT prices
 * when present, otherwise public TTC converted to retail HT, before discounts,
 * shipping or payment fees.
 */
export function resolveProfessionalPricing(input: {
  isB2B: boolean;
  vatRate: number;
  items: PricingCatalogItem[];
  pricingTierOverride?: PricingTier;
}): ProfessionalPricingResolution {
  const thresholdHT = getProfessionalPricingThresholdHT();
  const vatMultiplier = 1 + Math.max(0, Number(input.vatRate) || 0) / 100;
  const normalizedItems = input.items.map((item) => {
    const quantity = Number.isInteger(item.quantity) && item.quantity > 0 ? item.quantity : 0;
    const retailUnitTTC = money(Math.max(0, Number(item.publicUnitTTC) || 0));
    const retailUnitHT = money(retailUnitTTC / 1.2);
    return {
      ...item,
      quantity,
      retailUnitTTC,
      retailUnitHT,
      proUnitHT: validOwnProfessionalPrice(item.ownProfessionalUnitHT),
    };
  });

  const qualifyingSubtotalHT = money(normalizedItems.reduce(
    (sum, item) => sum + (item.proUnitHT ?? item.retailUnitHT) * item.quantity,
    0,
  ));
  const pricingTier: PricingTier = input.pricingTierOverride
    || (input.isB2B && qualifyingSubtotalHT >= thresholdHT ? "pro" : "retail");

  const lines = normalizedItems.map((item) => {
    const useProfessionalPrice = input.isB2B && pricingTier === "pro" && item.proUnitHT !== null;
    const appliedUnitHT = useProfessionalPrice ? item.proUnitHT! : item.retailUnitHT;
    return {
      productId: item.productId,
      variantId: item.variantId || null,
      quantity: item.quantity,
      retailUnitTTC: item.retailUnitTTC,
      retailUnitHT: item.retailUnitHT,
      proUnitHT: item.proUnitHT,
      appliedUnitHT,
      appliedUnitTTC: money(appliedUnitHT * vatMultiplier),
      priceSource: (useProfessionalPrice ? "pro" : "retail") as PriceSource,
    };
  });

  const remainingHT = input.isB2B && pricingTier === "retail"
    ? money(Math.max(0, thresholdHT - qualifyingSubtotalHT))
    : 0;
  const progressPercent = !input.isB2B || thresholdHT === 0
    ? 100
    : Math.min(100, money((qualifyingSubtotalHT / thresholdHT) * 100));

  return {
    isB2B: input.isB2B,
    pricingTier,
    thresholdHT,
    qualifyingSubtotalHT,
    remainingHT,
    progressPercent,
    lines,
  };
}
