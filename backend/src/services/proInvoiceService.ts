import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont, RGB } from "pdf-lib";
import { v2 as cloudinary } from "cloudinary";
import { prisma } from "../utils/prisma";
import { sendEmail } from "./emailService";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

type InvoiceLine = {
  designation: string;
  quantity: number;
  unitHT: number;
  vatRate: number;
};

type LoadedOrder = NonNullable<Awaited<ReturnType<typeof loadInvoiceOrder>>>;

const SELLER = {
  name: process.env.SELLER_LEGAL_NAME || "Barber Paradise",
  address: process.env.SELLER_ADDRESS || "Adresse Barber Paradise à compléter",
  postalCity: process.env.SELLER_POSTAL_CITY || "France",
  siret: process.env.SELLER_SIRET || "SIRET à compléter",
  vatNumber: process.env.SELLER_VAT_NUMBER || "",
  email: process.env.SELLER_EMAIL || "contact@barberparadise.fr",
  vatExempt: process.env.SELLER_VAT_EXEMPT === "true",
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_BOTTOM = 60; // espace réservé en bas de chaque page

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
          proAccount: true,
          addresses: { orderBy: { isDefault: "desc" } },
        },
      },
      shippingAddress: true,
    },
  });
}

/**
 * Charge le compte client par email si customerId est null (commandes POS sans compte lié).
 */
async function loadCustomerByEmail(email: string) {
  return prisma.customer.findUnique({
    where: { email },
    include: {
      proAccount: true,
      addresses: { orderBy: { isDefault: "desc" } },
    },
  });
}

async function nextInvoiceNumber(year: number): Promise<string> {
  const prefix = `BP-PRO-${year}-`;
  const existing = await prisma.order.findMany({
    where: { proInvoiceNumber: { startsWith: prefix } },
    select: { proInvoiceNumber: true },
  });

  const max = existing.reduce((highest: number, order: { proInvoiceNumber: string | null }) => {
    const sequence = Number(order.proInvoiceNumber?.replace(prefix, "") || 0);
    return Number.isFinite(sequence) && sequence > highest ? sequence : highest;
  }, 0);

  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

async function getClientIdentity(order: LoadedOrder) {
  // Priorité 1 : customer directement lié à la commande
  let customer = order.customer;

  // Priorité 2 : si pas de customer lié (commandes POS sans compte), chercher par email
  if (!customer && order.email) {
    customer = await loadCustomerByEmail(order.email);
  }

  const pro = customer?.proAccount;
  const billing = (order.billingAddress || {}) as Record<string, string | undefined>;
  const shipping = order.shippingAddress;
  const savedAddress = customer?.addresses?.[0];

  const name =
    pro?.companyName ||
    `${billing.firstName || shipping?.firstName || savedAddress?.firstName || customer?.firstName || ""} ${
      billing.lastName || shipping?.lastName || savedAddress?.lastName || customer?.lastName || ""
    }`.trim() ||
    order.email;

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
    siret: pro?.siret || "",
    vatNumber: order.vatNumber || pro?.vatNumber || "",
    email: order.email,
    phone: pro?.phone || "",
  };
}

