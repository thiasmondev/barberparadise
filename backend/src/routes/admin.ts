import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../utils/prisma";
import {
  getCustomerName,
  sendEmail,
  sendOrderShippedEmail,
} from "../services/emailService";
import { requireAdmin, AuthRequest } from "../middleware/auth";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { v2 as cloudinary } from "cloudinary";
import { PDFParse } from "pdf-parse";
import Anthropic from "@anthropic-ai/sdk";
import {
  buildIndyCsv,
  buildIndyEmailHtml,
  buildIndyReport,
  IndyReport,
  previousMonthKey,
} from "../services/indyReportService";

// ─── Cloudinary Config ───────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Multer (mémoire) ────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
  ) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Seules les images sont acceptées"));
  },
});

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
  ) => {
    if (
      file.mimetype === "text/csv" ||
      file.originalname.toLowerCase().endsWith(".csv")
    )
      cb(null, true);
    else cb(new Error("Seuls les fichiers CSV sont acceptés"));
  },
});

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
  ) => {
    if (
      file.mimetype === "application/pdf" ||
      file.originalname.toLowerCase().endsWith(".pdf")
    )
      cb(null, true);
    else cb(new Error("Seuls les fichiers PDF sont acceptés"));
  },
});

export const adminRouter = Router();

type NumericInput = string | number | null | undefined;

function toOptionalInt(value: NumericInput): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toOptionalFloat(value: NumericInput): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function toRequiredInt(value: NumericInput, field: string): number {
  const parsed = toOptionalInt(value);
  if (parsed === undefined || parsed === null)
    throw new Error(`${field} est requis`);
  return parsed;
}

function toRequiredFloat(value: NumericInput, field: string): number {
  const parsed = toOptionalFloat(value);
  if (parsed === undefined || parsed === null)
    throw new Error(`${field} est requis`);
  return parsed;
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  return value === undefined ? undefined : Boolean(value);
}

function buildPackagingData(body: Record<string, unknown>) {
  const lengthCm = toRequiredFloat(body.lengthCm as NumericInput, "Longueur");
  const widthCm = toRequiredFloat(body.widthCm as NumericInput, "Largeur");
  const heightCm = toRequiredFloat(body.heightCm as NumericInput, "Hauteur");
  return {
    name: String(body.name || "").trim(),
    type: String(body.type || "").trim(),
    lengthCm,
    widthCm,
    heightCm,
    internalVolumeCm3: Math.round(lengthCm * widthCm * heightCm * 100) / 100,
    maxWeightG: toRequiredInt(
      body.maxWeightG as NumericInput,
      "Poids max supporté"
    ),
    selfWeightG: toRequiredInt(
      body.selfWeightG as NumericInput,
      "Poids du carton vide"
    ),
    costEur: toRequiredFloat(body.costEur as NumericInput, "Coût unitaire"),
    stock: toRequiredInt(body.stock as NumericInput, "Stock disponible"),
    isReinforced: Boolean(body.isReinforced),
    isActive: body.isActive === undefined ? true : Boolean(body.isActive),
  };
}

type LogisticsCarrier =
  | "colissimo"
  | "mondial_relay"
  | "colissimo_international";

const LOGISTICS_CARRIERS: Record<LogisticsCarrier, string> = {
  colissimo: "Colissimo domicile",
  mondial_relay: "Mondial Relay point relais",
  colissimo_international: "Colissimo international",
};

type LogisticsItemProduct = {
  id: string;
  name: string;
  images: string;
  weightG: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  isFragile: boolean;
  isLiquid: boolean;
  isAerosol: boolean;
  logisticNote: string | null;
};

type LogisticsOrderItem = {
  id: string;
  name: string;
  quantity: number;
  image: string;
  product?: LogisticsItemProduct | null;
};

type LogisticsPackaging = {
  id: number;
  name: string;
  type: string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  internalVolumeCm3: number;
  maxWeightG: number;
  selfWeightG: number;
  costEur: number;
  stock: number;
  isReinforced: boolean;
  isActive: boolean;
};

function safeJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed)
      ? parsed.filter(item => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function getLogisticsItemImage(item: LogisticsOrderItem): string {
  if (item.image) return item.image;
  return safeJsonArray(item.product?.images || "")[0] || "";
}

function computeLogisticsMetrics(items: LogisticsOrderItem[]) {
  let itemCount = 0;
  let totalWeightG = 0;
  let totalVolumeCm3 = 0;
  let hasUnknownWeight = false;
  let hasFragile = false;
  let hasLiquid = false;
  let hasAerosol = false;

  for (const item of items) {
    const quantity = Math.max(0, item.quantity || 0);
    const product = item.product;
    itemCount += quantity;

    if (!product || product.weightG === null || product.weightG === undefined) {
      hasUnknownWeight = true;
    } else {
      totalWeightG += product.weightG * quantity;
    }

    const lengthCm = product?.lengthCm ?? 10;
    const widthCm = product?.widthCm ?? 10;
    const heightCm = product?.heightCm ?? 5;
    totalVolumeCm3 += lengthCm * widthCm * heightCm * quantity;
    hasFragile = hasFragile || Boolean(product?.isFragile);
    hasLiquid = hasLiquid || Boolean(product?.isLiquid);
    hasAerosol = hasAerosol || Boolean(product?.isAerosol);
  }

  return {
    itemCount,
    totalWeightG,
    estimatedWeightG: hasUnknownWeight ? null : totalWeightG,
    totalVolumeCm3: Math.round(totalVolumeCm3 * 1.2),
    hasUnknownWeight,
    hasFragile,
    hasLiquid,
    hasAerosol,
  };
}

function findRecommendedPackaging(
  packagings: LogisticsPackaging[],
  totalWeightG: number,
  totalVolumeCm3: number
) {
  return (
    packagings
      .filter(
        p =>
          p.isActive &&
          p.maxWeightG >= totalWeightG &&
          p.internalVolumeCm3 >= totalVolumeCm3
      )
      .sort((a, b) => a.internalVolumeCm3 - b.internalVolumeCm3)[0] || null
  );
}

function normalizeLogisticsItem(item: LogisticsOrderItem) {
  const product = item.product;
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    image: getLogisticsItemImage(item),
    productId: product?.id || null,
    weightG: product?.weightG ?? null,
    lengthCm: product?.lengthCm ?? null,
    widthCm: product?.widthCm ?? null,
    heightCm: product?.heightCm ?? null,
    isFragile: Boolean(product?.isFragile),
    isLiquid: Boolean(product?.isLiquid),
    isAerosol: Boolean(product?.isAerosol),
    logisticNote: product?.logisticNote ?? null,
  };
}

type AdminStockStatus = "active" | "draft" | "archived" | "inactive";

type StockCatalogProduct = {
  id: string;
  name: string;
  brand: string;
  stockCount: number;
  inStock: boolean;
  variants: {
    id: string;
    name: string;
    stock: number;
    inStock: boolean;
    sku: string;
  }[];
};

type StockImportProposal = {
  lineText: string;
  extractedName: string;
  quantity: number;
  confidence: number;
  productId: string | null;
  productName: string | null;
  variantId: string | null;
  variantName: string | null;
  currentStock: number | null;
  newStock: number | null;
  reason: string;
};

const STOCK_STATUSES = new Set<AdminStockStatus>([
  "active",
  "draft",
  "archived",
  "inactive",
]);
const anthropicForStock = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

function toStockStatus(value: unknown): AdminStockStatus | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const status = String(value).trim() as AdminStockStatus;
  if (!STOCK_STATUSES.has(status)) throw new Error("Statut produit invalide");
  return status;
}

function toNonNegativeInt(
  value: NumericInput,
  field: string
): number | undefined {
  const parsed = toOptionalInt(value);
  if (parsed === undefined) return undefined;
  if (parsed === null || parsed < 0)
    throw new Error(`${field} doit être un entier positif ou nul`);
  return parsed;
}

function normalizeForStockMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreStockMatch(line: string, label: string, sku?: string): number {
  const normalizedLine = normalizeForStockMatch(line);
  const normalizedLabel = normalizeForStockMatch(label);
  if (!normalizedLabel) return 0;
  let score = 0;
  if (normalizedLine.includes(normalizedLabel)) score += 0.75;
  const tokens = normalizedLabel.split(" ").filter(token => token.length >= 3);
  if (tokens.length > 0) {
    const hits = tokens.filter(token => normalizedLine.includes(token)).length;
    score += Math.min(0.65, (hits / tokens.length) * 0.65);
  }
  if (
    sku &&
    normalizeForStockMatch(sku) &&
    normalizedLine.includes(normalizeForStockMatch(sku))
  )
    score += 0.35;
  return Math.min(0.99, score);
}

function extractQuantityFromInvoiceLine(line: string): number | null {
  const explicit = line.match(
    /(?:quantit[eé]|qt[eé]|qte|qty)\s*[:x×-]?\s*(\d{1,4})/i
  );
  if (explicit) return parseInt(explicit[1], 10);
  const beginning = line.match(/^\s*(\d{1,4})\s+(?:x|×)?\s*[A-Za-zÀ-ÿ0-9]/);
  if (beginning) return parseInt(beginning[1], 10);
  const numbers = [...line.matchAll(/\b(\d{1,4})\b/g)].map(match =>
    parseInt(match[1], 10)
  );
  const plausible = numbers.filter(number => number > 0 && number < 1000);
  if (plausible.length === 1) return plausible[0];
  return null;
}

