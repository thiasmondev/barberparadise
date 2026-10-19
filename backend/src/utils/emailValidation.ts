/**
 * Validation volontairement pragmatique des adresses utilisées pour les
 * commandes, paiements et notifications. Elle bloque notamment les valeurs
 * telles que "prenomnomdomaine.fr", qui ne peuvent pas être remises aux
 * prestataires de livraison ou de messagerie.
 */
const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmailAddress(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidEmailAddress(value: unknown): boolean {
  const email = normalizeEmailAddress(value);
  return email.length <= 254 && EMAIL_ADDRESS_PATTERN.test(email);
}
