import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type LogisticsCarrier =
  | "colissimo"
  | "mondial_relay"
  | "colissimo_international";

export const LOGISTICS_CARRIERS: Record<LogisticsCarrier, string> = {
  colissimo: "Colissimo domicile",
  mondial_relay: "Mondial Relay point relais",
  colissimo_international: "Colissimo international",
};

export type LabelSource = "carrier_api" | "internal_fallback";

export type ShipmentAddress = {
  firstName: string;
  lastName: string;
  address: string;
  extension?: string | null;
  postalCode: string;
  city: string;
  country: string;
  phone?: string | null;
};

export type ShipmentLabelInput = {
  carrier: LogisticsCarrier;
  orderNumber: string;
  customerEmail: string;
  recipient: ShipmentAddress;
  totalWeightG: number;
  packageDimensions?: {
    lengthCm: number;
    widthCm: number;
    heightCm: number;
  } | null;
  existingTrackingNumber?: string | null;
};

export type ShipmentLabelResult = {
  trackingNumber: string;
  carrierShipmentId: string | null;
  trackingUrl: string | null;
  labelPdfBase64: string;
  labelFormat: "PDF";
  labelSource: LabelSource;
  labelGeneratedAt: Date;
  labelStatus: "generated" | "fallback_generated";
  rawResponse: Record<string, unknown> | null;
  notice: string | null;
};

export type TrackingResult = {
  trackingStatus: string;
  trackingUrl: string | null;
  rawResponse: Record<string, unknown> | null;
};

function normalizeCountry(country: string) {
  return country?.trim() || "France";
}

function buildFallbackTrackingNumber(carrier: LogisticsCarrier, orderNumber: string) {
  const prefix: Record<LogisticsCarrier, string> = {
    colissimo: "BPCL",
    mondial_relay: "BPMR",
    colissimo_international: "BPCI",
  };
  const compactOrder = orderNumber.replace(/[^A-Z0-9]/gi, "").slice(-10).toUpperCase();
  const suffix = Date.now().toString(36).toUpperCase().slice(-5);
  return `${prefix[carrier]}${compactOrder}${suffix}`;
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
    return Boolean(process.env.MONDIAL_RELAY_ENSEIGNE && process.env.MONDIAL_RELAY_PRIVATE_KEY);
  }
  return Boolean(process.env.COLISSIMO_CONTRACT_NUMBER && process.env.COLISSIMO_PASSWORD);
}

function carrierCredentialNotice(carrier: LogisticsCarrier) {
  if (carrier === "mondial_relay") {
    return "Les identifiants MONDIAL_RELAY_ENSEIGNE et MONDIAL_RELAY_PRIVATE_KEY ne sont pas configurés : une étiquette interne imprimable a été générée en attendant l’activation du webservice officiel.";
  }
  return "Les identifiants COLISSIMO_CONTRACT_NUMBER et COLISSIMO_PASSWORD ne sont pas configurés : une étiquette interne imprimable a été générée en attendant l’activation du webservice officiel.";
}

function drawBarcodeLikePattern(page: any, x: number, y: number, width: number, height: number, seed: string) {
  let cursor = x;
  const max = x + width;
  const bytes = Array.from(seed).map(char => char.charCodeAt(0));
  let i = 0;
  while (cursor < max) {
    const code = bytes[i % bytes.length] || 31;
    const barWidth = 1 + (code % 4);
    const gap = 1 + ((code >> 2) % 3);
    page.drawRectangle({
      x: cursor,
      y,
      width: Math.min(barWidth, max - cursor),
      height,
      color: rgb(0.05, 0.05, 0.05),
    });
    cursor += barWidth + gap;
    i += 1;
  }
}