function extractHeuristicInvoiceCandidates(
  text: string
): { lineText: string; extractedName: string; quantity: number }[] {
  return text
    .split(/\r?\n/)
    .map(line => line.replace(/\s+/g, " ").trim())
    .filter(line => line.length >= 8)
    .map(line => ({ line, quantity: extractQuantityFromInvoiceLine(line) }))
    .filter(
      (item): item is { line: string; quantity: number } =>
        Number.isFinite(item.quantity ?? NaN) && (item.quantity ?? 0) > 0
    )
    .map(item => ({
      lineText: item.line,
      extractedName: item.line
        .replace(/(?:quantit[eé]|qt[eé]|qte|qty)\s*[:x×-]?\s*\d{1,4}/gi, "")
        .replace(/^\s*\d{1,4}\s*(?:x|×)?\s*/i, "")
        .trim(),
      quantity: item.quantity,
    }))
    .slice(0, 80);
}

function buildStockImportProposals(
  candidates: {
    lineText: string;
    extractedName: string;
    quantity: number;
    confidence?: number;
  }[],
  catalog: StockCatalogProduct[]
): StockImportProposal[] {
  return candidates.map(candidate => {
    let best: {
      product: StockCatalogProduct;
      variant?: StockCatalogProduct["variants"][number];
      score: number;
      label: string;
    } | null = null;
    for (const product of catalog) {
      const productScore = scoreStockMatch(
        `${candidate.extractedName} ${candidate.lineText}`,
        `${product.brand} ${product.name}`
      );
      if (!best || productScore > best.score)
        best = { product, score: productScore, label: product.name };
      for (const variant of product.variants) {
        const variantLabel = `${product.brand} ${product.name} ${variant.name}`;
        const variantScore = scoreStockMatch(
          `${candidate.extractedName} ${candidate.lineText}`,
          variantLabel,
          variant.sku
        );
        if (!best || variantScore > best.score)
          best = { product, variant, score: variantScore, label: variantLabel };
      }
    }
    const match = best && best.score >= 0.38 ? best : null;
    const currentStock = match
      ? match.variant
        ? match.variant.stock
        : match.product.stockCount
      : null;
    const confidence = Math.max(
      candidate.confidence ?? 0,
      match ? match.score : 0
    );
    return {
      lineText: candidate.lineText,
      extractedName: candidate.extractedName,
      quantity: Math.max(0, Math.round(candidate.quantity)),
      confidence: Math.round(Math.min(0.99, confidence) * 100) / 100,
      productId: match ? match.product.id : null,
      productName: match ? match.product.name : null,
      variantId: match && match.variant ? match.variant.id : null,
      variantName: match && match.variant ? match.variant.name : null,
      currentStock,
      newStock:
        currentStock === null
          ? null
          : currentStock + Math.max(0, Math.round(candidate.quantity)),
      reason: match
        ? "Correspondance automatique à vérifier avant application"
        : "Produit non reconnu automatiquement",
    };
  });
}

async function extractInvoiceCandidatesWithClaude(
  text: string,
  catalog: StockCatalogProduct[]
): Promise<
  | {
      lineText: string;
      extractedName: string;
      quantity: number;
      confidence?: number;
    }[]
  | null
> {
  if (!anthropicForStock) return null;
  const catalogSummary = catalog
    .flatMap(product => [
      { id: product.id, label: `${product.brand} — ${product.name}` },
      ...product.variants.map(variant => ({
        id: variant.id,
        label: `${product.brand} — ${product.name} — ${variant.name}${variant.sku ? ` — SKU ${variant.sku}` : ""}`,
      })),
    ])
    .slice(0, 600);
  const prompt = `Tu extrais les lignes produits d'une facture fournisseur BarberParadise. Réponds uniquement en JSON valide au format {"items":[{"lineText":"texte source","extractedName":"nom produit","quantity":12,"confidence":0.8}]}.

Règles : quantity est la quantité reçue ou facturée, pas un prix, pas une référence, pas un total monétaire. Ignore TVA, frais, livraison, remises et totaux. Utilise le catalogue seulement comme aide de reconnaissance.

Catalogue partiel :
${JSON.stringify(catalogSummary).slice(0, 18000)}

Texte facture :
${text.slice(0, 45000)}`;
  const message = await anthropicForStock.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 5000,
    messages: [{ role: "user", content: prompt }],
  });
  const textBlock = message.content.find(block => block.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;
  const match = textBlock.text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  const parsed = JSON.parse(match[0]) as { items?: unknown[] };
  if (!Array.isArray(parsed.items)) return null;
  return parsed.items
    .map(item => item as Record<string, unknown>)
    .map(item => ({
      lineText: String(item.lineText || item.extractedName || "").trim(),
      extractedName: String(item.extractedName || item.lineText || "").trim(),
      quantity: Math.max(0, Math.round(Number(item.quantity || 0))),
      confidence: Number(item.confidence || 0),
    }))
    .filter(item => item.extractedName && item.quantity > 0)
    .slice(0, 100);
}

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/["\n\r,;]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function parseNullablePrice(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

async function generateIndyCfoAnalysis(report: IndyReport): Promise<string> {
  if (!anthropicForStock) {
    return "Analyse CFO indisponible : clé ANTHROPIC_API_KEY absente. Vérifier le CA TTC, la TVA collectée, les ventes par PSP et la répartition OSS avant clôture Indy.";
  }

  try {
    const message = await anthropicForStock.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 900,
      messages: [
        {
          role: "user",
          content: `Tu es CFO e-commerce pour Barber Paradise. Analyse ce bilan mensuel Indy en français, en 5 points opérationnels maximum : cohérence CA/TVA, concentration PSP, répartition OSS pays/TVA, remboursements/annulations, points à vérifier avant clôture Indy. Ne produis pas de tableau. Données JSON : ${JSON.stringify(report).slice(0, 20000)}`,
        },
      ],
    });
    const textBlock = message.content.find(block => block.type === "text");
    return textBlock && textBlock.type === "text" ? textBlock.text.trim() : "Analyse CFO indisponible.";
  } catch (error) {
    console.error("[indy-report] Analyse CFO Claude impossible", error);
    return "Analyse CFO indisponible : génération Claude en échec. Vérifier manuellement le CA, la TVA, les PSP et les remboursements avant clôture Indy.";
  }
}

function getIndyEmailRecipient(req: AuthRequest): string {
  const body = req.body as { to?: unknown } | undefined;
  if (typeof body?.to === "string" && body.to.trim()) return body.to.trim();
  if (process.env.FINANCE_EMAIL) return process.env.FINANCE_EMAIL;
  if (process.env.ADMIN_EMAIL) return process.env.ADMIN_EMAIL;
  return "contact@barberparadise.fr";
}

// GET /api/admin/finance/indy-report?month=YYYY-MM — Bilan mensuel commerçant Indy
adminRouter.get(
  "/finance/indy-report",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const report = await buildIndyReport(req.query.month);
      res.json(report);
    } catch (error) {
      console.error("[indy-report] Rapport impossible", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Rapport Indy impossible" });
    }
  }
);

// GET /api/admin/finance/indy-report/csv?month=YYYY-MM — CSV compatible Indy
adminRouter.get(
  "/finance/indy-report/csv",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const report = await buildIndyReport(req.query.month);
      const csv = buildIndyCsv(report);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=\"barberparadise-indy-${report.month}.csv\"`);
      res.send(csv);
    } catch (error) {
      console.error("[indy-report] CSV impossible", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "CSV Indy impossible" });
    }
  }
);

// POST /api/admin/finance/indy-report/send-email — Envoi manuel ou mensuel du CSV Indy
adminRouter.post(
  "/finance/indy-report/send-email",
  requireAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const body = req.body as { month?: unknown; monthly?: unknown } | undefined;
      const month = body?.month || (body?.monthly === true ? previousMonthKey() : undefined);
      const report = await buildIndyReport(month);
      const cfoAnalysis = await generateIndyCfoAnalysis(report);
      const csv = buildIndyCsv(report);
      const to = getIndyEmailRecipient(req);
      const emailResult = await sendEmail({
        to,
        subject: `Bilan mensuel Indy Barber Paradise — ${report.month}`,
        html: buildIndyEmailHtml(report, cfoAnalysis),
        attachments: [
          {
            filename: `barberparadise-indy-${report.month}.csv`,
            content: Buffer.from(csv, "utf8").toString("base64"),
          },
        ],
      });

      res.json({ sent: emailResult.sent, skipped: emailResult.skipped || false, id: emailResult.id, month: report.month, to, cfoAnalysis });
    } catch (error) {
      console.error("[indy-report] Email impossible", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Email Indy impossible" });
    }
  }
);

// POST /api/admin/finance/indy-report/send-monthly — Déclenchement prévu le 1er du mois pour le mois précédent
adminRouter.post(
  "/finance/indy-report/send-monthly",
  requireAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    req.body = { ...(req.body || {}), monthly: true };
    const report = await buildIndyReport(previousMonthKey());
    const cfoAnalysis = await generateIndyCfoAnalysis(report);
    const csv = buildIndyCsv(report);
    const to = getIndyEmailRecipient(req);
    const emailResult = await sendEmail({
      to,
      subject: `Bilan mensuel Indy Barber Paradise — ${report.month}`,
      html: buildIndyEmailHtml(report, cfoAnalysis),
      attachments: [{ filename: `barberparadise-indy-${report.month}.csv`, content: Buffer.from(csv, "utf8").toString("base64") }],
    });
    res.json({ sent: emailResult.sent, skipped: emailResult.skipped || false, id: emailResult.id, month: report.month, to, cfoAnalysis });
  }
);

