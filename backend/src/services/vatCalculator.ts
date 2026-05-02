export const EU_COUNTRIES = [
  "FR",
  "BE",
  "NL",
  "DE",
  "IT",
  "ES",
  "PT",
  "AT",
  "LU",
  "IE",
  "GR",
  "FI",
  "SE",
  "DK",
  "PL",
  "CZ",
  "HU",
  "RO",
  "SK",
  "SI",
  "HR",
  "BG",
  "LT",
  "LV",
  "EE",
  "CY",
  "MT",
];

export type VatRegime = "standard" | "reverse_charge" | "export_exempt";

export function normalizeVatCountry(country: string | undefined | null): string {
  return (country || "FR").trim().toUpperCase();
}

export function getVatRate(country: string, isB2B: boolean, vatNumber?: string): number {
  const normalizedCountry = normalizeVatCountry(country);

  if (!EU_COUNTRIES.includes(normalizedCountry)) return 0;

  if (isB2B && vatNumber && normalizedCountry !== "FR") return 0;

  return 20;
}

export function getVatRegime(country: string, isB2B: boolean, vatNumber?: string): VatRegime {
  const normalizedCountry = normalizeVatCountry(country);

  if (!EU_COUNTRIES.includes(normalizedCountry)) return "export_exempt";

  if (isB2B && vatNumber && normalizedCountry !== "FR") return "reverse_charge";

  return "standard";
}

export function getVatEmailLabel(params: { country: string; isB2B: boolean; vatNumber?: string; vatRate?: number }): string {
  const regime = getVatRegime(params.country, params.isB2B, params.vatNumber);

  if (regime === "reverse_charge") return "TVA : 0% — Autoliquidation (art. 283-2 du CGI)";
  if (regime === "export_exempt") return "TVA : 0% — Exportation exonérée";

  return `TVA (${params.vatRate ?? 20}%)`;
}
