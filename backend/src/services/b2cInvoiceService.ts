import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { v2 as cloudinary } from "cloudinary";
import { prisma } from "../utils/prisma";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

type LoadedOrder = NonNullable<Awaited<ReturnType<typeof loadInvoiceOrder>>>;

type InvoiceLine = {
  designation: string;
  quantity: number;
  unitTTC: number;
  vatRate: number;
  discountAmount: number;
};

export type B2CInvoiceResult = {
  invoiceNumber: string;
  invoiceUrl: string;
  pdfBuffer?: Buffer;
};

const SELLER = {
  name: process.env.SELLER_LEGAL_NAME || "Barber Paradise",
  address: process.env.SELLER_ADDRESS || "Adresse Barber Paradise à compléter",
  postalCity: process.env.SELLER_POSTAL_CITY || "France",
  siret: process.env.SELLER_SIRET || "SIRET à compléter",
  vatNumber: process.env.SELLER_VAT_NUMBER || "",
  email: process.env.SELLER_EMAIL || "contact@barberparadise.fr",
  phone: process.env.SELLER_PHONE || process.env.SHOP_PHONE || "Téléphone à compléter",
  vatExempt: process.env.SELLER_VAT_EXEMPT === "true",
};

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function euro(value: number): string {
  return `${money(value).toFixed(2).replace(".", ",")} €`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function sanitizeCloudinaryPublicId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function paymentLabel(method?: string | null): string {
  switch ((method || "").toLowerCase()) {
    case "card":
    case "stripe":
    case "mollie":
      return "Carte bancaire";
    case "paypal":
    case "paypal_4x":
      return "PayPal";
    case "bank_transfer":
    case "bank-transfer":
    case "virement":
      return "Virement bancaire";
    default:
      return method || "Non renseigné";
  }
}

async function loadInvoiceOrder(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      customer: true,
      shippingAddress: true,
    },
  });
}