// GET /api/admin/stats — Statistiques du tableau de bord
adminRouter.get(
  "/stats",
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const [
        totalProducts,
        totalOrders,
        totalCustomers,
        recentOrders,
        ordersByStatus,
      ] = await Promise.all([
        prisma.product.count({ where: { status: "active" } }),
        prisma.order.count(),
        prisma.customer.count(),
        prisma.order.findMany({
          select: { id: true, total: true, status: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        prisma.order.groupBy({
          by: ["status"],
          _count: { status: true },
          _sum: { total: true },
        }),
      ]);

      let totalRevenue = 0;
      await prisma.order.findMany({ select: { total: true } }).then(orders => {
        totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
      });

      res.json({
        totalProducts,
        totalOrders,
        totalCustomers,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        recentOrders,
        ordersByStatus: ordersByStatus.map(s => ({
          status: s.status,
          count: s._count.status,
          revenue: s._sum.total || 0,
        })),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
);

// GET /api/admin/products/meta — Marques + toutes catégories/sous-catégories (3 niveaux) pour autocomplétion
adminRouter.get(
  "/products/meta",
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const [brands, allCategoryRows, productCategories, productSubcategories] =
        await Promise.all([
          // Marques distinctes depuis les produits
          prisma.product.findMany({
            select: { brand: true },
            distinct: ["brand"],
            where: { brand: { not: "" } },
            orderBy: { brand: "asc" },
          }),
          // Toutes les entrées de la table Category (3 niveaux)
          prisma.category.findMany({
            select: { slug: true, name: true, parentSlug: true },
            orderBy: [{ parentSlug: "asc" }, { name: "asc" }],
          }),
          // Catégories utilisées dans les produits (complément)
          prisma.product.findMany({
            select: { category: true },
            distinct: ["category"],
            where: { category: { not: "" } },
          }),
          // Sous-catégories utilisées dans les produits (complément)
          prisma.product.findMany({
            select: { subcategory: true },
            distinct: ["subcategory"],
            where: { subcategory: { not: "" } },
          }),
        ]);

      // Map slug -> nom et parent pour affichage
      const nameMap = new Map(allCategoryRows.map(c => [c.slug, c.name]));
      const parentMap = new Map(
        allCategoryRows.map(c => [c.slug, c.parentSlug || ""])
      );

      // Identifier les slugs de chaque niveau (structure à 4 niveaux possible)
      // Niveau 0 : racines (parentSlug vide/null)
      const rootSlugs = new Set(
        allCategoryRows.filter(c => !c.parentSlug).map(c => c.slug)
      );
      // Niveau 1 : enfants directs des racines (ex: cheveux, barbe, peignes...)
      const level1Slugs = new Set(
        allCategoryRows
          .filter(c => c.parentSlug && rootSlugs.has(c.parentSlug))
          .map(c => c.slug)
      );
      // Niveau 2 : enfants des niveau 1 (ex: cires, gel, laques...)
      const level2Slugs = new Set(
        allCategoryRows
          .filter(c => c.parentSlug && level1Slugs.has(c.parentSlug))
          .map(c => c.slug)
      );
      // Niveau 3 : enfants des niveau 2 (ex: cire-brillante, cire-mat-naturel...)
      const level3Slugs = new Set(
        allCategoryRows
          .filter(c => c.parentSlug && level2Slugs.has(c.parentSlug))
          .map(c => c.slug)
      );

      // Pour le champ "Catégorie" (niveau 1) : enfants directs des racines
      const categorySlugs = new Set([
        ...level1Slugs,
        ...productCategories.map(c => c.category).filter(Boolean),
      ]);

      // Pour le champ "Sous-catégorie" (niveau 2) : enfants des catégories
      const subcategorySlugs = new Set([
        ...level2Slugs,
        ...productSubcategories.map(s => s.subcategory).filter(Boolean),
      ]);

      // Construire les suggestions enrichies avec label hiérarchique
      const categoriesWithLabels = [...categorySlugs].sort().map(slug => ({
        slug,
        label: nameMap.has(slug) ? `${nameMap.get(slug)!}` : slug,
        parent: parentMap.get(slug) || "",
      }));

      const subcategoriesWithLabels = [...subcategorySlugs].sort().map(slug => {
        const name = nameMap.get(slug) || slug;
        const parent = parentMap.get(slug) || "";
        const parentName = nameMap.get(parent) || parent;
        return {
          slug,
          label: parentName ? `${name} (${parentName})` : name,
          parent,
        };
      });

      // Sous-sous-catégories (niveau 3) séparées pour le 3e champ
      const subsubcategoriesWithLabels = [...level3Slugs].sort().map(slug => {
        const name = nameMap.get(slug) || slug;
        const parent = parentMap.get(slug) || "";
        const parentName = nameMap.get(parent) || parent;
        return { slug, label: `${name} (sous ${parentName})`, parent };
      });

      // Map parentSlug (niveau 2) -> enfants niveau 3 (pour filtrage dynamique du 3e champ)
      const level3ByParent: Record<string, { slug: string; label: string }[]> =
        {};
      for (const slug of level3Slugs) {
        const parent = parentMap.get(slug) || "";
        if (!level3ByParent[parent]) level3ByParent[parent] = [];
        level3ByParent[parent].push({ slug, label: nameMap.get(slug) || slug });
      }

      // Map parentSlug (niveau 1) -> enfants niveau 2 (pour filtrage dynamique du 2e champ)
      const level2ByParent: Record<string, { slug: string; label: string }[]> =
        {};
      for (const slug of level2Slugs) {
        const parent = parentMap.get(slug) || "";
        if (!level2ByParent[parent]) level2ByParent[parent] = [];
        level2ByParent[parent].push({ slug, label: nameMap.get(slug) || slug });
      }

      res.json({
        brands: brands.map(b => b.brand).filter(Boolean),
        categories: [...categorySlugs].sort(),
        subcategories: [...subcategorySlugs].sort(),
        categoriesWithLabels,
        subcategoriesWithLabels,
        subsubcategoriesWithLabels,
        level3ByParent,
        level2ByParent,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
);

type AdminProPriceUpdate = {
  productId?: unknown;
  variantId?: unknown;
  priceProEur?: unknown;
};

type ProPriceProductRow = {
  id: string;
  name: string;
  price: number;
};

type ProPriceVariantRow = {
  id: string;
  name: string;
  price: number | null;
  productId: string;
  product: ProPriceProductRow;
};

function validateProPriceValue(
  label: string,
  priceProEur: number | null,
  publicPriceTtc: number
): string | null {
  if (Number.isNaN(priceProEur)) return `${label} : prix pro invalide`;
  if (priceProEur !== null && priceProEur < 0)
    return `${label} : prix pro négatif`;
  if (priceProEur !== null && priceProEur >= publicPriceTtc)
    return `${label} : le prix pro HT doit être inférieur au prix public TTC`;
  return null;
}

// GET /api/admin/pro/prices/export — Export CSV de tous les prix professionnels
adminRouter.get(
  "/pro/prices/export",
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const products = await prisma.product.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          brand: true,
          price: true,
          priceProEur: true,
          variants: {
            select: {
              id: true,
              name: true,
              price: true,
              priceProEur: true,
              order: true,
            },
            orderBy: { order: "asc" },
          },
        },
        orderBy: [{ brand: "asc" }, { name: "asc" }],
      });

      const header = [
        "id",
        "slug",
        "nom",
        "variante",
        "prix_public_ttc",
        "prix_pro_ht",
      ];
      const lines = [header.join(",")];
      for (const product of products) {
        if (product.variants.length > 0) {
          for (const variant of product.variants) {
            lines.push(
              [
                variant.id,
                product.slug,
                product.name,
                variant.name,
                variant.price ?? product.price,
                variant.priceProEur ?? "",
              ]
                .map(csvEscape)
                .join(",")
            );
          }
        } else {
          lines.push(
            [
              product.id,
              product.slug,
              product.name,
              "",
              product.price,
              product.priceProEur ?? "",
            ]
              .map(csvEscape)
              .join(",")
          );
        }
      }

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=barberparadise-prix-pro.csv"
      );
      res.send(`\uFEFF${lines.join("\n")}`);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur export prix professionnels" });
    }
  }
);

// POST /api/admin/pro/prices/import — Import CSV des prix professionnels
adminRouter.post(
  "/pro/prices/import",
  requireAdmin,
  csvUpload.single("csv"),
  async (req: Request, res: Response): Promise<void> => {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ error: "Aucun fichier CSV fourni" });
      return;
    }

    try {
      const rows: Record<string, string>[] = parse(
        file.buffer.toString("utf-8"),
        {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          bom: true,
          relax_quotes: true,
        }
      );

      const rowIds = [
        ...new Set(
          rows
            .map(
              row =>
                row.id ||
                row.productId ||
                row.variantId ||
                row.product_id ||
                row.variant_id
            )
            .filter(Boolean)
        ),
      ];
      const [products, variants] = await Promise.all([
        prisma.product.findMany({
          where: { id: { in: rowIds } },
          select: { id: true, name: true, price: true },
        }),
        prisma.productVariant.findMany({
          where: { id: { in: rowIds } },
          select: {
            id: true,
            name: true,
            price: true,
            productId: true,
            product: { select: { id: true, name: true, price: true } },
          },
        }),
      ]);
      const productById = new Map(
        products.map(product => [product.id, product])
      );
      const variantById = new Map(
        variants.map(variant => [variant.id, variant])
      );
      const errors: string[] = [];
      const productUpdates: {
        productId: string;
        priceProEur: number | null;
      }[] = [];
      const variantUpdates: {
        variantId: string;
        priceProEur: number | null;
      }[] = [];

      rows.forEach((row, index) => {
        const rowNumber = index + 2;
        const id =
          row.id ||
          row.productId ||
          row.variantId ||
          row.product_id ||
          row.variant_id;
        const rawPrice =
          row.priceProEur ??
          row.prix_pro_ht ??
          row.price_pro_eur ??
          row["Prix pro HT"] ??
          "";
        if (!id) {
          errors.push(`Ligne ${rowNumber} : id manquant`);
          return;
        }
        const priceProEur = parseNullablePrice(rawPrice);
        const variant = variantById.get(id);
        const product = productById.get(id);
        if (variant) {
          const publicPrice = variant.price ?? variant.product.price;
          const label = `${variant.product.name} — ${variant.name}`;
          const error = validateProPriceValue(label, priceProEur, publicPrice);
          if (error) {
            errors.push(`Ligne ${rowNumber} : ${error}`);
            return;
          }
          variantUpdates.push({ variantId: variant.id, priceProEur });
          return;
        }
        if (product) {
          const error = validateProPriceValue(
            product.name,
            priceProEur,
            product.price
          );
          if (error) {
            errors.push(`Ligne ${rowNumber} : ${error}`);
            return;
          }
          productUpdates.push({ productId: product.id, priceProEur });
          return;
        }
        errors.push(
          `Ligne ${rowNumber} : produit ou variante introuvable (${id})`
        );
      });

      if (errors.length > 0) {
        res.status(400).json({ updated: 0, errors });
        return;
      }

      await prisma.$transaction([
        ...productUpdates.map(update =>
          prisma.product.update({
            where: { id: update.productId },
            data: { priceProEur: update.priceProEur },
          })
        ),
        ...variantUpdates.map(update =>
          prisma.productVariant.update({
            where: { id: update.variantId },
            data: { priceProEur: update.priceProEur },
          })
        ),
      ]);

      res.json({
        updated: productUpdates.length + variantUpdates.length,
        errors: [],
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : "Erreur import prix professionnels",
      });
    }
  }
);

