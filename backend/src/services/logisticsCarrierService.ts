import crypto from "crypto";

export type LogisticsCarrier =
  | "colissimo"
  | "mondial_relay"
  | "colissimo_international";

export const LOGISTICS_CARRIERS: Record<LogisticsCarrier, string> = {
  colissimo: "Colissimo domicile",
  mondial_relay: "Mondial Relay point relais",
  colissimo_international: "Colissimo international",
};

export type LabelSource = "carrier_api";

/**
 * Erreur de création d’étiquette enrichie d’un diagnostic transporteur.
 * Elle ne contient jamais la clé privée Mondial Relay ni le hash Security.
 */
export class CarrierLabelCreationError extends Error {
  constructor(
    message: string,
    public readonly rawResponse: Record<string, unknown>,
  ) {
    super(message);
    this.name = "CarrierLabelCreationError";
  }
}

export type ShipmentAddress = {
  firstName: string;
  lastName: string;
  address: string;
  extension?: string | null;
  postalCode: string;
  city: string;
  country: string;
  phone?: string | null;
  email?: string | null;
  companyName?: string | null;
};

export type ShipmentDimensions = {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

export type ShipmentQuoteOption = {
  insuranceValueCents?: number | null;
  signatureRequired?: boolean;
};

export type ShipmentQuoteInput = {
  orderNumber: string;
  customerEmail: string;
  recipient: ShipmentAddress;
  /** Expéditeur alternatif, utilisé pour une étiquette de retour client → Barber Paradise. */
  sender?: ShipmentAddress | null;
  totalWeightG: number;
  orderValueCents: number;
  packageDimensions?: ShipmentDimensions | null;
  requestedInsuranceValueCents?: number | null;
  carrierOptions?: Partial<Record<LogisticsCarrier, ShipmentQuoteOption>>;
};

export type ShipmentLabelInput = ShipmentQuoteInput & {
  carrier: LogisticsCarrier;
  offerId: string;
  insuranceValueCents: number;
  signatureRequired?: boolean;
  packagingId?: number | null;
  relayPointId?: string | null;
  /** Format du PDF d'étiquette demandé par l'admin : "100x150" (défaut) ou "A4" */
  labelPrintFormat?: "100x150" | "A4" | null;
};

export type ShipmentRateQuote = {
  id: string;
  carrier: LogisticsCarrier;
  carrierLabel: string;
  serviceCode: string;
  serviceLabel: string;
  deliveryMode: "home" | "relay";
  amountCents: number;
  currency: "EUR";
  priceTaxIncluded: boolean;
  priceTaxLabel: "HT" | "TTC";
  taxRate: number;
  taxAmountCents: number;
  totalWithTaxCents: number;
  insuranceValueCents: number;
  insuranceLabel: string;
  signatureAvailable: boolean;
  signatureRequired: boolean;
  contractNumberApplied: boolean;
  contractNumberSuffix: string | null;
  estimatedDeliveryDays: string;
  requiresRelayPoint: boolean;
  purchasable: boolean;
  configurationError: string | null;
  source: "contract_tariff_grid";
};

export type ShipmentLabelResult = {
  trackingNumber: string;
  carrierShipmentId: string | null;
  trackingUrl: string | null;
  labelPdfBase64: string | null;
  labelUrl: string | null;
  labelFormat: "PDF";
  labelSource: LabelSource;
  labelGeneratedAt: Date;
  labelStatus: "carrier_label_created";
  offerId: string;
  serviceCode: string;
  deliveryMode: "home" | "relay";
  relayPointId: string | null;
  priceCents: number;
  currency: "EUR";
  insuranceValueCents: number;
  priceTaxIncluded: boolean;
  priceTaxLabel: "HT" | "TTC";
  taxAmountCents: number;
  totalWithTaxCents: number;
  signatureRequired: boolean;
  rawResponse: Record<string, unknown> | null;
  notice: string | null;
};

export type TrackingResult = {
  trackingStatus: string;
  trackingUrl: string | null;
  rawResponse: Record<string, unknown> | null;
};

export type CancelShipmentLabelInput = {
  carrier: LogisticsCarrier;
  trackingNumber: string;
  carrierShipmentId?: string | null;
};

export type CancelShipmentLabelResult = {
  success: boolean;
  status: "cancelled";
  message: string;
  rawResponse: Record<string, unknown> | null;
};

type TariffStep = {
  maxWeightG: number;
  amountCents: number;
};

const DEFAULT_TARIFFS: Record<LogisticsCarrier, TariffStep[]> = {
  colissimo: [
    { maxWeightG: 250, amountCents: 499 },
    { maxWeightG: 500, amountCents: 699 },
    { maxWeightG: 750, amountCents: 799 },
    { maxWeightG: 1000, amountCents: 899 },
    { maxWeightG: 2000, amountCents: 999 },
    { maxWeightG: 5000, amountCents: 1499 },
    { maxWeightG: 10000, amountCents: 2199 },
    { maxWeightG: 30000, amountCents: 3299 },
  ],
  mondial_relay: [
    { maxWeightG: 500, amountCents: 359 },
    { maxWeightG: 1000, amountCents: 549 },
    { maxWeightG: 2000, amountCents: 669 },
    { maxWeightG: 3000, amountCents: 789 },
    { maxWeightG: 5000, amountCents: 999 },
    { maxWeightG: 7000, amountCents: 1299 },
    { maxWeightG: 10000, amountCents: 1599 },
    { maxWeightG: 30000, amountCents: 2499 },
  ],
  colissimo_international: [
    { maxWeightG: 500, amountCents: 1399 },
    { maxWeightG: 1000, amountCents: 1899 },
    { maxWeightG: 2000, amountCents: 2499 },
    { maxWeightG: 5000, amountCents: 3999 },
    { maxWeightG: 10000, amountCents: 5999 },
    { maxWeightG: 30000, amountCents: 10999 },
  ],
};

const COLISSIMO_INSURANCE_LEVELS = [0, 15000, 30000, 50000, 100000, 200000, 500000];
const COLISSIMO_MIN_INSURANCE_VALUE_CENTS = COLISSIMO_INSURANCE_LEVELS[1];
// Codes produits Colissimo compatibles avec l'option valeur assurée (doc SLS v3.0)
// Documentation Colissimo SLS : la valeur assurée est incompatible avec DOM sans signature.
// En France métropolitaine, elle est disponible avec DOS (Colissimo domicile avec signature).
const COLISSIMO_INSURANCE_COMPATIBLE_PRODUCT_CODES = new Set(["DOS", "CDS", "COLI"]);
const MONDIAL_RELAY_INSURANCE_LEVELS = [0, 2500, 5000, 12500, 25000, 50000];
const DEFAULT_CARRIER_VAT_RATE = 0.2;

function getColissimoContractNumber() {
  return (process.env.COLISSIMO_CONTRACT_NUMBER || "").trim();
}

function getColissimoPassword() {
  return (process.env.COLISSIMO_PASSWORD || process.env.COLISSIMO_API_KEY || "").trim();
}

function getMondialRelayEnseigne() {
  return (process.env.MONDIAL_RELAY_ENSEIGNE || "").trim();
}

function getMondialRelayPrivateKey() {
  return (process.env.MONDIAL_RELAY_PRIVATE_KEY || "").trim();
}

function quoteTaxMode(carrier: LogisticsCarrier): "HT" | "TTC" {
  const envKey = `LOGISTICS_${carrier.toUpperCase()}_PRICE_TAX_MODE`;
  const configured = (process.env[envKey] || process.env.LOGISTICS_CARRIER_PRICE_TAX_MODE || "TTC").trim().toUpperCase();
  return configured === "HT" ? "HT" : "TTC";
}

function enrichCarrierTax(amountCents: number, carrier: LogisticsCarrier) {
  const priceTaxLabel = quoteTaxMode(carrier);
  const priceTaxIncluded = priceTaxLabel === "TTC";
  const taxAmountCents = priceTaxIncluded ? 0 : Math.round(amountCents * DEFAULT_CARRIER_VAT_RATE);
  return {
    priceTaxIncluded,
    priceTaxLabel,
    taxRate: DEFAULT_CARRIER_VAT_RATE,
    taxAmountCents,
    totalWithTaxCents: amountCents + taxAmountCents,
  };
}

function xmlEscape(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Normalise un champ texte pour Mondial Relay (hash MD5 + body SOAP).
 * - Décompose les caractères accentués (NFD) et supprime les diacritiques
 * - Remplace les apostrophes doubles ('') par une apostrophe simple (')
 * - Supprime les caractères hors plage ASCII 32-126
 * - En mode adresse (uppercase=true) : filtre strict selon la whitelist MR
 *   ^[0-9A-Z _\-'.,/]{2,32}$ — les parenthèses, @, #, etc. sont supprimés
 * - Tronque à la longueur maximale si spécifiée
 * DOIT être appliqué de manière identique sur les valeurs du hash MD5
 * ET sur les valeurs du body SOAP pour garantir la cohérence.
 */
function normalizeMondialRelayText(value: string | number | null | undefined, maxLen?: number, uppercase = true): string {
  let s = String(value ?? "");
  // Décomposition Unicode NFD : é -> e + combining accent
  s = s.normalize("NFD");
  // Suppression des diacritiques (marques de combinaison Unicode U+0300–U+036F)
  s = s.replace(/[\u0300-\u036f]/g, "");
  // Remplacement des apostrophes doubles par une apostrophe simple
  s = s.replace(/''/g, "'");
  // Suppression des caractères hors ASCII 32-126
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[^\x20-\x7E]/g, "");
  // Normalisation des espaces multiples
  s = s.replace(/\s+/g, " ").trim();
  // Conversion en majuscules : Mondial Relay n'accepte que [A-Z] dans les champs adresse
  // (regex ^[0-9A-Z\_\-'., /]{2,32}$). Sans toUpperCase, les minuscules déclenchent STAT 33.
  // Ne pas mettre en majuscules les emails (STAT 39) ni les téléphones.
  if (uppercase) {
    s = s.toUpperCase();
    // Filtrage strict : supprime les caractères hors whitelist MR pour les champs adresse.
    // La regex MR autorise uniquement : chiffres, lettres majuscules, espace, _ - ' . , /
    // Les parenthèses (), crochets [], @, #, &, etc. ne sont pas autorisés et causent STAT 34.
    s = s.replace(/[^0-9A-Z _\-'.,/]/g, "");
    // Re-normaliser les espaces multiples après suppression des caractères
    s = s.replace(/\s+/g, " ").trim();
  }
  if (maxLen !== undefined && s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

/**
 * Normalise un numéro de téléphone pour Mondial Relay.
 * Contraintes (spec v5.11) : 10 chiffres, format 0XXXXXXXXX pour la France.
 * Transformations :
 *   - Supprime espaces, tirets, points, parenthèses
 *   - Convertit +33XXXXXXXXX ou 0033XXXXXXXXX en 0XXXXXXXXX
 *   - Si le résultat n'est pas 10 chiffres commençant par 0, retourne null (tag omis)
 */
function normalizeMondialRelayPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  // Supprime tout sauf les chiffres et le signe +
  let digits = phone.replace(/[^0-9+]/g, "");
  // Convertit +33XXXXXXXXX → 0XXXXXXXXX
  if (digits.startsWith("+33")) digits = "0" + digits.slice(3);
  // Convertit 0033XXXXXXXXX → 0XXXXXXXXX
  if (digits.startsWith("0033")) digits = "0" + digits.slice(4);
  // Supprime le + restant si présent
  digits = digits.replace(/\+/g, "");
  // Vérifie le format : 10 chiffres commençant par 0
  if (/^0[0-9]{9}$/.test(digits)) return digits;
  // Format non reconnu : retourne null (tag omis pour éviter STAT 38)
  return null;
}

/**
 * Construit un identifiant client valide pour le champ NClient de Mondial Relay.
 * Contraintes (spec v5.11) : alphanumérique, max 9 caractères, sans @ ni caractères spéciaux.
 * Stratégie : prend la partie avant le @ de l'email, supprime les caractères non alphanumériques,
 * tronque à 9 caractères en majuscules. Déterministe et stable pour un email donné.
 */
function buildMondialRelayNClient(email: string): string {
  const local = (email || "").split("@")[0] || "CLIENT";
  // Supprime tout ce qui n'est pas alphanumérique (tirets, points, +, etc.)
  const alnum = local.replace(/[^a-zA-Z0-9]/g, "");
  // Tronque à 9 caractères en majuscules
  return (alnum || "CLIENT").slice(0, 9).toUpperCase();
}

/**
 * Construit un numéro de dossier valide pour le champ NDossier de Mondial Relay.
 * Contraintes (spec v5.11) : alphanumérique, max 15 caractères.
 * Supprime les tirets, points et autres caractères non alphanumériques.
 * Ex: 'BP-2026-37866' → 'BP202637866'
 */
function buildMondialRelayNDossier(orderNumber: string): string {
  const alnum = (orderNumber || "").replace(/[^a-zA-Z0-9]/g, "");
  return (alnum || "ORDER").slice(0, 15).toUpperCase();
}

function getXmlValue(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, "i"));
  return match?.[1]?.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim() || null;
}

function getEnvJson<T>(key: string, fallback: T): T {
  const raw = process.env[key];
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeCountryCode(country: string | undefined | null) {
  const value = (country || "FR").trim().toUpperCase();
  if (["FR", "FRA", "FRANCE"].includes(value)) return "FR";
  if (["BE", "BEL", "BELGIQUE", "BELGIUM"].includes(value)) return "BE";
  if (["ES", "ESP", "ESPAGNE", "SPAIN"].includes(value)) return "ES";
  if (["DE", "DEU", "ALLEMAGNE", "GERMANY"].includes(value)) return "DE";
  return value.slice(0, 2);
}

function isFrance(country: string | undefined | null) {
  return normalizeCountryCode(country) === "FR";
}

function buildTrackingUrl(carrier: LogisticsCarrier, trackingNumber: string) {
  const encoded = encodeURIComponent(trackingNumber);
  if (carrier === "mondial_relay") {
    return `https://www.mondialrelay.fr/suivi-de-colis/?numeroExpedition=${encoded}`;
  }
  return `https://www.laposte.fr/outils/suivre-vos-envois?code=${encoded}`;
}

function hasCarrierCredentials(carrier: LogisticsCarrier) {
  if (carrier === "mondial_relay") {
    return Boolean(getMondialRelayEnseigne() && getMondialRelayPrivateKey());
  }
  return Boolean(getColissimoContractNumber() && getColissimoPassword());
}

function carrierConfigurationError(carrier: LogisticsCarrier) {
  if (hasCarrierCredentials(carrier)) return null;
  if (carrier === "mondial_relay") {
    return "MONDIAL_RELAY_ENSEIGNE et MONDIAL_RELAY_PRIVATE_KEY doivent être configurés pour acheter l’étiquette officielle Mondial Relay.";
  }
  return "COLISSIMO_CONTRACT_NUMBER et COLISSIMO_PASSWORD doivent être configurés pour acheter l’étiquette officielle Colissimo. COLISSIMO_API_KEY reste accepté comme alias de compatibilité pour le mot de passe.";
}

function tariffFor(carrier: LogisticsCarrier) {
  const envKey = `LOGISTICS_${carrier.toUpperCase()}_TARIFFS_JSON`;
  return getEnvJson<TariffStep[]>(envKey, DEFAULT_TARIFFS[carrier]);
}

function calculateBaseAmount(carrier: LogisticsCarrier, totalWeightG: number) {
  const tariff = tariffFor(carrier).sort((a, b) => a.maxWeightG - b.maxWeightG);
  const step = tariff.find(item => totalWeightG <= item.maxWeightG) || tariff[tariff.length - 1];
  return step.amountCents;
}

function insuranceLevel(carrier: LogisticsCarrier, orderValueCents: number, requestedInsuranceCents?: number) {
  const levels = carrier === "mondial_relay" ? MONDIAL_RELAY_INSURANCE_LEVELS : COLISSIMO_INSURANCE_LEVELS;
  const requested = Math.max(requestedInsuranceCents || 0, 0);
  return levels.find(level => level >= requested) ?? levels[levels.length - 1];
}

function insuranceSurcharge(carrier: LogisticsCarrier, insuranceValueCents: number) {
  if (insuranceValueCents <= 0) return 0;
  if (carrier === "mondial_relay") return Math.ceil(insuranceValueCents * 0.01);
  return Math.ceil(insuranceValueCents * 0.008);
}

function normalizeColissimoInsuranceValueCents(value: number | null | undefined) {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return 0;

  // Les routes admin transmettent déjà l’assurance en centimes. On conserve donc
  // l’entier tel quel afin qu’une saisie 150 € devienne 15000, sans double conversion.
  return Math.round(numericValue);
}

function assertColissimoInsuranceProductCompatibility(productCode: string, insuranceValueCents: number) {
  if (insuranceValueCents <= 0) return;
  if (!COLISSIMO_INSURANCE_COMPATIBLE_PRODUCT_CODES.has(productCode)) {
    throw new Error(
      `Le code produit Colissimo ${productCode} ne supporte pas l’option valeur assurée. Sélectionnez un service compatible ou désactivez l’assurance.`
    );
  }
}

function signatureSurcharge(carrier: LogisticsCarrier, signatureRequired?: boolean) {
  if (!signatureRequired) return 0;
  return carrier === "colissimo" || carrier === "colissimo_international" ? 150 : 0;
}

function buildOfferId(carrier: LogisticsCarrier, serviceCode: string, insuranceValueCents: number) {
  return `${carrier}:${serviceCode}:ins_${insuranceValueCents}`;
}

function parseOfferId(offerId: string) {
  const [carrier, serviceCode, insuranceToken] = offerId.split(":");
  const insuranceValueCents = Number((insuranceToken || "").replace("ins_", ""));
  if (!carrier || !serviceCode || Number.isNaN(insuranceValueCents)) {
    throw new Error("Offre transporteur invalide.");
  }
  return { carrier: carrier as LogisticsCarrier, serviceCode, insuranceValueCents };
}

export function buildShipmentQuotes(input: ShipmentQuoteInput): ShipmentRateQuote[] {
  const countryCode = normalizeCountryCode(input.recipient.country);
  const domestic = countryCode === "FR";
  const carriers: LogisticsCarrier[] = domestic
    ? ["colissimo", "mondial_relay"]
    : ["colissimo_international"];
  const colissimoContractNumber = getColissimoContractNumber();

  return carriers.map(carrier => {
    const carrierOption = input.carrierOptions?.[carrier];
    const requestedInsuranceValueCents = carrierOption?.insuranceValueCents ?? input.requestedInsuranceValueCents ?? undefined;
    const isColissimo = carrier === "colissimo" || carrier === "colissimo_international";
    const insuranceValueCents = insuranceLevel(carrier, input.orderValueCents, requestedInsuranceValueCents);
    // La valeur assurée nationale n’est disponible que sur DOS : l’option signature
    // est donc activée automatiquement et la proposition renseigne le bon code produit.
    const signatureRequired = isColissimo
      ? Boolean(carrierOption?.signatureRequired) || (carrier === "colissimo" && insuranceValueCents > 0)
      : false;
    const serviceCode = carrier === "mondial_relay"
      ? "24R"
      : carrier === "colissimo"
        ? (signatureRequired ? "DOS" : "DOM")
        : "COLI_INTER";
    const amountCents = calculateBaseAmount(carrier, input.totalWeightG) + insuranceSurcharge(carrier, insuranceValueCents) + signatureSurcharge(carrier, signatureRequired);
    const requiresRelayPoint = carrier === "mondial_relay";
    const tax = enrichCarrierTax(amountCents, carrier);
    return {
      id: buildOfferId(carrier, serviceCode, insuranceValueCents),
      carrier,
      carrierLabel: LOGISTICS_CARRIERS[carrier],
      serviceCode,
      serviceLabel: carrier === "mondial_relay" ? "Point Relais / Locker" : domestic ? "Domicile France" : `International ${countryCode}`,
      deliveryMode: carrier === "mondial_relay" ? "relay" : "home",
      amountCents,
      currency: "EUR",
      ...tax,
      insuranceValueCents,
      insuranceLabel: insuranceValueCents > 0 ? `Assurance jusqu’à ${(insuranceValueCents / 100).toLocaleString("fr-FR")} €` : "Assurance standard transporteur",
      signatureAvailable: isColissimo,
      signatureRequired,
      contractNumberApplied: isColissimo ? Boolean(colissimoContractNumber) : Boolean(getMondialRelayEnseigne()),
      contractNumberSuffix: isColissimo && colissimoContractNumber ? colissimoContractNumber.slice(-4) : carrier === "mondial_relay" && getMondialRelayEnseigne() ? getMondialRelayEnseigne().slice(-4) : null,
      estimatedDeliveryDays: carrier === "mondial_relay" ? "3 à 5 jours ouvrés" : domestic ? "2 jours ouvrés indicatifs" : "3 à 8 jours ouvrés indicatifs",
      requiresRelayPoint,
      purchasable: hasCarrierCredentials(carrier),
      configurationError: carrierConfigurationError(carrier),
      source: "contract_tariff_grid",
    } satisfies ShipmentRateQuote;
  });
}

type SoapBinaryResponse = {
  text: string;
  buffer: Buffer;
  contentType: string;
};

async function postSoapBinary(url: string, action: string, body: string): Promise<SoapBinaryResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: action,
    },
    body,
  });
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const text = buffer.toString("utf8");
  if (!response.ok) {
    throw new Error(`Erreur API transporteur ${response.status}: ${text.slice(0, 400)}`);
  }
  return {
    text,
    buffer,
    contentType: response.headers.get("content-type") || "",
  };
}

async function postSoap(url: string, action: string, body: string) {
  return (await postSoapBinary(url, action, body)).text;
}

function extractPdfBase64FromSoapResponse(response: SoapBinaryResponse): string | null {
  const pdfStart = response.buffer.indexOf(Buffer.from("%PDF"));
  if (pdfStart >= 0) {
    const eofMarker = Buffer.from("%%EOF");
    const pdfEnd = response.buffer.indexOf(eofMarker, pdfStart);
    const end = pdfEnd >= 0 ? pdfEnd + eofMarker.length : response.buffer.length;
    return response.buffer.subarray(pdfStart, end).toString("base64");
  }

  const xmlLabel = getXmlValue(response.text, "label") || getXmlValue(response.text, "labelResponse");
  if (!xmlLabel) return null;
  const compact = xmlLabel.replace(/\s+/g, "");
  if (!compact) return null;

  const decoded = Buffer.from(compact, "base64");
  if (decoded.indexOf(Buffer.from("%PDF")) >= 0) {
    return decoded.toString("base64");
  }
  return compact;
}

async function downloadPdfAsBase64(url: string) {
  // Les URLs Mondial Relay sont relatives (/StickersProxy/...) — préfixer le domaine.
  // Doc officielle v5.14 : "The value given by URL_Etiquette does not include the domain name and the protocol."
  // Domaine correct confirmé : https://www.mondialrelay.com (HTTP 200 + application/pdf)
  const absoluteUrl = url.startsWith("/") ? `https://www.mondialrelay.com${url}` : url;
  const response = await fetch(absoluteUrl);
  if (!response.ok) {
    throw new Error(`Impossible de télécharger l’étiquette officielle (${response.status}).`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer).toString("base64");
}

async function createColissimoLabel(input: ShipmentLabelInput, quote: ShipmentRateQuote): Promise<ShipmentLabelResult> {
  const contractNumber = getColissimoContractNumber();
  const password = getColissimoPassword();
  if (!contractNumber || !password) {
    throw new Error(carrierConfigurationError(input.carrier) || "Configuration Colissimo absente.");
  }

  const now = new Date();
  const depositDate = now.toISOString().slice(0, 10);
  // Codes produits Colissimo (doc SLS v3.0) :
  //   DOM = France sans signature, DOS = France avec signature (aussi international avec signature)
  //   COLI = International sans signature (seul code fonctionnel pour l'Europe/monde hors DOM-TOM)
  //   COM/CDS = DOM-TOM (Overseas France : Martinique, Guadeloupe, Réunion…) uniquement
  //   Note : COM retourne erreur 30213 pour les pays européens (BE, DE, etc.)
  const isFranceDom = input.carrier === "colissimo";
  const countryCode = normalizeCountryCode(input.recipient.country);
  const rawInsuranceValue = input.insuranceValueCents;
  const insuranceValue = normalizeColissimoInsuranceValueCents(rawInsuranceValue);
  // Réappliquer la règle côté serveur : le client ne peut pas transmettre une valeur assurée
  // avec DOM sans signature, même si le devis a été calculé avant une modification de l’UI.
  const signatureRequired = Boolean(input.signatureRequired) || (isFranceDom && insuranceValue > 0);
  const productCode = isFranceDom
    ? (signatureRequired ? "DOS" : "DOM")
    : (signatureRequired ? "DOS" : "COLI");
  assertColissimoInsuranceProductCompatibility(productCode, insuranceValue);
  const insuranceBlock = insuranceValue > 0
    ? `\n            <insuranceValue>${insuranceValue}</insuranceValue>`
    : "";
  const sender = input.sender || null;
  const senderName = sender?.companyName || `${sender?.firstName || ""} ${sender?.lastName || ""}`.trim() || process.env.LOGISTICS_SENDER_COMPANY || "Barber Paradise";
  const senderAddress = sender?.address || process.env.LOGISTICS_SENDER_ADDRESS || "Adresse expéditeur à configurer";
  const senderCountryCode = normalizeCountryCode(sender?.country || "France");
  const senderCity = sender?.city || process.env.LOGISTICS_SENDER_CITY || "Ville";
  const senderPostalCode = sender?.postalCode || process.env.LOGISTICS_SENDER_POSTAL_CODE || "00000";
  const senderEmail = sender?.email || process.env.LOGISTICS_SENDER_EMAIL || "contact@barberparadise.fr";

  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:sls="http://sls.ws.coliposte.fr">
  <soapenv:Header/>
  <soapenv:Body>
    <sls:generateLabel>
      <generateLabelRequest>
        <contractNumber>${xmlEscape(contractNumber)}</contractNumber>
        <password>${xmlEscape(password)}</password>
        <outputFormat>
          <x>0</x>
          <y>0</y>
          <outputPrintingType>PDF_10x15_300dpi</outputPrintingType>
        </outputFormat>
        <letter>
          <service>
            <productCode>${xmlEscape(productCode)}</productCode>
            <depositDate>${xmlEscape(depositDate)}</depositDate>
            <transportationAmount>${quote.amountCents}</transportationAmount>
            <totalAmount>${quote.amountCents}</totalAmount>
          </service>
          <parcel>${insuranceBlock}
            <weight>${Math.max(input.totalWeightG / 1000, 0.01).toFixed(3)}</weight>
            <nonMachinable>false</nonMachinable>
            ${isFranceDom ? "" : "<ftd>false</ftd>"}
          </parcel>
          <sender>
            <senderParcelRef>${xmlEscape(input.orderNumber)}</senderParcelRef>
            <address>
              <companyName>${xmlEscape(senderName)}</companyName>
              <line2>${xmlEscape(senderAddress)}</line2>
              <countryCode>${xmlEscape(senderCountryCode)}</countryCode>
              <city>${xmlEscape(senderCity)}</city>
              <zipCode>${xmlEscape(senderPostalCode)}</zipCode>
              <email>${xmlEscape(senderEmail)}</email>
            </address>
          </sender>
          <addressee>
            <addresseeParcelRef>${xmlEscape(input.orderNumber)}</addresseeParcelRef>
            <codeBarForReference>false</codeBarForReference>
            <serviceInfo>${xmlEscape(input.customerEmail)}</serviceInfo>
            <address>
              <lastName>${xmlEscape(input.recipient.lastName || input.recipient.firstName)}</lastName>
              <firstName>${xmlEscape(input.recipient.firstName)}</firstName>
              <line2>${xmlEscape(input.recipient.address)}</line2>
              <line3>${xmlEscape(input.recipient.extension || "")}</line3>
              <countryCode>${xmlEscape(countryCode)}</countryCode>
              <city>${xmlEscape(input.recipient.city)}</city>
              <zipCode>${xmlEscape(input.recipient.postalCode)}</zipCode>
              <phoneNumber>${xmlEscape(input.recipient.phone || "")}</phoneNumber>
              <email>${xmlEscape(input.customerEmail)}</email>
            </address>
          </addressee>
        </letter>
      </generateLabelRequest>
    </sls:generateLabel>
  </soapenv:Body>
</soapenv:Envelope>`;

  const endpoint = process.env.COLISSIMO_SLS_ENDPOINT || "https://ws.colissimo.fr/sls-ws/SlsServiceWS/2.0";
  // Le WSDL Colissimo SLS 2.0 expose generateLabel avec un SOAPAction vide.
  // Envoyer "generateLabel" provoque un rejet SOAP côté Colissimo.
  const soapResponse = await postSoapBinary(endpoint, '""', envelope);
  const xml = soapResponse.text;
  const trackingNumber = getXmlValue(xml, "parcelNumber") || getXmlValue(xml, "parcelNumberPartner");
  const pdfUrl = getXmlValue(xml, "pdfUrl");
  const labelBase64 = extractPdfBase64FromSoapResponse(soapResponse) || (pdfUrl ? await downloadPdfAsBase64(pdfUrl) : null);

  if (!trackingNumber) {
    const errorId = getXmlValue(xml, "id");
    const messageContent = getXmlValue(xml, "messageContent");
    if (errorId === "30309") {
      throw new Error(
        `Colissimo a refusé l’option valeur assurée (${insuranceValue / 100} €). ` +
        `L’envoi a été préparé avec signature (service ${productCode}). ` +
        `Si ce refus persiste, vérifiez dans votre contrat Colissimo que l’option valeur assurée est activée pour ce service.`
      );
    }
    throw new Error(
      `Colissimo n'a pas retourné de numéro de colis. ` +
      `[id=${errorId || "inconnu"} message=${messageContent || "sans détail"} productCode=${productCode} countryCode=${countryCode} postalCode=${input.recipient.postalCode}]`
    );
  }
  if (!labelBase64 && !pdfUrl) {
    throw new Error("Colissimo a créé l’expédition mais n’a pas retourné d’étiquette PDF exploitable.");
  }

  return {
    trackingNumber,
    carrierShipmentId: trackingNumber,
    trackingUrl: buildTrackingUrl(input.carrier, trackingNumber),
    labelPdfBase64: labelBase64,
    labelUrl: pdfUrl,
    labelFormat: "PDF",
    labelSource: "carrier_api",
    labelGeneratedAt: new Date(),
    labelStatus: "carrier_label_created",
    offerId: quote.id,
    serviceCode: quote.serviceCode,
    deliveryMode: quote.deliveryMode,
    relayPointId: input.relayPointId || null,
    priceCents: quote.amountCents,
    currency: quote.currency,
    insuranceValueCents: insuranceValue,
    priceTaxIncluded: quote.priceTaxIncluded,
    priceTaxLabel: quote.priceTaxLabel,
    taxAmountCents: quote.taxAmountCents,
    totalWithTaxCents: quote.totalWithTaxCents,
    signatureRequired,
    rawResponse: { carrier: "colissimo", offer: quote, productCode, rawInsuranceValue, insuranceValueCents: insuranceValue, signatureRequired, contractNumberApplied: Boolean(contractNumber), contractNumberSuffix: contractNumber ? contractNumber.slice(-4) : null, responseContentType: soapResponse.contentType, pdfExtractedFromMultipart: Boolean(labelBase64 && !getXmlValue(xml, "label") && !pdfUrl), responseXml: xml.slice(0, 4000) },
    notice: null,
  };
}

