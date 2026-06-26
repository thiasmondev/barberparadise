import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { getFrontendUrl } from "../utils/frontendUrl";
import {
  formatPaymentMethod,
  getCustomerName,
  sendDraftOrderEmail,
  sendEmail,
  sendOrderConfirmationEmail,
  sendOrderShippedEmail,
  sendPasswordResetEmail,
} from "../services/emailService";
import { ensureB2CInvoiceForOrder, generateB2CInvoicePdfBuffer } from "../services/b2cInvoiceService";
import { ensureProInvoiceForOrder } from "../services/proInvoiceService";
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
import {
  buildShipmentQuotes,
  createOfficialShipmentLabel,
  cancelOfficialShipmentLabel,
  fetchShipmentTracking,
  LOGISTICS_CARRIERS,
  LogisticsCarrier,
} from "../services/logisticsCarrierService";
import { calculateShippingOptions, ensureDefaultShippingZones } from "../services/shippingCalculator";
import { generateProductRecommendations } from "../services/seo-agent";
import { notifyIfRestocked, notifySingleStockAlert } from "../services/stockAlertService";

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

const PASSWORD_RESET_TOKEN_MINUTES = 60;
const DRAFT_SHARE_EXPIRY_DAYS = Math.max(1, parseInt(process.env.DRAFT_SHARE_EXPIRY_DAYS || "7", 10) || 7);

function hashPasswordResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function hashDraftShareToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getDraftShareExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + DRAFT_SHARE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

function createDraftShareRawToken(orderId: string, expiresAt: Date): string {
  const payload = `${orderId}.${expiresAt.getTime()}`;
  const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || "barber-paradise-draft-share";
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonArraySafe(value?: string | null): unknown[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}


const STANDARD_VAT_RATE = 20;
const PRO_MINIMUM_ORDER_HT = 200;
const CURRENCY = "EUR";

type DiscountType = "percent" | "fixed";

type AdminDraftLineInput = {
  productId?: unknown;
  variantId?: unknown;
  quantity?: unknown;
  lineDiscountType?: unknown;
  lineDiscountValue?: unknown;
};

type NormalizedDraftItem = {
  productId: string;
  variantId: string | null;
  quantity: number;
  lineDiscountType: DiscountType | null;
  lineDiscountValue: number;
};

type NormalizedDiscount = {
  type: DiscountType | null;
  value: number;
};

type AdminDraftAddressInput = {
  firstName?: unknown;
  lastName?: unknown;
  address?: unknown;
  extension?: unknown;
  city?: unknown;
  postalCode?: unknown;
  country?: unknown;
  phone?: unknown;
};

type NormalizedDraftAddress = {
  firstName: string;
  lastName: string;
  address: string;
  extension: string;
  city: string;
  postalCode: string;
  country: string;
  phone: string;
};

type DraftCalculationResult = {
  orderItems: Array<{
    productId: string;
    variantId: string | null;
    variantLabel: string | null;
    name: string;
    price: number;
    quantity: number;
    image: string;
    discountAmount: number;
    lineDiscountType: DiscountType | null;
    lineDiscountValue: number | null;
  }>;
  subtotalHT: number;
  subtotalTTC: number;
  subtotal: number;
  shipping: number;
  totalHT: number;
  vatRate: number;
  vatAmount: number;
  totalTTC: number;
  total: number;
  orderDiscountType: DiscountType | null;
  orderDiscountValue: number | null;
  orderDiscountAmount: number;
  discountTotal: number;
};

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeCountry(country?: unknown): string {
  const raw = typeof country === "string" && country.trim() ? country.trim() : "FR";
  if (raw.length === 2) return raw.toUpperCase();
  const normalized = raw.toLowerCase();
  if (["france", "fr", "métropole", "metropole"].includes(normalized)) return "FR";
  if (["belgique", "belgium", "be"].includes(normalized)) return "BE";
  return raw.toUpperCase();
}

function getVatRate(country: string, isB2B: boolean, vatNumber?: string | null): number {
  if (!isB2B) return STANDARD_VAT_RATE;
  const normalizedCountry = normalizeCountry(country);
  const normalizedVat = (vatNumber || "").toUpperCase().trim();
  if (normalizedCountry !== "FR" && normalizedVat && !normalizedVat.startsWith("FR")) return 0;
  return STANDARD_VAT_RATE;
}

function generateAdminDraftOrderNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const rand = Math.floor(Math.random() * 100000).toString().padStart(5, "0");
  return `BP-${year}-${rand}`;
}

function asOptionalString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeDraftAddress(input?: AdminDraftAddressInput | null): NormalizedDraftAddress | null {
  if (!input) return null;
  const address = {
    firstName: asOptionalString(input.firstName),
    lastName: asOptionalString(input.lastName),
    address: asOptionalString(input.address),
    extension: asOptionalString(input.extension),
    city: asOptionalString(input.city),
    postalCode: asOptionalString(input.postalCode),
    country: normalizeCountry(input.country),
    phone: asOptionalString(input.phone),
  };
  if (!address.firstName || !address.lastName || !address.address || !address.city || !address.postalCode) return null;
  return address;
}

function normalizeDiscountType(value: unknown): DiscountType | null {
  if (value === "percent" || value === "fixed") return value;
  return null;
}

function normalizeDiscountValue(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? money(numeric) : 0;
}

function normalizeDiscount(typeValue: unknown, valueValue: unknown): NormalizedDiscount {
  const type = normalizeDiscountType(typeValue);
  const value = normalizeDiscountValue(valueValue);
  if (!type || value <= 0) return { type: null, value: 0 };
  return { type, value };
}

function calculateDiscountAmount(type: DiscountType | null, value: number, baseAmount: number): number {
  if (!type || value <= 0 || baseAmount <= 0) return 0;
  const rawAmount = type === "percent" ? baseAmount * (Math.min(value, 100) / 100) : value;
  return money(Math.min(baseAmount, Math.max(0, rawAmount)));
}

function normalizeDraftItems(items: unknown): NormalizedDraftItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item: AdminDraftLineInput) => {
      const productId = typeof item?.productId === "string" ? item.productId.trim() : "";
      const variantId = typeof item?.variantId === "string" && item.variantId.trim() ? item.variantId.trim() : null;
      const quantity = Number(item?.quantity);
      const lineDiscount = normalizeDiscount(item?.lineDiscountType, item?.lineDiscountValue);
      return {
        productId,
        variantId,
        quantity: Number.isInteger(quantity) && quantity > 0 ? quantity : 0,
        lineDiscountType: lineDiscount.type,
        lineDiscountValue: lineDiscount.type ? lineDiscount.value : 0,
      };
    })
    .filter((item) => item.productId && item.quantity > 0);
}

function firstProductImage(images: string | null | undefined): string {
  const parsed = parseJsonArraySafe(images);
  const first = parsed[0];
  return typeof first === "string" ? first : "";
}

async function calculateAdminDraftTotals(params: {
  items: NormalizedDraftItem[];
  isB2B: boolean;
  country: string;
  vatNumber?: string | null;
  shippingOverride?: unknown;
  enforceProMinimum?: boolean;
  allowInactiveProducts?: boolean;
  orderDiscountType?: unknown;
  orderDiscountValue?: unknown;
}): Promise<DraftCalculationResult> {
  if (params.items.length === 0) throw new Error("Ajoutez au moins un produit au brouillon");

  const products = await prisma.product.findMany({
    where: { id: { in: params.items.map((item) => item.productId) } },
    include: { variants: { orderBy: { order: "asc" } } },
  });
  const productById = new Map(products.map((product) => [product.id, product]));
  const orderItems: DraftCalculationResult["orderItems"] = [];
  const vatRate = getVatRate(params.country, params.isB2B, params.vatNumber);
  const vatMultiplier = 1 + vatRate / 100;
  let subtotalHT = 0;
  let subtotalTTC = 0;
  let lineDiscountTotal = 0;

  for (const item of params.items) {
    const product = productById.get(item.productId);
    if (!product) throw new Error(`Produit introuvable : ${item.productId}`);
    if (!params.allowInactiveProducts && product.status !== "active") throw new Error(`Produit indisponible : ${product.name}`);
    const selectedVariant = item.variantId ? product.variants.find((variant) => variant.id === item.variantId) : null;
    if (product.variants.length > 0 && !selectedVariant) throw new Error(`Sélectionnez une variante disponible pour ${product.name}`);
    if (selectedVariant) {
      if (!selectedVariant.inStock || selectedVariant.stock <= 0) throw new Error(`Variante indisponible : ${product.name} - ${selectedVariant.name}`);
      if (selectedVariant.stock < item.quantity) throw new Error(`Stock insuffisant pour ${product.name} - ${selectedVariant.name}`);
    } else if (product.stockCount > 0 && product.stockCount < item.quantity) {
      throw new Error(`Stock insuffisant pour ${product.name}`);
    }

    const publicTtcPrice = selectedVariant?.price ?? product.price;
    const proHtPrice = selectedVariant?.priceProEur ?? product.priceProEur ?? publicTtcPrice / (1 + STANDARD_VAT_RATE / 100);
    const unitHT = params.isB2B
      ? money(proHtPrice)
      : money(publicTtcPrice / (1 + STANDARD_VAT_RATE / 100));
    const unitTTC = params.isB2B ? money(unitHT * vatMultiplier) : publicTtcPrice;
    const lineBaseHT = money(unitHT * item.quantity);
    const lineBaseTTC = money(unitTTC * item.quantity);
    const lineDiscountDisplay = calculateDiscountAmount(
      item.lineDiscountType,
      item.lineDiscountValue,
      params.isB2B ? lineBaseHT : lineBaseTTC
    );
    const lineDiscountHT = params.isB2B ? lineDiscountDisplay : money(lineDiscountDisplay / vatMultiplier);
    const lineDiscountTTC = params.isB2B ? money(lineDiscountDisplay * vatMultiplier) : lineDiscountDisplay;

    subtotalHT += Math.max(0, lineBaseHT - lineDiscountHT);
    subtotalTTC += Math.max(0, lineBaseTTC - lineDiscountTTC);
    lineDiscountTotal += lineDiscountDisplay;
    orderItems.push({
      productId: product.id,
      variantId: selectedVariant?.id || null,
      variantLabel: selectedVariant?.name || null,
      name: selectedVariant ? `${product.name} - ${selectedVariant.name}` : product.name,
      price: params.isB2B ? unitHT : publicTtcPrice,
      quantity: item.quantity,
      image: selectedVariant?.image || firstProductImage(product.images),
      discountAmount: lineDiscountDisplay,
      lineDiscountType: item.lineDiscountType,
      lineDiscountValue: item.lineDiscountType ? item.lineDiscountValue : null,
    });
  }

  subtotalHT = money(subtotalHT);
  subtotalTTC = money(subtotalTTC);

  const orderDiscount = normalizeDiscount(params.orderDiscountType, params.orderDiscountValue);
  const orderDiscountAmount = calculateDiscountAmount(
    orderDiscount.type,
    orderDiscount.value,
    params.isB2B ? subtotalHT : subtotalTTC
  );
  const orderDiscountHT = params.isB2B ? orderDiscountAmount : money(orderDiscountAmount / vatMultiplier);
  const orderDiscountTTC = params.isB2B ? money(orderDiscountAmount * vatMultiplier) : orderDiscountAmount;
  subtotalHT = money(Math.max(0, subtotalHT - orderDiscountHT));
  subtotalTTC = money(Math.max(0, subtotalTTC - orderDiscountTTC));

  if (params.enforceProMinimum !== false && params.isB2B && subtotalHT < PRO_MINIMUM_ORDER_HT) {
    throw new Error(`Le minimum de commande professionnel est de ${PRO_MINIMUM_ORDER_HT} € HT`);
  }

  const shippingOverride = Number(params.shippingOverride);
  let shipping = Number.isFinite(shippingOverride) && shippingOverride >= 0 ? money(shippingOverride) : 0;
  if (!Number.isFinite(shippingOverride)) {
    const shippingOptions = await calculateShippingOptions(params.country, params.isB2B ? subtotalHT : subtotalTTC, params.isB2B);
    shipping = money(shippingOptions[0]?.price ?? 0);
  }

  const totalHT = subtotalHT;
  const vatAmount = money(totalHT * (vatRate / 100));
  const totalTTC = money(totalHT + vatAmount + shipping);
  const subtotal = params.isB2B ? subtotalHT : subtotalTTC;
  const discountTotal = money(lineDiscountTotal + orderDiscountAmount);

  return {
    orderItems,
    subtotalHT,
    subtotalTTC,
    subtotal,
    shipping,
    totalHT,
    vatRate,
    vatAmount,
    totalTTC,
    total: totalTTC,
    orderDiscountType: orderDiscount.type,
    orderDiscountValue: orderDiscount.type ? orderDiscount.value : null,
    orderDiscountAmount,
    discountTotal,
  };
}

async function serializeAdminDraft(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      shippingAddress: true,
      customer: {
        include: { proAccount: true, addresses: true, _count: { select: { orders: true } } },
      },
    },
  });
}

function serializeCategoryAdminProduct(product: any) {
  return {
    ...product,
    images: parseJsonArraySafe(product.images),
    tags: parseJsonArraySafe(product.tags),
    features: parseJsonArraySafe(product.features),
  };
}

function getCategoryProductWhere(slug: string) {
  return {
    OR: [{ category: slug }, { subcategory: slug }, { subsubcategory: slug }],
  };
}

async function getCategoryLevel(category: { slug: string; parentSlug: string }): Promise<0 | 1 | 2> {
  if (!category.parentSlug) return 0;
  const parent = await prisma.category.findUnique({
    where: { slug: category.parentSlug },
    select: { parentSlug: true },
  });
  return parent?.parentSlug ? 2 : 1;
}

function getProductCategoryField(level: 0 | 1 | 2): "category" | "subcategory" | "subsubcategory" {
  if (level === 0) return "category";
  if (level === 1) return "subcategory";
  return "subsubcategory";
}

function cleanCategoryPayload(body: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};
  const textFields = ["name", "slug", "description", "image", "metaTitle", "metaDescription"];

  textFields.forEach((field) => {
    if (typeof body[field] === "string") payload[field] = (body[field] as string).trim();
  });

  if (typeof body.parentSlug === "string") payload.parentSlug = body.parentSlug.trim();
  if (typeof body.order === "number") payload.order = body.order;
  if (typeof body.isActive === "boolean") payload.isActive = body.isActive;

  return payload;
}

// ─── Réintégration de stock ─────────────────────────────────────────────────
/**
 * Réintègre le stock de chaque article d'une commande.
 * Idempotente : ne fait rien si order.stockRestored est déjà true.
 * Doit être appelée dans une transaction Prisma ou de manière autonome.
 *
 * @param orderId - ID de la commande dont le stock doit être réintégré
 * @param tx - Optionnel : instance Prisma transactionnelle. Si absent, utilise prisma directement.
 */