// GET /api/admin/pro/prices/:brandId — Produits d'une marque avec prix pro
adminRouter.get(
  "/pro/prices/:brandId",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const brandId = parseInt(req.params.brandId, 10);
      if (!Number.isFinite(brandId)) {
        res.status(400).json({ error: "Marque invalide" });
        return;
      }

      const brand = await prisma.brand.findUnique({
        select: { id: true, name: true, slug: true },
        where: { id: brandId },
      });
      if (!brand) {
        res.status(404).json({ error: "Marque introuvable" });
        return;
      }

      const products = await prisma.product.findMany({
        where: { OR: [{ brandId }, { brand: brand.name }] },
        select: {
          id: true,
          name: true,
          slug: true,
          brand: true,
          brandId: true,
          price: true,
          priceProEur: true,
          status: true,
          variants: {
            select: {
              id: true,
              name: true,
              price: true,
              priceProEur: true,
              order: true,
            },
            orderBy: { order: "asc" },
          },
        },
        orderBy: { name: "asc" },
      });

      res.json({ brand, products });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur chargement prix professionnels" });
    }
  }
);

// PUT /api/admin/pro/prices/brand/:brandId — Mise à jour groupée des prix pro d'une marque
adminRouter.put(
  "/pro/prices/brand/:brandId",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const brandId = parseInt(req.params.brandId, 10);
      const incoming: AdminProPriceUpdate[] = Array.isArray(req.body?.prices)
        ? req.body.prices
        : [];
      if (!Number.isFinite(brandId)) {
        res.status(400).json({ error: "Marque invalide" });
        return;
      }
      if (incoming.length === 0) {
        res.status(400).json({
          error: "Aucun prix à sauvegarder",
          updated: 0,
          errors: ["Aucun prix à sauvegarder"],
        });
        return;
      }

      const brand = await prisma.brand.findUnique({
        select: { id: true, name: true },
        where: { id: brandId },
      });
      if (!brand) {
        res.status(404).json({ error: "Marque introuvable" });
        return;
      }

      const products = await prisma.product.findMany({
        where: { OR: [{ brandId }, { brand: brand.name }] },
        select: { id: true, name: true, price: true },
      });
      const productById = new Map(
        products.map(product => [product.id, product])
      );
      const productIds = products.map(product => product.id);
      const variantIds = incoming
        .map(item => String(item.variantId || ""))
        .filter(Boolean);
      const variants = await prisma.productVariant.findMany({
        where: { id: { in: variantIds }, productId: { in: productIds } },
        select: {
          id: true,
          name: true,
          price: true,
          productId: true,
          product: { select: { id: true, name: true, price: true } },
        },
      });
      const variantById = new Map(
        variants.map(variant => [variant.id, variant])
      );
      const errors: string[] = [];
      const productUpdates: {
        productId: string;
        priceProEur: number | null;
      }[] = [];
      const variantUpdates: {
        variantId: string;
        priceProEur: number | null;
      }[] = [];

      incoming.forEach((item, index) => {
        const variantId = String(item.variantId || "");
        const productId = String(item.productId || "");
        const priceProEur = parseNullablePrice(item.priceProEur);
        if (variantId) {
          const variant = variantById.get(variantId) as
            | ProPriceVariantRow
            | undefined;
          if (!variant) {
            errors.push(
              `Ligne ${index + 1} : variante hors marque ou introuvable (${variantId})`
            );
            return;
          }
          const label = `${variant.product.name} — ${variant.name}`;
          const error = validateProPriceValue(
            label,
            priceProEur,
            variant.price ?? variant.product.price
          );
          if (error) {
            errors.push(error);
            return;
          }
          variantUpdates.push({ variantId, priceProEur });
          return;
        }

        if (!productId) {
          errors.push(`Ligne ${index + 1} : productId ou variantId manquant`);
          return;
        }
        const product = productById.get(productId);
        if (!product) {
          errors.push(`Produit hors marque ou introuvable : ${productId}`);
          return;
        }
        const error = validateProPriceValue(
          product.name,
          priceProEur,
          product.price
        );
        if (error) {
          errors.push(error);
          return;
        }
        productUpdates.push({ productId, priceProEur });
      });

      if (errors.length > 0) {
        res.status(400).json({ updated: 0, errors: [...new Set(errors)] });
        return;
      }

      await prisma.$transaction([
        ...productUpdates.map(update =>
          prisma.product.update({
            where: { id: update.productId },
            data: { priceProEur: update.priceProEur },
          })
        ),
        ...variantUpdates.map(update =>
          prisma.productVariant.update({
            where: { id: update.variantId },
            data: { priceProEur: update.priceProEur },
          })
        ),
      ]);

      res.json({
        updated: productUpdates.length + variantUpdates.length,
        errors: [],
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur sauvegarde prix professionnels" });
    }
  }
);

// GET /api/admin/stock/brands — Synthèse stock par marque
adminRouter.get(
  "/stock/brands",
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const products = await prisma.product.findMany({
        select: {
          id: true,
          brand: true,
          brandId: true,
          stockCount: true,
          inStock: true,
          status: true,
        },
        orderBy: [{ brand: "asc" }, { name: "asc" }],
      });
      const brands = await prisma.brand.findMany({
        select: { id: true, name: true, slug: true, logo: true },
      });
      const brandById = new Map(brands.map(brand => [brand.id, brand]));
      const grouped = new Map<
        string,
        {
          brandId: number | null;
          brand: string;
          slug: string;
          logo: string | null;
          productCount: number;
          activeCount: number;
          inStockCount: number;
          outOfStockCount: number;
          totalStockCount: number;
        }
      >();
      for (const product of products) {
        const brandRef = product.brandId
          ? brandById.get(product.brandId)
          : null;
        const brandName = brandRef?.name || product.brand || "Sans marque";
        const key = product.brandId
          ? `id:${product.brandId}`
          : `name:${brandName.toLowerCase()}`;
        if (!grouped.has(key)) {
          grouped.set(key, {
            brandId: product.brandId ?? null,
            brand: brandName,
            slug:
              brandRef?.slug ||
              normalizeForStockMatch(brandName).replace(/\s+/g, "-") ||
              "sans-marque",
            logo: brandRef?.logo || null,
            productCount: 0,
            activeCount: 0,
            inStockCount: 0,
            outOfStockCount: 0,
            totalStockCount: 0,
          });
        }
        const item = grouped.get(key)!;
        item.productCount += 1;
        if (product.status === "active") item.activeCount += 1;
        if (product.inStock) item.inStockCount += 1;
        else item.outOfStockCount += 1;
        item.totalStockCount += product.stockCount ?? 0;
      }
      res.json({
        brands: [...grouped.values()].sort((a, b) =>
          a.brand.localeCompare(b.brand, "fr")
        ),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur chargement synthèse stock" });
    }
  }
);

// GET /api/admin/stock/products — Produits stock d'une marque
adminRouter.get(
  "/stock/products",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { brand, brandId, search, status } = req.query as Record<
        string,
        string
      >;
      const where: Record<string, unknown> = {};
      if (brandId) where.brandId = parseInt(brandId, 10);
      else if (brand) where.brand = brand;
      if (status) where.status = status;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { slug: { contains: search, mode: "insensitive" } },
          { brand: { contains: search, mode: "insensitive" } },
        ];
      }
      const products = await prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          brand: true,
          brandId: true,
          category: true,
          subcategory: true,
          price: true,
          priceProEur: true,
          originalPrice: true,
          images: true,
          inStock: true,
          stockCount: true,
          status: true,
          updatedAt: true,
          variants: {
            select: {
              id: true,
              name: true,
              price: true,
              priceProEur: true,
              stock: true,
              inStock: true,
              sku: true,
              order: true,
            },
            orderBy: { order: "asc" },
          },
        },
        orderBy: [{ brand: "asc" }, { name: "asc" }],
        take: 500,
      });
      res.json({
        products: products.map(product => ({
          ...product,
          images: JSON.parse(product.images || "[]"),
        })),
        total: products.length,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur chargement produits stock" });
    }
  }
);