function mondialRelaySecurity(values: Array<string | number | null | undefined>) {
  const privateKey = getMondialRelayPrivateKey();
  return crypto.createHash("md5").update(values.map(value => String(value ?? "")).join("") + privateKey).digest("hex").toUpperCase();
}

async function createMondialRelayLabel(input: ShipmentLabelInput, quote: ShipmentRateQuote): Promise<ShipmentLabelResult> {
  const enseigne = getMondialRelayEnseigne();
  if (!enseigne || !getMondialRelayPrivateKey()) {
    throw new Error(carrierConfigurationError("mondial_relay") || "Configuration Mondial Relay absente.");
  }
  if (!input.relayPointId) {
    throw new Error("Un point relais est obligatoire pour acheter une étiquette Mondial Relay.");
  }

  const countryCode = normalizeCountryCode(input.recipient.country);
  const sender = input.sender || null;
  const senderCompanyRaw = sender?.companyName || `${sender?.firstName || ""} ${sender?.lastName || ""}`.trim() || process.env.LOGISTICS_SENDER_COMPANY || "Barber Paradise";
  const senderAddressRaw = sender?.address || process.env.LOGISTICS_SENDER_ADDRESS || "";
  const senderExtensionRaw = sender?.extension || process.env.LOGISTICS_SENDER_ADDRESS_2 || "";
  const senderCityRaw = sender?.city || process.env.LOGISTICS_SENDER_CITY || "";
  const senderPostalCodeRaw = sender?.postalCode || process.env.LOGISTICS_SENDER_POSTAL_CODE || "";
  const senderPhoneRaw = sender?.phone || process.env.LOGISTICS_SENDER_PHONE;
  const senderEmailRaw = sender?.email || process.env.LOGISTICS_SENDER_EMAIL || "contact@barberparadise.fr";
  // Poids en grammes. Mondial Relay exige un minimum de 100g (STAT 20 si < 100).
  // Si les produits n'ont pas de poids renseigné en base, totalWeightG peut être 0.
  const poids = Math.max(input.totalWeightG, 100).toString();
  const assurance = input.insuranceValueCents > 0 ? "1" : "0";
  const expValeur = Math.round(input.insuranceValueCents / 100).toString();
  const modeCol = process.env.MONDIAL_RELAY_MODE_COL || "CCC";
  const modeLiv = process.env.MONDIAL_RELAY_MODE_LIV || "24R";
  // NDossier : numéro de dossier alphanumérique max 15 caractères (contrainte Mondial Relay v5.11)
  // 'BP-2026-37866' → 'BP202637866' (tirets supprimés)
  const nDossier = buildMondialRelayNDossier(input.orderNumber);
  // NClient : identifiant client alphanumérique max 9 caractères (contrainte Mondial Relay v5.11)
  const nClient = buildMondialRelayNClient(input.customerEmail);
  // Normalisation ASCII des champs expéditeur (suppression accents, apostrophes doubles, etc.)
  // DOIT être identique entre le tableau values (hash MD5) et l'enveloppe SOAP.
  const expeAd1 = normalizeMondialRelayText(senderCompanyRaw, 32);
  // Spec MR v5.11 : Expe_Ad3 est obligatoire (min 2 car.). Si l'adresse est vide, on utilise
  // le nom de l'expéditeur comme fallback pour éviter STAT 33 (L3 invalide).
  const expeAd3Raw = normalizeMondialRelayText(senderAddressRaw, 32);
  const expeAd3 = expeAd3Raw.length >= 2 ? expeAd3Raw : normalizeMondialRelayText(senderCompanyRaw, 32);
  // Spec MR v5.11 : Expe_Ad4 est optionnel. Mondial Relay rejette une chaîne vide (STAT 34) :
  // il faut soit une valeur valide (min 2 car.), soit ne pas envoyer le tag du tout.
  const expeAd4Raw = normalizeMondialRelayText(senderExtensionRaw, 32);
  const expeAd4 = expeAd4Raw.length >= 2 ? expeAd4Raw : null;
  const expeVille = normalizeMondialRelayText(senderCityRaw, 26);
  // Spec MR v5.11 : Expe_Tel1 doit être au format 0XXXXXXXXX (10 chiffres).
  const expeTel1 = normalizeMondialRelayPhone(senderPhoneRaw);
  const expeMail = normalizeMondialRelayText(senderEmailRaw, 70, false);

  // Normalisation ASCII des champs texte destinataire (suppression accents, apostrophes doubles, etc.)
  // DOIT être identique entre le tableau values (hash MD5) et l'enveloppe SOAP.
  const destName = normalizeMondialRelayText(`${input.recipient.firstName} ${input.recipient.lastName}`.trim(), 32);
  const destAd3 = normalizeMondialRelayText(input.recipient.address, 32);
  const destAd4 = normalizeMondialRelayText(input.recipient.extension || "", 32);
  const destVille = normalizeMondialRelayText(input.recipient.city, 26);
  // Spec MR v5.11 : Dest_Tel1 doit être au format 0XXXXXXXXX.
  // Si le client n'a pas de téléphone ou format invalide, le tag est omis.
  const destPhone = normalizeMondialRelayPhone(input.recipient.phone);
  const destMail = normalizeMondialRelayText(input.recipient.email || input.customerEmail, 70, false);

  const values = [
    enseigne, modeCol, modeLiv, nDossier, nClient,
    "FR", expeAd1, "", expeAd3,
    // expeAd4 est null quand LOGISTICS_SENDER_ADDRESS_2 est vide : le hash doit utiliser "" dans ce cas
    expeAd4 ?? "", expeVille, senderPostalCodeRaw, "FR",
    // expeTel1 est null si le téléphone est absent/invalide : le hash utilise "" dans ce cas
    expeTel1 ?? "", "", expeMail,
    "FR", destName, "", destAd3, destAd4,
    destVille, input.recipient.postalCode, countryCode, destPhone ?? "", "", destMail,
    poids, input.packageDimensions?.lengthCm || "", "", "1", "0", "EUR", expValeur, "EUR",
    // COL_Rel_Pays, COL_Rel (vide), LIV_Rel_Pays, LIV_Rel (point relais de livraison)
    // Ordre identique à l'enveloppe SOAP : COL_Rel="", LIV_Rel=relayPointId
    "FR", "", "FR", input.relayPointId, "", "", "", "", assurance, "",
  ];
  const security = mondialRelaySecurity(values);
  // LOG DIAGNOSTIC STAT 34 — à retirer après résolution
  console.log("[MondialRelay][DIAG-V2] ENV brutes:", JSON.stringify({
    COMPANY: process.env.LOGISTICS_SENDER_COMPANY || "(absent)",
    ADDRESS: process.env.LOGISTICS_SENDER_ADDRESS || "(absent)",
    ADDRESS_2: process.env.LOGISTICS_SENDER_ADDRESS_2 || "(absent)",
    CITY: process.env.LOGISTICS_SENDER_CITY || "(absent)",
    POSTAL_CODE: process.env.LOGISTICS_SENDER_POSTAL_CODE || "(absent)",
    PHONE: process.env.LOGISTICS_SENDER_PHONE || "(absent)",
    EMAIL: process.env.LOGISTICS_SENDER_EMAIL || "(absent)",
  }));
  console.log("[MondialRelay][DIAG-V2] Champs normalisés expéditeur:", JSON.stringify({
    expeAd1,
    expeAd3,
    expeAd4: expeAd4 !== null ? expeAd4 : "(null — tag omis)",
    expeVille,
    expeCP: senderPostalCodeRaw,
    expeTel1: expeTel1 !== null ? expeTel1 : "(null — tag omis)",
    expeMail,
  }));
  console.log("[MondialRelay][DIAG-V2] Champs normalisés destinataire:", JSON.stringify({
    destName,
    destAd3,
    destAd4: destAd4.length >= 2 ? destAd4 : "(vide — tag omis)",
    destVille,
    destCP: input.recipient.postalCode,
    countryCode,
    destPhone: destPhone !== null ? destPhone : "(null — tag omis)",
    destMail,
  }));
  console.log("[MondialRelay][DIAG-V2] Autres:", JSON.stringify({ enseigne, nDossier, nClient, poids, relayPointId: input.relayPointId, assurance }));
  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <WSI2_CreationExpedition xmlns="http://www.mondialrelay.fr/webservice/">
      <Enseigne>${xmlEscape(enseigne)}</Enseigne><ModeCol>${xmlEscape(modeCol)}</ModeCol><ModeLiv>${xmlEscape(modeLiv)}</ModeLiv>
      <NDossier>${xmlEscape(nDossier)}</NDossier><NClient>${xmlEscape(nClient)}</NClient><Expe_Langage>FR</Expe_Langage>
      <Expe_Ad1>${xmlEscape(expeAd1)}</Expe_Ad1><Expe_Ad2></Expe_Ad2><Expe_Ad3>${xmlEscape(expeAd3)}</Expe_Ad3>${expeAd4 !== null ? `<Expe_Ad4>${xmlEscape(expeAd4)}</Expe_Ad4>` : ""}
      <Expe_Ville>${xmlEscape(expeVille)}</Expe_Ville><Expe_CP>${xmlEscape(senderPostalCodeRaw)}</Expe_CP><Expe_Pays>FR</Expe_Pays>${expeTel1 !== null ? `<Expe_Tel1>${xmlEscape(expeTel1)}</Expe_Tel1>` : ""}<Expe_Tel2></Expe_Tel2><Expe_Mail>${xmlEscape(expeMail)}</Expe_Mail>
      <Dest_Langage>FR</Dest_Langage><Dest_Ad1>${xmlEscape(destName)}</Dest_Ad1><Dest_Ad2></Dest_Ad2><Dest_Ad3>${xmlEscape(destAd3)}</Dest_Ad3>${destAd4.length >= 2 ? `<Dest_Ad4>${xmlEscape(destAd4)}</Dest_Ad4>` : ""}
      <Dest_Ville>${xmlEscape(destVille)}</Dest_Ville><Dest_CP>${xmlEscape(input.recipient.postalCode)}</Dest_CP><Dest_Pays>${xmlEscape(countryCode)}</Dest_Pays>${destPhone !== null ? `<Dest_Tel1>${xmlEscape(destPhone)}</Dest_Tel1>` : ""}<Dest_Tel2></Dest_Tel2><Dest_Mail>${xmlEscape(destMail)}</Dest_Mail>
      <Poids>${xmlEscape(poids)}</Poids><Longueur>${xmlEscape(input.packageDimensions?.lengthCm || "")}</Longueur><Taille></Taille><NbColis>1</NbColis>
      <CRT_Valeur>0</CRT_Valeur><CRT_Devise>EUR</CRT_Devise><Exp_Valeur>${xmlEscape(expValeur)}</Exp_Valeur><Exp_Devise>EUR</Exp_Devise><COL_Rel_Pays>FR</COL_Rel_Pays><COL_Rel></COL_Rel><LIV_Rel_Pays>FR</LIV_Rel_Pays><LIV_Rel>${xmlEscape(input.relayPointId)}</LIV_Rel><TAvisage></TAvisage><TReprise></TReprise><Montage></Montage><TRDV></TRDV><Assurance>${xmlEscape(assurance)}</Assurance><Instructions></Instructions><Security>${security}</Security>
    </WSI2_CreationExpedition>
  </soap:Body>
</soap:Envelope>`;

  const xml = await postSoap("https://api.mondialrelay.com/Web_Services.asmx", "http://www.mondialrelay.fr/webservice/WSI2_CreationExpedition", envelope);
  const status = getXmlValue(xml, "STAT");
  if (status && status !== "0") {
    const rawResponse = {
      carrier: "mondial_relay",
      operation: "WSI2_CreationExpedition",
      status,
      // Exclure volontairement l’enveloppe et Security : elles contiennent le hash sensible.
      responseXml: xml.slice(0, 4000),
      orderNumber: input.orderNumber,
      relayPointId: input.relayPointId || null,
      recipientPostalCode: input.recipient.postalCode,
      senderPostalCode: senderPostalCodeRaw,
      countryCode,
      totalWeightG: input.totalWeightG,
      insuranceValueCents: input.insuranceValueCents,
    };
    const details = status === "36"
      ? "Le code postal transmis a été refusé par Mondial Relay. Vérifiez le code postal de livraison et réessayez avec un point relais recherché pour cette adresse."
      : "Vérifiez les coordonnées ou les options de l’expédition, puis réessayez.";
    throw new CarrierLabelCreationError(
      `Mondial Relay a refusé la création d’expédition (STAT ${status}). ${details}`,
      rawResponse,
    );
  }
  const expeditionNum = getXmlValue(xml, "ExpeditionNum");
  const labelUrlDirect = getXmlValue(xml, "URL_Etiquette");
  if (!expeditionNum) {
    throw new CarrierLabelCreationError(
      "Mondial Relay n’a pas retourné de numéro d’expédition.",
      {
        carrier: "mondial_relay",
        operation: "WSI2_CreationExpedition",
        responseXml: xml.slice(0, 4000),
        orderNumber: input.orderNumber,
        relayPointId: input.relayPointId || null,
      },
    );
  }

  // Doc Mondial Relay v5.14 p.26 : URL_Etiquette contient format=A4 dans l'URL.
  // Pour obtenir le format 10x15 (100x150mm), il suffit de remplacer format=A4 par format=10x15.
  // Pas besoin d'appeler WSI3_GetEtiquettes — l'URL directe est plus fiable et plus rapide.
  const wantedFormat = (input.labelPrintFormat === "A4") ? "A4" : "10x15";
  let labelUrl: string | null = null;
  if (labelUrlDirect) {
    // Remplacer le param format dans l'URL Mondial Relay (format=A4 → format=10x15 ou inversement)
    labelUrl = labelUrlDirect.replace(/([?&]format=)[^&]*/i, `$1${wantedFormat}`);
    // Si l'URL ne contient pas de param format, l'ajouter manuellement
    if (!/[?&]format=/i.test(labelUrl)) {
      labelUrl += (labelUrl.includes("?") ? "&" : "?") + `format=${wantedFormat}`;
    }
  } else {
    // Fallback WSI3_GetEtiquettes si URL_Etiquette absente (cas rare)
    const getLabelValues = [enseigne, expeditionNum, "FR"];
    const getLabelSecurity = mondialRelaySecurity(getLabelValues);
    const getLabelEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><WSI3_GetEtiquettes xmlns="http://www.mondialrelay.fr/webservice/"><Enseigne>${xmlEscape(enseigne)}</Enseigne><Expeditions>${xmlEscape(expeditionNum)}</Expeditions><Langue>FR</Langue><Security>${getLabelSecurity}</Security></WSI3_GetEtiquettes></soap:Body></soap:Envelope>`;
    const labelXml = await postSoap("https://api.mondialrelay.com/Web_Services.asmx", "http://www.mondialrelay.fr/webservice/WSI3_GetEtiquettes", getLabelEnvelope);
    if (wantedFormat === "10x15") {
      labelUrl = getXmlValue(labelXml, "URL_PDF_10x15") || getXmlValue(labelXml, "URL_PDF_A5") || getXmlValue(labelXml, "URL_PDF_A4");
    } else {
      labelUrl = getXmlValue(labelXml, "URL_PDF_A4") || getXmlValue(labelXml, "URL_PDF_A5") || getXmlValue(labelXml, "URL_PDF_10x15");
    }
  }
  if (!labelUrl) {
    throw new Error("Mondial Relay a créé l’expédition mais n’a pas retourné d’URL d’étiquette PDF.");
  }

  return {
    trackingNumber: expeditionNum,
    carrierShipmentId: expeditionNum,
    trackingUrl: buildTrackingUrl("mondial_relay", expeditionNum),
    labelPdfBase64: await downloadPdfAsBase64(labelUrl),
    labelUrl,
    labelFormat: "PDF",
    labelSource: "carrier_api",
    labelGeneratedAt: new Date(),
    labelStatus: "carrier_label_created",
    offerId: quote.id,
    serviceCode: quote.serviceCode,
    deliveryMode: quote.deliveryMode,
    relayPointId: input.relayPointId || null,
    priceCents: quote.amountCents,
    currency: quote.currency,
    insuranceValueCents: input.insuranceValueCents,
    priceTaxIncluded: quote.priceTaxIncluded,
    priceTaxLabel: quote.priceTaxLabel,
    taxAmountCents: quote.taxAmountCents,
    totalWithTaxCents: quote.totalWithTaxCents,
    signatureRequired: false,
    rawResponse: { carrier: "mondial_relay", offer: quote, expeditionXml: xml.slice(0, 4000), labelUrl },
    notice: null,
  };
}