async function restoreOrderStock(
  orderId: string,
  tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
): Promise<void> {
  const db = tx ?? prisma;

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) {
    console.warn(`[stock-restore] Commande introuvable : ${orderId}`);
    return;
  }

  // Idempotence : ne pas réintégrer deux fois
  if (order.stockRestored) {
    console.log(`[stock-restore] Stock déjà réintégré pour la commande ${order.orderNumber} — ignoré.`);
    return;
  }

  for (const item of order.items) {
    if (!item.productId) continue;

    if (item.variantId) {
      // Produit à variantes : réincrémenter le stock de la variante
      const variant = await db.productVariant.findUnique({ where: { id: item.variantId } });
      if (!variant) {
        console.warn(`[stock-restore] Variante introuvable : ${item.variantId} (commande ${order.orderNumber})`);
        continue;
      }

      const newVariantStock = variant.stock + item.quantity;
      await db.productVariant.update({
        where: { id: item.variantId },
        data: { stock: newVariantStock, inStock: newVariantStock > 0 },
      });

      // Mettre à jour inStock du produit parent selon l'état réel de toutes ses variantes
      const activeVariantCount = await db.productVariant.count({
        where: { productId: item.productId, stock: { gt: 0 } },
      });
      await db.product.update({
        where: { id: item.productId },
        data: { inStock: activeVariantCount > 0 },
      });

      console.log(
        `[stock-restore] Variante ${variant.id} (produit ${item.productId}) : +${item.quantity} → ${newVariantStock} (commande ${order.orderNumber})`
      );
    } else {
      // Produit sans variante : réincrémenter stockCount
      const product = await db.product.findUnique({ where: { id: item.productId } });
      if (!product) {
        console.warn(`[stock-restore] Produit introuvable : ${item.productId} (commande ${order.orderNumber})`);
        continue;
      }

      const newStock = product.stockCount + item.quantity;
      await db.product.update({
        where: { id: item.productId },
        data: { stockCount: newStock, inStock: newStock > 0 },
      });

      console.log(
        `[stock-restore] Produit ${product.id} : +${item.quantity} → ${newStock} (commande ${order.orderNumber})`
      );
    }
  }

  // Marquer la commande comme ayant eu son stock réintégré (idempotence)
  await db.order.update({
    where: { id: orderId },
    data: { stockRestored: true },
  });

  console.log(`[stock-restore] Réintégration terminée pour la commande ${order.orderNumber} (${order.items.length} article(s)).`);
}

// GET /api/admin/categories/:id — Détail catégorie + produits associés
adminRouter.get("/categories/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const category = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!category) {
      res.status(404).json({ error: "Catégorie introuvable" });
      return;
    }

    const products = await prisma.product.findMany({
      where: getCategoryProductWhere(category.slug),
      orderBy: [{ categoryOrder: "asc" }, { updatedAt: "desc" }],
    });

    res.json({
      category,
      products: products.map((product) => serializeCategoryAdminProduct(product)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// PUT /api/admin/categories/:id — Mise à jour fiche catégorie
adminRouter.put("/categories/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: "Catégorie introuvable" });
      return;
    }

    const payload = cleanCategoryPayload(req.body as Record<string, unknown>);
    if (!payload.name || !payload.slug) {
      res.status(400).json({ error: "Le nom et le slug sont requis" });
      return;
    }

    const nextSlug = String(payload.slug);
    const category = await prisma.$transaction(async (tx) => {
      const updated = await tx.category.update({
        where: { id: req.params.id },
        data: payload,
      });

      if (existing.slug !== nextSlug) {
        await Promise.all([
          tx.product.updateMany({ where: { category: existing.slug }, data: { category: nextSlug } }),
          tx.product.updateMany({ where: { subcategory: existing.slug }, data: { subcategory: nextSlug } }),
          tx.product.updateMany({ where: { subsubcategory: existing.slug }, data: { subsubcategory: nextSlug } }),
          tx.category.updateMany({ where: { parentSlug: existing.slug }, data: { parentSlug: nextSlug } }),
        ]);
      }

      return updated;
    });

    res.json(category);
  } catch (err: any) {
    console.error(err);
    if (err?.code === "P2002") {
      res.status(409).json({ error: "Ce slug est déjà utilisé" });
      return;
    }
    res.status(500).json({ error: "Erreur modification catégorie" });
  }
});

// POST /api/admin/categories/:id/products — Ajout de produits à la catégorie
adminRouter.post("/categories/:id/products", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { productIds } = req.body as { productIds?: string[] };
    if (!Array.isArray(productIds) || productIds.length === 0) {
      res.status(400).json({ error: "productIds requis" });
      return;
    }

    const category = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!category) {
      res.status(404).json({ error: "Catégorie introuvable" });
      return;
    }

    const level = await getCategoryLevel(category);
    const field = getProductCategoryField(level);
    const maxProduct = await prisma.product.findFirst({
      where: getCategoryProductWhere(category.slug),
      orderBy: { categoryOrder: "desc" },
      select: { categoryOrder: true },
    });
    const startOrder = (maxProduct?.categoryOrder ?? -1) + 1;

    await prisma.$transaction(
      productIds.map((productId, index) =>
        prisma.product.update({
          where: { id: productId },
          data: { [field]: category.slug, categoryOrder: startOrder + index },
        })
      )
    );

    const products = await prisma.product.findMany({
      where: getCategoryProductWhere(category.slug),
      orderBy: [{ categoryOrder: "asc" }, { updatedAt: "desc" }],
    });

    res.status(201).json({
      success: true,
      products: products.map((product) => serializeCategoryAdminProduct(product)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur ajout produits" });
  }
});

// PATCH /api/admin/categories/:id/products/reorder — Réordonner les produits de la catégorie
adminRouter.patch("/categories/:id/products/reorder", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { productIds } = req.body as { productIds?: string[] };
    if (!Array.isArray(productIds)) {
      res.status(400).json({ error: "productIds requis" });
      return;
    }

    const category = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!category) {
      res.status(404).json({ error: "Catégorie introuvable" });
      return;
    }

    await prisma.$transaction(
      productIds.map((productId, index) =>
        prisma.product.update({ where: { id: productId }, data: { categoryOrder: index } })
      )
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur réorganisation produits" });
  }
});

// DELETE /api/admin/categories/:id/products/:productId — Retirer un produit de la catégorie
adminRouter.delete("/categories/:id/products/:productId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const category = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!category) {
      res.status(404).json({ error: "Catégorie introuvable" });
      return;
    }

    const product = await prisma.product.findUnique({ where: { id: req.params.productId } });
    if (!product) {
      res.status(404).json({ error: "Produit introuvable" });
      return;
    }

    const data: Record<string, unknown> = { categoryOrder: 0 };
    if (product.category === category.slug) data.category = "";
    if (product.subcategory === category.slug) data.subcategory = "";
    if (product.subsubcategory === category.slug) data.subsubcategory = "";

    await prisma.product.update({ where: { id: product.id }, data });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur retrait produit" });
  }
});

// POST /api/admin/customers/send-reset-emails — Envoi massif des liens de réinitialisation aux clients importés
adminRouter.post("/customers/send-reset-emails", requireAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const customers = await prisma.customer.findMany({
      where: { mustResetPassword: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    let sent = 0;
    let skipped = 0;
    let errors = 0;
    const failedCustomerIds: string[] = [];

    for (let index = 0; index < customers.length; index += 1) {
      const customer = customers[index];

      try {
        await prisma.passwordResetToken.updateMany({
          where: { customerId: customer.id, usedAt: null, expiresAt: { gt: new Date() } },
          data: { usedAt: new Date() },
        });

        const rawToken = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_MINUTES * 60 * 1000);
        await prisma.passwordResetToken.create({
          data: {
            customerId: customer.id,
            tokenHash: hashPasswordResetToken(rawToken),
            expiresAt,
          },
        });

        const result = await sendPasswordResetEmail({
          to: customer.email,
          customerName: getCustomerName(customer, customer.email),
          resetUrl: `${getFrontendUrl()}/reinitialiser-mot-de-passe?token=${rawToken}`,
          expiresInMinutes: PASSWORD_RESET_TOKEN_MINUTES,
        });

        if (result.sent) {
          sent += 1;
        } else if (result.skipped) {
          skipped += 1;
        } else {
          errors += 1;
          failedCustomerIds.push(customer.id);
        }
      } catch (error) {
        errors += 1;
        failedCustomerIds.push(customer.id);
        console.error(`[admin] Erreur envoi reset customerId=${customer.id}`, error);
      }

      if (index < customers.length - 1) {
        await wait(100);
      }
    }

    res.json({
      totalEligible: customers.length,
      sent,
      skipped,
      errors,
      failedCustomerIds,
      rateLimit: "10 emails/seconde",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur envoi emails de réinitialisation" });
  }
});

function asPrismaJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

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

function parseJsonObject(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseJsonArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function serializeProductForAdmin(product: any) {
  const features = parseJsonObject(product.features);
  const tags = parseJsonArray(product.tags);
  const compareAtPrice = product.compareAtPrice ?? product.originalPrice ?? null;
  return {
    ...product,
    compareAtPrice,
    originalPrice: compareAtPrice,
    purchasePrice: product.purchasePrice ?? null,
    images: parseJsonArray(product.images),
    tags,
    features,
    metaDescription: product.shortDescription || "",
    seoDescription: product.description || "",
    seoTags: tags,
    schemaJsonLd: features.schemaJsonLd || "",
    faqItems: Array.isArray(features.faqItems) ? features.faqItems : [],
    directAnswerIntro: features.directAnswerIntro || "",
    directAnswer: features.directAnswerIntro || "",
    voiceSnippet: features.voiceSnippet || "",
    eeaatContent: features.eeaatContent || "",
    longTailQuestions: Array.isArray(features.longTailQuestions) ? features.longTailQuestions : [],
    competitorComparison: Array.isArray(features.competitorComparison) ? features.competitorComparison : [],
    useCases: Array.isArray(features.useCases) ? features.useCases : [],
    buyingGuideSnippet: features.buyingGuideSnippet || "",
    entityKeywords: Array.isArray(features.entityKeywords) ? features.entityKeywords : [],
  };
}

function normalizeNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return String(value).trim();
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function normalizeFaqItems(value: unknown): { question: string; answer: string }[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return [];
  return value
    .map((item: any) => ({
      question: String(item?.question || "").trim(),
      answer: String(item?.answer || "").trim(),
    }))
    .filter((item) => item.question || item.answer);
}

function normalizeCountries(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [];
  return Array.from(
    new Set(
      values
        .map((item) => String(item || "").trim().toUpperCase())
        .filter((item) => /^[A-Z]{2}$/.test(item)),
    ),
  );
}

function buildShippingZoneData(body: Record<string, unknown>) {
  return {
    name: String(body.name || "").trim(),
    countries: normalizeCountries(body.countries),
  };
}

function buildShippingRateData(body: Record<string, unknown>) {
  const isFree = Boolean(body.isFree);
  return {
    name: String(body.name || "").trim(),
    minAmount: toRequiredFloat(body.minAmount as NumericInput, "Montant minimum"),
    maxAmount:
      body.maxAmount === null || body.maxAmount === undefined || body.maxAmount === ""
        ? null
        : toRequiredFloat(body.maxAmount as NumericInput, "Montant maximum"),
    price: isFree ? 0 : toRequiredFloat(body.price as NumericInput, "Prix"),
    carrier: String(body.carrier || "").trim() || null,
    freeThreshold:
      body.freeThreshold === null || body.freeThreshold === undefined || body.freeThreshold === ""
        ? null
        : toRequiredFloat(body.freeThreshold as NumericInput, "Seuil de gratuité"),
    isFree,
    deliveryTime: String(body.deliveryTime || "").trim() || null,
  };
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
          select: { id: true, orderNumber: true, total: true, status: true, createdAt: true },
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


// GET /api/admin/stock-alerts — Alertes de retour en stock
adminRouter.get(
  "/stock-alerts",
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const [alerts, pendingCount] = await Promise.all([
        prisma.stockAlert.findMany({
          orderBy: { createdAt: "desc" },
          include: {
            product: { select: { id: true, name: true, slug: true } },
            variant: { select: { id: true, name: true } },
          },
          take: 500,
        }),
        prisma.stockAlert.count({ where: { notified: false } }),
      ]);

      res.json({
        alerts: alerts.map(alert => ({
          id: alert.id,
          email: alert.email,
          productId: alert.productId,
          productName: alert.product.name,
          productSlug: alert.product.slug,
          variantId: alert.variantId,
          variantName: alert.variant?.name ?? null,
          createdAt: alert.createdAt,
          notified: alert.notified,
          notifiedAt: alert.notifiedAt,
        })),
        pendingCount,
        total: alerts.length,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur chargement alertes stock" });
    }
  }
);

// POST /api/admin/stock-alerts/:id/notify — Notification manuelle
adminRouter.post(
  "/stock-alerts/:id/notify",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await notifySingleStockAlert(req.params.id);
      res.json({ success: result.failed === 0, result });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur notification manuelle" });
    }
  }
);

// DELETE /api/admin/stock-alerts/:id — Supprimer une alerte
adminRouter.delete(
  "/stock-alerts/:id",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      await prisma.stockAlert.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur suppression alerte stock" });
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
          variants: {
            select: { stock: true, inStock: true },
          },
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
        const normalizedBrandName = normalizeForStockMatch(brandName) || "sans marque";
        const key = `name:${normalizedBrandName}`;
        if (!grouped.has(key)) {
          grouped.set(key, {
            brandId: product.brandId ?? null,
            brand: brandName,
            slug:
              brandRef?.slug ||
              normalizedBrandName.replace(/\s+/g, "-") ||
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
        if (!item.brandId && product.brandId) item.brandId = product.brandId;
        if (!item.logo && brandRef?.logo) item.logo = brandRef.logo;
        const hasVariants = product.variants.length > 0;
        const variantStockTotal = hasVariants
          ? product.variants.reduce((sum, v) => sum + Math.max(0, v.stock ?? 0), 0)
          : 0;
        const effectiveStock = hasVariants ? variantStockTotal : (product.stockCount ?? 0);
        const effectiveInStock = hasVariants
          ? product.variants.some((v) => v.inStock && (v.stock ?? 0) > 0)
          : product.inStock;
        item.productCount += 1;
        if (product.status === "active") item.activeCount += 1;
        if (effectiveInStock) item.inStockCount += 1;
        else item.outOfStockCount += 1;
        item.totalStockCount += effectiveStock;
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
      const andFilters: Record<string, unknown>[] = [];
      if (brandId) {
        const parsedBrandId = parseInt(brandId, 10);
        const brandRef = Number.isFinite(parsedBrandId)
          ? await prisma.brand.findUnique({
              where: { id: parsedBrandId },
              select: { name: true },
            })
          : null;
        andFilters.push({
          OR: [
            { brandId: parsedBrandId },
            ...(brandRef?.name ? [{ brand: brandRef.name }] : []),
          ],
        });
      } else if (brand) {
        andFilters.push({ brand });
      }
      if (status) where.status = status;
      if (search) {
        andFilters.push({
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { slug: { contains: search, mode: "insensitive" } },
            { brand: { contains: search, mode: "insensitive" } },
          ],
        });
      }
      if (andFilters.length > 0) where.AND = andFilters;
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
              purchasePrice: true,
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
        select: { price: true, stockCount: true },
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
      const nextStockCount = toNonNegativeInt(
        req.body.stockCount as NumericInput,
        "Stock"
      );
      const updated = await prisma.product.update({
        where: { id: req.params.id },
        data: {
          price: req.body.price !== undefined ? nextPublicPrice : undefined,
          priceProEur: nextProPrice,
          stockCount: nextStockCount,
          inStock:
            req.body.inStock !== undefined
              ? Boolean(req.body.inStock)
              : undefined,
          status: toStockStatus(req.body.status),
        },
        include: { variants: { orderBy: { order: "asc" } } },
      });
      if (nextStockCount !== undefined) {
        await notifyIfRestocked({
          productId: updated.id,
          previousStock: currentProduct.stockCount,
          nextStock: nextStockCount,
        });
      }
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
        select: { stock: true, price: true, productId: true, product: { select: { price: true, inStock: true } } },
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
      const nextVariantStock = toNonNegativeInt(
        req.body.stock as NumericInput,
        "Stock variante"
      );
      const updated = await prisma.productVariant.update({
        where: { id: req.params.id },
        data: {
          stock: nextVariantStock,
          inStock:
            req.body.inStock !== undefined
              ? Boolean(req.body.inStock)
              : undefined,
          priceProEur: nextProPrice,
          purchasePrice: toOptionalFloat(req.body.purchasePrice as NumericInput),
        },
      });
      if (nextVariantStock !== undefined) {
        await notifyIfRestocked({
          productId: currentVariant.productId,
          variantId: updated.id,
          previousStock: currentVariant.stock,
          nextStock: nextVariantStock,
        });
        // Mettre à jour inStock du produit parent selon l'état réel de toutes ses variantes
        const allVariants = await prisma.productVariant.findMany({
          where: { productId: currentVariant.productId },
          select: { id: true, stock: true, inStock: true },
        });
        const parentInStock = allVariants.some((v) =>
          v.id === updated.id
            ? (updated.inStock ?? false) && (updated.stock ?? 0) > 0
            : (v.inStock ?? false) && (v.stock ?? 0) > 0
        );
        await prisma.product.update({
          where: { id: currentVariant.productId },
          data: { inStock: parentInStock },
        });
      }
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
      const restockNotifications: Array<{ productId: string; variantId?: string | null; previousStock: number; nextStock: number }> = [];
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
              select: { stock: true, productId: true },
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
            restockNotifications.push({ productId: variant.productId, variantId, previousStock: variant.stock, nextStock });
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
            restockNotifications.push({ productId, previousStock: product.stockCount, nextStock });
            updated += 1;
          }
        }
      });
      for (const notification of restockNotifications) {
        await notifyIfRestocked(notification);
      }
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
        products: products.map((p) => serializeProductForAdmin(p)),
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


// POST /api/admin/products/:id/recommendations/generate — Générer les recommandations produit via l'agent SEO
adminRouter.post(
  "/products/:id/recommendations/generate",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const currentProduct = await prisma.product.findUnique({
        where: { id: req.params.id },
        select: { id: true, name: true, description: true, category: true },
      });

      if (!currentProduct) {
        res.status(404).json({ error: "Produit introuvable" });
        return;
      }

      const catalog = await prisma.product.findMany({
        where: { status: "active", NOT: { id: currentProduct.id } },
        select: { id: true, name: true, category: true },
        orderBy: { name: "asc" },
      });

      const recommendations = await generateProductRecommendations(currentProduct, catalog);
      const productIds = recommendations.map((item) => item.id);
      const recommendedProducts = productIds.length > 0
        ? await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true, category: true, brand: true, slug: true, images: true },
          })
        : [];
      const byId = new Map(recommendedProducts.map((item) => [item.id, item]));

      res.json({
        recommendations: recommendations.map((item) => ({
          ...item,
          product: byId.get(item.id) || null,
        })),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err instanceof Error ? err.message : "Erreur génération recommandations produit" });
    }
  }
);