// PATCH /api/admin/stock/products/:id — Mise à jour rapide stock/prix/statut
adminRouter.patch(
  "/stock/products/:id",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const currentProduct = await prisma.product.findUnique({
        where: { id: req.params.id },
        select: { price: true },
      });
      if (!currentProduct) {
        res.status(404).json({ error: "Produit introuvable" });
        return;
      }
      const nextPublicPrice =
        req.body.price !== undefined
          ? parseFloat(String(req.body.price))
          : currentProduct.price;
      const nextProPrice = toOptionalFloat(
        req.body.priceProEur as NumericInput
      );
      if (
        nextProPrice !== undefined &&
        nextProPrice !== null &&
        nextProPrice >= nextPublicPrice
      ) {
        res.status(400).json({
          error: "Le prix pro HT doit être inférieur au prix public TTC",
        });
        return;
      }
      const updated = await prisma.product.update({
        where: { id: req.params.id },
        data: {
          price: req.body.price !== undefined ? nextPublicPrice : undefined,
          priceProEur: nextProPrice,
          stockCount: toNonNegativeInt(
            req.body.stockCount as NumericInput,
            "Stock"
          ),
          inStock:
            req.body.inStock !== undefined
              ? Boolean(req.body.inStock)
              : undefined,
          status: toStockStatus(req.body.status),
        },
        include: { variants: { orderBy: { order: "asc" } } },
      });
      res.json({ ...updated, images: JSON.parse(updated.images || "[]") });
    } catch (err) {
      console.error(err);
      res.status(400).json({
        error: err instanceof Error ? err.message : "Erreur mise à jour stock",
      });
    }
  }
);

// PATCH /api/admin/stock/variants/:id — Mise à jour rapide stock/prix variante
adminRouter.patch(
  "/stock/variants/:id",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const currentVariant = await prisma.productVariant.findUnique({
        where: { id: req.params.id },
        select: { price: true, product: { select: { price: true } } },
      });
      if (!currentVariant) {
        res.status(404).json({ error: "Variante introuvable" });
        return;
      }
      const publicPrice = currentVariant.price ?? currentVariant.product.price;
      const nextProPrice = toOptionalFloat(
        req.body.priceProEur as NumericInput
      );
      if (
        nextProPrice !== undefined &&
        nextProPrice !== null &&
        nextProPrice >= publicPrice
      ) {
        res.status(400).json({
          error:
            "Le prix pro HT variante doit être inférieur au prix public TTC",
        });
        return;
      }
      const updated = await prisma.productVariant.update({
        where: { id: req.params.id },
        data: {
          stock: toNonNegativeInt(
            req.body.stock as NumericInput,
            "Stock variante"
          ),
          inStock:
            req.body.inStock !== undefined
              ? Boolean(req.body.inStock)
              : undefined,
          priceProEur: nextProPrice,
        },
      });
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(400).json({
        error:
          err instanceof Error ? err.message : "Erreur mise à jour variante",
      });
    }
  }
);

// POST /api/admin/stock/import-pdf — Extraction facture fournisseur PDF
adminRouter.post(
  "/stock/import-pdf",
  requireAdmin,
  pdfUpload.single("invoice"),
  async (req: Request, res: Response): Promise<void> => {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ error: "Aucun fichier PDF fourni" });
      return;
    }
    try {
      const parser = new PDFParse({ data: file.buffer });
      const parsedPdf = await parser.getText();
      await parser.destroy();
      const text = parsedPdf.text.replace(/\u0000/g, " ").trim();
      if (!text) {
        res.status(400).json({
          error:
            "Le PDF ne contient pas de texte exploitable. Essayez un PDF non scanné.",
        });
        return;
      }
      const catalog: StockCatalogProduct[] = await prisma.product.findMany({
        select: {
          id: true,
          name: true,
          brand: true,
          stockCount: true,
          inStock: true,
          variants: {
            select: {
              id: true,
              name: true,
              stock: true,
              inStock: true,
              sku: true,
            },
            orderBy: { order: "asc" },
          },
        },
        orderBy: [{ brand: "asc" }, { name: "asc" }],
        take: 1200,
      });
      let candidates = await extractInvoiceCandidatesWithClaude(
        text,
        catalog
      ).catch(error => {
        console.warn(
          "Extraction IA facture indisponible, fallback heuristique",
          error
        );
        return null;
      });
      const extractionMode =
        candidates && candidates.length > 0 ? "ia" : "heuristique";
      if (!candidates || candidates.length === 0)
        candidates = extractHeuristicInvoiceCandidates(text);
      const proposals = buildStockImportProposals(candidates, catalog)
        .filter(proposal => proposal.quantity > 0)
        .sort(
          (a, b) =>
            Number(Boolean(b.productId)) - Number(Boolean(a.productId)) ||
            b.confidence - a.confidence
        );
      res.json({
        fileName: file.originalname,
        extractionMode,
        textPreview: text.slice(0, 1200),
        proposals,
        matchedCount: proposals.filter(proposal => proposal.productId).length,
        total: proposals.length,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Erreur import facture PDF",
      });
    }
  }
);

// POST /api/admin/stock/apply-pdf — Application des ajustements proposés
adminRouter.post(
  "/stock/apply-pdf",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const mode = req.body.mode === "set" ? "set" : "increment";
      const adjustments = Array.isArray(req.body.adjustments)
        ? req.body.adjustments
        : [];
      if (adjustments.length === 0) {
        res.status(400).json({ error: "Aucun ajustement à appliquer" });
        return;
      }
      let updated = 0;
      const errors: string[] = [];
      await prisma.$transaction(async tx => {
        for (const raw of adjustments) {
          const item = raw as Record<string, unknown>;
          const quantity =
            toNonNegativeInt(item.quantity as NumericInput, "Quantité") ?? 0;
          const productId =
            typeof item.productId === "string" ? item.productId : null;
          const variantId =
            typeof item.variantId === "string" ? item.variantId : null;
          if (!productId && !variantId) {
            errors.push(
              "Ajustement ignoré : aucun produit ou variante associé"
            );
            continue;
          }
          if (variantId) {
            const variant = await tx.productVariant.findUnique({
              where: { id: variantId },
              select: { stock: true },
            });
            if (!variant) {
              errors.push(`Variante introuvable : ${variantId}`);
              continue;
            }
            const nextStock =
              mode === "set" ? quantity : variant.stock + quantity;
            await tx.productVariant.update({
              where: { id: variantId },
              data: { stock: nextStock, inStock: nextStock > 0 },
            });
            updated += 1;
            continue;
          }
          if (productId) {
            const product = await tx.product.findUnique({
              where: { id: productId },
              select: { stockCount: true },
            });
            if (!product) {
              errors.push(`Produit introuvable : ${productId}`);
              continue;
            }
            const nextStock =
              mode === "set" ? quantity : product.stockCount + quantity;
            await tx.product.update({
              where: { id: productId },
              data: { stockCount: nextStock, inStock: nextStock > 0 },
            });
            updated += 1;
          }
        }
      });
      res.json({ updated, errors });
    } catch (err) {
      console.error(err);
      res.status(400).json({
        error:
          err instanceof Error ? err.message : "Erreur application stock PDF",
      });
    }
  }
);

// GET /api/admin/products — Liste produits pour l'admin
adminRouter.get(
  "/products",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        page = "1",
        limit = "50",
        search,
        category,
        status,
      } = req.query as Record<string, string>;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {};
      if (status) where.status = status;
      if (category) where.category = category;
      if (search)
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { slug: { contains: search, mode: "insensitive" } },
          { handle: { contains: search, mode: "insensitive" } },
          { brand: { contains: search, mode: "insensitive" } },
          { category: { contains: search, mode: "insensitive" } },
          { subcategory: { contains: search, mode: "insensitive" } },
          { subsubcategory: { contains: search, mode: "insensitive" } },
        ];
      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          skip,
          take: parseInt(limit),
        }),
        prisma.product.count({ where }),
      ]);
      res.json({
        products: products.map(p => ({
          ...p,
          images: JSON.parse(p.images || "[]"),
          tags: JSON.parse(p.tags || "[]"),
        })),
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
);

// PATCH /api/admin/products/:id — Modifier un produit
adminRouter.patch(
  "/products/:id",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        name,
        brand,
        brandId,
        category,
        subcategory,
        subsubcategory,
        price,
        priceEur,
        priceProEur,
        originalPrice,
        inStock,
        stockCount,
        status,
        description,
        isActive,
        isNew,
        weightG,
        lengthCm,
        widthCm,
        heightCm,
        isFragile,
        isLiquid,
        isAerosol,
        requiresGlass,
        logisticNote,
      } = req.body;
      const currentProduct = await prisma.product.findUnique({
        where: { id: req.params.id },
        select: { price: true },
      });
      if (!currentProduct) {
        res.status(404).json({ error: "Produit introuvable" });
        return;
      }
      const rawPublicPrice = price !== undefined ? price : priceEur;
      const nextPublicPrice =
        rawPublicPrice !== undefined ? parseFloat(rawPublicPrice) : currentProduct.price;
      const nextProPrice = toOptionalFloat(priceProEur);
      const nextStockCount = toNonNegativeInt(stockCount, "Stock");
      const nextStatus = toStockStatus(status);
      const nextBrandId =
        brandId === undefined
          ? undefined
          : brandId === null || brandId === ""
          ? null
          : Number(brandId);
      if (nextBrandId !== undefined && nextBrandId !== null && !Number.isInteger(nextBrandId)) {
        res.status(400).json({ error: "Marque invalide" });
        return;
      }
      if (
        nextProPrice !== undefined &&
        nextProPrice !== null &&
        nextProPrice >= nextPublicPrice
      ) {
        res.status(400).json({
          error: "Le prix pro HT doit être inférieur au prix public TTC",
        });
        return;
      }

      const product = await prisma.product.update({
        where: { id: req.params.id },
        data: {
          name: name || undefined,
          brand: brand || undefined,
          brandId: nextBrandId,
          category: category || undefined,
          subcategory: subcategory || undefined,
          subsubcategory:
            subsubcategory !== undefined ? subsubcategory || "" : undefined,
          price: rawPublicPrice !== undefined ? nextPublicPrice : undefined,
          priceProEur: nextProPrice,
          originalPrice:
            originalPrice !== undefined
              ? toOptionalFloat(originalPrice)
              : undefined,
          inStock: inStock !== undefined ? Boolean(inStock) : undefined,
          stockCount: nextStockCount,
          description: description || undefined,
          status:
            nextStatus ??
            (isActive !== undefined
              ? isActive
                ? "active"
                : "inactive"
              : undefined),
          isNew: isNew !== undefined ? Boolean(isNew) : undefined,
          weightG: toOptionalInt(weightG),
          lengthCm: toOptionalFloat(lengthCm),
          widthCm: toOptionalFloat(widthCm),
          heightCm: toOptionalFloat(heightCm),
          isFragile: toOptionalBoolean(isFragile),
          isLiquid: toOptionalBoolean(isLiquid),
          isAerosol: toOptionalBoolean(isAerosol),
          requiresGlass: toOptionalBoolean(requiresGlass),
          logisticNote:
            logisticNote !== undefined
              ? String(logisticNote).trim() || null
              : undefined,
        },
      });
      res.json(product);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur mise à jour produit" });
    }
  }
);