export async function createOfficialShipmentLabel(input: ShipmentLabelInput): Promise<ShipmentLabelResult> {
  const { carrier, serviceCode, insuranceValueCents } = parseOfferId(input.offerId);
  if (carrier !== input.carrier) {
    throw new Error("L’offre sélectionnée ne correspond pas au transporteur demandé.");
  }

  const quote = buildShipmentQuotes({ ...input, requestedInsuranceValueCents: input.insuranceValueCents }).find(item => item.carrier === carrier && item.serviceCode === serviceCode);
  if (!quote) {
    throw new Error("Offre transporteur introuvable ou incompatible avec cette commande.");
  }
  quote.id = input.offerId;
  quote.signatureRequired = carrier !== "mondial_relay" ? Boolean(input.signatureRequired) : false;
  if (!quote.purchasable) {
    throw new Error(quote.configurationError || "Identifiants transporteur manquants.");
  }

  const normalizedInsuranceValueCents = Number(input.insuranceValueCents || 0) > 0 ? input.insuranceValueCents : 0;
  const normalizedInput = { ...input, insuranceValueCents: normalizedInsuranceValueCents };
  if (serviceCode === "24R" || carrier === "mondial_relay") {
    try {
      return await createMondialRelayLabel(normalizedInput, quote);
    } catch (error) {
      if (error instanceof CarrierLabelCreationError) {
        throw error;
      }
      throw new CarrierLabelCreationError(
        error instanceof Error ? error.message : "Erreur inconnue lors de la création Mondial Relay.",
        {
          carrier: "mondial_relay",
          operation: "WSI2_CreationExpedition",
          orderNumber: input.orderNumber,
          relayPointId: input.relayPointId || null,
          recipientPostalCode: input.recipient.postalCode,
          senderPostalCode: input.sender?.postalCode || process.env.LOGISTICS_SENDER_POSTAL_CODE || null,
          totalWeightG: input.totalWeightG,
          insuranceValueCents: normalizedInsuranceValueCents,
          errorType: error instanceof Error ? error.name : "UnknownError",
        },
      );
    }
  }
  return createColissimoLabel(normalizedInput, quote);
}

