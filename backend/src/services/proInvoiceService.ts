import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
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

async function loadInvoiceOrder(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      customer: { include: { proAccount: true } },
      shippingAddress: true,
    },
  });
}

async function nextInvoiceNumber(year: number): Promise<string> {
  const prefix = `BP-PRO-${year}-`;
  const existing = await prisma.order.findMany({
    where: { proInvoiceNumber: { startsWith: prefix } },
    select: { proInvoiceNumber: true },
  });

  const max = existing.reduce((highest, order) => {
    const sequence = Number(order.proInvoiceNumber?.replace(prefix, "") || 0);
    return Number.isFinite(sequence) && sequence > highest ? sequence : highest;
  }, 0);

  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

function getClientIdentity(order: LoadedOrder) {
  const pro = order.customer?.proAccount;
  const billing = (order.billingAddress || {}) as Record<string, string | undefined>;
  const shipping = order.shippingAddress;
  const name = pro?.companyName || `${billing.firstName || shipping?.firstName || ""} ${billing.lastName || shipping?.lastName || ""}`.trim() || order.email;
  const address = billing.address || shipping?.address || "Adresse non renseignée";
  const extension = billing.extension || shipping?.extension || "";
  const city = `${billing.postalCode || shipping?.postalCode || ""} ${billing.city || shipping?.city || ""}`.trim();
  const country = billing.country || shipping?.country || "France";

  return {
    name,
    address: [address, extension].filter(Boolean).join(" "),
    city,
    country,
    siret: pro?.siret || "Non renseigné",
    vatNumber: order.vatNumber || pro?.vatNumber || "Non renseigné",
    email: order.email,
  };
}

function buildInvoiceLines(order: LoadedOrder): InvoiceLine[] {
  const lines = order.items.map((item) => ({
    designation: item.name,
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
  const accent = rgb(0.12, 0.12, 0.12);
  const muted = rgb(0.38, 0.38, 0.38);

  const draw = (text: string, x: number, y: number, size = 10, font = regular, color = accent) => {
    page.drawText(text, { x, y, size, font, color });
  };

  page.drawRectangle({ x: 0, y: 785, width: 595.28, height: 56.89, color: rgb(0.06, 0.06, 0.06) });
  page.drawText("BARBER PARADISE", { x: 40, y: 808, size: 18, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Facture professionnelle", { x: 370, y: 810, size: 14, font: bold, color: rgb(1, 1, 1) });

  draw(`Facture n° ${invoiceNumber}`, 40, 752, 15, bold);
  draw(`Date d’émission : ${formatDate(issuedAt)}`, 40, 732, 10);
  draw(`Commande : ${order.orderNumber}`, 40, 716, 10);

  draw("Vendeur", 40, 675, 11, bold);
  draw(SELLER.name, 40, 658, 10);
  draw(SELLER.address, 40, 642, 10);
  draw(SELLER.postalCity, 40, 626, 10);
  draw(`SIRET : ${SELLER.siret}`, 40, 610, 9, regular, muted);
  if (SELLER.vatNumber) draw(`TVA intracommunautaire : ${SELLER.vatNumber}`, 40, 596, 9, regular, muted);
  draw(`Email : ${SELLER.email}`, 40, 582, 9, regular, muted);

  draw("Client professionnel", 330, 675, 11, bold);
  draw(client.name, 330, 658, 10);
  wrapText(client.address, 34).forEach((line, index) => draw(line, 330, 642 - index * 14, 10));
  draw(client.city, 330, 612, 10);
  draw(client.country, 330, 598, 10);
  draw(`SIRET : ${client.siret}`, 330, 582, 9, regular, muted);
  draw(`TVA intracommunautaire : ${client.vatNumber}`, 330, 568, 9, regular, muted);

  const tableTop = 520;
  page.drawRectangle({ x: 40, y: tableTop, width: 515, height: 24, color: rgb(0.93, 0.91, 0.87) });
  draw("Désignation", 48, tableTop + 8, 9, bold);
  draw("Qté", 295, tableTop + 8, 9, bold);
  draw("PU HT", 330, tableTop + 8, 9, bold);
  draw("TVA", 395, tableTop + 8, 9, bold);
  draw("Total TTC", 460, tableTop + 8, 9, bold);

  let y = tableTop - 20;
  for (const line of lines) {
    const lineHT = money(line.unitHT * line.quantity);
    const lineVat = money(lineHT * (line.vatRate / 100));
    const lineTTC = money(lineHT + lineVat);
    const nameLines = wrapText(line.designation, 42);
    nameLines.forEach((part, index) => draw(part, 48, y - index * 12, 9));
    draw(String(line.quantity), 300, y, 9);
    draw(euro(line.unitHT), 330, y, 9);
    draw(`${line.vatRate}%`, 400, y, 9);
    draw(euro(lineTTC), 460, y, 9);
    y -= Math.max(22, nameLines.length * 12 + 8);
  }

  const totalsX = 365;
  y -= 12;
  draw("Montant HT", totalsX, y, 10, bold);
  draw(euro(order.totalHT), 470, y, 10);
  y -= 18;
  draw(`TVA (${order.vatRate}%)`, totalsX, y, 10, bold);
  draw(euro(order.vatAmount), 470, y, 10);
  y -= 18;
  draw("Montant TTC", totalsX, y, 12, bold);
  draw(euro(order.totalTTC || order.total), 470, y, 12, bold);

  const legalY = 160;
  draw("Mentions légales B2B", 40, legalY, 11, bold);
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

  legalMentions.forEach((mention, index) => {
    wrapText(mention, 92).forEach((part, lineIndex) => draw(part, 40, legalY - 18 - index * 26 - lineIndex * 11, 8.5, regular, muted));
  });

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

async function uploadInvoicePdf(pdfBuffer: Buffer, invoiceNumber: string): Promise<string> {
  const publicId = `barberparadise/invoices/${sanitizeCloudinaryPublicId(invoiceNumber)}`;

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
  const customerName = getClientIdentity(order).name;
  await sendEmail({
    to: order.email,
    subject: `Facture ${invoiceNumber} — Barber Paradise Pro`,
    html: `<p>Bonjour ${customerName},</p><p>Veuillez trouver ci-joint votre facture professionnelle <strong>${invoiceNumber}</strong> pour la commande <strong>${order.orderNumber}</strong>.</p><p>Vous pouvez également la télécharger depuis votre espace client pro : <a href="${invoiceUrl}">${invoiceUrl}</a>.</p>`,
    attachments: [
      {
        filename: `${invoiceNumber}.pdf`,
        content: pdfBuffer.toString("base64"),
      },
    ],
  });
}

export async function ensureProInvoiceForOrder(orderId: string): Promise<{ invoiceNumber: string; invoiceUrl: string } | null> {
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
    data: { proInvoiceNumber: invoiceNumber, proInvoiceUrl: invoiceUrl },
  });

  await sendInvoiceEmail(order, invoiceNumber, invoiceUrl, pdfBuffer);
  return { invoiceNumber, invoiceUrl };
}