// PUT /api/admin/products/:id/recommendations — Enregistrer les recommandations produit manuelles
adminRouter.put(
  "/products/:id/recommendations",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const product = await prisma.product.findUnique({
        where: { id: req.params.id },
        select: { id: true },
      });

      if (!product) {
        res.status(404).json({ error: "Produit introuvable" });
        return;
      }

      const rawIds: unknown[] = Array.isArray(req.body?.recommendedProductIds) ? req.body.recommendedProductIds : [];
      const recommendedProductIds: string[] = Array.from(new Set(
        rawIds
          .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
          .map((id: string) => id.trim())
          .filter((id: string) => id !== product.id)
      )).slice(0, 4);

      if (recommendedProductIds.length > 0) {
        const found = await prisma.product.findMany({
          where: { id: { in: recommendedProductIds } },
          select: { id: true },
        });
        const foundIds = new Set(found.map((item) => item.id));
        const invalidIds = recommendedProductIds.filter((id) => !foundIds.has(id));
        if (invalidIds.length > 0) {
          res.status(400).json({ error: `Produits recommandés introuvables : ${invalidIds.join(", ")}` });
          return;
        }
      }

      const updated = await prisma.product.update({
        where: { id: product.id },
        data: { recommendedProductIds },
      });

      res.json({ success: true, recommendedProductIds: updated.recommendedProductIds });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur sauvegarde recommandations produit" });
    }
  }
);

// GET /api/admin/products/:id — Détail produit admin avec champs SEO/GEO pré-remplissables
adminRouter.get(
  "/products/:id",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const product = await prisma.product.findUnique({ where: { id: req.params.id } });
      if (!product) {
        res.status(404).json({ error: "Produit introuvable" });
        return;
      }

      res.json(serializeProductForAdmin(product));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur récupération produit" });
    }
  }
);

function slugifyProductAnchor(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "produit-barber-paradise";
}

async function ensureAvailableProductAnchor(rawSlug: string, productId: string): Promise<string> {
  const slug = slugifyProductAnchor(rawSlug);
  const existing = await prisma.product.findFirst({
    where: {
      OR: [{ slug }, { handle: slug }],
      id: { not: productId },
    },
    select: { id: true },
  });
  if (existing) {
    const error = new Error("Cette ancre d’URL est déjà utilisée par un autre produit.");
    (error as any).statusCode = 409;
    throw error;
  }
  return slug;
}

// PUT /api/admin/products/:id/seo — Sauvegarder les champs SEO/GEO édités dans l'agent SEO
adminRouter.put(
  "/products/:id/seo",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const product = await prisma.product.findUnique({ where: { id: req.params.id } });
      if (!product) {
        res.status(404).json({ error: "Produit introuvable" });
        return;
      }

      const {
        optimizedTitle,
        title,
        name,
        optimizedSlug,
        slug,
        urlAnchor,
        metaDescription,
        seoDescription,
        description,
        suggestedTags,
        seoTags,
        tags,
        schemaJsonLd,
        faqItems,
        directAnswerIntro,
        directAnswer,
        voiceSnippet,
        eeaatContent,
        longTailQuestions,
        competitorComparison,
        useCases,
        buyingGuideSnippet,
        entityKeywords,
        price,
        priceEur,
        compareAtPrice,
        originalPrice,
        purchasePrice,
      } = req.body || {};

      const existingFeatures = parseJsonObject(product.features);
      const nextFeatures = { ...existingFeatures };
      const nextSchema = normalizeNullableString(schemaJsonLd);
      const nextDirectAnswer = normalizeNullableString(directAnswerIntro ?? directAnswer);
      const nextVoiceSnippet = normalizeNullableString(voiceSnippet);
      const nextEeaatContent = normalizeNullableString(eeaatContent);
      const nextBuyingGuideSnippet = normalizeNullableString(buyingGuideSnippet);
      const nextFaqItems = normalizeFaqItems(faqItems);
      const nextLongTailQuestions = Array.isArray(longTailQuestions) ? longTailQuestions : longTailQuestions === undefined ? undefined : [];
      const nextCompetitorComparison = Array.isArray(competitorComparison) ? competitorComparison : competitorComparison === undefined ? undefined : [];
      const nextUseCases = Array.isArray(useCases) ? useCases : useCases === undefined ? undefined : [];
      const nextEntityKeywords = normalizeStringArray(entityKeywords);

      if (nextSchema !== undefined) nextFeatures.schemaJsonLd = nextSchema;
      if (nextFaqItems !== undefined) nextFeatures.faqItems = nextFaqItems;
      if (nextDirectAnswer !== undefined) nextFeatures.directAnswerIntro = nextDirectAnswer;
      if (nextVoiceSnippet !== undefined) nextFeatures.voiceSnippet = nextVoiceSnippet;
      if (nextEeaatContent !== undefined) nextFeatures.eeaatContent = nextEeaatContent;
      if (nextLongTailQuestions !== undefined) nextFeatures.longTailQuestions = nextLongTailQuestions;
      if (nextCompetitorComparison !== undefined) nextFeatures.competitorComparison = nextCompetitorComparison;
      if (nextUseCases !== undefined) nextFeatures.useCases = nextUseCases;
      if (nextBuyingGuideSnippet !== undefined) nextFeatures.buyingGuideSnippet = nextBuyingGuideSnippet;
      if (nextEntityKeywords !== undefined) nextFeatures.entityKeywords = nextEntityKeywords;

      const nextTags = normalizeStringArray(suggestedTags ?? seoTags ?? tags);
      const requestedSlug = optimizedSlug ?? slug ?? urlAnchor;
      const nextSlug = requestedSlug !== undefined ? await ensureAvailableProductAnchor(String(requestedSlug), product.id) : undefined;
      const rawPublicPrice = price !== undefined ? price : priceEur;
      const nextCompareAtPrice = toOptionalFloat((compareAtPrice ?? originalPrice) as NumericInput);
      const updateData: Record<string, any> = {
        name: normalizeNullableString(optimizedTitle ?? title ?? name) || undefined,
        slug: nextSlug,
        handle: nextSlug,
        shortDescription: normalizeNullableString(metaDescription) ?? undefined,
        description: normalizeNullableString(seoDescription ?? description) ?? undefined,
        tags: nextTags !== undefined ? JSON.stringify(nextTags) : undefined,
        features: JSON.stringify(nextFeatures),
        price: rawPublicPrice !== undefined ? toRequiredFloat(rawPublicPrice as NumericInput, "Prix public") : undefined,
        compareAtPrice: nextCompareAtPrice,
        originalPrice: nextCompareAtPrice,
        purchasePrice: toOptionalFloat(purchasePrice as NumericInput),
      };

      const updated = await prisma.product.update({
        where: { id: product.id },
        data: updateData,
      });

      res.json({ success: true, product: serializeProductForAdmin(updated) });
    } catch (err: any) {
      console.error(err);
      res.status(err.statusCode || 500).json({ error: err.message || "Erreur sauvegarde SEO produit" });
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
        compareAtPrice,
        purchasePrice,
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
        select: { price: true, stockCount: true },
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
          compareAtPrice:
            compareAtPrice !== undefined || originalPrice !== undefined
              ? toOptionalFloat((compareAtPrice ?? originalPrice) as NumericInput)
              : undefined,
          originalPrice:
            compareAtPrice !== undefined || originalPrice !== undefined
              ? toOptionalFloat((compareAtPrice ?? originalPrice) as NumericInput)
              : undefined,
          purchasePrice: toOptionalFloat(purchasePrice),
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
      if (nextStockCount !== undefined) {
        await notifyIfRestocked({
          productId: product.id,
          previousStock: currentProduct.stockCount,
          nextStock: nextStockCount,
        });
      }
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
        await tx.stockAlert.deleteMany({ where: { productId: req.params.id } });
        await tx.productVariant.deleteMany({ where: { productId: req.params.id } });
        await tx.review.deleteMany({ where: { productId: req.params.id } });
        await tx.wishlistItem.deleteMany({ where: { productId: req.params.id } });
        await tx.orderItem.deleteMany({ where: { productId: req.params.id } });
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
        compareAtPrice,
        purchasePrice,
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
          compareAtPrice: compareAtPrice !== undefined || originalPrice !== undefined ? toOptionalFloat((compareAtPrice ?? originalPrice) as NumericInput) : null,
          originalPrice: compareAtPrice !== undefined || originalPrice !== undefined ? toOptionalFloat((compareAtPrice ?? originalPrice) as NumericInput) : null,
          purchasePrice: toOptionalFloat(purchasePrice) ?? null,
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


// GET /api/admin/shipping/zones — Liste des zones et tarifs d'expédition
adminRouter.get(
  "/shipping/zones",
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      await ensureDefaultShippingZones();
      const zones = await prisma.shippingZone.findMany({
        include: { rates: { orderBy: [{ minAmount: "asc" }, { price: "asc" }, { name: "asc" }] } },
        orderBy: { name: "asc" },
      });
      res.json({ zones });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur chargement zones d'expédition" });
    }
  }
);

// POST /api/admin/shipping/zones — Créer une zone d'expédition
adminRouter.post(
  "/shipping/zones",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const data = buildShippingZoneData(req.body || {});
      if (!data.name) {
        res.status(400).json({ error: "Le nom de la zone est requis" });
        return;
      }
      if (!data.countries.length) {
        res.status(400).json({ error: "Sélectionnez au moins un pays" });
        return;
      }
      const zone = await prisma.shippingZone.create({
        data,
        include: { rates: { orderBy: [{ minAmount: "asc" }, { price: "asc" }, { name: "asc" }] } },
      });
      res.status(201).json(zone);
    } catch (err) {
      console.error(err);
      res.status(400).json({ error: err instanceof Error ? err.message : "Erreur création zone" });
    }
  }
);

// PUT /api/admin/shipping/zones/:id — Modifier une zone d'expédition
adminRouter.put(
  "/shipping/zones/:id",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const data = buildShippingZoneData(req.body || {});
      if (!data.name) {
        res.status(400).json({ error: "Le nom de la zone est requis" });
        return;
      }
      if (!data.countries.length) {
        res.status(400).json({ error: "Sélectionnez au moins un pays" });
        return;
      }
      const zone = await prisma.shippingZone.update({
        where: { id: req.params.id },
        data,
        include: { rates: { orderBy: [{ minAmount: "asc" }, { price: "asc" }, { name: "asc" }] } },
      });
      res.json(zone);
    } catch (err) {
      console.error(err);
      res.status(400).json({ error: err instanceof Error ? err.message : "Erreur mise à jour zone" });
    }
  }
);

// DELETE /api/admin/shipping/zones/:id — Supprimer une zone d'expédition
adminRouter.delete(
  "/shipping/zones/:id",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      await prisma.shippingZone.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur suppression zone" });
    }
  }
);

// POST /api/admin/shipping/zones/:id/rates — Ajouter un tarif à une zone
adminRouter.post(
  "/shipping/zones/:id/rates",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const data = buildShippingRateData(req.body || {});
      if (!data.name) {
        res.status(400).json({ error: "Le nom du tarif est requis" });
        return;
      }
      if (data.maxAmount !== null && data.maxAmount <= data.minAmount) {
        res.status(400).json({ error: "Le montant maximum doit être supérieur au minimum" });
        return;
      }
      if (data.freeThreshold !== null && data.freeThreshold < 0) {
        res.status(400).json({ error: "Le seuil de gratuité doit être positif" });
        return;
      }
      const rate = await prisma.shippingRate.create({ data: { ...data, zoneId: req.params.id } });
      res.status(201).json(rate);
    } catch (err) {
      console.error(err);
      res.status(400).json({ error: err instanceof Error ? err.message : "Erreur création tarif" });
    }
  }
);

// PUT /api/admin/shipping/rates/:id — Modifier un tarif
adminRouter.put(
  "/shipping/rates/:id",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const data = buildShippingRateData(req.body || {});
      if (!data.name) {
        res.status(400).json({ error: "Le nom du tarif est requis" });
        return;
      }
      if (data.maxAmount !== null && data.maxAmount <= data.minAmount) {
        res.status(400).json({ error: "Le montant maximum doit être supérieur au minimum" });
        return;
      }
      if (data.freeThreshold !== null && data.freeThreshold < 0) {
        res.status(400).json({ error: "Le seuil de gratuité doit être positif" });
        return;
      }
      const rate = await prisma.shippingRate.update({ where: { id: req.params.id }, data });
      res.json(rate);
    } catch (err) {
      console.error(err);
      res.status(400).json({ error: err instanceof Error ? err.message : "Erreur mise à jour tarif" });
    }
  }
);