// DELETE /api/admin/products/:id — Supprimer un produit
adminRouter.delete(
  "/products/:id",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.productVariant.deleteMany({ where: { productId: req.params.id } });
        await tx.product.delete({ where: { id: req.params.id } });
      });
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur suppression produit" });
    }
  }
);

// POST /api/admin/products — Créer un produit
adminRouter.post(
  "/products",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        name,
        brand,
        category,
        subcategory,
        price,
        priceProEur,
        originalPrice,
        inStock,
        description,
        isActive,
        weightG,
        lengthCm,
        widthCm,
        heightCm,
        isFragile,
        isLiquid,
        isAerosol,
        requiresGlass,
        logisticNote,
      } = req.body;
      const publicPrice = parseFloat(price);
      const proPrice = toOptionalFloat(priceProEur) ?? null;
      if (proPrice !== null && proPrice >= publicPrice) {
        res.status(400).json({
          error: "Le prix pro HT doit être inférieur au prix public TTC",
        });
        return;
      }

      const product = await prisma.product.create({
        data: {
          handle: name.toLowerCase().replace(/ +/g, "-"),
          slug: name.toLowerCase().replace(/ +/g, "-"),
          shortDescription: description ? description.substring(0, 100) : "",
          name,
          brand,
          category,
          subcategory,
          price: publicPrice,
          priceProEur: proPrice,
          originalPrice: originalPrice ? parseFloat(originalPrice) : null,
          inStock: inStock ? true : false,
          description,
          status: isActive ? "active" : "inactive",
          weightG: toOptionalInt(weightG),
          lengthCm: toOptionalFloat(lengthCm),
          widthCm: toOptionalFloat(widthCm),
          heightCm: toOptionalFloat(heightCm),
          isFragile: Boolean(isFragile),
          isLiquid: Boolean(isLiquid),
          isAerosol: Boolean(isAerosol),
          requiresGlass: Boolean(requiresGlass),
          logisticNote:
            logisticNote !== undefined
              ? String(logisticNote).trim() || null
              : null,
          images: "[]",
          tags: "[]",
        },
      });
      res.json(product);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur création produit" });
    }
  }
);

// GET /api/admin/packaging — Liste des emballages logistiques
adminRouter.get(
  "/packaging",
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const packaging = await prisma.packaging.findMany({
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
      });
      res.json({ packaging });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur chargement emballages" });
    }
  }
);

// POST /api/admin/packaging — Créer un emballage logistique
adminRouter.post(
  "/packaging",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const data = buildPackagingData(req.body || {});
      if (!data.name) {
        res.status(400).json({ error: "Le nom de l'emballage est requis" });
        return;
      }
      if (!["carton", "enveloppe", "tube"].includes(data.type)) {
        res
          .status(400)
          .json({ error: "Le type doit être carton, enveloppe ou tube" });
        return;
      }
      const packaging = await prisma.packaging.create({ data });
      res.status(201).json(packaging);
    } catch (err) {
      console.error(err);
      res.status(400).json({
        error: err instanceof Error ? err.message : "Erreur création emballage",
      });
    }
  }
);

// PATCH /api/admin/packaging/:id — Modifier un emballage logistique
adminRouter.patch(
  "/packaging/:id",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const data = buildPackagingData(req.body || {});
      if (!data.name) {
        res.status(400).json({ error: "Le nom de l'emballage est requis" });
        return;
      }
      if (!["carton", "enveloppe", "tube"].includes(data.type)) {
        res
          .status(400)
          .json({ error: "Le type doit être carton, enveloppe ou tube" });
        return;
      }
      const packaging = await prisma.packaging.update({
        where: { id: parseInt(req.params.id, 10) },
        data,
      });
      res.json(packaging);
    } catch (err) {
      console.error(err);
      res.status(400).json({
        error:
          err instanceof Error ? err.message : "Erreur mise à jour emballage",
      });
    }
  }
);

// DELETE /api/admin/packaging/:id — Supprimer un emballage logistique
adminRouter.delete(
  "/packaging/:id",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      await prisma.packaging.delete({
        where: { id: parseInt(req.params.id, 10) },
      });
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur suppression emballage" });
    }
  }
);

// GET /api/admin/logistics/orders — Commandes payées non encore expédiées
adminRouter.get(
  "/logistics/orders",
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const orders = await prisma.order.findMany({
        where: { status: "paid", shipment: null },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  images: true,
                  weightG: true,
                  lengthCm: true,
                  widthCm: true,
                  heightCm: true,
                  isFragile: true,
                  isLiquid: true,
                  isAerosol: true,
                  logisticNote: true,
                },
              },
            },
          },
          customer: {
            select: { firstName: true, lastName: true, email: true },
          },
          shippingAddress: true,
        },
        orderBy: { createdAt: "asc" },
      });

      const formatted = orders.map(order => {
        const metrics = computeLogisticsMetrics(
          order.items as LogisticsOrderItem[]
        );
        return {
          id: order.id,
          orderNumber: order.orderNumber,
          createdAt: order.createdAt,
          customerName: getCustomerName(order.customer, order.email),
          customerEmail:
            order.customer?.email || order.customerEmail || order.email,
          total: order.total,
          currency: order.currency,
          itemCount: metrics.itemCount,
          estimatedWeightG: metrics.estimatedWeightG,
          hasUnknownWeight: metrics.hasUnknownWeight,
        };
      });

      res.json({
        orders: formatted,
        total: formatted.length,
        pendingCount: formatted.length,
      });
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ error: "Erreur chargement commandes logistiques" });
    }
  }
);

// GET /api/admin/logistics/orders/:orderId — Détail préparation d'expédition
adminRouter.get(
  "/logistics/orders/:orderId",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const [order, packagings] = await Promise.all([
        prisma.order.findUnique({
          where: { id: req.params.orderId },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    images: true,
                    weightG: true,
                    lengthCm: true,
                    widthCm: true,
                    heightCm: true,
                    isFragile: true,
                    isLiquid: true,
                    isAerosol: true,
                    logisticNote: true,
                  },
                },
              },
            },
            customer: true,
            shippingAddress: true,
            shipment: { include: { packaging: true } },
          },
        }),
        prisma.packaging.findMany({
          where: { isActive: true },
          orderBy: [{ internalVolumeCm3: "asc" }, { name: "asc" }],
        }),
      ]);

      if (!order) {
        res.status(404).json({ error: "Commande non trouvée" });
        return;
      }

      const metrics = computeLogisticsMetrics(
        order.items as LogisticsOrderItem[]
      );
      const recommendedBox = findRecommendedPackaging(
        packagings as LogisticsPackaging[],
        metrics.totalWeightG,
        metrics.totalVolumeCm3
      );
      const packageTotalWeightG =
        metrics.totalWeightG + (recommendedBox?.selfWeightG || 0);

      res.json({
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          createdAt: order.createdAt,
          status: order.status,
          email: order.email,
          customerName: getCustomerName(order.customer, order.email),
          total: order.total,
          currency: order.currency,
          isB2B: order.isB2B,
          shippingAddress: order.shippingAddress,
        },
        items: (order.items as LogisticsOrderItem[]).map(
          normalizeLogisticsItem
        ),
        packagings,
        recommendation: {
          totalWeightG: metrics.totalWeightG,
          estimatedWeightG: metrics.estimatedWeightG,
          totalVolumeCm3: metrics.totalVolumeCm3,
          packageTotalWeightG,
          hasUnknownWeight: metrics.hasUnknownWeight,
          hasFragile: metrics.hasFragile,
          hasLiquid: metrics.hasLiquid,
          hasAerosol: metrics.hasAerosol,
          recommendedBox,
        },
        shipment: order.shipment,
      });
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ error: "Erreur chargement préparation logistique" });
    }
  }
);