async function cancelColissimoLabel(input: CancelShipmentLabelInput): Promise<CancelShipmentLabelResult> {
  const parcelNumber = input.trackingNumber || input.carrierShipmentId;
  if (!parcelNumber) {
    throw new Error("Numéro de colis Colissimo obligatoire pour annuler l’étiquette.");
  }

  // Le WSDL Colissimo SLS 2.0 ne publie aucune opération d’annulation
  // (`cancelLabel`, `deleteLabel` ou équivalent). Appeler une opération non
  // déclarée renvoie une Fault SOAP 500 du type :
  // "Message part {http://sls.ws.coliposte.fr}cancelLabel was not recognized".
  // L’annulation est donc traitée côté Barber Paradise pour les étiquettes non
  // scannées ; la route admin bloque déjà les colis expédiés, scannés ou livrés.
  return {
    success: true,
    status: "cancelled",
    message: "L’étiquette a été annulée. Le remboursement sera crédité sous 48h.",
    rawResponse: {
      carrier: input.carrier,
      trackingNumber: parcelNumber,
      mode: "administrative_cancellation",
      reason: "Colissimo SLS 2.0 n’expose pas d’opération SOAP d’annulation d’étiquette.",
    },
  };
}

async function cancelMondialRelayLabel(input: CancelShipmentLabelInput): Promise<CancelShipmentLabelResult> {
  const enseigne = getMondialRelayEnseigne();
  if (!enseigne || !getMondialRelayPrivateKey()) {
    throw new Error(carrierConfigurationError("mondial_relay") || "Configuration Mondial Relay absente.");
  }

  const expeditionNum = input.carrierShipmentId || input.trackingNumber;
  if (!expeditionNum) {
    throw new Error("Numéro d’expédition Mondial Relay obligatoire pour annuler l’étiquette.");
  }

  const values = [enseigne, expeditionNum];
  const security = mondialRelaySecurity(values);
  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <WSI2_AnnulationExpedition xmlns="http://www.mondialrelay.fr/webservice/">
      <Enseigne>${xmlEscape(enseigne)}</Enseigne>
      <Expedition>${xmlEscape(expeditionNum)}</Expedition>
      <Security>${security}</Security>
    </WSI2_AnnulationExpedition>
  </soap:Body>
</soap:Envelope>`;

  const xml = await postSoap("https://api.mondialrelay.com/Web_Services.asmx", "http://www.mondialrelay.fr/webservice/WSI2_AnnulationExpedition", envelope);
  const status = getXmlValue(xml, "STAT");
  if (status && status !== "0") {
    throw new Error(`Mondial Relay a refusé l’annulation (STAT ${status}).`);
  }

  return {
    success: true,
    status: "cancelled",
    message: "L’étiquette a été annulée. Le remboursement sera crédité sous 48h.",
    rawResponse: {
      carrier: "mondial_relay",
      trackingNumber: expeditionNum,
      xml: xml.slice(0, 2000),
    },
  };
}

export async function cancelOfficialShipmentLabel(input: CancelShipmentLabelInput): Promise<CancelShipmentLabelResult> {
  if (input.carrier === "mondial_relay") {
    return cancelMondialRelayLabel(input);
  }
  return cancelColissimoLabel(input);
}

export async function fetchShipmentTracking(carrier: LogisticsCarrier, trackingNumber: string | null | undefined): Promise<TrackingResult> {
  if (!trackingNumber) {
    return { trackingStatus: "Numéro de suivi absent", trackingUrl: null, rawResponse: null };
  }

  return {
    trackingStatus: "Suivi prêt — consultez le lien officiel du transporteur",
    trackingUrl: buildTrackingUrl(carrier, trackingNumber),
    rawResponse: { carrier, trackingNumber },
  };
}