// DELETE /api/admin/shipping/rates/:id — Supprimer un tarif
adminRouter.delete(
  "/shipping/rates/:id",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      await prisma.shippingRate.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur suppression tarif" });
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
        where: {
          status: "paid",
          OR: [
            { shipment: null },
            { shipment: { is: { labelGeneratedAt: null, shippedAt: null } } },
          ],
        },
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
          shipment: true,
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
          relayPointId: order.relayPointId,
          relayPointName: order.relayPointName,
          relayPointAddress: order.relayPointAddress,
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

// GET /api/admin/logistics/orders/:orderId/quotes — Calculer les offres transporteur avant achat
adminRouter.get(
  "/logistics/orders/:orderId/quotes",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const packagingIdRaw = req.query?.packagingId;
      const totalWeightRaw = req.query?.totalWeightG;
      const parseOptionalInteger = (value: unknown) =>
        value === undefined || value === null || value === "" ? null : parseInt(String(value), 10);
      const parseOptionalBoolean = (value: unknown) =>
        value === undefined || value === null || value === "" ? undefined : String(value) === "true";
      const packagingId = parseOptionalInteger(packagingIdRaw);
      const overriddenTotalWeightG = parseOptionalInteger(totalWeightRaw);
      const colissimoInsuranceValueCents = parseOptionalInteger(req.query?.colissimoInsuranceValueCents);
      const mondialRelayInsuranceValueCents = parseOptionalInteger(req.query?.mondialRelayInsuranceValueCents);
      const colissimoSignatureRequired = parseOptionalBoolean(req.query?.colissimoSignatureRequired);

      if (packagingId !== null && !Number.isFinite(packagingId)) {
        res.status(400).json({ error: "Carton sélectionné invalide" });
        return;
      }
      if (overriddenTotalWeightG !== null && (!Number.isFinite(overriddenTotalWeightG) || overriddenTotalWeightG <= 0)) {
        res.status(400).json({ error: "Poids total du colis invalide" });
        return;
      }
      if (colissimoInsuranceValueCents !== null && (!Number.isFinite(colissimoInsuranceValueCents) || colissimoInsuranceValueCents < 0)) {
        res.status(400).json({ error: "Montant d’assurance Colissimo invalide" });
        return;
      }
      if (mondialRelayInsuranceValueCents !== null && (!Number.isFinite(mondialRelayInsuranceValueCents) || mondialRelayInsuranceValueCents < 0)) {
        res.status(400).json({ error: "Montant d’assurance Mondial Relay invalide" });
        return;
      }

      const order = await prisma.order.findUnique({
        where: { id: req.params.orderId },
        include: {
          items: { include: { product: true } },
          customer: true,
          shippingAddress: true,
        },
      });

      if (!order) {
        res.status(404).json({ error: "Commande non trouvée" });
        return;
      }
      if (!order.shippingAddress) {
        res.status(400).json({ error: "Adresse d’expédition obligatoire pour calculer les offres" });
        return;
      }

      const packaging = packagingId
        ? await prisma.packaging.findUnique({ where: { id: packagingId } })
        : null;
      if (packagingId && !packaging) {
        res.status(404).json({ error: "Carton sélectionné introuvable" });
        return;
      }

      const metrics = computeLogisticsMetrics(order.items as LogisticsOrderItem[]);
      const computedTotalWeightG = metrics.totalWeightG + (packaging?.selfWeightG || 0);
      const totalWeightG = overriddenTotalWeightG || computedTotalWeightG;
      const quotes = buildShipmentQuotes({
        orderNumber: order.orderNumber,
        customerEmail: order.email,
        recipient: order.shippingAddress,
        totalWeightG,
        orderValueCents: Math.round(Number(order.total || 0) * 100),
        carrierOptions: {
          colissimo: {
            insuranceValueCents: colissimoInsuranceValueCents,
            signatureRequired: colissimoSignatureRequired,
          },
          colissimo_international: {
            insuranceValueCents: colissimoInsuranceValueCents,
            signatureRequired: colissimoSignatureRequired,
          },
          mondial_relay: {
            insuranceValueCents: mondialRelayInsuranceValueCents,
          },
        },
        packageDimensions: packaging
          ? {
              lengthCm: packaging.lengthCm,
              widthCm: packaging.widthCm,
              heightCm: packaging.heightCm,
            }
          : null,
      });

      res.json({ quotes, totalWeightG, packaging });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur calcul offres transporteur" });
    }
  }
);

// POST /api/admin/logistics/orders/:orderId/label — Acheter une étiquette officielle transporteur
adminRouter.post(
  "/logistics/orders/:orderId/label",
  requireAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const carrier = String(req.body?.carrier || "") as LogisticsCarrier;
      const offerId = String(req.body?.offerId || "").trim();
      const relayPointId = String(req.body?.relayPointId || "").trim() || null;
      const insuranceValueCents = Math.max(parseInt(String(req.body?.insuranceValueCents || "0"), 10) || 0, 0);
      const signatureRequired = Boolean(req.body?.signatureRequired);
      const sendTrackingEmail = Boolean(req.body?.sendTrackingEmail);
      const packagingIdRaw = req.body?.packagingId;
      const packagingId =
        packagingIdRaw === undefined || packagingIdRaw === null || packagingIdRaw === ""
          ? null
          : parseInt(String(packagingIdRaw), 10);

      if (!Object.keys(LOGISTICS_CARRIERS).includes(carrier)) {
        res.status(400).json({ error: "Transporteur invalide" });
        return;
      }
      if (!offerId) {
        res.status(400).json({ error: "Offre transporteur obligatoire" });
        return;
      }
      if (packagingId !== null && !Number.isFinite(packagingId)) {
        res.status(400).json({ error: "Carton sélectionné invalide" });
        return;
      }

      const order = await prisma.order.findUnique({
        where: { id: req.params.orderId },
        include: {
          items: { include: { product: true } },
          customer: true,
          shippingAddress: true,
        },
      });

      if (!order) {
        res.status(404).json({ error: "Commande non trouvée" });
        return;
      }
      // Les commandes B2B en virement bancaire peuvent être expédiées avant réception des fonds
      // (délai de 1 à 3 jours ouvrés). L'admin est responsable de la décision d'expédition.
      const BANK_TRANSFER_METHODS = ["paybybank", "pay_by_bank", "banktransfer", "bank_transfer", "bank-transfer", "virement"];
      const isB2BBankTransfer = order.isB2B && BANK_TRANSFER_METHODS.includes((order.paymentMethod || "").toLowerCase());
      const ELIGIBLE_STATUSES = ["paid", "processing", "shipped"];
      const isPendingB2BBankTransfer = isB2BBankTransfer && ["pending", "pending_payment", "open"].includes(order.status);

      if (!ELIGIBLE_STATUSES.includes(order.status) && !isPendingB2BBankTransfer) {
        res.status(400).json({ error: "Commande non éligible à l'achat d'étiquette" });
        return;
      }
      if (!order.shippingAddress) {
        res.status(400).json({ error: "Adresse d’expédition obligatoire pour acheter l’étiquette" });
        return;
      }

      const packaging = packagingId
        ? await prisma.packaging.findUnique({ where: { id: packagingId } })
        : null;
      if (packagingId && !packaging) {
        res.status(404).json({ error: "Carton sélectionné introuvable" });
        return;
      }

      const metrics = computeLogisticsMetrics(order.items as LogisticsOrderItem[]);
      const totalWeightG = metrics.totalWeightG + (packaging?.selfWeightG || 0);
      const labelResult = await createOfficialShipmentLabel({
        carrier,
        offerId,
        insuranceValueCents,
        signatureRequired,
        packagingId,
        relayPointId,
        orderNumber: order.orderNumber,
        customerEmail: order.email,
        recipient: order.shippingAddress,
        totalWeightG,
        orderValueCents: Math.round(Number(order.total || 0) * 100),
        packageDimensions: packaging
          ? {
              lengthCm: packaging.lengthCm,
              widthCm: packaging.widthCm,
              heightCm: packaging.heightCm,
            }
          : null,
      });

      const [shipment, updatedOrder] = await prisma.$transaction([
        prisma.shipment.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          carrier,
          carrierShipmentId: labelResult.carrierShipmentId,
          trackingNumber: labelResult.trackingNumber,
          trackingUrl: labelResult.trackingUrl,
          packagingId,
          totalWeightG,
          offerId: labelResult.offerId,
          serviceCode: labelResult.serviceCode,
          deliveryMode: labelResult.deliveryMode,
          relayPointId: labelResult.relayPointId,
          labelPriceCents: labelResult.priceCents,
          labelCurrency: labelResult.currency,
          insuranceValueCents: labelResult.insuranceValueCents,
          labelPdfBase64: labelResult.labelPdfBase64,
          labelFormat: labelResult.labelFormat,
          labelSource: labelResult.labelSource,
          labelStatus: labelResult.labelStatus,
          labelGeneratedAt: labelResult.labelGeneratedAt,
          carrierRawResponse: asPrismaJson(labelResult.rawResponse),
          lastTrackingStatus: "Étiquette officielle achetée",
          lastTrackingSyncAt: new Date(),
          shippedBy: req.user?.email || null,
        },
        update: {
          carrier,
          carrierShipmentId: labelResult.carrierShipmentId,
          trackingNumber: labelResult.trackingNumber,
          trackingUrl: labelResult.trackingUrl,
          packagingId,
          totalWeightG,
          offerId: labelResult.offerId,
          serviceCode: labelResult.serviceCode,
          deliveryMode: labelResult.deliveryMode,
          relayPointId: labelResult.relayPointId,
          labelPriceCents: labelResult.priceCents,
          labelCurrency: labelResult.currency,
          insuranceValueCents: labelResult.insuranceValueCents,
          labelPdfBase64: labelResult.labelPdfBase64,
          labelFormat: labelResult.labelFormat,
          labelSource: labelResult.labelSource,
          labelStatus: labelResult.labelStatus,
          labelGeneratedAt: labelResult.labelGeneratedAt,
          carrierRawResponse: asPrismaJson(labelResult.rawResponse),
          lastTrackingStatus: `Étiquette ${LOGISTICS_CARRIERS[carrier]} achetée — Suivi ${labelResult.trackingNumber}`,
          lastTrackingSyncAt: new Date(),
          shippedBy: req.user?.email || null,
        },
        include: { packaging: true },
        }),
        prisma.order.update({
          where: { id: order.id },
          data: { status: "processing" },
        }),
      ]);

      let trackingEmailSent = false;
      if (sendTrackingEmail && labelResult.trackingNumber) {
        await sendOrderShippedEmail({
          to: order.email,
          orderNumber: order.orderNumber,
          customerName: getCustomerName(order.customer, order.email),
          carrier: LOGISTICS_CARRIERS[carrier],
          trackingNumber: labelResult.trackingNumber,
          trackingUrl: labelResult.trackingUrl || `https://www.laposte.fr/outils/suivre-vos-envois?code=${encodeURIComponent(labelResult.trackingNumber)}`,
        });
        trackingEmailSent = true;
      }

      res.json({
        success: true,
        order: updatedOrder,
        shipment,
        trackingEmailSent,
        label: {
          downloadUrl: `/api/admin/shipments/${shipment.id}/label.pdf`,
          source: labelResult.labelSource,
          priceCents: labelResult.priceCents,
          insuranceValueCents: labelResult.insuranceValueCents,
          priceTaxIncluded: labelResult.priceTaxIncluded,
          priceTaxLabel: labelResult.priceTaxLabel,
          taxAmountCents: labelResult.taxAmountCents,
          totalWithTaxCents: labelResult.totalWithTaxCents,
          signatureRequired: labelResult.signatureRequired,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err instanceof Error ? err.message : "Erreur achat étiquette transporteur" });
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
          shippingAddress: true,
          shipment: true,
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

      if (!order.shippingAddress) {
        res.status(400).json({
          error: "Adresse d’expédition obligatoire pour générer l’étiquette",
        });
        return;
      }
      const metrics = computeLogisticsMetrics(
        order.items as LogisticsOrderItem[]
      );
      const totalWeightG = metrics.totalWeightG + (packaging?.selfWeightG || 0);
      if (!order.shipment || order.shipment.labelSource !== "carrier_api" || !order.shipment.trackingNumber) {
        res.status(400).json({
          error:
            "Achetez d’abord une étiquette officielle Colissimo ou Mondial Relay avant de marquer la commande comme expédiée.",
        });
        return;
      }
      if (order.shipment.carrier !== carrier) {
        res.status(400).json({
          error: "Le transporteur choisi ne correspond pas à l’étiquette officielle déjà achetée.",
        });
        return;
      }
      const labelResult = {
        carrierShipmentId: order.shipment.carrierShipmentId,
        trackingNumber: order.shipment.trackingNumber,
        trackingUrl: order.shipment.trackingUrl,
        labelPdfBase64: order.shipment.labelPdfBase64,
        labelFormat: order.shipment.labelFormat || "PDF",
        labelSource: order.shipment.labelSource,
        labelStatus: order.shipment.labelStatus || "carrier_label_created",
        labelGeneratedAt: order.shipment.labelGeneratedAt || new Date(),
        offerId: order.shipment.offerId,
        serviceCode: order.shipment.serviceCode,
        deliveryMode: order.shipment.deliveryMode,
        relayPointId: order.shipment.relayPointId,
        priceCents: order.shipment.labelPriceCents,
        currency: order.shipment.labelCurrency || "EUR",
        insuranceValueCents: order.shipment.insuranceValueCents,
        rawResponse: order.shipment.carrierRawResponse as Record<string, unknown> | null,
        notice: null,
      };
      const shippedAt = new Date();
      const [shipment, updatedOrder] = await prisma.$transaction([
        prisma.shipment.upsert({
          where: { orderId: order.id },
          create: {
            orderId: order.id,
            carrier,
            carrierShipmentId: labelResult.carrierShipmentId,
            trackingNumber: labelResult.trackingNumber,
            trackingUrl: labelResult.trackingUrl,
            packagingId,
            totalWeightG,
            offerId: labelResult.offerId,
            serviceCode: labelResult.serviceCode,
            deliveryMode: labelResult.deliveryMode,
            relayPointId: labelResult.relayPointId,
            labelPriceCents: labelResult.priceCents,
            labelCurrency: labelResult.currency,
            insuranceValueCents: labelResult.insuranceValueCents,
            labelPdfBase64: labelResult.labelPdfBase64,
            labelFormat: labelResult.labelFormat,
            labelSource: labelResult.labelSource,
            labelStatus: labelResult.labelStatus,
            labelGeneratedAt: labelResult.labelGeneratedAt,
            carrierRawResponse: asPrismaJson(labelResult.rawResponse),
            lastTrackingStatus: "Expédition créée",
            lastTrackingSyncAt: new Date(),
            shippedAt,
            shippedBy: req.user?.email || null,
          },
          update: {
            carrier,
            carrierShipmentId: labelResult.carrierShipmentId,
            trackingNumber: labelResult.trackingNumber,
            trackingUrl: labelResult.trackingUrl,
            packagingId,
            totalWeightG,
            offerId: labelResult.offerId,
            serviceCode: labelResult.serviceCode,
            deliveryMode: labelResult.deliveryMode,
            relayPointId: labelResult.relayPointId,
            labelPriceCents: labelResult.priceCents,
            labelCurrency: labelResult.currency,
            insuranceValueCents: labelResult.insuranceValueCents,
            labelPdfBase64: labelResult.labelPdfBase64,
            labelFormat: labelResult.labelFormat,
            labelSource: labelResult.labelSource,
            labelStatus: labelResult.labelStatus,
            labelGeneratedAt: labelResult.labelGeneratedAt,
            carrierRawResponse: asPrismaJson(labelResult.rawResponse),
            lastTrackingStatus: "Expédition créée",
            lastTrackingSyncAt: new Date(),
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
        trackingNumber: labelResult.trackingNumber,
      });
      res.json({
        success: true,
        order: updatedOrder,
        shipment,
        label: {
          downloadUrl: `/api/admin/logistics/orders/${order.id}/label`,
          source: labelResult.labelSource,
          notice: labelResult.notice,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur validation expédition" });
    }
  }
);

// GET /api/admin/logistics/orders/:orderId/label — Télécharger l’étiquette PDF
adminRouter.get(
  "/logistics/orders/:orderId/label",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const shipment = await prisma.shipment.findUnique({
        where: { orderId: req.params.orderId },
        include: { order: true },
      });

      if (!shipment || !shipment.labelPdfBase64) {
        res.status(404).json({ error: "Étiquette non générée" });
        return;
      }

      const pdfBuffer = Buffer.from(shipment.labelPdfBase64, "base64");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=etiquette-${shipment.order.orderNumber}.pdf`
      );
      res.send(pdfBuffer);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur téléchargement étiquette" });
    }
  }
);

// GET /api/admin/shipments/:shipmentId/label.pdf — Afficher/télécharger l’étiquette PDF par expédition
adminRouter.get(
  "/shipments/:shipmentId/label.pdf",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const shipment = await prisma.shipment.findUnique({
        where: { id: req.params.shipmentId },
        include: { order: true },
      });

      if (!shipment || !shipment.labelPdfBase64 || shipment.labelStatus === "cancelled") {
        res.status(404).json({ error: "Étiquette non disponible" });
        return;
      }

      const pdfBuffer = Buffer.from(shipment.labelPdfBase64, "base64");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename=etiquette-${shipment.order.orderNumber}.pdf`
      );
      res.send(pdfBuffer);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur téléchargement étiquette" });
    }
  }
);

// POST /api/admin/shipments/:shipmentId/cancel — Annuler une étiquette transporteur
adminRouter.post(
  "/shipments/:shipmentId/cancel",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const shipment = await prisma.shipment.findUnique({
        where: { id: req.params.shipmentId },
        include: { packaging: true },
      });

      if (!shipment) {
        res.status(404).json({ error: "Expédition non trouvée" });
        return;
      }
      if (!Object.keys(LOGISTICS_CARRIERS).includes(shipment.carrier)) {
        res.status(400).json({ error: "Transporteur invalide" });
        return;
      }
      if (shipment.labelStatus === "cancelled") {
        res.status(400).json({ error: "Cette étiquette est déjà annulée" });
        return;
      }
      const scannedStatuses = ["in_transit", "shipped", "delivered", "scanned"];
      const normalizedTrackingStatus = String(shipment.lastTrackingStatus || "").toLowerCase();
      const hasCarrierScan = Boolean(shipment.shippedAt) || scannedStatuses.some(status => normalizedTrackingStatus.includes(status));
      if (hasCarrierScan) {
        res.status(400).json({ error: "Cette étiquette ne peut plus être annulée car elle a déjà été scannée par le transporteur." });
        return;
      }
      if (!shipment.trackingNumber) {
        res.status(400).json({ error: "Numéro de suivi absent pour annuler l’étiquette" });
        return;
      }

      const cancellation = await cancelOfficialShipmentLabel({
        carrier: shipment.carrier as LogisticsCarrier,
        trackingNumber: shipment.trackingNumber,
        carrierShipmentId: shipment.carrierShipmentId,
      });

      const updatedShipment = await prisma.shipment.update({
        where: { id: shipment.id },
        data: {
          labelStatus: "cancelled",
          lastTrackingStatus: cancellation.message,
          lastTrackingSyncAt: new Date(),
          carrierRawResponse: asPrismaJson(cancellation.rawResponse || shipment.carrierRawResponse),
        },
        include: { packaging: true },
      });

      res.json({ success: true, shipment: updatedShipment, message: cancellation.message });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err instanceof Error ? err.message : "Erreur annulation étiquette" });
    }
  }
);