// POST /api/admin/logistics/orders/:orderId/ship — Marquer comme expédié
adminRouter.post(
  "/logistics/orders/:orderId/ship",
  requireAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const carrier = String(req.body?.carrier || "") as LogisticsCarrier;
      const trackingNumber =
        String(req.body?.trackingNumber || "").trim() || null;
      const packagingIdRaw = req.body?.packagingId;
      const packagingId =
        packagingIdRaw === undefined ||
        packagingIdRaw === null ||
        packagingIdRaw === ""
          ? null
          : parseInt(String(packagingIdRaw), 10);

      if (!Object.keys(LOGISTICS_CARRIERS).includes(carrier)) {
        res.status(400).json({ error: "Transporteur invalide" });
        return;
      }
      if (packagingId !== null && !Number.isFinite(packagingId)) {
        res.status(400).json({ error: "Carton sélectionné invalide" });
        return;
      }

      const order = await prisma.order.findUnique({
        where: { id: req.params.orderId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  images: true,
                  weightG: true,
                  lengthCm: true,
                  widthCm: true,
                  heightCm: true,
                  isFragile: true,
                  isLiquid: true,
                  isAerosol: true,
                  logisticNote: true,
                },
              },
            },
          },
          customer: true,
        },
      });

      if (!order) {
        res.status(404).json({ error: "Commande non trouvée" });
        return;
      }
      if (!["paid", "processing"].includes(order.status)) {
        res.status(400).json({
          error:
            "Seules les commandes payées ou en préparation peuvent être expédiées",
        });
        return;
      }

      const packaging = packagingId
        ? await prisma.packaging.findUnique({ where: { id: packagingId } })
        : null;
      if (packagingId && !packaging) {
        res.status(404).json({ error: "Carton sélectionné introuvable" });
        return;
      }

      const metrics = computeLogisticsMetrics(
        order.items as LogisticsOrderItem[]
      );
      const totalWeightG = metrics.totalWeightG + (packaging?.selfWeightG || 0);
      const shippedAt = new Date();

      const [shipment, updatedOrder] = await prisma.$transaction([
        prisma.shipment.upsert({
          where: { orderId: order.id },
          create: {
            orderId: order.id,
            carrier,
            trackingNumber,
            packagingId,
            totalWeightG,
            shippedAt,
            shippedBy: req.user?.email || null,
          },
          update: {
            carrier,
            trackingNumber,
            packagingId,
            totalWeightG,
            shippedAt,
            shippedBy: req.user?.email || null,
          },
          include: { packaging: true },
        }),
        prisma.order.update({
          where: { id: order.id },
          data: { status: "shipped" },
        }),
      ]);

      await sendOrderShippedEmail({
        to: order.email,
        orderNumber: order.orderNumber,
        customerName: getCustomerName(order.customer, order.email),
        carrier: LOGISTICS_CARRIERS[carrier],
        trackingNumber,
      });

      res.json({ success: true, order: updatedOrder, shipment });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur validation expédition" });
    }
  }
);

// GET /api/admin/orders — Liste commandes pour l'admin
adminRouter.get(
  "/orders",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        page = "1",
        limit = "20",
        status,
      } = req.query as Record<string, string>;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {};
      if (status) where.status = status;
      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          include: {
            items: true,
            shippingAddress: true,
            customer: {
              select: { firstName: true, lastName: true, email: true },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: parseInt(limit),
        }),
        prisma.order.count({ where }),
      ]);
      res.json({
        orders,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
);

// GET /api/admin/orders/:id — Détail d'une commande
adminRouter.get(
  "/orders/:id",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const order = await prisma.order.findUnique({
        where: { id: req.params.id },
        include: { items: true, shippingAddress: true, customer: true },
      });
      if (!order) {
        res.status(404).json({ error: "Commande non trouvée" });
        return;
      }
      res.json(order);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
);

// PATCH /api/admin/orders/:id/status — Changer le statut d'une commande
adminRouter.patch(
  "/orders/:id/status",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { status } = req.body;
      const previousOrder = await prisma.order.findUnique({
        where: { id: req.params.id },
        include: { customer: true },
      });
      const order = await prisma.order.update({
        where: { id: req.params.id },
        data: { status },
        include: { customer: true },
      });
      const shippingEmailStatuses = new Set([
        "shipped",
        "delivered",
        "EXPÉDIÉ",
      ]);
      if (
        shippingEmailStatuses.has(status) &&
        !shippingEmailStatuses.has(previousOrder?.status || "") &&
        order.email
      ) {
        await sendOrderShippedEmail({
          to: order.email,
          orderNumber: order.orderNumber,
          customerName: getCustomerName(order.customer, order.email),
        });
      }
      res.json(order);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur mise à jour statut" });
    }
  }
);

// GET /api/admin/customers — Liste clients pour l'admin
adminRouter.get(
  "/customers",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        page = "1",
        limit = "20",
        search,
      } = req.query as Record<string, string>;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {};
      if (search) {
        where.OR = [
          { email: { contains: search, mode: "insensitive" } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
        ];
      }
      const [customers, total] = await Promise.all([
        prisma.customer.findMany({
          where,
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            createdAt: true,
            _count: { select: { orders: true } },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: parseInt(limit),
        }),
        prisma.customer.count({ where }),
      ]);
      res.json({
        customers,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
);

// GET /api/admin/customers/:id — Détail d'un client
adminRouter.get(
  "/customers/:id",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: req.params.id },
        include: {
          orders: {
            include: { items: true, shippingAddress: true },
            orderBy: { createdAt: "desc" },
          },
          addresses: true,
          _count: { select: { orders: true, wishlist: true } },
        },
      });
      if (!customer) {
        res.status(404).json({ error: "Client non trouvé" });
        return;
      }
      const { password: _, ...safeCustomer } = customer;
      res.json(safeCustomer);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
);

// GET /api/admin/reviews — Avis en attente de modération
adminRouter.get(
  "/reviews",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const reviews = await prisma.review.findMany({
        where: { approved: false },
        include: { product: { select: { name: true, slug: true } } },
        orderBy: { createdAt: "desc" },
      });
      res.json(reviews);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
);

// PUT /api/admin/reviews/:id/approve — Approuver un avis
adminRouter.put(
  "/reviews/:id/approve",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const review = await prisma.review.update({
        where: { id: req.params.id },
        data: { approved: true },
      });
      res.json(review);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur approbation avis" });
    }
  }
);

// ─── POST /api/admin/products/:id/images — Upload image vers Cloudinary ────
adminRouter.post(
  "/products/:id/images",
  requireAdmin,
  upload.single("image"),
  async (
    req: Request & { file?: Express.Multer.File },
    res: Response
  ): Promise<void> => {
    try {
      let secureUrl: string;

      if (req.body?.url) {
        // Mode 1 : URL déjà uploadée vers Cloudinary depuis le frontend (preset non signé)
        secureUrl = req.body.url;
      } else if (req.file) {
        // Mode 2 : Upload depuis le backend via Cloudinary API signée (fallback)
        const uploadedFile = req.file;
        const result = await new Promise<{ secure_url: string }>(
          (resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              {
                folder: `barberparadise/products/${req.params.id}`,
                transformation: [
                  {
                    width: 1200,
                    height: 1200,
                    crop: "limit",
                    quality: "auto",
                    fetch_format: "auto",
                  },
                ],
              },
              (error, result) => {
                if (error || !result)
                  reject(error || new Error("Upload échoué"));
                else resolve(result as { secure_url: string });
              }
            );
            stream.end(uploadedFile.buffer);
          }
        );
        secureUrl = result.secure_url;
      } else {
        res.status(400).json({ error: "Aucun fichier ni URL fourni" });
        return;
      }

      // Ajouter l'URL à la liste d'images du produit
      const product = await prisma.product.findUnique({
        where: { id: req.params.id },
      });
      if (!product) {
        res.status(404).json({ error: "Produit introuvable" });
        return;
      }
      const images: string[] = JSON.parse(product.images || "[]");
      images.push(secureUrl);
      await prisma.product.update({
        where: { id: req.params.id },
        data: { images: JSON.stringify(images) },
      });
      res.json({ url: secureUrl, images });
    } catch (err: any) {
      console.error("[UPLOAD IMAGE ERROR]", err);
      const msg =
        err?.message ||
        err?.error?.message ||
        JSON.stringify(err) ||
        "Erreur upload image";
      res.status(500).json({ error: msg });
    }
  }
);

// ─── PUT /api/admin/products/:id/images — Réorganiser / remplacer la liste d'images ─
adminRouter.put(
  "/products/:id/images",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { images } = req.body as { images: string[] };
      if (!Array.isArray(images)) {
        res.status(400).json({ error: "images doit être un tableau" });
        return;
      }
      const updated = await prisma.product.update({
        where: { id: req.params.id },
        data: { images: JSON.stringify(images) },
      });
      res.json({ images: JSON.parse(updated.images || "[]") });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur mise à jour images" });
    }
  }
);

// ─── DELETE /api/admin/products/:id/images — Supprimer une image ────────────
adminRouter.delete(
  "/products/:id/images",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { url } = req.body as { url: string };
      if (!url) {
        res.status(400).json({ error: "URL manquante" });
        return;
      }

      // Supprimer de Cloudinary si c'est une URL Cloudinary
      if (url.includes("cloudinary.com")) {
        try {
          const parts = url.split("/");
          const filenameWithExt = parts[parts.length - 1];
          const filename = filenameWithExt.split(".")[0];
          const folderIndex = parts.indexOf("barberparadise");
          const publicId =
            folderIndex >= 0
              ? parts
                  .slice(folderIndex)
                  .join("/")
                  .replace(/\.[^.]+$/, "")
              : filename;
          await cloudinary.uploader.destroy(publicId);
        } catch (e) {
          console.warn("Impossible de supprimer de Cloudinary:", e);
        }
      }

      // Retirer l'URL de la liste
      const product = await prisma.product.findUnique({
        where: { id: req.params.id },
      });
      if (!product) {
        res.status(404).json({ error: "Produit introuvable" });
        return;
      }
      const images: string[] = JSON.parse(product.images || "[]").filter(
        (img: string) => img !== url
      );
      await prisma.product.update({
        where: { id: req.params.id },
        data: { images: JSON.stringify(images) },
      });
      res.json({ success: true, images });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur suppression image" });
    }
  }
);