function buildInvoiceLines(order: LoadedOrder): InvoiceLine[] {
  const lines = order.items.map((item: { name: string; variantLabel?: string | null; quantity: number; price: number }) => ({
    designation: item.variantLabel ? `${item.name} — ${item.variantLabel}` : item.name,
    quantity: item.quantity,
    unitHT: item.price,
    vatRate: order.vatRate,
  }));

  if (order.shipping > 0) {
    lines.push({
      designation: "Frais de livraison",
      quantity: 1,
      unitHT: order.vatRate > 0 ? money(order.shipping / (1 + order.vatRate / 100)) : order.shipping,
      vatRate: order.vatRate,
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
  y: number; // position Y courante (coordonnées pdf-lib : 0 = bas de page)
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

/**
 * Vérifie si on a assez de place pour `needed` points.
 * Si non, crée une nouvelle page et remet y en haut.
 */
function ensureSpace(ctx: DrawCtx, needed: number): void {
  if (ctx.y - needed < CONTENT_BOTTOM) {
    addPage(ctx);
  }
}

function drawText(
  ctx: DrawCtx,
  text: string,
  x: number,
  size = 10,
  font?: PDFFont,
  color?: RGB,
): void {
  currentPage(ctx).drawText(text, {
    x,
    y: ctx.y,
    size,
    font: font || ctx.regular,
    color: color || ctx.accent,
  });
}

function drawLine(ctx: DrawCtx, x1: number, x2: number, thickness = 0.5): void {
  currentPage(ctx).drawLine({
    start: { x: x1, y: ctx.y },
    end: { x: x2, y: ctx.y },
    thickness,
    color: rgb(0.8, 0.8, 0.8),
  });
}

async function generateInvoicePdf(order: LoadedOrder, invoiceNumber: string): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const accent = rgb(0.12, 0.12, 0.12);
  const muted = rgb(0.38, 0.38, 0.38);

  const ctx: DrawCtx = {
    pdf,
    regular,
    bold,
    accent,
    muted,
    pages: [],
    currentPageIndex: 0,
    y: PAGE_HEIGHT - MARGIN,
  };

  // Première page
  addPage(ctx);

  const client = await getClientIdentity(order);
  const lines = buildInvoiceLines(order);
  const issuedAt = new Date();

  // ── En-tête ──────────────────────────────────────────────────────────────
  const firstPage = currentPage(ctx);
  firstPage.drawRectangle({ x: 0, y: PAGE_HEIGHT - 57, width: PAGE_WIDTH, height: 57, color: rgb(0.06, 0.06, 0.06) });
  firstPage.drawText("BARBER PARADISE", { x: MARGIN, y: PAGE_HEIGHT - 34, size: 18, font: bold, color: rgb(1, 1, 1) });
  firstPage.drawText("Facture professionnelle", { x: 370, y: PAGE_HEIGHT - 32, size: 14, font: bold, color: rgb(1, 1, 1) });

  ctx.y = PAGE_HEIGHT - 57 - 20;

  // ── Infos facture ─────────────────────────────────────────────────────────
  drawText(ctx, `Facture n° ${invoiceNumber}`, MARGIN, 15, bold);
  ctx.y -= 22;
  drawText(ctx, `Date d'émission : ${formatDate(issuedAt)}`, MARGIN, 10);
  ctx.y -= 15;
  drawText(ctx, `Commande : ${order.orderNumber}`, MARGIN, 10);
  ctx.y -= 25;

  // ── Bloc vendeur / client (sur 2 colonnes) ────────────────────────────────
  const colLeft = MARGIN;
  const colRight = 310;
  const blockTopY = ctx.y;

  // Vendeur
  firstPage.drawText("Vendeur", { x: colLeft, y: blockTopY, size: 11, font: bold, color: accent });
  let sellerY = blockTopY - 16;
  const sellerLines = [
    SELLER.name,
    SELLER.address,
    SELLER.postalCity,
    `SIRET : ${SELLER.siret}`,
    ...(SELLER.vatNumber ? [`TVA : ${SELLER.vatNumber}`] : []),
    `Email : ${SELLER.email}`,
  ];
  for (const line of sellerLines) {
    firstPage.drawText(line, { x: colLeft, y: sellerY, size: 9, font: sellerY < blockTopY - 40 ? regular : regular, color: sellerY < blockTopY - 32 ? muted : accent });
    sellerY -= 13;
  }

  // Client
  firstPage.drawText("Client professionnel", { x: colRight, y: blockTopY, size: 11, font: bold, color: accent });
  let clientY = blockTopY - 16;

  const clientNameLines = wrapText(client.name, 32);
  for (const l of clientNameLines) {
    firstPage.drawText(l, { x: colRight, y: clientY, size: 10, font: regular, color: accent });
    clientY -= 14;
  }

  const clientAddrLines = wrapText(client.address, 32);
  for (const l of clientAddrLines) {
    firstPage.drawText(l, { x: colRight, y: clientY, size: 9, font: regular, color: accent });
    clientY -= 13;
  }

  if (client.city) {
    firstPage.drawText(client.city, { x: colRight, y: clientY, size: 9, font: regular, color: accent });
    clientY -= 13;
  }
  if (client.country && client.country !== "France") {
    firstPage.drawText(client.country, { x: colRight, y: clientY, size: 9, font: regular, color: accent });
    clientY -= 13;
  }
  if (client.siret) {
    firstPage.drawText(`SIRET : ${client.siret}`, { x: colRight, y: clientY, size: 9, font: regular, color: muted });
    clientY -= 13;
  }
  if (client.vatNumber) {
    firstPage.drawText(`TVA : ${client.vatNumber}`, { x: colRight, y: clientY, size: 9, font: regular, color: muted });
    clientY -= 13;
  }
  if (client.phone) {
    firstPage.drawText(`Tél : ${client.phone}`, { x: colRight, y: clientY, size: 9, font: regular, color: muted });
    clientY -= 13;
  }
  firstPage.drawText(`Email : ${client.email}`, { x: colRight, y: clientY, size: 9, font: regular, color: muted });

  // Avancer y sous les deux blocs
  ctx.y = Math.min(sellerY, clientY) - 20;

  // ── Séparateur ────────────────────────────────────────────────────────────
  currentPage(ctx).drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE_WIDTH - MARGIN, y: ctx.y },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });
  ctx.y -= 16;

  // ── En-tête tableau ───────────────────────────────────────────────────────
  ensureSpace(ctx, 30);
  currentPage(ctx).drawRectangle({ x: MARGIN, y: ctx.y - 6, width: PAGE_WIDTH - MARGIN * 2, height: 22, color: rgb(0.93, 0.91, 0.87) });
  drawText(ctx, "Désignation", MARGIN + 8, 9, bold);
  drawText(ctx, "Qté", 300, 9, bold);
  drawText(ctx, "PU HT", 335, 9, bold);
  drawText(ctx, "TVA", 400, 9, bold);
  drawText(ctx, "Total TTC", 460, 9, bold);
  ctx.y -= 26;

  // ── Lignes du tableau ─────────────────────────────────────────────────────
  for (const line of lines) {
    const lineHT = money(line.unitHT * line.quantity);
    const lineVat = money(lineHT * (line.vatRate / 100));
    const lineTTC = money(lineHT + lineVat);
    const nameLines = wrapText(line.designation, 42);
    const rowHeight = Math.max(22, nameLines.length * 13 + 8);

    ensureSpace(ctx, rowHeight + 4);

    // Fond alterné léger (optionnel, ici juste séparateur)
    drawLine(ctx, MARGIN, PAGE_WIDTH - MARGIN, 0.3);
    ctx.y -= 2;

    const rowTopY = ctx.y;
    for (let i = 0; i < nameLines.length; i++) {
      currentPage(ctx).drawText(nameLines[i], { x: MARGIN + 8, y: rowTopY - i * 13, size: 9, font: regular, color: accent });
    }
    currentPage(ctx).drawText(String(line.quantity), { x: 305, y: rowTopY, size: 9, font: regular, color: accent });
    currentPage(ctx).drawText(euro(line.unitHT), { x: 335, y: rowTopY, size: 9, font: regular, color: accent });
    currentPage(ctx).drawText(`${line.vatRate}%`, { x: 405, y: rowTopY, size: 9, font: regular, color: accent });
    currentPage(ctx).drawText(euro(lineTTC), { x: 460, y: rowTopY, size: 9, font: regular, color: accent });

    ctx.y -= rowHeight;
  }

  // ── Totaux ────────────────────────────────────────────────────────────────
  ensureSpace(ctx, 80);
  ctx.y -= 10;
  drawLine(ctx, MARGIN, PAGE_WIDTH - MARGIN);
  ctx.y -= 16;

  const totalsX = 360;
  const totalsValX = 470;

  drawText(ctx, "Montant HT", totalsX, 10, bold);
  currentPage(ctx).drawText(euro(order.totalHT), { x: totalsValX, y: ctx.y, size: 10, font: regular, color: accent });
  ctx.y -= 18;

  drawText(ctx, `TVA (${order.vatRate}%)`, totalsX, 10, bold);
  currentPage(ctx).drawText(euro(order.vatAmount), { x: totalsValX, y: ctx.y, size: 10, font: regular, color: accent });
  ctx.y -= 18;

  // Ligne remise commerciale (mode gift) — affichée si présente
  if (order.commercialDiscountAmount && order.commercialDiscountAmount > 0) {
    const discountLabel = order.commercialDiscountLabel || "Remise commerciale";
    currentPage(ctx).drawText(discountLabel, { x: totalsX, y: ctx.y, size: 10, font: bold, color: rgb(0.8, 0.2, 0.2) });
    currentPage(ctx).drawText(`-${euro(order.commercialDiscountAmount)}`, { x: totalsValX, y: ctx.y, size: 10, font: regular, color: rgb(0.8, 0.2, 0.2) });
    ctx.y -= 18;
  }

  ctx.y -= 4;

  // Ligne de total
  currentPage(ctx).drawRectangle({ x: totalsX - 5, y: ctx.y - 6, width: PAGE_WIDTH - MARGIN - totalsX + 5, height: 22, color: rgb(0.06, 0.06, 0.06) });
  currentPage(ctx).drawText("Montant TTC", { x: totalsX, y: ctx.y + 2, size: 11, font: bold, color: rgb(1, 1, 1) });
  currentPage(ctx).drawText(euro(order.totalTTC || order.total), { x: totalsValX, y: ctx.y + 2, size: 11, font: bold, color: rgb(1, 1, 1) });
  ctx.y -= 30;

  // ── Mentions légales ──────────────────────────────────────────────────────
  const legalMentions = [
    "Commande minimum professionnelle : 200 € HT.",
    "Délai de paiement : paiement exigible à la commande, sauf accord écrit contraire.",
    "Pénalités de retard : taux BCE majoré de 10 points et indemnité forfaitaire de recouvrement de 40 €.",
  ];
  if (order.vatRate === 0) {
    legalMentions.push("TVA à 0 % : autoliquidation par le preneur lorsque le régime intracommunautaire est applicable.");
  }
  if (SELLER.vatExempt) {
    legalMentions.push("TVA non applicable — art. 293B du CGI.");
  }

  // Calculer la hauteur nécessaire pour les mentions légales
  const legalLines: string[] = [];
  for (const mention of legalMentions) {
    legalLines.push(...wrapText(mention, 92));
    legalLines.push(""); // espace entre mentions
  }
  const legalHeight = legalLines.length * 11 + 30;

  ensureSpace(ctx, legalHeight);
  ctx.y -= 10;
  drawText(ctx, "Mentions légales B2B", MARGIN, 11, bold);
  ctx.y -= 16;

  for (const mention of legalMentions) {
    const parts = wrapText(mention, 92);
    for (const part of parts) {
      ensureSpace(ctx, 12);
      drawText(ctx, part, MARGIN, 8.5, regular, muted);
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

async function sendInvoiceEmail(order: LoadedOrder, invoiceNumber: string, invoiceUrl: string, pdfBuffer: Buffer) {
  const client = await getClientIdentity(order);
  await sendEmail({
    to: order.email,
    subject: `Facture ${invoiceNumber} — Barber Paradise Pro`,
    html: `<p>Bonjour ${client.name},</p><p>Veuillez trouver ci-joint votre facture professionnelle <strong>${invoiceNumber}</strong> pour la commande <strong>${order.orderNumber}</strong>.</p><p>Vous pouvez également la télécharger depuis votre espace client pro : <a href="${invoiceUrl}">${invoiceUrl}</a>.</p>`,
    attachments: [
      {
        filename: `${invoiceNumber}.pdf`,
        content: pdfBuffer.toString("base64"),
      },
    ],
  });
}

export async function ensureProInvoiceForOrder(
  orderId: string,
  options?: { sendInvoiceEmail?: boolean }
): Promise<{ invoiceNumber: string; invoiceUrl: string; pdfBuffer?: Buffer } | null> {
  const shouldSendEmail = options?.sendInvoiceEmail !== false;
  const order = await loadInvoiceOrder(orderId);
  if (!order || !order.isB2B) return null;
  if (order.proInvoiceNumber && order.proInvoiceUrl) {
    return { invoiceNumber: order.proInvoiceNumber, invoiceUrl: order.proInvoiceUrl };
  }

  const invoiceNumber = order.proInvoiceNumber || await nextInvoiceNumber(new Date().getFullYear());
  const pdfBuffer = await generateInvoicePdf(order, invoiceNumber);
  const invoiceUrl = await uploadInvoicePdf(pdfBuffer, invoiceNumber);

  await prisma.order.update({
    where: { id: order.id },
    // Réinitialiser itemsLastModifiedAt pour masquer le badge "Facture à régénérer" après régénération
    data: { proInvoiceNumber: invoiceNumber, proInvoiceUrl: invoiceUrl, itemsLastModifiedAt: null },
  });

  if (shouldSendEmail) {
    await sendInvoiceEmail(order, invoiceNumber, invoiceUrl, pdfBuffer);
  }

  return { invoiceNumber, invoiceUrl, pdfBuffer };
}