// POST /api/admin/logistics/orders/:orderId/tracking/sync — Synchroniser le suivi
adminRouter.post(
  "/logistics/orders/:orderId/tracking/sync",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const shipment = await prisma.shipment.findUnique({
        where: { orderId: req.params.orderId },
        include: { packaging: true },
      });

      if (!shipment) {
        res.status(404).json({ error: "Expédition non trouvée" });
        return;
      }

      if (!Object.keys(LOGISTICS_CARRIERS).includes(shipment.carrier)) {
        res.status(400).json({ error: "Transporteur invalide" });
        return;
      }

      const tracking = await fetchShipmentTracking(
        shipment.carrier as LogisticsCarrier,
        shipment.trackingNumber
      );
      const updatedShipment = await prisma.shipment.update({
        where: { orderId: req.params.orderId },
        data: {
          trackingUrl: tracking.trackingUrl,
          lastTrackingStatus: tracking.trackingStatus,
          lastTrackingSyncAt: new Date(),
          carrierRawResponse: asPrismaJson(tracking.rawResponse || shipment.carrierRawResponse),
        },
        include: { packaging: true },
      });

      res.json({ success: true, shipment: updatedShipment });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur synchronisation suivi" });
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
        search,
        channel,
      } = req.query as Record<string, string>;
      const pageNumber = Math.max(1, parseInt(page) || 1);
      const pageSize = Math.max(1, Math.min(100, parseInt(limit) || 20));
      const skip = (pageNumber - 1) * pageSize;
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {};
      if (status) where.status = status;
      if (channel && ["online", "pos"].includes(channel)) where.channel = channel;
      const summaryWhere = channel && ["online", "pos"].includes(channel) ? { channel } : {};
      if (search?.trim()) {
        const term = search.trim();
        where.OR = [
          { orderNumber: { contains: term, mode: "insensitive" } },
          { email: { contains: term, mode: "insensitive" } },
          { customerEmail: { contains: term, mode: "insensitive" } },
          { customer: { firstName: { contains: term, mode: "insensitive" } } },
          { customer: { lastName: { contains: term, mode: "insensitive" } } },
        ];
      }
      const [orders, total, todayOrders, todayItems, processedOrders, deliveredOrders] = await Promise.all([
        prisma.order.findMany({
          where,
          include: {
            items: true,
            shippingAddress: true,
            shipment: true,
            customer: {
              select: { firstName: true, lastName: true, email: true },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: pageSize,
        }),
        prisma.order.count({ where }),
        prisma.order.count({ where: { ...summaryWhere, createdAt: { gte: startOfToday } } }),
        prisma.orderItem.aggregate({
          where: { order: { ...summaryWhere, createdAt: { gte: startOfToday } } },
          _sum: { quantity: true },
        }),
        prisma.order.count({ where: { ...summaryWhere, status: { in: ["processing", "shipped", "delivered"] } } }),
        prisma.order.count({ where: { ...summaryWhere, status: "delivered" } }),
      ]);
      res.json({
        orders,
        total,
        page: pageNumber,
        pages: Math.ceil(total / pageSize),
        summary: {
          ordersToday: todayOrders,
          itemsOrdered: todayItems._sum.quantity || 0,
          processedOrders,
          deliveredOrders,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
);


// GET /api/admin/orders/shipment-labels — Étiquettes générées
adminRouter.get(
  "/orders/shipment-labels",
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const shipments = await prisma.shipment.findMany({
        where: {
          labelPdfBase64: { not: null },
        },
        include: {
          order: { select: { id: true, orderNumber: true } },
        },
        orderBy: [{ labelGeneratedAt: "desc" }, { createdAt: "desc" }],
      });

      res.json({
        labels: shipments.map((shipment) => ({
          id: shipment.id,
          orderId: shipment.orderId,
          orderNumber: shipment.order.orderNumber,
          carrier: shipment.carrier,
          trackingNumber: shipment.trackingNumber,
          labelStatus: shipment.labelStatus === "cancelled" ? "cancelled" : shipment.shippedAt ? "shipped" : shipment.labelStatus || "generated",
          labelGeneratedAt: shipment.labelGeneratedAt,
          shippedAt: shipment.shippedAt,
          downloadUrl: `/api/admin/shipments/${shipment.id}/label.pdf`,
        })),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
);

// GET /api/admin/orders/abandoned-carts — Paniers non convertis depuis plus d'une heure
adminRouter.get(
  "/orders/abandoned-carts",
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const abandonedBefore = new Date(Date.now() - 60 * 60 * 1000);
      const carts = await prisma.abandonedCartSession.findMany({
        where: {
          itemCount: { gt: 0 },
          convertedAt: null,
          lastSeenAt: { lte: abandonedBefore },
        },
        orderBy: { lastSeenAt: "desc" },
        take: 100,
      });

      res.json({
        carts: carts.map((cart) => {
          const items = Array.isArray(cart.items) ? cart.items : [];
          return {
            id: cart.id,
            email: cart.email || "Email non renseigné",
            itemCount: cart.itemCount,
            total: cart.total,
            abandonedAt: cart.lastSeenAt,
            reminderStage: cart.reminderStage,
            lastReminderAt: cart.lastReminderAt,
            convertedAt: cart.convertedAt,
            unsubscribed: cart.unsubscribed,
            reminderStatus: cart.convertedAt
              ? "Converti"
              : cart.unsubscribed
                ? "Désinscrit"
                : cart.reminderStage === 1
                  ? "Email 1 envoyé"
                  : cart.reminderStage === 2
                    ? "Email 2 envoyé"
                    : cart.reminderStage >= 3
                      ? "Email 3 envoyé"
                      : "Aucune",
            products: items
              .map((item) => {
                if (!item || typeof item !== "object" || Array.isArray(item)) return null;
                const product = item as { name?: unknown; quantity?: unknown };
                if (typeof product.name !== "string") return null;
                const quantity = typeof product.quantity === "number" ? product.quantity : 1;
                return `${product.name} × ${quantity}`;
              })
              .filter(Boolean),
          };
        }),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
);


// GET /api/admin/orders/drafts — Liste des brouillons de commande
adminRouter.get(
  "/orders/drafts",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { page = "1", limit = "20", search } = req.query as Record<string, string>;
      const pageNumber = Math.max(1, parseInt(page) || 1);
      const pageSize = Math.max(1, Math.min(100, parseInt(limit) || 20));
      const skip = (pageNumber - 1) * pageSize;
      const where: Prisma.OrderWhereInput = { status: "draft" };
      if (search?.trim()) {
        const term = search.trim();
        where.OR = [
          { orderNumber: { contains: term, mode: "insensitive" } },
          { email: { contains: term, mode: "insensitive" } },
          { customerEmail: { contains: term, mode: "insensitive" } },
          { customer: { firstName: { contains: term, mode: "insensitive" } } },
          { customer: { lastName: { contains: term, mode: "insensitive" } } },
        ];
      }

      const [drafts, total] = await Promise.all([
        prisma.order.findMany({
          where,
          include: {
            items: true,
            shippingAddress: true,
            customer: { include: { proAccount: true, _count: { select: { orders: true } } } },
          },
          orderBy: { updatedAt: "desc" },
          skip,
          take: pageSize,
        }),
        prisma.order.count({ where }),
      ]);

      res.json({ drafts, total, page: pageNumber, pages: Math.ceil(total / pageSize) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur chargement brouillons" });
    }
  }
);

// POST /api/admin/orders/drafts — Créer un brouillon de commande
adminRouter.post(
  "/orders/drafts",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const items = normalizeDraftItems(req.body?.items);
      const requestedB2B = Boolean(req.body?.isB2B);
      const customerId = typeof req.body?.customerId === "string" && req.body.customerId ? req.body.customerId : null;
      const customer = customerId
        ? await prisma.customer.findUnique({ where: { id: customerId }, include: { proAccount: true } })
        : null;
      const email = asOptionalString(req.body?.email, customer?.email || "").toLowerCase();
      if (!email || !email.includes("@")) {
        res.status(400).json({ error: "Email client requis pour créer un brouillon" });
        return;
      }

      const shippingAddress = normalizeDraftAddress(req.body?.shippingAddress) || {
        firstName: customer?.firstName || "Client",
        lastName: customer?.lastName || "Barber Paradise",
        address: "Adresse à compléter",
        extension: "",
        city: "Ville à compléter",
        postalCode: "00000",
        country: normalizeCountry(req.body?.shippingAddress?.country),
        phone: "",
      };
      const isB2B = requestedB2B;
      const vatNumber = asOptionalString(req.body?.vatNumber, customer?.proAccount?.vatNumber || "").toUpperCase() || null;
      const totals = await calculateAdminDraftTotals({
        items,
        isB2B,
        country: shippingAddress.country,
        vatNumber,
        shippingOverride: req.body?.shipping,
        orderDiscountType: req.body?.orderDiscountType,
        orderDiscountValue: req.body?.orderDiscountValue,
        enforceProMinimum: false,
      });
      const paymentLater = Boolean(req.body?.paymentLater);

      const order = await prisma.order.create({
        data: {
          orderNumber: generateAdminDraftOrderNumber(),
          email,
          customerEmail: email,
          customerId,
          status: "draft",
          paymentMethod: paymentLater ? "b2b_deferred" : "card",
          paymentProvider: paymentLater ? "manual" : null,
          isB2B,
          subtotal: totals.subtotal,
          shipping: totals.shipping,
          total: totals.total,
          totalHT: totals.totalHT,
          vatRate: totals.vatRate,
          vatAmount: totals.vatAmount,
          totalTTC: totals.totalTTC,
          discountAmount: totals.discountTotal,
          orderDiscountType: totals.orderDiscountType,
          orderDiscountValue: totals.orderDiscountValue,
          discountTotal: totals.discountTotal,
          currency: CURRENCY,
          vatNumber,
          billingAddress: ((req.body?.billingAddress || shippingAddress) as Prisma.InputJsonValue),
          notes: asOptionalString(req.body?.notes),
          items: { create: totals.orderItems },
          shippingAddress: { create: shippingAddress },
        },
      });

      const draft = await serializeAdminDraft(order.id);
      res.status(201).json({ draft });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur création brouillon";
      res.status(400).json({ error: message });
    }
  }
);

// POST /api/admin/orders/drafts/:id/send — Envoyer un brouillon au client par email
adminRouter.post(
  "/orders/drafts/:id/send",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const draft = await prisma.order.findUnique({
        where: { id: req.params.id },
        include: { items: true, customer: true },
      });
      if (!draft || draft.status !== "draft") {
        res.status(404).json({ error: "Brouillon non trouvé" });
        return;
      }

      const { overrideEmail } = req.body as { overrideEmail?: string };
      const baseEmail = (draft.email || draft.customerEmail || draft.customer?.email || "").trim().toLowerCase();
      const email = (overrideEmail && overrideEmail.includes("@") ? overrideEmail.trim().toLowerCase() : null) || baseEmail;
      if (!email || !email.includes("@")) {
        res.status(400).json({ error: "Email client requis pour envoyer le brouillon" });
        return;
      }
      if (!draft.items.length) {
        res.status(400).json({ error: "Le brouillon doit contenir au moins un article" });
        return;
      }

      const now = new Date();
      const existingExpiresAt = draft.draftShareExpiresAt && draft.draftShareExpiresAt > now ? draft.draftShareExpiresAt : null;
      const expiresAt = existingExpiresAt || getDraftShareExpiresAt(now);
      const rawToken = createDraftShareRawToken(draft.id, expiresAt);
      const tokenHash = hashDraftShareToken(rawToken);
      const resumeUrl = `${getFrontendUrl()}/commande?draftToken=${encodeURIComponent(rawToken)}`;

      const updatedDraft = await prisma.order.update({
        where: { id: draft.id },
        data: {
          draftShareTokenHash: tokenHash,
          draftShareSentAt: now,
          draftShareExpiresAt: expiresAt,
          draftShareConvertedAt: null,
        },
        include: { items: true, customer: true },
      });

      const emailResult = await sendDraftOrderEmail({
        to: email,
        customerName: getCustomerName(updatedDraft.customer, email),
        orderNumber: updatedDraft.orderNumber,
        resumeUrl,
        expiresAt,
        items: updatedDraft.items.map((item) => ({ name: item.name, quantity: item.quantity, price: item.price })),
        total: updatedDraft.totalTTC || updatedDraft.total,
      });

      if (!emailResult.sent && !emailResult.skipped) {
        res.status(502).json({ error: "L’email n’a pas pu être envoyé" });
        return;
      }

      const serializedDraft = await serializeAdminDraft(updatedDraft.id);

      res.json({
        ok: true,
        draft: serializedDraft || updatedDraft,
        shareUrl: resumeUrl,
        sentAt: updatedDraft.draftShareSentAt,
        expiresAt: updatedDraft.draftShareExpiresAt,
        skippedEmail: Boolean(emailResult.skipped),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur envoi brouillon";
      res.status(400).json({ error: message });
    }
  }
);

// GET /api/admin/orders/drafts/:id — Détail d'un brouillon
adminRouter.get(
  "/orders/drafts/:id",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const draft = await serializeAdminDraft(req.params.id);
      if (!draft || draft.status !== "draft") {
        res.status(404).json({ error: "Brouillon non trouvé" });
        return;
      }
      res.json({ draft });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur chargement brouillon" });
    }
  }
);

// PATCH /api/admin/orders/drafts/:id — Modifier un brouillon
adminRouter.patch(
  "/orders/drafts/:id",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const current = await prisma.order.findUnique({ where: { id: req.params.id } });
      if (!current || current.status !== "draft") {
        res.status(404).json({ error: "Brouillon non trouvé" });
        return;
      }

      const items = normalizeDraftItems(req.body?.items);
      const customerId = typeof req.body?.customerId === "string" && req.body.customerId ? req.body.customerId : null;
      const customer = customerId
        ? await prisma.customer.findUnique({ where: { id: customerId }, include: { proAccount: true } })
        : null;
      const email = asOptionalString(req.body?.email, customer?.email || current.email).toLowerCase();
      const shippingAddress = normalizeDraftAddress(req.body?.shippingAddress);
      if (!shippingAddress) {
        res.status(400).json({ error: "Adresse de livraison incomplète" });
        return;
      }

      const isB2B = Boolean(req.body?.isB2B);
      const vatNumber = asOptionalString(req.body?.vatNumber, customer?.proAccount?.vatNumber || "").toUpperCase() || null;
      const totals = await calculateAdminDraftTotals({
        items,
        isB2B,
        country: shippingAddress.country,
        vatNumber,
        shippingOverride: req.body?.shipping,
        orderDiscountType: req.body?.orderDiscountType,
        orderDiscountValue: req.body?.orderDiscountValue,
        enforceProMinimum: false,
      });
      const paymentLater = Boolean(req.body?.paymentLater);

      await prisma.$transaction([
        prisma.orderItem.deleteMany({ where: { orderId: current.id } }),
        prisma.shippingAddress.deleteMany({ where: { orderId: current.id } }),
        prisma.order.update({
          where: { id: current.id },
          data: {
            email,
            customerEmail: email,
            customerId,
            paymentMethod: paymentLater ? "b2b_deferred" : "card",
            paymentProvider: paymentLater ? "manual" : null,
            isB2B,
            subtotal: totals.subtotal,
            shipping: totals.shipping,
            total: totals.total,
            totalHT: totals.totalHT,
            vatRate: totals.vatRate,
            vatAmount: totals.vatAmount,
            totalTTC: totals.totalTTC,
            discountAmount: totals.discountTotal,
            orderDiscountType: totals.orderDiscountType,
            orderDiscountValue: totals.orderDiscountValue,
            discountTotal: totals.discountTotal,
            vatNumber,
            billingAddress: ((req.body?.billingAddress || shippingAddress) as Prisma.InputJsonValue),
            notes: asOptionalString(req.body?.notes),
            items: { create: totals.orderItems },
            shippingAddress: { create: shippingAddress },
          },
        }),
      ]);

      const draft = await serializeAdminDraft(current.id);
      res.json({ draft });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur mise à jour brouillon";
      res.status(400).json({ error: message });
    }
  }
);

// POST /api/admin/orders/drafts/:id/confirm — Convertir un brouillon en commande réelle
adminRouter.post(
  "/orders/drafts/:id/confirm",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const draft = await prisma.order.findUnique({
        where: { id: req.params.id },
        include: { items: true, shippingAddress: true },
      });
      if (!draft || draft.status !== "draft") {
        res.status(404).json({ error: "Brouillon non trouvé" });
        return;
      }
      if (!draft.shippingAddress) {
        res.status(400).json({ error: "Adresse de livraison requise avant confirmation" });
        return;
      }
      if (draft.isB2B && draft.totalHT < PRO_MINIMUM_ORDER_HT) {
        res.status(400).json({ error: `Le minimum de commande professionnel est de ${PRO_MINIMUM_ORDER_HT} € HT` });
        return;
      }

      const paymentMethod = typeof req.body?.paymentMethod === "string" ? req.body.paymentMethod : draft.paymentMethod;
      const status = paymentMethod === "b2b_deferred" ? "pending_payment" : "pending";
      const order = await prisma.order.update({
        where: { id: draft.id },
        data: {
          status,
          paymentMethod,
          paymentProvider: paymentMethod === "b2b_deferred" ? "manual" : draft.paymentProvider,
        },
        include: { items: true, shippingAddress: true, customer: true },
      });

      res.json({ order });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur confirmation brouillon";
      res.status(400).json({ error: message });
    }
  }
);

