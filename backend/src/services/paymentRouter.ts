export type PaymentMethod = "card" | "paypal" | "bank_transfer" | "sepa_debit";
export type PaymentProvider = "mollie" | "paypal" | "fintecture" | "gocardless" | "checkout";

const EEA_COUNTRIES = new Set([
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
]);

export function getPaymentProvider(params: {
  method: PaymentMethod;
  cardCountry?: string;
  isB2B?: boolean;
}): PaymentProvider {
  if (params.method === "paypal") return "paypal";
  if (params.method === "bank_transfer") return "fintecture";
  if (params.method === "sepa_debit" && params.isB2B) return "gocardless";

  const normalizedCountry = params.cardCountry?.trim().toUpperCase();
  if (params.method === "card" && normalizedCountry && EEA_COUNTRIES.has(normalizedCountry)) {
    return "mollie";
  }

  return "checkout";
}

export function assertSupportedPaymentMethod(method: string): asserts method is PaymentMethod {
  const supported: PaymentMethod[] = ["card", "paypal", "bank_transfer", "sepa_debit"];
  if (!supported.includes(method as PaymentMethod)) {
    throw new Error("Méthode de paiement non supportée");
  }
}