async function nextInvoiceNumber(year: number): Promise<string> {
  const prefix = `BP-${year}-`;
  const existing = await prisma.order.findMany({
    where: { invoiceNumber: { startsWith: prefix } },
    select: { invoiceNumber: true },
  });

  const max = existing.reduce((highest, order) => {
    const sequence = Number(order.invoiceNumber?.replace(prefix, "") || 0);
    return Number.isFinite(sequence) && sequence > highest ? sequence : highest;
  }, 0);

  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

function getClientIdentity(order: LoadedOrder) {
  const billing = (order.billingAddress || {}) as Record<string, string | undefined>;
  const shipping = order.shippingAddress;
  const firstName = billing.firstName || shipping?.firstName || order.customer?.firstName || "";
  const lastName = billing.lastName || shipping?.lastName || order.customer?.lastName || "";
  const name = `${firstName} ${lastName}`.trim() || order.email;
  const address = billing.address || shipping?.address || "Adresse non renseignée";
  const extension = billing.extension || shipping?.extension || "";
  const city = `${billing.postalCode || shipping?.postalCode || ""} ${billing.city || shipping?.city || ""}`.trim();
  const country = billing.country || shipping?.country || "France";

  return {
    name,
    address: [address, extension].filter(Boolean).join(" "),
    city,
    country,
    email: order.email,
  };
}

function buildInvoiceLines(order: LoadedOrder): InvoiceLine[] {
  const vatRate = order.vatRate || 20;
  const lines = order.items.map((item) => ({
    designation: item.variantLabel ? `${item.name} — ${item.variantLabel}` : item.name,
    quantity: item.quantity,
    unitTTC: money(item.price),
    vatRate,
    discountAmount: money(item.discountAmount || 0),
  }));

  if (order.shipping > 0) {
    lines.push({
      designation: "Frais de livraison",
      quantity: 1,
      unitTTC: money(order.shipping),
      vatRate,
      discountAmount: 0,
    });
  }

  return lines;
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (`${current} ${word}`.trim().length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function generateInvoicePdf(order: LoadedOrder, invoiceNumber: string): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const client = getClientIdentity(order);
  const lines = buildInvoiceLines(order);
  const issuedAt = new Date();
  const vatRate = order.vatRate || 20;
  const totalTTC = money(order.totalTTC || order.total);
  const totalHT = money(order.totalHT || totalTTC / (1 + vatRate / 100));
  const vatAmount = money(order.vatAmount || totalTTC - totalHT);
  const subtotalTTC = money(Math.max(0, totalTTC - order.shipping));
  const subtotalHT = money(order.shipping > 0 ? totalHT - order.shipping / (1 + vatRate / 100) : totalHT);
  const accent = rgb(0.12, 0.12, 0.12);
  const muted = rgb(0.38, 0.38, 0.38);

  const draw = (text: string, x: number, y: number, size = 10, font = regular, color = accent) => {
    page.drawText(text, { x, y, size, font, color });
  };

  page.drawRectangle({ x: 0, y: 785, width: 595.28, height: 56.89, color: rgb(0.06, 0.06, 0.06) });
  page.drawText("BARBER PARADISE", { x: 40, y: 808, size: 18, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Facture client", { x: 405, y: 810, size: 14, font: bold, color: rgb(1, 1, 1) });

  draw(`Facture n° ${invoiceNumber}`, 40, 752, 15, bold);
  draw(`Date d’émission : ${formatDate(issuedAt)}`, 40, 732, 10);
  draw(`Commande : ${order.orderNumber}`, 40, 716, 10);
  draw(`Paiement : ${paymentLabel(order.paymentMethod || order.paymentProvider)}`, 40, 700, 10);

  draw("Vendeur", 40, 665, 11, bold);
  draw(SELLER.name, 40, 648, 10);
  draw(SELLER.address, 40, 632, 10);
  draw(SELLER.postalCity, 40, 616, 10);
  draw(`SIRET : ${SELLER.siret}`, 40, 600, 9, regular, muted);
  if (SELLER.vatNumber) draw(`TVA intracommunautaire : ${SELLER.vatNumber}`, 40, 586, 9, regular, muted);
  draw(`Email : ${SELLER.email}`, 40, 572, 9, regular, muted);
  draw(`Téléphone : ${SELLER.phone}`, 40, 558, 9, regular, muted);

  draw("Client", 330, 665, 11, bold);
  draw(client.name, 330, 648, 10);
  wrapText(client.address, 34).forEach((line, index) => draw(line, 330, 632 - index * 14, 10));
  draw(client.city, 330, 602, 10);
  draw(client.country, 330, 588, 10);
  draw(`Email : ${client.email}`, 330, 574, 9, regular, muted);

  const tableTop = 520;
  page.drawRectangle({ x: 40, y: tableTop, width: 515, height: 24, color: rgb(0.93, 0.91, 0.87) });
  draw("Désignation", 48, tableTop + 8, 9, bold);
  draw("Qté", 258, tableTop + 8, 9, bold);
  draw("PU HT", 292, tableTop + 8, 9, bold);
  draw("TVA", 357, tableTop + 8, 9, bold);
  draw("PU TTC", 410, tableTop + 8, 9, bold);
  draw("Total TTC", 482, tableTop + 8, 9, bold);

  let y = tableTop - 20;
  for (const line of lines) {
    const lineTTCBeforeDiscount = money(line.unitTTC * line.quantity);
    const lineTTC = money(Math.max(0, lineTTCBeforeDiscount - line.discountAmount));
    const unitHT = money(line.unitTTC / (1 + line.vatRate / 100));
    const nameLines = wrapText(line.designation, 34);
    nameLines.forEach((part, index) => draw(part, 48, y - index * 12, 9));
    if (line.discountAmount > 0) draw(`Remise : -${euro(line.discountAmount)}`, 48, y - nameLines.length * 12, 8, regular, muted);
    draw(String(line.quantity), 263, y, 9);
    draw(euro(unitHT), 292, y, 9);
    draw(`${line.vatRate}%`, 360, y, 9);
    draw(euro(line.unitTTC), 410, y, 9);
    draw(euro(lineTTC), 482, y, 9);
    y -= Math.max(24, nameLines.length * 12 + (line.discountAmount > 0 ? 18 : 8));
  }

  const totalsX = 350;
  y -= 12;
  draw("Sous-total HT", totalsX, y, 10, bold);
  draw(euro(subtotalHT), 470, y, 10);
  y -= 18;
  draw("Livraison TTC", totalsX, y, 10, bold);
  draw(euro(order.shipping), 470, y, 10);
  y -= 18;
  draw(`TVA (${vatRate}%)`, totalsX, y, 10, bold);
  draw(euro(vatAmount), 470, y, 10);
  y -= 18;
  draw("Total TTC", totalsX, y, 12, bold);
  draw(euro(totalTTC), 470, y, 12, bold);

  const legalY = 155;
  draw("Mentions légales", 40, legalY, 11, bold);
  const legalMentions = [
    "Facture acquittée sous réserve d’encaissement effectif du paiement.",
    "Les prix sont indiqués toutes taxes comprises. Le droit de rétractation légal s’applique selon les conditions générales de vente Barber Paradise, hors exceptions prévues par le Code de la consommation.",
    "Pour toute réclamation, contactez le service client Barber Paradise par email.",
  ];

  if (SELLER.vatNumber) {
    legalMentions.push(`Numéro de TVA intracommunautaire du vendeur : ${SELLER.vatNumber}.`);
  }
  if (SELLER.vatExempt) {
    legalMentions.push("TVA non applicable — art. 293B du CGI.");
  }

  let legalLineY = legalY - 18;
  for (const mention of legalMentions) {
    for (const part of wrapText(mention, 92)) {
      draw(part, 40, legalLineY, 8.5, regular, muted);
      legalLineY -= 11;
    }
    legalLineY -= 5;
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

async function uploadInvoicePdf(pdfBuffer: Buffer, invoiceNumber: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        folder: "barberparadise/invoices",
        public_id: sanitizeCloudinaryPublicId(invoiceNumber),
        format: "pdf",
        overwrite: true,
      },
      (error, result) => {
        if (error || !result?.secure_url) {
          reject(error || new Error("Upload Cloudinary impossible"));
          return;
        }
        resolve(result.secure_url);
      },
    );

    stream.end(pdfBuffer);
  });
}

export async function ensureB2CInvoiceForOrder(orderId: string): Promise<B2CInvoiceResult | null> {
  const order = await loadInvoiceOrder(orderId);
  if (!order || order.isB2B) return null;
  if (order.invoiceNumber && order.invoiceUrl) {
    return { invoiceNumber: order.invoiceNumber, invoiceUrl: order.invoiceUrl };
  }

  const invoiceNumber = order.invoiceNumber || await nextInvoiceNumber(new Date().getFullYear());
  const pdfBuffer = await generateInvoicePdf(order, invoiceNumber);
  const invoiceUrl = await uploadInvoicePdf(pdfBuffer, invoiceNumber);

  await prisma.order.update({
    where: { id: order.id },
    data: { invoiceNumber, invoiceUrl },
  });

  return { invoiceNumber, invoiceUrl, pdfBuffer };
}

/**
 * Re-génère le PDF en mémoire pour une commande dont la facture existe déjà en base.
 * Utilisé pour attacher le PDF à l'email de confirmation sans re-uploader sur Cloudinary.
 */
export async function generateB2CInvoicePdfBuffer(orderId: string, invoiceNumber: string): Promise<Buffer | null> {
  const order = await loadInvoiceOrder(orderId);
  if (!order || order.isB2B) return null;
  return generateInvoicePdf(order, invoiceNumber);
}