// POST /api/admin/orders/abandoned-carts/:id/to-draft — Exporter un panier abandonné en brouillon
adminRouter.post(
  "/orders/abandoned-carts/:id/to-draft",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const cart = await prisma.abandonedCartSession.findUnique({ where: { id: req.params.id } });
      if (!cart || cart.convertedAt) {
        res.status(404).json({ error: "Panier abandonné non trouvé" });
        return;
      }
      const rawItems = Array.isArray(cart.items) ? cart.items : [];
      const items = normalizeDraftItems(
        rawItems.map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return null;
          const line = item as { productId?: unknown; id?: unknown; quantity?: unknown };
          return { productId: line.productId || line.id, quantity: line.quantity };
        }).filter(Boolean)
      );
      const email = (cart.email || asOptionalString(req.body?.email)).toLowerCase();
      if (!email || !email.includes("@")) {
        res.status(400).json({ error: "Ce panier ne contient pas d’email client exploitable" });
        return;
      }
      const customer = await prisma.customer.findUnique({ where: { email }, include: { proAccount: true, addresses: true } });
      const defaultAddress = customer?.addresses.find((address) => address.isDefault) || customer?.addresses[0];
      const shippingAddress = defaultAddress
        ? {
            firstName: defaultAddress.firstName,
            lastName: defaultAddress.lastName,
            address: defaultAddress.address,
            extension: defaultAddress.extension || "",
            city: defaultAddress.city,
            postalCode: defaultAddress.postalCode,
            country: normalizeCountry(defaultAddress.country),
            phone: customer?.phone || "",
          }
        : {
            firstName: customer?.firstName || "Client",
            lastName: customer?.lastName || "Barber Paradise",
            address: "Adresse à compléter",
            extension: "",
            city: "Ville à compléter",
            postalCode: "00000",
            country: "FR",
            phone: customer?.phone || "",
          };
      const isB2B = Boolean(req.body?.isB2B) && customer?.proAccount?.status === "approved";
      const vatNumber = customer?.proAccount?.vatNumber || null;
      const totals = await calculateAdminDraftTotals({
        items,
        isB2B,
        country: shippingAddress.country,
        vatNumber,
        shippingOverride: req.body?.shipping,
        orderDiscountType: req.body?.orderDiscountType,
        orderDiscountValue: req.body?.orderDiscountValue,
        enforceProMinimum: false,
      });

      const order = await prisma.order.create({
        data: {
          orderNumber: generateAdminDraftOrderNumber(),
          email,
          customerEmail: email,
          customerId: customer?.id || null,
          status: "draft",
          paymentMethod: "card",
          paymentProvider: null,
          isB2B,
          subtotal: totals.subtotal,
          shipping: totals.shipping,
          total: totals.total,
          totalHT: totals.totalHT,
          vatRate: totals.vatRate,
          vatAmount: totals.vatAmount,
          totalTTC: totals.totalTTC,
          discountAmount: totals.discountTotal,
          orderDiscountType: totals.orderDiscountType,
          orderDiscountValue: totals.orderDiscountValue,
          discountTotal: totals.discountTotal,
          currency: CURRENCY,
          vatNumber,
          billingAddress: shippingAddress as Prisma.InputJsonValue,
          notes: `Brouillon créé depuis le panier abandonné ${cart.id}`,
          items: { create: totals.orderItems },
          shippingAddress: { create: shippingAddress },
        },
      });

      await prisma.abandonedCartSession.update({
        where: { id: cart.id },
        data: { convertedOrderId: order.id, convertedAt: new Date() },
      });
      const draft = await serializeAdminDraft(order.id);
      res.status(201).json({ draft });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur export panier abandonné";
      res.status(400).json({ error: message });
    }
  }
);

// GET /api/admin/orders/invoices — Liste des factures B2C et B2B
adminRouter.get(
  "/orders/invoices",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { page = "1", limit = "20", search, type } = req.query as Record<string, string>;
      const take = Math.min(Math.max(Number(limit) || 20, 1), 100);
      const currentPage = Math.max(Number(page) || 1, 1);
      const skip = (currentPage - 1) * take;
      const trimmedSearch = search?.trim();
      const normalizedType = type === "B2B" || type === "B2C" ? type : "";

      const where: any = {
        OR: [
          { invoiceNumber: { not: null }, invoiceUrl: { not: null } },
          { proInvoiceNumber: { not: null }, proInvoiceUrl: { not: null } },
        ],
      };

      if (normalizedType === "B2C") {
        where.invoiceNumber = { not: null };
        where.invoiceUrl = { not: null };
        where.isB2B = false;
        delete where.OR;
      } else if (normalizedType === "B2B") {
        where.proInvoiceNumber = { not: null };
        where.proInvoiceUrl = { not: null };
        where.isB2B = true;
        delete where.OR;
      }

      if (trimmedSearch) {
        const searchFilters = [
          { orderNumber: { contains: trimmedSearch, mode: "insensitive" as const } },
          { email: { contains: trimmedSearch, mode: "insensitive" as const } },
          { customerEmail: { contains: trimmedSearch, mode: "insensitive" as const } },
          { invoiceNumber: { contains: trimmedSearch, mode: "insensitive" as const } },
          { proInvoiceNumber: { contains: trimmedSearch, mode: "insensitive" as const } },
          { customer: { firstName: { contains: trimmedSearch, mode: "insensitive" as const } } },
          { customer: { lastName: { contains: trimmedSearch, mode: "insensitive" as const } } },
        ];
        where.AND = [{ OR: where.OR || [{ invoiceNumber: { not: null }, invoiceUrl: { not: null } }, { proInvoiceNumber: { not: null }, proInvoiceUrl: { not: null } }] }, { OR: searchFilters }];
        if (normalizedType) where.AND = [{ OR: searchFilters }];
      }

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          include: { customer: true, shippingAddress: true },
          orderBy: { updatedAt: "desc" },
          skip,
          take,
        }),
        prisma.order.count({ where }),
      ]);

      res.json({
        invoices: orders.map((order) => {
          const isProInvoice = Boolean(order.isB2B && order.proInvoiceNumber && order.proInvoiceUrl);
          return {
            id: order.id,
            orderNumber: order.orderNumber,
            type: isProInvoice ? "B2B" : "B2C",
            invoiceNumber: isProInvoice ? order.proInvoiceNumber : order.invoiceNumber,
            invoiceUrl: isProInvoice ? order.proInvoiceUrl : order.invoiceUrl,
            customerName: [order.customer?.firstName || order.shippingAddress?.firstName, order.customer?.lastName || order.shippingAddress?.lastName].filter(Boolean).join(" ") || "Client invité",
            customerEmail: order.customer?.email || order.customerEmail || order.email,
            totalHT: order.totalHT,
            vatAmount: order.vatAmount,
            totalTTC: order.totalTTC || order.total,
            currency: order.currency,
            issuedAt: order.updatedAt,
            createdAt: order.createdAt,
          };
        }),
        total,
        page: currentPage,
        pages: Math.max(1, Math.ceil(total / take)),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur récupération factures admin" });
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
        include: {
          items: true,
          shippingAddress: true,
          shipment: true,
          customer: {
            include: { _count: { select: { orders: true } } },
          },
        },
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

// PATCH /api/admin/orders/:id — Modifier une commande
adminRouter.patch(
  "/orders/:id",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const current = await prisma.order.findUnique({
        where: { id: req.params.id },
        include: { items: true, shippingAddress: true, customer: true },
      });
      if (!current) {
        res.status(404).json({ error: "Commande non trouvée" });
        return;
      }

      const items = normalizeDraftItems(req.body?.items);
      const customerId = typeof req.body?.customerId === "string" && req.body.customerId ? req.body.customerId : null;
      const customer = customerId
        ? await prisma.customer.findUnique({ where: { id: customerId }, include: { proAccount: true } })
        : null;
      const email = asOptionalString(req.body?.email, customer?.email || current.email).toLowerCase();
      if (!email || !email.includes("@")) {
        res.status(400).json({ error: "Email client invalide" });
        return;
      }

      const shippingAddress = normalizeDraftAddress(req.body?.shippingAddress);
      if (!shippingAddress) {
        res.status(400).json({ error: "Adresse de livraison incomplète" });
        return;
      }

      const isB2B = Boolean(req.body?.isB2B);
      const vatNumber = asOptionalString(req.body?.vatNumber, customer?.proAccount?.vatNumber || current.vatNumber || "").toUpperCase() || null;
      const totals = await calculateAdminDraftTotals({
        items,
        isB2B,
        country: shippingAddress.country,
        vatNumber,
        shippingOverride: req.body?.shipping,
        orderDiscountType: req.body?.orderDiscountType,
        orderDiscountValue: req.body?.orderDiscountValue,
        enforceProMinimum: false,
        allowInactiveProducts: true,
      });

      const allowedStatuses = new Set([
        "draft",
        "pending",
        "pending_payment",
        "paid",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ]);
      const requestedStatus = typeof req.body?.status === "string" ? req.body.status : current.status;
      const status = allowedStatuses.has(requestedStatus) ? requestedStatus : current.status;
      const paymentMethod = typeof req.body?.paymentMethod === "string" ? req.body.paymentMethod.trim() : current.paymentMethod;
      const paymentProvider = typeof req.body?.paymentProvider === "string" ? req.body.paymentProvider.trim() : current.paymentProvider;

      await prisma.$transaction([
        prisma.orderItem.deleteMany({ where: { orderId: current.id } }),
        prisma.shippingAddress.deleteMany({ where: { orderId: current.id } }),
        prisma.order.update({
          where: { id: current.id },
          data: {
            email,
            customerEmail: email,
            customerId,
            status,
            paymentMethod: paymentMethod || null,
            paymentProvider: paymentProvider || null,
            isB2B,
            subtotal: totals.subtotal,
            shipping: totals.shipping,
            total: totals.total,
            totalHT: totals.totalHT,
            vatRate: totals.vatRate,
            vatAmount: totals.vatAmount,
            totalTTC: totals.totalTTC,
            discountAmount: totals.discountTotal,
            orderDiscountType: totals.orderDiscountType,
            orderDiscountValue: totals.orderDiscountValue,
            discountTotal: totals.discountTotal,
            vatNumber,
            billingAddress: ((req.body?.billingAddress || shippingAddress) as Prisma.InputJsonValue),
            notes: asOptionalString(req.body?.notes, current.notes || ""),
            items: { create: totals.orderItems },
            shippingAddress: { create: shippingAddress },
          },
        }),
      ]);

      // Réintégration du stock si la commande passe en annulée via la modification complète
      const stockDecrementedStatuses = new Set(["paid", "processing", "shipped", "delivered"]);
      if (status === "cancelled" && stockDecrementedStatuses.has(current.status)) {
        await restoreOrderStock(current.id);
      }

      const order = await prisma.order.findUnique({
        where: { id: current.id },
        include: {
          items: true,
          shippingAddress: true,
          shipment: true,
          customer: { include: { _count: { select: { orders: true } } } },
        },
      });
      res.json(order);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur modification commande";
      res.status(400).json({ error: message });
    }
  }
);

