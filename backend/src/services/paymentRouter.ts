export type PaymentMethod =
  | "card"
  | "paybybank"
  | "pay_by_bank"
  | "sepa"
  | "paypal"
  | "paypal_4x"
  | "apple_pay"
  | "google_pay"
  | "bancontact"
  | "ideal"
  | "blik"
  | "mb_way"
  | "multibanco";

export type PaymentProvider = "mollie" | "paypal";
export type Provider = PaymentProvider;

export const EEE_COUNTRIES = [
  "FR",
  "BE",
  "NL",
  "DE",
  "IT",
  "ES",
  "PT",
  "AT",
  "CH",
  "SE",
  "NO",
  "DK",
  "FI",
  "PL",
  "CZ",
  "HU",
  "RO",
  "GR",
  "IE",
  "LU",
  "SI",
  "SK",
  "HR",
  "BG",
  "LT",
  "LV",
  "EE",
  "CY",
  "MT",
  "IS",
  "LI",
  "GB",
] as const;

const EEE_COUNTRY_SET = new Set<string>(EEE_COUNTRIES);

export const SUPPORTED_PAYMENT_METHODS: PaymentMethod[] = [
  "card",
  "paybybank",
  "pay_by_bank",
  "sepa",
  "paypal",
  "paypal_4x",
  "apple_pay",
  "google_pay",
  "bancontact",
  "ideal",
  "blik",
  "mb_way",
  "multibanco",
];

export const MOLLIE_METHOD_MAP: Record<Exclude<PaymentMethod, "paypal" | "paypal_4x">, string[]> = {
  card: ["creditcard"],
  paybybank: ["paybybank"],
  pay_by_bank: ["banktransfer"],
  sepa: ["directdebit"],
  apple_pay: ["applepay"],
  google_pay: ["googlepay"],
  bancontact: ["bancontact"],
  ideal: ["ideal"],
  blik: ["blik"],
  mb_way: ["mbway"],
  multibanco: ["multibanco"],
};

const LOCAL_METHODS_BY_COUNTRY: Partial<Record<string, PaymentMethod[]>> = {
  BE: ["bancontact"],
  NL: ["ideal"],
  PL: ["blik"],
  PT: ["mb_way", "multibanco"],
};

export function normalizeCountry(country?: string): string {
  return (country || "FR").trim().toUpperCase();
}

export function getAvailableMethods(country: string, isB2B: boolean): PaymentMethod[] {
  const normalizedCountry = normalizeCountry(country);

  if (!EEE_COUNTRY_SET.has(normalizedCountry)) {
    return [];
  }

  if (isB2B) {
    // B2B : Pay by Bank uniquement (open banking Mollie — confirmation quasi instantanée)
    return ["paybybank"];
  }

  // B2C : carte + Pay by Bank + PayPal standard + PayPal 4x + Apple Pay + Google Pay (conditionnel côté client)
  // sepa (prélèvement) : retiré
  const commonMethods: PaymentMethod[] = ["card", "paybybank", "paypal", "paypal_4x", "apple_pay", "google_pay"];
  const localMethods = LOCAL_METHODS_BY_COUNTRY[normalizedCountry] || [];
  return [...commonMethods, ...localMethods];
}

export function getProvider(method: PaymentMethod, country = "FR"): PaymentProvider {
  if (method === "paypal" || method === "paypal_4x") return "paypal";
  return "mollie";
}

export function getPaymentProvider(params: { method: PaymentMethod; country?: string; cardCountry?: string; isB2B?: boolean }): PaymentProvider {
  return getProvider(params.method, params.country || params.cardCountry || "FR");
}

export function getMollieLocale(country: string): string {
  const locales: Record<string, string> = {
    FR: "fr_FR",
    BE: "fr_BE",
    NL: "nl_NL",
    DE: "de_DE",
    IT: "it_IT",
    ES: "es_ES",
    PT: "pt_PT",
    AT: "de_AT",
    CH: "de_CH",
    SE: "sv_SE",
    NO: "nb_NO",
    DK: "da_DK",
    FI: "fi_FI",
    PL: "pl_PL",
    GB: "en_GB",
  };
  return locales[normalizeCountry(country)] || "fr_FR";
}

export function assertSupportedPaymentMethod(method: string): asserts method is PaymentMethod {
  if (!SUPPORTED_PAYMENT_METHODS.includes(method as PaymentMethod)) {
    throw new Error("Méthode de paiement non supportée");
  }
}