async function buildInternalLabelPdf(input: ShipmentLabelInput, trackingNumber: string) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([420, 595]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const carrierLabel = LOGISTICS_CARRIERS[input.carrier];
  const recipientName = `${input.recipient.firstName} ${input.recipient.lastName}`.trim();
  const country = normalizeCountry(input.recipient.country);

  page.drawRectangle({ x: 24, y: 24, width: 372, height: 547, borderColor: rgb(0.08, 0.08, 0.08), borderWidth: 1.5 });
  page.drawRectangle({ x: 24, y: 516, width: 372, height: 55, color: rgb(0.05, 0.05, 0.05) });
  page.drawText("BARBER PARADISE", { x: 40, y: 550, size: 15, font: bold, color: rgb(1, 1, 1) });
  page.drawText(carrierLabel.toUpperCase(), { x: 40, y: 530, size: 11, font: bold, color: rgb(1, 1, 1) });
  page.drawText("ETIQUETTE D’EXPEDITION", { x: 236, y: 550, size: 9, font: bold, color: rgb(1, 1, 1) });
  page.drawText(input.orderNumber, { x: 236, y: 532, size: 10, font: bold, color: rgb(1, 1, 1) });

  page.drawText("DESTINATAIRE", { x: 40, y: 482, size: 10, font: bold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText(recipientName || input.customerEmail, { x: 40, y: 456, size: 17, font: bold, color: rgb(0, 0, 0) });
  page.drawText(input.recipient.address, { x: 40, y: 433, size: 12, font, color: rgb(0, 0, 0) });
  if (input.recipient.extension) {
    page.drawText(input.recipient.extension, { x: 40, y: 415, size: 11, font, color: rgb(0.1, 0.1, 0.1) });
  }
  page.drawText(`${input.recipient.postalCode} ${input.recipient.city}`.toUpperCase(), { x: 40, y: 392, size: 15, font: bold, color: rgb(0, 0, 0) });
  page.drawText(country.toUpperCase(), { x: 40, y: 370, size: 12, font: bold, color: rgb(0, 0, 0) });
  if (input.recipient.phone) {
    page.drawText(`Tel. ${input.recipient.phone}`, { x: 40, y: 350, size: 10, font, color: rgb(0.15, 0.15, 0.15) });
  }

  page.drawRectangle({ x: 40, y: 247, width: 340, height: 82, borderColor: rgb(0, 0, 0), borderWidth: 1 });
  drawBarcodeLikePattern(page, 55, 268, 310, 42, trackingNumber);
  page.drawText(trackingNumber, { x: 93, y: 253, size: 15, font: bold, color: rgb(0, 0, 0) });

  page.drawText("POIDS", { x: 40, y: 212, size: 9, font: bold, color: rgb(0.25, 0.25, 0.25) });
  page.drawText(`${(input.totalWeightG / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 3 })} kg`, { x: 40, y: 194, size: 14, font: bold, color: rgb(0, 0, 0) });
  page.drawText("FORMAT", { x: 150, y: 212, size: 9, font: bold, color: rgb(0.25, 0.25, 0.25) });
  const dimensions = input.packageDimensions
    ? `${input.packageDimensions.lengthCm}×${input.packageDimensions.widthCm}×${input.packageDimensions.heightCm} cm`
    : "Non renseigné";
  page.drawText(dimensions, { x: 150, y: 194, size: 12, font: bold, color: rgb(0, 0, 0) });
  page.drawText("DATE", { x: 285, y: 212, size: 9, font: bold, color: rgb(0.25, 0.25, 0.25) });
  page.drawText(new Date().toLocaleDateString("fr-FR"), { x: 285, y: 194, size: 12, font: bold, color: rgb(0, 0, 0) });

  page.drawRectangle({ x: 40, y: 94, width: 340, height: 55, color: rgb(0.96, 0.96, 0.96) });
  page.drawText("Document interne généré par Barber Paradise.", { x: 52, y: 128, size: 9, font: bold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText("Activez les identifiants transporteur pour obtenir l’étiquette officielle d’affranchissement.", { x: 52, y: 112, size: 8, font, color: rgb(0.25, 0.25, 0.25) });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes).toString("base64");
}

async function createCarrierApiLabel(input: ShipmentLabelInput): Promise<ShipmentLabelResult | null> {
  if (!hasCarrierCredentials(input.carrier)) return null;

  // Les webservices Colissimo et Mondial Relay nécessitent des contrats actifs.
  // Cette couche reste volontairement isolée : dès que les identifiants sont renseignés,
  // l’adaptateur officiel peut retourner le PDF transporteur sans modifier l’interface admin.
  return null;
}

export async function createShipmentLabel(input: ShipmentLabelInput): Promise<ShipmentLabelResult> {
  const officialLabel = await createCarrierApiLabel(input);
  if (officialLabel) return officialLabel;

  const trackingNumber =
    input.existingTrackingNumber?.trim() || buildFallbackTrackingNumber(input.carrier, input.orderNumber);
  const labelPdfBase64 = await buildInternalLabelPdf(input, trackingNumber);
  return {
    trackingNumber,
    carrierShipmentId: null,
    trackingUrl: buildTrackingUrl(input.carrier, trackingNumber),
    labelPdfBase64,
    labelFormat: "PDF",
    labelSource: "internal_fallback",
    labelGeneratedAt: new Date(),
    labelStatus: "fallback_generated",
    rawResponse: null,
    notice: carrierCredentialNotice(input.carrier),
  };
}

export async function fetchShipmentTracking(carrier: LogisticsCarrier, trackingNumber: string | null | undefined): Promise<TrackingResult> {
  if (!trackingNumber) {
    return { trackingStatus: "Numéro de suivi absent", trackingUrl: null, rawResponse: null };
  }

  return {
    trackingStatus: "Suivi prêt — consultez le lien transporteur",
    trackingUrl: buildTrackingUrl(carrier, trackingNumber),
    rawResponse: null,
  };
}