// DELETE /api/admin/orders/:id — Supprimer une commande
adminRouter.delete(
  "/orders/:id",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const order = await prisma.order.findUnique({ where: { id: req.params.id } });
      if (!order) {
        res.status(404).json({ error: "Commande non trouvée" });
        return;
      }

      // Réintégrer le stock avant suppression, uniquement si la commande était dans un statut
      // où le stock avait été décrémenté (paid, processing, shipped, delivered).
      // Si la commande était déjà annulée ou en attente, le stock n'avait pas été touché.
      const stockDecrementedStatuses = new Set(["paid", "processing", "shipped", "delivered"]);
      if (stockDecrementedStatuses.has(order.status)) {
        await restoreOrderStock(order.id);
      }

      await prisma.order.delete({ where: { id: order.id } });
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur suppression commande" });
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

      // Réintégration du stock si la commande passe en annulée
      // Condition : le statut précédent était un statut "actif" (stock décrémenté)
      const stockDecrementedStatuses = new Set(["paid", "processing", "shipped", "delivered"]);
      if (status === "cancelled" && stockDecrementedStatuses.has(previousOrder?.status || "")) {
        await restoreOrderStock(order.id);
      }

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

// POST /api/admin/customers — Création manuelle d'un client B2C ou B2B depuis l'admin
adminRouter.post(
  "/customers",
  requireAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const normalizeString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
      const normalizeOptionalString = (value: unknown): string | null => {
        const normalized = normalizeString(value);
        return normalized || null;
      };
      const normalizeEmail = (value: unknown): string => normalizeString(value).toLowerCase();
      const normalizeVatNumber = (value: unknown): string | null => normalizeOptionalString(value)?.toUpperCase() || null;

      const email = normalizeEmail(req.body?.email);
      const firstName = normalizeString(req.body?.firstName);
      const lastName = normalizeString(req.body?.lastName);
      const phone = normalizeOptionalString(req.body?.phone);
      const accountType = normalizeString(req.body?.accountType).toLowerCase() === "b2b" ? "b2b" : "b2c";
      const sendInvitation = req.body?.sendInvitation !== false;

      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        res.status(400).json({ error: "Email client invalide" });
        return;
      }

      const existing = await prisma.customer.findUnique({ where: { email }, select: { id: true } });
      if (existing) {
        res.status(409).json({ error: "Un client existe déjà avec cet email" });
        return;
      }

      const companyName = normalizeOptionalString(req.body?.companyName);
      const activity = normalizeOptionalString(req.body?.activity);
      const proPhone = normalizeOptionalString(req.body?.proPhone) || phone;
      const siret = normalizeOptionalString(req.body?.siret);
      const vatNumber = normalizeVatNumber(req.body?.vatNumber);

      const shouldCreateProAccount = accountType === "b2b" && Boolean(companyName && activity && proPhone);

      const temporaryPasswordHash = await bcrypt.hash(crypto.randomBytes(24).toString("base64url"), 12);
      const now = new Date();
      const adminIdentity = req.user?.email || req.user?.id || "admin";

      const customer = await prisma.customer.create({
        data: {
          email,
          password: temporaryPasswordHash,
          firstName,
          lastName,
          phone,
          mustResetPassword: true,
          acceptsEmailMarketing: Boolean(req.body?.acceptsEmailMarketing),
          ...(shouldCreateProAccount
            ? {
                proAccount: {
                  create: {
                    companyName: companyName!,
                    activity: activity!,
                    phone: proPhone!,
                    siret,
                    vatNumber,
                    status: "approved",
                    rejectionReason: null,
                    approvedAt: now,
                    approvedBy: adminIdentity,
                  },
                },
              }
            : {}),
        },
        include: {
          orders: { select: { total: true } },
          proAccount: { select: { id: true, companyName: true, status: true, activity: true, phone: true, siret: true, vatNumber: true, approvedAt: true } },
          _count: { select: { orders: true } },
        },
      });

      let invitation: { sent: boolean; skipped?: boolean; id?: string; provider?: string } | null = null;
      if (sendInvitation) {
        const rawToken = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_MINUTES * 60 * 1000);
        await prisma.passwordResetToken.create({
          data: {
            customerId: customer.id,
            tokenHash: hashPasswordResetToken(rawToken),
            expiresAt,
          },
        });

        invitation = await sendPasswordResetEmail({
          to: customer.email,
          customerName: getCustomerName(customer, customer.email),
          resetUrl: `${getFrontendUrl()}/reinitialiser-mot-de-passe?token=${rawToken}`,
          expiresInMinutes: PASSWORD_RESET_TOKEN_MINUTES,
        });
      }

      const { orders, password: _password, ...safeCustomer } = customer as typeof customer & { password?: string };
      res.status(201).json({
        customer: {
          ...safeCustomer,
          totalSpent: orders.reduce((sum, order) => sum + order.total, 0),
        },
        invitation,
      });
    } catch (err) {
      console.error("[admin] Erreur création client", err);
      res.status(500).json({ error: "Erreur création client" });
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
      const searchTerms = String(search || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = searchTerms.length
        ? {
            AND: searchTerms.map((term) => ({
              OR: [
                { email: { contains: term, mode: "insensitive" } },
                { firstName: { contains: term, mode: "insensitive" } },
                { lastName: { contains: term, mode: "insensitive" } },
                { phone: { contains: term, mode: "insensitive" } },
                { proAccount: { is: { companyName: { contains: term, mode: "insensitive" } } } },
                { proAccount: { is: { phone: { contains: term, mode: "insensitive" } } } },
              ],
            })),
          }
        : {};
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
            orders: { select: { total: true } },
            proAccount: {
              select: { id: true, companyName: true, status: true, activity: true, phone: true, siret: true, vatNumber: true, approvedAt: true },
            },
            _count: { select: { orders: true } },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: parseInt(limit),
        }),
        prisma.customer.count({ where }),
      ]);
      const formattedCustomers = customers.map(({ orders, ...customer }) => ({
        ...customer,
        totalSpent: orders.reduce((sum, order) => sum + order.total, 0),
      }));

      res.json({
        customers: formattedCustomers,
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
          proAccount: { select: { id: true, companyName: true, status: true, activity: true, phone: true, siret: true, vatNumber: true, approvedAt: true, approvedBy: true, rejectionReason: true } },
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


// PATCH /api/admin/customers/:id/pro-account — activation ou suspension manuelle du statut B2B d'un client
adminRouter.patch(
  "/customers/:id/pro-account",
  requireAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: req.params.id },
        include: { proAccount: true },
      });
      if (!customer) {
        res.status(404).json({ error: "Client non trouvé" });
        return;
      }

      const enabled = Boolean(req.body?.enabled);
      const normalize = (value: unknown): string | null => {
        if (typeof value !== "string") return null;
        const trimmed = value.trim();
        return trimmed || null;
      };
      const normalizeVat = (value: unknown): string | null => normalize(value)?.toUpperCase() || null;

      if (enabled) {
        const companyName = normalize(req.body?.companyName) || `${customer.firstName} ${customer.lastName}`.trim() || customer.email;
        const activity = normalize(req.body?.activity) || customer.proAccount?.activity || "Professionnel de la coiffure / barber";
        const phone = normalize(req.body?.phone) || customer.phone || customer.proAccount?.phone || "Non renseigné";
        const siret = normalize(req.body?.siret) || null;
        const vatNumber = normalizeVat(req.body?.vatNumber) || null;

        await prisma.proAccount.upsert({
          where: { customerId: customer.id },
          create: {
            customerId: customer.id,
            companyName,
            activity,
            phone,
            siret,
            vatNumber,
            status: "approved",
            approvedAt: new Date(),
            approvedBy: req.user?.email || req.user?.id || "admin",
          },
          update: {
            companyName,
            activity,
            phone,
            siret,
            vatNumber,
            status: "approved",
            rejectionReason: null,
            approvedAt: new Date(),
            approvedBy: req.user?.email || req.user?.id || "admin",
          },
        });
      } else if (customer.proAccount) {
        await prisma.proAccount.update({
          where: { customerId: customer.id },
          data: {
            status: "suspended",
            rejectionReason: "Statut B2B désactivé manuellement depuis l'administration.",
            approvedAt: null,
            approvedBy: null,
          },
        });
      }

      const updated = await prisma.customer.findUnique({
        where: { id: customer.id },
        include: {
          orders: { include: { items: true, shippingAddress: true }, orderBy: { createdAt: "desc" } },
          addresses: true,
          proAccount: { select: { id: true, companyName: true, status: true, activity: true, phone: true, siret: true, vatNumber: true, approvedAt: true, approvedBy: true, rejectionReason: true } },
          _count: { select: { orders: true, wishlist: true } },
        },
      });

      const { password: _, ...safeCustomer } = updated!;
      res.json(safeCustomer);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur mise à jour du statut B2B" });
    }
  }
);

// ─── Emails secondaires client ──────────────────────────────────────────────

// GET /api/admin/customers/:id/emails — Liste des emails secondaires d'un client
adminRouter.get(
  "/customers/:id/emails",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const emails = await prisma.customerEmail.findMany({
        where: { customerId: req.params.id },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      });
      res.json(emails);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
);

// POST /api/admin/customers/:id/emails — Ajouter un email secondaire
adminRouter.post(
  "/customers/:id/emails",
  requireAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { email, label, isPrimary } = req.body as { email: string; label?: string; isPrimary?: boolean };
      if (!email || !email.includes("@")) {
        res.status(400).json({ error: "Adresse email invalide" });
        return;
      }
      // Vérifier que le client existe
      const customer = await prisma.customer.findUnique({ where: { id: req.params.id }, select: { id: true } });
      if (!customer) {
        res.status(404).json({ error: "Client non trouvé" });
        return;
      }
      // Si isPrimary, retirer le flag des autres
      if (isPrimary) {
        await prisma.customerEmail.updateMany({
          where: { customerId: req.params.id },
          data: { isPrimary: false },
        });
      }
      const created = await prisma.customerEmail.create({
        data: {
          customerId: req.params.id,
          email: email.trim().toLowerCase(),
          label: label?.trim() || "Secondaire",
          isPrimary: Boolean(isPrimary),
        },
      });
      console.log(`[admin][customer-email] Ajout email ${created.email} (${created.label}) pour client ${req.params.id} par ${req.user?.email || "admin"}`);
      res.status(201).json(created);
    } catch (err: any) {
      if (err?.code === "P2002") {
        res.status(409).json({ error: "Cette adresse email est déjà enregistrée pour ce client" });
        return;
      }
      console.error(err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
);

// PATCH /api/admin/customers/:id/emails/:emailId — Modifier label ou isPrimary
adminRouter.patch(
  "/customers/:id/emails/:emailId",
  requireAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { label, isPrimary } = req.body as { label?: string; isPrimary?: boolean };
      // Si on définit comme primaire, retirer le flag des autres
      if (isPrimary) {
        await prisma.customerEmail.updateMany({
          where: { customerId: req.params.id },
          data: { isPrimary: false },
        });
      }
      const updated = await prisma.customerEmail.update({
        where: { id: req.params.emailId },
        data: {
          ...(label !== undefined ? { label: label.trim() } : {}),
          ...(isPrimary !== undefined ? { isPrimary: Boolean(isPrimary) } : {}),
        },
      });
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
);

// DELETE /api/admin/customers/:id/emails/:emailId — Supprimer un email secondaire
adminRouter.delete(
  "/customers/:id/emails/:emailId",
  requireAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      await prisma.customerEmail.delete({ where: { id: req.params.emailId } });
      res.json({ success: true });
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
        purchasePrice,
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
          purchasePrice: purchasePrice != null && purchasePrice !== "" ? parseFloat(purchasePrice) : null,
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
        purchasePrice,
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
          purchasePrice: purchasePrice != null && purchasePrice !== "" ? parseFloat(purchasePrice) : null,
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

// POST /api/admin/orders/:id/resend-confirmation — Renvoyer l'email de confirmation au client
adminRouter.post(
  "/orders/:id/resend-confirmation",
  requireAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const order = await prisma.order.findUnique({
        where: { id: req.params.id },
        include: { items: true, shippingAddress: true, customer: true },
      });

      if (!order) {
        res.status(404).json({ error: "Commande introuvable" });
        return;
      }

      const { overrideEmail: overrideEmailConf } = req.body as { overrideEmail?: string };
      const baseEmailConf = order.email || order.customerEmail || order.customer?.email || "";
      const emailTo = (overrideEmailConf && overrideEmailConf.includes("@") ? overrideEmailConf.trim() : null) || baseEmailConf;
      if (!emailTo) {
        res.status(400).json({ error: "Aucune adresse email pour cette commande" });
        return;
      }

      // Récupérer la facture existante sans en créer une nouvelle si elle existe déjà
      let invoiceAttachment: { filename: string; content: string } | undefined;
      try {
        const invoice = await ensureB2CInvoiceForOrder(order.id);
        if (invoice) {
          const pdfBuffer = invoice.pdfBuffer ?? await generateB2CInvoicePdfBuffer(order.id, invoice.invoiceNumber);
          if (pdfBuffer) {
            invoiceAttachment = {
              filename: `${invoice.invoiceNumber}.pdf`,
              content: pdfBuffer.toString("base64"),
            };
          }
        }
      } catch (invoiceErr) {
        console.warn(`[email][admin-resend] Impossible de récupérer la facture pour ${order.orderNumber}:`, invoiceErr instanceof Error ? invoiceErr.message : invoiceErr);
        // Continuer sans pièce jointe
      }

      console.log(`[email][admin-resend] Renvoi confirmation ${order.orderNumber} → ${emailTo} (pièce jointe: ${invoiceAttachment ? invoiceAttachment.filename : "aucune"}) par ${req.user?.email || "admin"}`);

      const result = await sendOrderConfirmationEmail({
        to: emailTo,
        orderNumber: order.orderNumber,
        customerName: getCustomerName(order.customer, emailTo),
        items: order.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          image: item.image,
        })),
        totalHT: order.totalHT || order.subtotal,
        vatAmount: order.vatAmount,
        vatRate: order.vatRate,
        vatNumber: order.vatNumber,
        isB2B: order.isB2B,
        totalTTC: order.total,
        shippingCost: order.shipping,
        shippingAddress: order.shippingAddress,
        paymentMethod: formatPaymentMethod(order.paymentMethod),
        attachments: invoiceAttachment ? [invoiceAttachment] : undefined,
      });

      console.log(`[email][admin-resend] Résultat renvoi confirmation ${order.orderNumber}: sent=${result.sent} provider=${result.provider || "?"} id=${result.id || "?"}`);

      if (!result.sent) {
        res.status(500).json({ error: "L'email n'a pas pu être envoyé. Vérifiez la configuration Resend." });
        return;
      }

      res.json({ success: true, message: `Email de confirmation renvoyé à ${emailTo}`, provider: result.provider, id: result.id });
    } catch (err) {
      console.error(`[email][admin-resend] Erreur renvoi confirmation:`, err);
      res.status(500).json({ error: err instanceof Error ? err.message : "Erreur renvoi email de confirmation" });
    }
  }
);

