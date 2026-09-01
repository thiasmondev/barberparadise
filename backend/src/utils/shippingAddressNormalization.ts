/**
 * Les exports Excel/CSV préfixent parfois les champs texte par une apostrophe
 * (ex. `'01250` ou `'0612345678`). Cette apostrophe ne fait pas partie de
 * l’adresse ni du téléphone et est rejetée par certains transporteurs.
 *
 * Ne supprimer que les apostrophes en début de valeur : les signes `+`, espaces,
 * tirets et formats internationaux de téléphone sont volontairement conservés.
 */
export function stripImportedLeadingApostrophe(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/^[\u0027\u2018\u2019\u02BC]+\s*/, "").trim();
}

export function normalizeShippingAddressContact<T extends { postalCode?: unknown; phone?: unknown }>(address: T): T & {
  postalCode: string;
  phone: string;
} {
  return {
    ...address,
    postalCode: stripImportedLeadingApostrophe(address.postalCode),
    phone: stripImportedLeadingApostrophe(address.phone),
  };
}