// ─── VARIANTES PRODUIT ────────────────────────────────────────────

// GET /api/admin/products/:id/variants — Lister les variantes d'un produit
adminRouter.get(
  "/products/:id/variants",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const variants = await prisma.productVariant.findMany({
        where: { productId: req.params.id },
        orderBy: { order: "asc" },
      });
      res.json(variants);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
);

// POST /api/admin/products/:id/variants — Créer une variante
adminRouter.post(
  "/products/:id/variants",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        name,
        type,
        color,
        colorHex,
        size,
        price,
        stock,
        inStock,
        sku,
        image,
        order,
      } = req.body;
      const variant = await prisma.productVariant.create({
        data: {
          productId: req.params.id,
          name: name || "",
          type: type || "other",
          color: color || "",
          colorHex: colorHex || "",
          size: size || "",
          price: price != null ? parseFloat(price) : null,
          stock: parseInt(stock) || 0,
          inStock: inStock !== false,
          sku: sku || "",
          image: image || "",
          order: parseInt(order) || 0,
        },
      });
      res.json(variant);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur création variante" });
    }
  }
);

// PUT /api/admin/variants/:variantId — Modifier une variante
adminRouter.put(
  "/variants/:variantId",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        name,
        type,
        color,
        colorHex,
        size,
        price,
        stock,
        inStock,
        sku,
        image,
        order,
      } = req.body;
      const variant = await prisma.productVariant.update({
        where: { id: req.params.variantId },
        data: {
          name: name || "",
          type: type || "other",
          color: color || "",
          colorHex: colorHex || "",
          size: size || "",
          price: price != null && price !== "" ? parseFloat(price) : null,
          stock: parseInt(stock) || 0,
          inStock: inStock !== false,
          sku: sku || "",
          image: image || "",
          order: parseInt(order) || 0,
        },
      });
      res.json(variant);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur modification variante" });
    }
  }
);

// DELETE /api/admin/variants/:variantId — Supprimer une variante
adminRouter.delete(
  "/variants/:variantId",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      await prisma.productVariant.delete({
        where: { id: req.params.variantId },
      });
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur suppression variante" });
    }
  }
);

// PUT /api/admin/products/:id/variants/reorder — Réorganiser les variantes
adminRouter.put(
  "/products/:id/variants/reorder",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { items } = req.body as { items: { id: string; order: number }[] };
      await Promise.all(
        items.map(item =>
          prisma.productVariant.update({
            where: { id: item.id },
            data: { order: item.order },
          })
        )
      );
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur réorganisation variantes" });
    }
  }
);

// POST /api/admin/change-password — Changer le mot de passe admin
adminRouter.post(
  "/change-password",
  requireAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        res.status(400).json({
          error: "Mot de passe actuel et nouveau mot de passe requis",
        });
        return;
      }

      if (newPassword.length < 8) {
        res.status(400).json({
          error: "Le nouveau mot de passe doit contenir au moins 8 caractères",
        });
        return;
      }

      // Récupérer l'admin connecté depuis le token
      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({ error: "Non authentifié" });
        return;
      }

      const admin = await prisma.admin.findUnique({ where: { id: adminId } });
      if (!admin) {
        res.status(404).json({ error: "Admin introuvable" });
        return;
      }

      // Vérifier le mot de passe actuel
      const valid = await bcrypt.compare(currentPassword, admin.password);
      if (!valid) {
        res.status(401).json({ error: "Mot de passe actuel incorrect" });
        return;
      }

      // Hasher et sauvegarder le nouveau mot de passe
      const hashed = await bcrypt.hash(newPassword, 12);
      await prisma.admin.update({
        where: { id: adminId },
        data: { password: hashed },
      });

      res.json({ success: true, message: "Mot de passe modifié avec succès" });
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ error: "Erreur lors du changement de mot de passe" });
    }
  }
);

// ─── BRANDS ADMIN ──────────────────────────────────────────────────────────────────

// GET /api/admin/brands — Liste toutes les marques
adminRouter.get(
  "/brands",
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const brands = await prisma.brand.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { products: true } } },
      });
      res.json(
        brands.map(b => ({
          id: b.id,
          name: b.name,
          slug: b.slug,
          logo: b.logo,
          bannerImage: b.bannerImage,
          description: b.description,
          website: b.website,
          productCount: b._count.products,
        }))
      );
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
);

// GET /api/admin/brands/:id/stats — Statistiques avant suppression définitive d'une marque
adminRouter.get(
  "/brands/:id/stats",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: "Identifiant de marque invalide" });
        return;
      }

      const brand = await prisma.brand.findUnique({
        where: { id },
        select: { id: true, name: true, slug: true, logo: true },
      });
      if (!brand) {
        res.status(404).json({ error: "Marque introuvable" });
        return;
      }

      const products = await prisma.product.findMany({
        where: { brandId: id },
        select: { id: true, images: true },
      });
      const productIds = products.map(product => product.id);
      const [reviewsCount, variantsCount] =
        productIds.length > 0
          ? await Promise.all([
              prisma.review.count({ where: { productId: { in: productIds } } }),
              prisma.productVariant.count({
                where: { productId: { in: productIds } },
              }),
            ])
          : [0, 0];
      const imagesCount = products.reduce((total, product) => {
        try {
          const images = JSON.parse(product.images || "[]");
          return total + (Array.isArray(images) ? images.length : 0);
        } catch {
          return total;
        }
      }, 0);

      res.json({
        brand,
        productsCount: products.length,
        reviewsCount,
        variantsCount,
        imagesCount,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
);

// DELETE /api/admin/brands/:id?confirm=true — Supprimer définitivement une marque et ses produits liés
adminRouter.delete(
  "/brands/:id",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        res.status(400).json({ error: "Identifiant de marque invalide" });
        return;
      }
      if (req.query.confirm !== "true") {
        res.status(400).json({
          error:
            "Confirmation obligatoire pour supprimer définitivement une marque",
        });
        return;
      }

      const result = await prisma.$transaction(async tx => {
        const brand = await tx.brand.findUnique({
          where: { id },
          select: { id: true, name: true },
        });
        if (!brand) return null;

        const products = await tx.product.findMany({
          where: { brandId: id },
          select: { id: true },
        });
        const productIds = products.map(product => product.id);

        if (productIds.length > 0) {
          await tx.review.deleteMany({
            where: { productId: { in: productIds } },
          });
          await tx.productVariant.deleteMany({
            where: { productId: { in: productIds } },
          });
          await tx.product.deleteMany({ where: { id: { in: productIds } } });
        }
        await tx.brand.delete({ where: { id } });

        return {
          deleted: true,
          productsDeleted: products.length,
          brandName: brand.name,
        };
      });

      if (!result) {
        res.status(404).json({ error: "Marque introuvable" });
        return;
      }
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur suppression marque" });
    }
  }
);

// PATCH /api/admin/brands/:id — Mettre à jour les champs texte d'une marque
adminRouter.patch(
  "/brands/:id",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const { logo, bannerImage, description, website, name } = req.body;
      const updated = await prisma.brand.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(logo !== undefined && { logo }),
          ...(bannerImage !== undefined && { bannerImage }),
          ...(description !== undefined && { description }),
          ...(website !== undefined && { website }),
        },
      });
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
);

// POST /api/admin/brands/:id/upload-logo — Upload logo → Cloudinary → update Brand.logo
adminRouter.post(
  "/brands/:id/upload-logo",
  requireAdmin,
  upload.single("logo"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "Aucun fichier reçu" });
        return;
      }

      const uploadResult = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "barberparadise/brands",
            public_id: `brand-${id}-logo`,
            overwrite: true,
            resource_type: "image",
            transformation: [
              { width: 400, height: 400, crop: "fit" },
              { quality: "auto", fetch_format: "auto" },
            ],
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(file.buffer);
      });

      const logoUrl = uploadResult.secure_url as string;
      const updated = await prisma.brand.update({
        where: { id },
        data: { logo: logoUrl },
      });
      res.json({ success: true, logo: logoUrl, brand: updated });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur upload logo" });
    }
  }
);

// POST /api/admin/brands/:id/upload-banner — Upload bannière → Cloudinary → update Brand.bannerImage
adminRouter.post(
  "/brands/:id/upload-banner",
  requireAdmin,
  upload.single("banner"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "Aucun fichier reçu" });
        return;
      }

      const uploadResult = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "barberparadise/brands",
            public_id: `brand-${id}-banner`,
            overwrite: true,
            resource_type: "image",
            transformation: [
              { width: 1400, height: 400, crop: "fill", gravity: "center" },
              { quality: "auto", fetch_format: "auto" },
            ],
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(file.buffer);
      });

      const bannerUrl = uploadResult.secure_url as string;
      const updated = await prisma.brand.update({
        where: { id },
        data: { bannerImage: bannerUrl },
      });
      res.json({ success: true, bannerImage: bannerUrl, brand: updated });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur upload bannière" });
    }
  }
);

// PUT /api/admin/products/:id/image-alts — Mettre à jour les alt texts des images
adminRouter.put(
  "/products/:id/image-alts",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { imageAlts } = req.body as { imageAlts: string[] };
      if (!Array.isArray(imageAlts)) {
        res.status(400).json({ error: "imageAlts doit être un tableau" });
        return;
      }
      const updated = await prisma.product.update({
        where: { id: req.params.id },
        data: { imageAlts: JSON.stringify(imageAlts) },
      });
      res.json({ imageAlts: JSON.parse((updated as any).imageAlts || "[]") });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur mise à jour alt texts" });
    }
  }
);

export default adminRouter;