// POST /api/admin/orders/:id/resend-tracking — Renvoyer l'email de suivi d'expédition au client
adminRouter.post(
  "/orders/:id/resend-tracking",
  requireAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const order = await prisma.order.findUnique({
        where: { id: req.params.id },
        include: { customer: true, shipment: true },
      });

      if (!order) {
        res.status(404).json({ error: "Commande introuvable" });
        return;
      }

      const { overrideEmail: overrideEmailTracking } = req.body as { overrideEmail?: string };
      const baseEmailTracking = order.email || order.customerEmail || order.customer?.email || "";
      const emailTo = (overrideEmailTracking && overrideEmailTracking.includes("@") ? overrideEmailTracking.trim() : null) || baseEmailTracking;
      if (!emailTo) {
        res.status(400).json({ error: "Aucune adresse email pour cette commande" });
        return;
      }

      const shipment = order.shipment as { trackingNumber?: string | null; trackingUrl?: string | null; carrier?: string | null } | null;
      if (!shipment?.trackingNumber) {
        res.status(400).json({ error: "Aucun numéro de suivi enregistré pour cette commande" });
        return;
      }

      const carrierLabel = LOGISTICS_CARRIERS[shipment.carrier as keyof typeof LOGISTICS_CARRIERS] || shipment.carrier || "Transporteur";

      console.log(`[email][admin-resend] Renvoi suivi ${order.orderNumber} → ${emailTo} tracking=${shipment.trackingNumber} par ${req.user?.email || "admin"}`);

      const result = await sendOrderShippedEmail({
        to: emailTo,
        orderNumber: order.orderNumber,
        customerName: getCustomerName(order.customer, emailTo),
        carrier: carrierLabel,
        trackingNumber: shipment.trackingNumber,
        trackingUrl: shipment.trackingUrl || `https://www.laposte.fr/outils/suivre-vos-envois?code=${encodeURIComponent(shipment.trackingNumber)}`,
      });

      console.log(`[email][admin-resend] Résultat renvoi suivi ${order.orderNumber}: sent=${result.sent} provider=${result.provider || "?"} id=${result.id || "?"}`);

      if (!result.sent) {
        res.status(500).json({ error: "L'email n'a pas pu être envoyé. Vérifiez la configuration Resend." });
        return;
      }

      res.json({ success: true, message: `Email de suivi renvoyé à ${emailTo}`, trackingNumber: shipment.trackingNumber, provider: result.provider, id: result.id });
    } catch (err) {
      console.error(`[email][admin-resend] Erreur renvoi suivi:`, err);
      res.status(500).json({ error: err instanceof Error ? err.message : "Erreur renvoi email de suivi" });
    }
  }
);

// POST /api/admin/orders/:id/duplicate — Dupliquer une commande en brouillon
adminRouter.post(
  "/orders/:id/duplicate",
  requireAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const source = await prisma.order.findUnique({
        where: { id: req.params.id },
        include: { items: true, shippingAddress: true, customer: true },
      });

      if (!source) {
        res.status(404).json({ error: "Commande introuvable" });
        return;
      }

      const email = (
        source.email ||
        source.customerEmail ||
        source.customer?.email ||
        ""
      ).toLowerCase();

      if (!email || !email.includes("@")) {
        res.status(400).json({ error: "Impossible de dupliquer : aucune adresse email sur la commande source" });
        return;
      }

      // Construire les items normalisés pour recalcul des totaux
      const normalizedItems: NormalizedDraftItem[] = source.items
        .filter((item) => item.productId)
        .map((item) => ({
          productId: item.productId!,
          variantId: item.variantId || null,
          quantity: item.quantity,
          lineDiscountType: (item.lineDiscountType as NormalizedDraftItem["lineDiscountType"]) || null,
          lineDiscountValue: item.lineDiscountValue ?? 0,
        }));

      if (normalizedItems.length === 0) {
        res.status(400).json({ error: "La commande source ne contient aucun article duplicable" });
        return;
      }

      const country = (source.shippingAddress?.country as string) || "FR";
      const isB2B = Boolean(source.isB2B);
      const vatNumber = source.vatNumber || null;

      // Recalcul des totaux avec les prix actuels (les prix peuvent avoir changé)
      const totals = await calculateAdminDraftTotals({
        items: normalizedItems,
        isB2B,
        country,
        vatNumber,
        shippingOverride: source.shipping,
        orderDiscountType: source.orderDiscountType,
        orderDiscountValue: source.orderDiscountValue,
        enforceProMinimum: false,
        allowInactiveProducts: true,
      });

      const shippingAddress = source.shippingAddress
        ? {
            firstName: source.shippingAddress.firstName,
            lastName: source.shippingAddress.lastName,
            address: source.shippingAddress.address,
            extension: source.shippingAddress.extension || "",
            city: source.shippingAddress.city,
            postalCode: source.shippingAddress.postalCode,
            country: source.shippingAddress.country,
            phone: source.shippingAddress.phone || "",
          }
        : {
            firstName: source.customer?.firstName || "Client",
            lastName: source.customer?.lastName || "Barber Paradise",
            address: "Adresse à compléter",
            extension: "",
            city: "Ville à compléter",
            postalCode: "00000",
            country,
            phone: "",
          };

      const duplicate = await prisma.order.create({
        data: {
          orderNumber: generateAdminDraftOrderNumber(),
          email,
          customerEmail: email,
          customerId: source.customerId || null,
          status: "draft",
          paymentMethod: isB2B ? "paybybank" : "card",
          paymentProvider: null,
          isB2B,
          subtotal: totals.subtotal,
          shipping: totals.shipping,
          total: totals.total,
          totalHT: totals.totalHT,
          vatRate: totals.vatRate,
          vatAmount: totals.vatAmount,
          totalTTC: totals.totalTTC,
          discountAmount: totals.discountTotal,
          orderDiscountType: totals.orderDiscountType,
          orderDiscountValue: totals.orderDiscountValue,
          discountTotal: totals.discountTotal,
          currency: source.currency || CURRENCY,
          vatNumber,
          billingAddress: (source.billingAddress || shippingAddress) as Prisma.InputJsonValue,
          notes: source.notes ? `Dupliquée depuis ${source.orderNumber}` : null,
          items: { create: totals.orderItems },
          shippingAddress: { create: shippingAddress },
        },
      });

      console.log(
        `[admin] Commande dupliquée : source=${source.orderNumber} → brouillon=${duplicate.orderNumber} par ${req.user?.email || "admin"}`
      );

      const draft = await serializeAdminDraft(duplicate.id);
      res.status(201).json({ draft, message: `Brouillon créé depuis ${source.orderNumber}` });
    } catch (err) {
      console.error(`[admin] Erreur duplication commande ${req.params.id}:`, err);
      res.status(400).json({ error: err instanceof Error ? err.message : "Erreur lors de la duplication" });
    }
  }
);

// POST /api/admin/orders/:id/generate-invoice — Génère ou régénère la facture d'une commande
adminRouter.post(
  "/orders/:id/generate-invoice",
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const force = req.body?.force === true; // force=true pour régénérer même si facture existante

      const order = await prisma.order.findUnique({
        where: { id },
        select: { id: true, orderNumber: true, isB2B: true, status: true, invoiceNumber: true, invoiceUrl: true, proInvoiceNumber: true, proInvoiceUrl: true },
      });

      if (!order) {
        res.status(404).json({ error: "Commande introuvable" });
        return;
      }

      // Si force=true, effacer TOUTES les références existantes (B2C et B2B)
      // Nécessaire quand la commande a changé de type (ex. POS B2C → B2B via toggle)
      if (force) {
        await prisma.order.update({
          where: { id },
          data: { invoiceNumber: null, invoiceUrl: null, proInvoiceNumber: null, proInvoiceUrl: null },
        });
        console.log(`[admin][generate-invoice] Régénération forcée (reset complet) — ${order.orderNumber} (${order.isB2B ? "B2B" : "B2C"}) par ${req.user?.email || "admin"}`);
      }

      let invoiceNumber: string | null = null;
      let invoiceUrl: string | null = null;

      if (order.isB2B) {
        const result = await ensureProInvoiceForOrder(id, { sendInvoiceEmail: false });
        if (!result) {
          res.status(400).json({ error: "Impossible de générer la facture B2B" });
          return;
        }
        invoiceNumber = result.invoiceNumber;
        invoiceUrl = result.invoiceUrl;
      } else {
        const result = await ensureB2CInvoiceForOrder(id);
        if (!result) {
          res.status(400).json({ error: "Impossible de générer la facture B2C" });
          return;
        }
        invoiceNumber = result.invoiceNumber;
        invoiceUrl = result.invoiceUrl;
      }

      console.log(`[admin][generate-invoice] Facture générée — ${order.orderNumber} → ${invoiceNumber} par ${req.user?.email || "admin"}`);
      res.json({ invoiceNumber, invoiceUrl, isB2B: order.isB2B });
    } catch (err) {
      console.error(`[admin][generate-invoice] Erreur pour ${req.params.id}:`, err);
      res.status(500).json({ error: err instanceof Error ? err.message : "Erreur lors de la génération de la facture" });
    }
  }
);

// POST /api/admin/orders/:id/send-invoice — Envoyer la facture existante au client par email
adminRouter.post(
  "/orders/:id/send-invoice",
  requireAdmin,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const order = await prisma.order.findUnique({
        where: { id },
        select: {
          id: true,
          orderNumber: true,
          isB2B: true,
          email: true,
          customerEmail: true,
          invoiceNumber: true,
          invoiceUrl: true,
          proInvoiceNumber: true,
          proInvoiceUrl: true,
          customer: { select: { email: true, firstName: true, lastName: true } },
        },
      });

      if (!order) {
        res.status(404).json({ error: "Commande introuvable" });
        return;
      }

      // Permettre de surcharger l'adresse destinataire depuis le frontend (email secondaire choisi)
      const { overrideEmail } = req.body as { overrideEmail?: string };
      const emailTo = (overrideEmail && overrideEmail.includes("@") ? overrideEmail.trim() : null)
        || order.email || order.customerEmail || order.customer?.email || "";
      if (!emailTo) {
        res.status(400).json({ error: "Aucune adresse email pour cette commande" });
        return;
      }

      if (order.isB2B) {
        // Facture pro
        if (!order.proInvoiceNumber || !order.proInvoiceUrl) {
          res.status(400).json({ error: "Aucune facture pro générée pour cette commande. Générez-la d'abord." });
          return;
        }
        // Régénérer le PDF en mémoire pour la pièce jointe
        const fullOrder = await prisma.order.findUnique({
          where: { id },
          include: {
            items: true,
            shippingAddress: true,
            customer: { include: { proAccount: true, addresses: true } },
          },
        });
        if (!fullOrder) {
          res.status(404).json({ error: "Commande introuvable" });
          return;
        }
        // Utiliser ensureProInvoiceForOrder avec sendInvoiceEmail=true pour envoyer l'email
        // Comme la facture existe déjà, on doit envoyer manuellement
        const customerName = order.customer
          ? `${order.customer.firstName || ""} ${order.customer.lastName || ""}`.trim() || emailTo
          : emailTo;
        await sendEmail({
          to: emailTo,
          subject: `Facture ${order.proInvoiceNumber} — Barber Paradise Pro`,
          html: `<p>Bonjour ${customerName},</p><p>Veuillez trouver ci-joint votre facture professionnelle <strong>${order.proInvoiceNumber}</strong> pour la commande <strong>${order.orderNumber}</strong>.</p><p>Vous pouvez également la télécharger directement : <a href="${order.proInvoiceUrl}">${order.proInvoiceUrl}</a>.</p><p>Cordialement,<br/>L'équipe Barber Paradise</p>`,
          attachments: [
            {
              filename: `${order.proInvoiceNumber}.pdf`,
              content: await fetch(order.proInvoiceUrl).then((r) => r.arrayBuffer()).then((b) => Buffer.from(b).toString("base64")),
            },
          ],
        });
        console.log(`[admin][send-invoice] Facture pro ${order.proInvoiceNumber} envoyée à ${emailTo} pour ${order.orderNumber} par ${req.user?.email || "admin"}`);
        res.json({ success: true, message: `Facture ${order.proInvoiceNumber} envoyée à ${emailTo}` });
      } else {
        // Facture B2C
        if (!order.invoiceNumber || !order.invoiceUrl) {
          res.status(400).json({ error: "Aucune facture générée pour cette commande. Générez-la d'abord." });
          return;
        }
        const customerName = order.customer
          ? `${order.customer.firstName || ""} ${order.customer.lastName || ""}`.trim() || emailTo
          : emailTo;
        await sendEmail({
          to: emailTo,
          subject: `Votre facture ${order.invoiceNumber} — Barber Paradise`,
          html: `<p>Bonjour ${customerName},</p><p>Veuillez trouver ci-joint votre facture <strong>${order.invoiceNumber}</strong> pour la commande <strong>${order.orderNumber}</strong>.</p><p>Vous pouvez également la télécharger depuis votre espace client : <a href="${order.invoiceUrl}">${order.invoiceUrl}</a>.</p><p>Cordialement,<br/>L'équipe Barber Paradise</p>`,
          attachments: [
            {
              filename: `${order.invoiceNumber}.pdf`,
              content: await fetch(order.invoiceUrl).then((r) => r.arrayBuffer()).then((b) => Buffer.from(b).toString("base64")),
            },
          ],
        });
        console.log(`[admin][send-invoice] Facture B2C ${order.invoiceNumber} envoyée à ${emailTo} pour ${order.orderNumber} par ${req.user?.email || "admin"}`);
        res.json({ success: true, message: `Facture ${order.invoiceNumber} envoyée à ${emailTo}` });
      }
    } catch (err) {
      console.error(`[admin][send-invoice] Erreur pour ${req.params.id}:`, err);
      res.status(500).json({ error: err instanceof Error ? err.message : "Erreur lors de l'envoi de la facture" });
    }
  }
);

// PATCH /api/admin/orders/:id/toggle-b2b — Bascule isB2B d'une commande (correction manuelle pour commandes POS)
adminRouter.patch(
  "/orders/:id/toggle-b2b",
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { isB2B } = req.body;
      if (typeof isB2B !== "boolean") {
        res.status(400).json({ error: "isB2B doit être un booléen" });
        return;
      }
      const order = await prisma.order.findUnique({ where: { id }, select: { id: true, orderNumber: true } });
      if (!order) {
        res.status(404).json({ error: "Commande introuvable" });
        return;
      }
      const updated = await prisma.order.update({
        where: { id },
        data: { isB2B },
        select: { id: true, isB2B: true },
      });
      console.log(`[admin][toggle-b2b] ${order.orderNumber} → isB2B=${isB2B} par ${req.user?.email || "admin"}`);
      res.json(updated);
    } catch (err) {
      console.error(`[admin][toggle-b2b] Erreur pour ${req.params.id}:`, err);
      res.status(500).json({ error: err instanceof Error ? err.message : "Erreur lors de la mise à jour" });
    }
  }
);

export default adminRouter;
