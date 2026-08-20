export type B2BSurchargePaymentMethod = "card" | "paypal";

export type B2BSurcharge = {
  percent: number;
  feeHT: number;
  feeVatRate: number;
  feeVatAmount: number;
  feeTTC: number;
  totalWithFeeTTC: number;
};

const ENV_BY_METHOD: Record<B2BSurchargePaymentMethod, string> = {
  card: "B2B_CARD_SURCHARGE_PERCENT",
  paypal: "B2B_PAYPAL_SURCHARGE_PERCENT",
};

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeNonNegativeAmount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * Lit un pourcentage de surcharge strictement positif.
 * Une variable absente, vide, invalide, négative ou supérieure à 100 désactive le moyen concerné.
 * Le choix protège le checkout : aucune méthode surtaxée n’est proposée sans configuration explicite.
 */
export function getB2BSurchargePercent(method: B2BSurchargePaymentMethod): number {
  const rawValue = process.env[ENV_BY_METHOD[method]]?.trim();
  if (!rawValue) return 0;

  const percent = Number(rawValue.replace(",", "."));
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
    console.warn(`[b2b-payment-surcharge] Configuration invalide pour ${ENV_BY_METHOD[method]} : méthode désactivée.`);
    return 0;
  }

  return percent;
}

/**
 * Un moyen B2B avec frais n’est accessible qu’après configuration explicite de son taux.
 * Pay by Bank n’est pas concerné et reste disponible sans frais via le routeur de paiement.
 */
export function isB2BMethodEnabled(method: B2BSurchargePaymentMethod): boolean {
  return getB2BSurchargePercent(method) > 0;
}

/**
 * Calcule un frais TTC à partir de la base HT et du taux de TVA applicable à la commande.
 * Le total HT passé peut inclure la livraison convertie en HT lorsque le frais doit porter
 * sur le total effectivement présenté au client.
 */
export function calculateB2BSurcharge(
  totalHT: number,
  vatRate: number,
  method: B2BSurchargePaymentMethod,
): B2BSurcharge {
  const normalizedTotalHT = normalizeNonNegativeAmount(totalHT);
  const normalizedVatRate = normalizeNonNegativeAmount(vatRate);
  const percent = getB2BSurchargePercent(method);
  const baseTTC = money(normalizedTotalHT * (1 + normalizedVatRate / 100));

  if (percent <= 0 || baseTTC <= 0) {
    return {
      percent: 0,
      feeHT: 0,
      feeVatRate: normalizedVatRate,
      feeVatAmount: 0,
      feeTTC: 0,
      totalWithFeeTTC: baseTTC,
    };
  }

  const feeTTC = money(baseTTC * (percent / 100));
  const feeHT = normalizedVatRate > 0 ? money(feeTTC / (1 + normalizedVatRate / 100)) : feeTTC;
  const feeVatAmount = money(feeTTC - feeHT);

  return {
    percent,
    feeHT,
    feeVatRate: normalizedVatRate,
    feeVatAmount,
    feeTTC,
    totalWithFeeTTC: money(baseTTC + feeTTC),
  };
}

/**
 * Retourne uniquement les informations publiques nécessaires au checkout.
 * Les taux non configurés ne sont pas exposés car les moyens associés restent invisibles.
 */
export function getB2BConfiguredSurcharges(): Partial<Record<B2BSurchargePaymentMethod, number>> {
  const entries = (Object.keys(ENV_BY_METHOD) as B2BSurchargePaymentMethod[])
    .map((method) => [method, getB2BSurchargePercent(method)] as const)
    .filter((entry): entry is readonly [B2BSurchargePaymentMethod, number] => entry[1] > 0);

  return Object.fromEntries(entries) as Partial<Record<B2BSurchargePaymentMethod, number>>;
}
