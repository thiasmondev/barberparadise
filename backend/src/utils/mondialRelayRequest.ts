import crypto from "node:crypto";

// WSI2_CreationExpedition order, including empty optional parameters.
// Source: Mondial Relay Web Service Solution v5.3, shipment creation input table.
export const MONDIAL_RELAY_CREATION_FIELDS = [
  "Enseigne", "ModeCol", "ModeLiv", "NDossier", "NClient",
  "Expe_Langage", "Expe_Ad1", "Expe_Ad2", "Expe_Ad3", "Expe_Ad4", "Expe_Ville", "Expe_CP", "Expe_Pays", "Expe_Tel1", "Expe_Tel2", "Expe_Mail",
  "Dest_Langage", "Dest_Ad1", "Dest_Ad2", "Dest_Ad3", "Dest_Ad4", "Dest_Ville", "Dest_CP", "Dest_Pays", "Dest_Tel1", "Dest_Tel2", "Dest_Mail",
  "Poids", "Longueur", "Taille", "NbColis", "CRT_Valeur", "CRT_Devise", "Exp_Valeur", "Exp_Devise", "COL_Rel_Pays", "COL_Rel", "LIV_Rel_Pays", "LIV_Rel",
  "TAvisage", "TReprise", "Montage", "TRDV", "Assurance", "Instructions",
] as const;
export type MondialRelayCreationField = typeof MONDIAL_RELAY_CREATION_FIELDS[number];
export type MondialRelayRawParameters = Partial<Record<MondialRelayCreationField, string | number | null | undefined>>;
export type MondialRelayParameters = Readonly<Record<MondialRelayCreationField, string>>;

function normalizeTypography(value: string) {
  return value
    .replace(/[‘’‛ʼ`´]/g, "'")
    .replace(/[«»“”„‟]/g, '"')
    .replace(/[‐‑‒–—―−]/g, "-")
    .replace(/[\u00a0\u202f\u2007]/g, " ");
}
function asciiText(value: string) {
  return normalizeTypography(value)
    .replace(/[œŒ]/g, (c) => c === "œ" ? "oe" : "OE")
    .replace(/[æÆ]/g, (c) => c === "æ" ? "ae" : "AE")
    .replace(/ß/g, "ss").replace(/[øØ]/g, (c) => c === "ø" ? "o" : "O")
    .normalize("NFD").replace(/\p{M}/gu, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/'{2,}/g, "'").replace(/\s+/g, " ").trim();
}
function normalizePhone(value: string) {
  let phone = value.replace(/[^0-9+]/g, "");
  if (phone.startsWith("+33")) phone = "0" + phone.slice(3);
  if (phone.startsWith("0033")) phone = "0" + phone.slice(4);
  return /^0[0-9]{9}$/.test(phone) ? phone : "";
}

/** Apply once, before signing. Neither raw input nor saved client addresses are changed. */
export function normalizeMondialRelayParameter(field: MondialRelayCreationField, value: string | number | null | undefined): string {
  const raw = String(value ?? "");
  // Do not uppercase or rewrite the local part of an email address.
  // Existing email validation remains responsible for format validation.
  if (field.endsWith("_Mail")) return raw.trim().slice(0, 70);
  if (/_Tel[12]$/.test(field)) return normalizePhone(raw);
  let text = asciiText(raw);
  if (/_Ad[1-4]$/.test(field)) {
    text = text.toUpperCase().replace(/[^0-9A-Z _\-'.,/]/g, "");
    return text.replace(/\s+/g, " ").trim().slice(0, 32);
  }
  if (field.endsWith("_Ville")) {
    return text.toUpperCase().replace(/[^A-Z _\-']/g, "").replace(/\s+/g, " ").trim().slice(0, 26);
  }
  if (field === "NDossier") return text.toUpperCase().replace(/[^0-9A-Z_ -]/g, "").slice(0, 15);
  if (field === "NClient") return text.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 9);
  if (field === "Instructions") return text.toUpperCase().replace(/[^0-9A-Z _\-'.,/]/g, "").slice(0, 30);
  // Countries, postal codes, modes and numeric values have already been selected
  // by the business layer. Trim once; signing and serialization share this value.
  return text;
}
export function normalizeMondialRelayParameters(raw: MondialRelayRawParameters): MondialRelayParameters {
  const parameters = {} as Record<MondialRelayCreationField, string>;
  for (const field of MONDIAL_RELAY_CREATION_FIELDS) parameters[field] = normalizeMondialRelayParameter(field, raw[field]);
  return Object.freeze(parameters);
}
function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
const OMIT_IF_EMPTY = new Set<MondialRelayCreationField>(["Expe_Ad4", "Dest_Ad4", "Expe_Tel1", "Dest_Tel1"]);
export function buildMondialRelayCreationRequest(raw: MondialRelayRawParameters, privateKey: string) {
  const parameters = normalizeMondialRelayParameters(raw);
  const security = crypto.createHash("md5")
    .update(MONDIAL_RELAY_CREATION_FIELDS.map((field) => parameters[field]).join("") + privateKey, "utf8")
    .digest("hex").toUpperCase();
  // Optional address lines accept 0..32 chars. A single "3" is valid and MUST
  // be sent when present in the signature. Never apply a second min-length rule.
  const body = MONDIAL_RELAY_CREATION_FIELDS.map((field) => {
    const value = parameters[field];
    if (!value && OMIT_IF_EMPTY.has(field)) return "";
    return `<${field}>${escapeXml(value)}</${field}>`;
  }).join("");
  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><WSI2_CreationExpedition xmlns="http://www.mondialrelay.fr/webservice/">${body}<Security>${security}</Security></WSI2_CreationExpedition></soap:Body></soap:Envelope>`;
  // Never persist or log the envelope/security; only the parameter object is safe
  // for an authorized admin's shipment diagnostic.
  return { parameters, envelope };
}
