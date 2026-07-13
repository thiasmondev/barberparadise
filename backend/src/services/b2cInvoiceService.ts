import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont, RGB } from "pdf-lib";
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
  phone: process.env.SELLER_PHONE || process.env.SHOP_PHONE || "",
  vatExempt: process.env.SELLER_VAT_EXEMPT === "true",
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_BOTTOM = 60;

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
      return "PayPal";
    case "paypal_4x":
      return "PayPal 4x sans frais";
    case "applepay":
    case "apple_pay":
      return "Apple Pay";
    case "googlepay":
    case "google_pay":
      return "Google Pay";
    case "paybybank":
    case "banktransfer":
    case "bank_transfer":
    case "virement":
      return "Virement bancaire";
    case "cash":
      return "Espèces";
    case "pos_terminal":
    case "terminal":
      return "Terminal de paiement";
    default:
      return method || "Non renseigné";
  }
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
  return lines.length > 0 ? lines : [""];
}

async function loadInvoiceOrder(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      customer: {
        include: {
          addresses: { orderBy: { isDefault: "desc" } },
        },
      },
      shippingAddress: true,
    },
  });
}

async function loadCustomerByEmail(email: string) {
  return prisma.customer.findUnique({
    where: { email },
    include: {
      addresses: { orderBy: { isDefault: "desc" } },
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

async function getClientIdentity(order: LoadedOrder) {
  let customer = order.customer;
  if (!customer && order.email) {
    customer = await loadCustomerByEmail(order.email);
  }

  const billing = (order.billingAddress || {}) as Record<string, string | undefined>;
  const shipping = order.shippingAddress;
  const savedAddress = customer?.addresses?.[0];

  const firstName = billing.firstName || shipping?.firstName || savedAddress?.firstName || customer?.firstName || "";
  const lastName = billing.lastName || shipping?.lastName || savedAddress?.lastName || customer?.lastName || "";
  const name = `${firstName} ${lastName}`.trim() || order.email;

  const address =
    billing.address ||
    shipping?.address ||
    savedAddress?.address ||
    "Adresse non renseignée";

  const extension =
    billing.extension ||
    shipping?.extension ||
    savedAddress?.extension ||
    "";

  const city = `${
    billing.postalCode || shipping?.postalCode || savedAddress?.postalCode || ""
  } ${
    billing.city || shipping?.city || savedAddress?.city || ""
  }`.trim();

  const country =
    billing.country ||
    shipping?.country ||
    savedAddress?.country ||
    "France";

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

// ─── Moteur de rendu multi-pages ─────────────────────────────────────────────

type DrawCtx = {
  pdf: PDFDocument;
  regular: PDFFont;
  bold: PDFFont;
  accent: RGB;
  muted: RGB;
  pages: PDFPage[];
  currentPageIndex: number;
  y: number;
};

function currentPage(ctx: DrawCtx): PDFPage {
  return ctx.pages[ctx.currentPageIndex];
}

function addPage(ctx: DrawCtx): void {
  const page = ctx.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  ctx.pages.push(page);
  ctx.currentPageIndex = ctx.pages.length - 1;
  ctx.y = PAGE_HEIGHT - MARGIN;
}

function ensureSpace(ctx: DrawCtx, needed: number): void {
  if (ctx.y - needed < CONTENT_BOTTOM) {
    addPage(ctx);
  }
}

async function generateInvoicePdf(order: LoadedOrder, invoiceNumber: string): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const accent = rgb(0.12, 0.12, 0.12);
  const muted = rgb(0.38, 0.38, 0.38);

  const ctx: DrawCtx = { pdf, regular, bold, accent, muted, pages: [], currentPageIndex: 0, y: PAGE_HEIGHT - MARGIN };
  addPage(ctx);

  const client = await getClientIdentity(order);
  const lines = buildInvoiceLines(order);
  const issuedAt = new Date();
  const vatRate = order.vatRate || 20;
  const totalTTC = money(order.totalTTC || order.total);
  const totalHT = money(order.totalHT || totalTTC / (1 + vatRate / 100));
  const vatAmount = money(order.vatAmount || totalTTC - totalHT);
  const subtotalHT = money(order.shipping > 0 ? totalHT - order.shipping / (1 + vatRate / 100) : totalHT);

  // ── En-tête ──────────────────────────────────────────────────────────────
  const firstPage = currentPage(ctx);
  firstPage.drawRectangle({ x: 0, y: PAGE_HEIGHT - 57, width: PAGE_WIDTH, height: 57, color: rgb(0.06, 0.06, 0.06) });
  firstPage.drawText("BARBER PARADISE", { x: MARGIN, y: PAGE_HEIGHT - 34, size: 18, font: bold, color: rgb(1, 1, 1) });
  firstPage.drawText("Facture client", { x: 430, y: PAGE_HEIGHT - 32, size: 14, font: bold, color: rgb(1, 1, 1) });

  ctx.y = PAGE_HEIGHT - 57 - 20;

  // ── Infos facture ─────────────────────────────────────────────────────────
  firstPage.drawText(`Facture n° ${invoiceNumber}`, { x: MARGIN, y: ctx.y, size: 15, font: bold, color: accent });
  ctx.y -= 22;
  firstPage.drawText(`Date d'émission : ${formatDate(issuedAt)}`, { x: MARGIN, y: ctx.y, size: 10, font: regular, color: accent });
  ctx.y -= 15;
  firstPage.drawText(`Commande : ${order.orderNumber}`, { x: MARGIN, y: ctx.y, size: 10, font: regular, color: accent });
  ctx.y -= 15;
  firstPage.drawText(`Paiement : ${paymentLabel(order.paymentMethod || order.paymentProvider)}`, { x: MARGIN, y: ctx.y, size: 10, font: regular, color: accent });
  ctx.y -= 25;

  // ── Blocs vendeur / client ────────────────────────────────────────────────
  const colLeft = MARGIN;
  const colRight = 310;
  const blockTopY = ctx.y;

  // Vendeur
  firstPage.drawText("Vendeur", { x: colLeft, y: blockTopY, size: 11, font: bold, color: accent });
  let sellerY = blockTopY - 16;
  firstPage.drawText(SELLER.name, { x: colLeft, y: sellerY, size: 10, font: regular, color: accent }); sellerY -= 14;
  firstPage.drawText(SELLER.address, { x: colLeft, y: sellerY, size: 9, font: regular, color: accent }); sellerY -= 13;
  firstPage.drawText(SELLER.postalCity, { x: colLeft, y: sellerY, size: 9, font: regular, color: accent }); sellerY -= 13;
  firstPage.drawText(`SIRET : ${SELLER.siret}`, { x: colLeft, y: sellerY, size: 9, font: regular, color: muted }); sellerY -= 13;
  if (SELLER.vatNumber) { firstPage.drawText(`TVA : ${SELLER.vatNumber}`, { x: colLeft, y: sellerY, size: 9, font: regular, color: muted }); sellerY -= 13; }
  firstPage.drawText(`Email : ${SELLER.email}`, { x: colLeft, y: sellerY, size: 9, font: regular, color: muted }); sellerY -= 13;
  if (SELLER.phone) { firstPage.drawText(`Tél : ${SELLER.phone}`, { x: colLeft, y: sellerY, size: 9, font: regular, color: muted }); sellerY -= 13; }

  // Client
  firstPage.drawText("Client", { x: colRight, y: blockTopY, size: 11, font: bold, color: accent });
  let clientY = blockTopY - 16;
  const clientNameLines = wrapText(client.name, 32);
  for (const l of clientNameLines) { firstPage.drawText(l, { x: colRight, y: clientY, size: 10, font: regular, color: accent }); clientY -= 14; }
  const clientAddrLines = wrapText(client.address, 32);
  for (const l of clientAddrLines) { firstPage.drawText(l, { x: colRight, y: clientY, size: 9, font: regular, color: accent }); clientY -= 13; }
  if (client.city) { firstPage.drawText(client.city, { x: colRight, y: clientY, size: 9, font: regular, color: accent }); clientY -= 13; }
  if (client.country && client.country !== "France") { firstPage.drawText(client.country, { x: colRight, y: clientY, size: 9, font: regular, color: accent }); clientY -= 13; }
  firstPage.drawText(`Email : ${client.email}`, { x: colRight, y: clientY, size: 9, font: regular, color: muted }); clientY -= 13;

  ctx.y = Math.min(sellerY, clientY) - 20;

  // ── Séparateur ────────────────────────────────────────────────────────────
  currentPage(ctx).drawLine({ start: { x: MARGIN, y: ctx.y }, end: { x: PAGE_WIDTH - MARGIN, y: ctx.y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
  ctx.y -= 16;

  // ── En-tête tableau ───────────────────────────────────────────────────────
  ensureSpace(ctx, 30);
  currentPage(ctx).drawRectangle({ x: MARGIN, y: ctx.y - 6, width: PAGE_WIDTH - MARGIN * 2, height: 22, color: rgb(0.93, 0.91, 0.87) });
  currentPage(ctx).drawText("Désignation", { x: MARGIN + 8, y: ctx.y + 2, size: 9, font: bold, color: accent });
  currentPage(ctx).drawText("Qté", { x: 265, y: ctx.y + 2, size: 9, font: bold, color: accent });
  currentPage(ctx).drawText("PU HT", { x: 295, y: ctx.y + 2, size: 9, font: bold, color: accent });
  currentPage(ctx).drawText("TVA", { x: 360, y: ctx.y + 2, size: 9, font: bold, color: accent });
  currentPage(ctx).drawText("PU TTC", { x: 405, y: ctx.y + 2, size: 9, font: bold, color: accent });
  currentPage(ctx).drawText("Total TTC", { x: 470, y: ctx.y + 2, size: 9, font: bold, color: accent });
  ctx.y -= 26;

  // ── Lignes du tableau ─────────────────────────────────────────────────────
  for (const line of lines) {
    const lineTTCBeforeDiscount = money(line.unitTTC * line.quantity);
    const lineTTC = money(Math.max(0, lineTTCBeforeDiscount - line.discountAmount));
    const unitHT = money(line.unitTTC / (1 + line.vatRate / 100));
    const nameLines = wrapText(line.designation, 36);
    const hasDiscount = line.discountAmount > 0;
    const rowHeight = Math.max(22, nameLines.length * 13 + (hasDiscount ? 14 : 0) + 8);

    ensureSpace(ctx, rowHeight + 4);
    currentPage(ctx).drawLine({ start: { x: MARGIN, y: ctx.y }, end: { x: PAGE_WIDTH - MARGIN, y: ctx.y }, thickness: 0.3, color: rgb(0.85, 0.85, 0.85) });
    ctx.y -= 2;

    const rowTopY = ctx.y;
    for (let i = 0; i < nameLines.length; i++) {
      currentPage(ctx).drawText(nameLines[i], { x: MARGIN + 8, y: rowTopY - i * 13, size: 9, font: regular, color: accent });
    }
    if (hasDiscount) {
      currentPage(ctx).drawText(`Remise : -${euro(line.discountAmount)}`, { x: MARGIN + 8, y: rowTopY - nameLines.length * 13, size: 8, font: regular, color: muted });
    }
    currentPage(ctx).drawText(String(line.quantity), { x: 270, y: rowTopY, size: 9, font: regular, color: accent });
    currentPage(ctx).drawText(euro(unitHT), { x: 295, y: rowTopY, size: 9, font: regular, color: accent });
    currentPage(ctx).drawText(`${line.vatRate}%`, { x: 363, y: rowTopY, size: 9, font: regular, color: accent });
    currentPage(ctx).drawText(euro(line.unitTTC), { x: 405, y: rowTopY, size: 9, font: regular, color: accent });
    currentPage(ctx).drawText(euro(lineTTC), { x: 470, y: rowTopY, size: 9, font: regular, color: accent });

    ctx.y -= rowHeight;
  }

  // ── Totaux ────────────────────────────────────────────────────────────────
  ensureSpace(ctx, 90);
  ctx.y -= 10;
  currentPage(ctx).drawLine({ start: { x: MARGIN, y: ctx.y }, end: { x: PAGE_WIDTH - MARGIN, y: ctx.y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
  ctx.y -= 16;

  const totalsX = 355;
  const totalsValX = 470;

  currentPage(ctx).drawText("Sous-total HT", { x: totalsX, y: ctx.y, size: 10, font: bold, color: accent });
  currentPage(ctx).drawText(euro(subtotalHT), { x: totalsValX, y: ctx.y, size: 10, font: regular, color: accent });
  ctx.y -= 18;

  currentPage(ctx).drawText("Livraison TTC", { x: totalsX, y: ctx.y, size: 10, font: bold, color: accent });
  currentPage(ctx).drawText(euro(order.shipping), { x: totalsValX, y: ctx.y, size: 10, font: regular, color: accent });
  ctx.y -= 18;

  currentPage(ctx).drawText(`TVA (${vatRate}%)`, { x: totalsX, y: ctx.y, size: 10, font: bold, color: accent });
  currentPage(ctx).drawText(euro(vatAmount), { x: totalsValX, y: ctx.y, size: 10, font: regular, color: accent });
  ctx.y -= 18;

  // Ligne remise commerciale (mode gift) — affichée si présente
  if (order.commercialDiscountAmount && order.commercialDiscountAmount > 0) {
    const discountLabel = order.commercialDiscountLabel || "Remise commerciale";
    currentPage(ctx).drawText(discountLabel, { x: totalsX, y: ctx.y, size: 10, font: bold, color: rgb(0.8, 0.2, 0.2) });
    currentPage(ctx).drawText(`-${euro(order.commercialDiscountAmount)}`, { x: totalsValX, y: ctx.y, size: 10, font: regular, color: rgb(0.8, 0.2, 0.2) });
    ctx.y -= 18;
  }

  ctx.y -= 4;

  // Ligne total TTC
  currentPage(ctx).drawRectangle({ x: totalsX - 5, y: ctx.y - 6, width: PAGE_WIDTH - MARGIN - totalsX + 5, height: 22, color: rgb(0.06, 0.06, 0.06) });
  currentPage(ctx).drawText("Total TTC", { x: totalsX, y: ctx.y + 2, size: 11, font: bold, color: rgb(1, 1, 1) });
  currentPage(ctx).drawText(euro(totalTTC), { x: totalsValX, y: ctx.y + 2, size: 11, font: bold, color: rgb(1, 1, 1) });
  ctx.y -= 30;

  // ── Mentions légales ──────────────────────────────────────────────────────
  const legalMentions = [
    "Facture acquittée sous réserve d'encaissement effectif du paiement.",
    "Les prix sont indiqués toutes taxes comprises. Le droit de rétractation légal s'applique selon les conditions générales de vente Barber Paradise, hors exceptions prévues par le Code de la consommation.",
    "Pour toute réclamation, contactez le service client Barber Paradise par email.",
  ];
  if (SELLER.vatNumber) legalMentions.push(`Numéro de TVA intracommunautaire du vendeur : ${SELLER.vatNumber}.`);
  if (SELLER.vatExempt) legalMentions.push("TVA non applicable — art. 293B du CGI.");

  ensureSpace(ctx, 30);
  ctx.y -= 10;
  currentPage(ctx).drawText("Mentions légales", { x: MARGIN, y: ctx.y, size: 11, font: bold, color: accent });
  ctx.y -= 16;

  for (const mention of legalMentions) {
    const parts = wrapText(mention, 92);
    for (const part of parts) {
      ensureSpace(ctx, 12);
      currentPage(ctx).drawText(part, { x: MARGIN, y: ctx.y, size: 8.5, font: regular, color: muted });
      ctx.y -= 11;
    }
    ctx.y -= 5;
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
    // Réinitialiser itemsLastModifiedAt pour masquer le badge "Facture à régénérer" après régénération
    data: { invoiceNumber, invoiceUrl, itemsLastModifiedAt: null },
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
