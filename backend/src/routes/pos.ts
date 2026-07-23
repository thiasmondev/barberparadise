import { Router, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { AuthRequest } from "../middleware/auth";
import { ensureB2CInvoiceForOrder } from "../services/b2cInvoiceService";
import { ensureProInvoiceForOrder } from "../services/proInvoiceService";

export const posRouter = Router();

const CURRENCY = "EUR";
const VAT_RATE = 20;
const POS_EMAIL_FALLBACK = "pos@barberparadise.fr";

// ─── TYPES ───────────────────────────────────────────────────────────────────

type DiscountType = "percent" | "fixed";

/**
 * Modes de paiement POS manuels :
 * - indy         : paiement carte via app Indy (appareil séparé)
 * - mollie_manual: paiement carte via app Mollie tap-to-pay (appareil séparé, sans API)
 * - cash         : espèces
 * - virement     : virement bancaire
 * - split        : paiement divisé sur plusieurs modes
 */
export type PosPaymentMethod = "indy" | "mollie_manual" | "cash" | "virement" | "split";

export type PosSplitLine = {
  method: Exclude<PosPaymentMethod, "split">;
  amount: number;
};

type PosPaymentItemInput = {
  productId: string;
  variantId?: string | null;
  quantity: number;
  discountAmount?: number;
  lineDiscountType?: DiscountType | null;
  lineDiscountValue?: number | null;
};

type PosPaymentBody = {
  items?: PosPaymentItemInput[];
  customerId?: string | null;
  posSessionId?: string | null;
  paymentMethod?: string;
  splitLines?: PosSplitLine[];
  globalDiscount?: number;
  orderDiscountType?: DiscountType | null;
  orderDiscountValue?: number | null;
  notes?: string | null;
};

type NormalizedDiscount = { type: DiscountType | null; value: number };

// ─── UTILITAIRES ─────────────────────────────────────────────────────────────

function money(value: number): number {
  return Math.max(0, Math.round((value + Number.EPSILON) * 100) / 100);
}

function normalizeDiscountType(value: unknown): DiscountType | null {
  return value === "percent" || value === "fixed" ? value : null;
}

function normalizePaymentMethod(value: unknown): PosPaymentMethod {
  if (value === "cash") return "cash";
  if (value === "virement") return "virement";
  if (value === "indy") return "indy";
  if (value === "mollie_manual") return "mollie_manual";
  if (value === "split") return "split";
  // Rétrocompatibilité : anciens modes "card" et "manual" → indy
  if (value === "card" || value === "manual") return "indy";
  return "indy";
}

function normalizeDiscount(typeValue: unknown, valueValue: unknown): NormalizedDiscount {
  const type = normalizeDiscountType(typeValue);
  const value = money(Number(valueValue || 0));
  if (!type || value <= 0) return { type: null, value: 0 };
  return { type, value };
}

function calculateDiscountAmount(type: DiscountType | null, value: number, baseAmount: number): number {
  if (!type || value <= 0 || baseAmount <= 0) return 0;
  const rawAmount = type === "percent" ? baseAmount * (Math.min(value, 100) / 100) : value;
  return money(Math.min(baseAmount, rawAmount));
}

function parseImages(images: string | null | undefined): string[] {
  if (!images) return [];
  try {
    const parsed = JSON.parse(images);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function compactVariantLabel(variant: { name: string; size: string; color: string } | null | undefined): string | null {
  if (!variant) return null;
  return [variant.name, variant.size, variant.color].map((part) => part?.trim()).filter(Boolean).join(" · ") || null;
}

async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const rand = Math.floor(Math.random() * 100000).toString().padStart(5, "0");
    const orderNumber = `BP-${year}-${rand}`;
    const exists = await prisma.order.findUnique({ where: { orderNumber }, select: { id: true } });
    if (!exists) return orderNumber;
  }
  return `BP-${year}-${Date.now().toString().slice(-6)}`;
}

async function resolvePosItems(rawItems: PosPaymentItemInput[]) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error("Le panier POS est vide.");
  }

  const resolvedItems = [] as Array<{
    productId: string;
    variantId: string | null;
    name: string;
    image: string;
    variantLabel: string | null;
    unitPrice: number;
    quantity: number;
    discountAmount: number;
    lineDiscountType: DiscountType | null;
    lineDiscountValue: number | null;
    lineTotal: number;
  }>;

  for (const item of rawItems) {
    const productId = typeof item.productId === "string" ? item.productId.trim() : "";
    const variantId = typeof item.variantId === "string" && item.variantId.trim() ? item.variantId.trim() : null;
    const quantity = Number.isFinite(Number(item.quantity)) ? Math.max(1, Math.floor(Number(item.quantity))) : 1;
    const legacyLineDiscount = money(Number(item.discountAmount || 0));
    const lineDiscount = normalizeDiscount(
      item.lineDiscountType || (legacyLineDiscount > 0 ? "fixed" : null),
      item.lineDiscountValue ?? legacyLineDiscount
    );

    if (!productId) throw new Error("Un produit du panier est invalide.");

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { variants: true },
    });

    if (!product || product.status !== "active") {
      throw new Error("Produit introuvable ou indisponible.");
    }

    const variant = variantId ? product.variants.find((entry) => entry.id === variantId) : null;
    const availableStock = variant ? variant.stock : product.stockCount;
    const isInStock = variant ? variant.inStock : product.inStock;

    if (!isInStock || availableStock < quantity) {
      throw new Error(`Stock insuffisant pour ${product.name}${variant ? ` (${variant.name})` : ""}.`);
    }

    const unitPrice = money(variant?.price ?? product.price);
    const grossLineTotal = money(unitPrice * quantity);
    const safeDiscount = calculateDiscountAmount(lineDiscount.type, lineDiscount.value, grossLineTotal);
    const images = parseImages(product.images);

    resolvedItems.push({
      productId: product.id,
      variantId: variant?.id || null,
      name: product.name,
      image: variant?.image || images[0] || "",
      variantLabel: compactVariantLabel(variant),
      unitPrice,
      quantity,
      discountAmount: safeDiscount,
      lineDiscountType: lineDiscount.type,
      lineDiscountValue: lineDiscount.type ? lineDiscount.value : null,
      lineTotal: money(grossLineTotal - safeDiscount),
    });
  }

  return resolvedItems;
}

function buildOrderTotals(subtotal: number, discountAmount: number) {
  const totalTTC = money(Math.max(0, subtotal - discountAmount));
  const totalHT = money(totalTTC / (1 + VAT_RATE / 100));
  const vatAmount = money(totalTTC - totalHT);
  return { totalTTC, totalHT, vatAmount };
}

/**
 * Valide les lignes de paiement divisé et vérifie que leur somme correspond au total.
 */
function validateSplitLines(splitLines: unknown, expectedTotal: number): PosSplitLine[] {
  if (!Array.isArray(splitLines) || splitLines.length < 2) {
    throw new Error("Le paiement divisé nécessite au moins 2 lignes.");
  }
  type SplitMethod = Exclude<PosPaymentMethod, "split">;
  const validMethods: SplitMethod[] = ["indy", "mollie_manual", "cash", "virement"];
  const lines: PosSplitLine[] = splitLines.map((line: unknown, idx: number) => {
    if (typeof line !== "object" || line === null) throw new Error(`Ligne ${idx + 1} invalide.`);
    const l = line as Record<string, unknown>;
    const method = l.method as SplitMethod;
    const amount = money(Number(l.amount || 0));
    if (!(validMethods as string[]).includes(method)) throw new Error(`Mode de paiement invalide en ligne ${idx + 1}.`);
    if (amount <= 0) throw new Error(`Le montant de la ligne ${idx + 1} doit être supérieur à 0.`);
    return { method, amount };
  });
  const splitTotal = money(lines.reduce((sum, l) => sum + l.amount, 0));
  // Tolérance de 0.01€ pour les arrondis
  if (Math.abs(splitTotal - expectedTotal) > 0.01) {
    throw new Error(`La somme des lignes (${splitTotal.toFixed(2)} €) ne correspond pas au total (${expectedTotal.toFixed(2)} €).`);
  }
  return lines;
}

async function applyPaidPosSideEffects(orderId: string) {
  const paidOrder = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) throw new Error("Vente POS introuvable.");
    if (order.status === "paid") {
      return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { customer: true, items: true } });
    }

    for (const item of order.items) {
      if (!item.productId) continue;

      if (item.variantId) {
        const variant = await tx.productVariant.findUnique({ where: { id: item.variantId } });
        if (!variant) continue;

        const nextVariantStock = Math.max(0, variant.stock - item.quantity);
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: nextVariantStock, inStock: nextVariantStock > 0 },
        });

        const remainingActiveVariants = await tx.productVariant.count({
          where: { productId: item.productId, inStock: true, stock: { gt: 0 } },
        });
        const product = await tx.product.findUnique({ where: { id: item.productId }, select: { stockCount: true } });
        await tx.product.update({
          where: { id: item.productId },
          data: { inStock: Boolean((product?.stockCount || 0) > 0 || remainingActiveVariants > 0) },
        });
        continue;
      }

      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product) continue;

      const nextStock = Math.max(0, product.stockCount - item.quantity);
      await tx.product.update({
        where: { id: item.productId },
        data: { stockCount: nextStock, inStock: nextStock > 0 },
      });
    }

    const paidAt = order.posPaidAt || new Date();
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status: "paid",
        posPaymentStatus: "paid",
        posPaidAt: paidAt,
      },
      include: { customer: true, items: true },
    });

    if (order.posSessionId) {
      await tx.posSession.update({
        where: { id: order.posSessionId },
        data: {
          totalSales: { increment: order.totalTTC || order.total || 0 },
          totalOrders: { increment: 1 },
        },
      });
    }

    return updated;
  });

  // Génération de facture hors transaction (idempotente)
  try {
    if (paidOrder.isB2B) {
      await ensureProInvoiceForOrder(paidOrder.id, { sendInvoiceEmail: false });
      console.log(`[POS][invoice] Facture B2B générée — orderId=${paidOrder.id} orderNumber=${paidOrder.orderNumber}`);
    } else {
      await ensureB2CInvoiceForOrder(paidOrder.id);
      console.log(`[POS][invoice] Facture B2C générée — orderId=${paidOrder.id} orderNumber=${paidOrder.orderNumber}`);
    }
  } catch (invoiceErr) {
    console.error(`[POS][invoice] Erreur génération facture pour ${paidOrder.orderNumber}:`, invoiceErr instanceof Error ? invoiceErr.message : invoiceErr);
  }

  return paidOrder;
}

function serializeOrder(order: any) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    channel: order.channel,
    status: order.status,
    posPaymentStatus: order.posPaymentStatus,
    providerPaymentId: order.providerPaymentId,
    terminalId: order.terminalId,
    posSessionId: order.posSessionId,
    paymentMethod: order.paymentMethod,
    posPaymentBreakdown: order.posPaymentBreakdown || null,
    subtotal: order.subtotal,
    discountAmount: order.discountAmount,
    orderDiscountType: order.orderDiscountType,
    orderDiscountValue: order.orderDiscountValue,
    discountTotal: order.discountTotal,
    totalHT: order.totalHT,
    vatAmount: order.vatAmount,
    totalTTC: order.totalTTC,
    total: order.total,
    currency: order.currency,
    notes: order.notes,
    createdAt: order.createdAt,
    posPaidAt: order.posPaidAt,
    customer: order.customer
      ? { id: order.customer.id, email: order.customer.email, firstName: order.customer.firstName, lastName: order.customer.lastName, phone: order.customer.phone }
      : null,
    items: Array.isArray(order.items)
      ? order.items.map((item: any) => ({
          id: item.id,
          productId: item.productId,
          variantId: item.variantId,
          variantLabel: item.variantLabel,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
          discountAmount: item.discountAmount,
          lineDiscountType: item.lineDiscountType,
          lineDiscountValue: item.lineDiscountValue,
          isCustomSale: item.isCustomSale,
        }))
      : [],
  };
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────

// Catalogue POS
posRouter.get("/catalog", async (req: AuthRequest, res: Response) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const category = typeof req.query.category === "string" ? req.query.category.trim() : "";
    const take = Math.min(60, Math.max(1, Number(req.query.limit || 30)));

    const where: Prisma.ProductWhereInput = {
      status: "active",
      ...(category ? { category } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
              { brand: { contains: q, mode: "insensitive" } },
              { category: { contains: q, mode: "insensitive" } },
              { variants: { some: { OR: [{ sku: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { color: { contains: q, mode: "insensitive" } }, { size: { contains: q, mode: "insensitive" } }] } } },
            ],
          }
        : {}),
    };

    const [products, categories] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: [{ categoryOrder: "asc" }, { name: "asc" }],
        take,
        include: { variants: { orderBy: { order: "asc" } } },
      }),
      prisma.product.findMany({
        where: { status: "active" },
        distinct: ["category"],
        select: { category: true },
        orderBy: { category: "asc" },
      }),
    ]);

    res.json({
      products: products.map((product) => {
        const images = parseImages(product.images);
        return {
          id: product.id,
          name: product.name,
          brand: product.brand,
          category: product.category,
          price: product.price,
          image: images[0] || "",
          inStock: product.inStock,
          stockCount: product.stockCount,
          hasVariants: product.variants.length > 0,
          variants: product.variants.map((variant) => ({
            id: variant.id,
            name: variant.name,
            label: compactVariantLabel(variant),
            sku: variant.sku,
            price: variant.price ?? product.price,
            stock: variant.stock,
            inStock: variant.inStock,
            image: variant.image || images[0] || "",
          })),
        };
      }),
      categories: categories.map((entry) => entry.category).filter(Boolean),
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Erreur catalogue POS." });
  }
});

// Paiement POS (vente avec articles du catalogue)
posRouter.post("/payments", async (req: AuthRequest, res: Response) => {
  let createdOrderId: string | null = null;
  try {
    const body = req.body as PosPaymentBody;
    const paymentMethod = normalizePaymentMethod(body.paymentMethod);

    console.log(`[POS][/payments] méthode=${paymentMethod} cashier=${req.user?.email || "n/a"}`);

    const items = await resolvePosItems(body.items || []);
    const subtotal = money(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
    const itemDiscount = money(items.reduce((sum, item) => sum + item.discountAmount, 0));
    const legacyGlobalDiscount = money(Number(body.globalDiscount || 0));
    const orderDiscount = normalizeDiscount(
      body.orderDiscountType || (legacyGlobalDiscount > 0 ? "fixed" : null),
      body.orderDiscountValue ?? legacyGlobalDiscount
    );
    const orderDiscountAmount = calculateDiscountAmount(orderDiscount.type, orderDiscount.value, Math.max(0, subtotal - itemDiscount));
    const discountAmount = money(itemDiscount + orderDiscountAmount);
    const { totalTTC, totalHT, vatAmount } = buildOrderTotals(subtotal, discountAmount);

    // Validation du paiement divisé
    let splitLines: PosSplitLine[] | null = null;
    if (paymentMethod === "split") {
      splitLines = validateSplitLines(body.splitLines, totalTTC);
    }

    const customer = body.customerId ? await prisma.customer.findUnique({ where: { id: body.customerId }, include: { proAccount: true } }) : null;
    const isB2B = customer?.proAccount?.status === "approved";
    const orderNumber = await generateOrderNumber();

    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: customer?.id || null,
        email: customer?.email || POS_EMAIL_FALLBACK,
        customerEmail: customer?.email || null,
        isB2B,
        status: "pending_payment",
        paymentMethod,
        paymentProvider: "manual",
        subtotal,
        shipping: 0,
        total: totalTTC,
        totalHT,
        vatRate: VAT_RATE,
        vatAmount,
        totalTTC,
        currency: CURRENCY,
        posSessionId: body.posSessionId || null,
        posPaymentStatus: "pending",
        posCashierId: req.user?.id || null,
        posCashierEmail: req.user?.email || null,
        discountAmount,
        orderDiscountType: orderDiscount.type,
        orderDiscountValue: orderDiscount.type ? orderDiscount.value : null,
        discountTotal: discountAmount,
        notes: body.notes || null,
        posPaymentBreakdown: splitLines ? (splitLines as Prisma.InputJsonValue) : undefined,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            variantLabel: item.variantLabel,
            name: item.name,
            price: item.unitPrice,
            quantity: item.quantity,
            image: item.image,
            discountAmount: item.discountAmount,
            lineDiscountType: item.lineDiscountType,
            lineDiscountValue: item.lineDiscountValue,
          })),
        },
      },
      include: { customer: true, items: true },
    });
    createdOrderId = order.id;

    const paidOrder = await applyPaidPosSideEffects(order.id);
    res.status(201).json({ order: serializeOrder(paidOrder), paymentId: null, status: "paid", changePaymentStateUrl: null });
  } catch (error) {
    if (createdOrderId) {
      await prisma.order.update({ where: { id: createdOrderId }, data: { status: "cancelled", posPaymentStatus: "failed" } }).catch(() => undefined);
    }
    console.error("[POS][/payments] Erreur", error instanceof Error ? error.message : error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Impossible de créer le paiement POS." });
  }
});

// Vente rapide POS (montant libre)
posRouter.post("/quick-sale", async (req: AuthRequest, res: Response) => {
  let createdOrderId: string | null = null;
  try {
    const amount = money(Number(req.body.amount || 0));
    const paymentMethod = normalizePaymentMethod(req.body.paymentMethod);
    const description = typeof req.body.description === "string" && req.body.description.trim() ? req.body.description.trim().slice(0, 120) : "Vente personnalisée";

    if (amount <= 0 && paymentMethod !== "cash") {
      res.status(400).json({ error: "Le montant de vente personnalisée doit être supérieur à 0 €." });
      return;
    }

    const customer = req.body.customerId ? await prisma.customer.findUnique({ where: { id: String(req.body.customerId) }, include: { proAccount: true } }) : null;
    const isB2BQuick = customer?.proAccount?.status === "approved";
    const orderNumber = await generateOrderNumber();
    const legacyGlobalDiscount = money(Number(req.body.globalDiscount || 0));
    const orderDiscount = normalizeDiscount(
      req.body.orderDiscountType || (legacyGlobalDiscount > 0 ? "fixed" : null),
      req.body.orderDiscountValue ?? legacyGlobalDiscount
    );
    const orderDiscountAmount = calculateDiscountAmount(orderDiscount.type, orderDiscount.value, amount);
    const { totalTTC, totalHT, vatAmount } = buildOrderTotals(amount, orderDiscountAmount);

    // Validation du paiement divisé
    let splitLines: PosSplitLine[] | null = null;
    if (paymentMethod === "split") {
      splitLines = validateSplitLines(req.body.splitLines, totalTTC);
    }

    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: customer?.id || null,
        email: customer?.email || POS_EMAIL_FALLBACK,
        customerEmail: customer?.email || null,
        isB2B: isB2BQuick,
        status: "pending_payment",
        paymentMethod,
        paymentProvider: "manual",
        subtotal: amount,
        shipping: 0,
        total: totalTTC,
        totalHT,
        vatRate: VAT_RATE,
        vatAmount,
        totalTTC,
        currency: CURRENCY,
        posSessionId: req.body.posSessionId || null,
        posPaymentStatus: "pending",
        posCashierId: req.user?.id || null,
        posCashierEmail: req.user?.email || null,
        discountAmount: orderDiscountAmount,
        orderDiscountType: orderDiscount.type,
        orderDiscountValue: orderDiscount.type ? orderDiscount.value : null,
        discountTotal: orderDiscountAmount,
        notes: req.body.notes || null,
        posPaymentBreakdown: splitLines ? (splitLines as Prisma.InputJsonValue) : undefined,
        items: { create: [{ name: description, price: amount, quantity: 1, image: "", discountAmount: orderDiscountAmount, lineDiscountType: orderDiscount.type, lineDiscountValue: orderDiscount.type ? orderDiscount.value : null, isCustomSale: true }] },
      },
      include: { customer: true, items: true },
    });
    createdOrderId = order.id;

    const paidOrder = await applyPaidPosSideEffects(order.id);
    res.status(201).json({ order: serializeOrder(paidOrder), paymentId: null, status: "paid", changePaymentStateUrl: null });
  } catch (error) {
    if (createdOrderId) {
      await prisma.order.update({ where: { id: createdOrderId }, data: { status: "cancelled", posPaymentStatus: "failed" } }).catch(() => undefined);
    }
    console.error("[POS][/quick-sale] Erreur", error instanceof Error ? error.message : error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Impossible de créer la vente personnalisée." });
  }
});

// Marquer une vente POS comme payée (depuis la fiche admin)
posRouter.post("/orders/:orderId/mark-paid", async (req: AuthRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    const order = await prisma.order.findFirst({
      where: { id: orderId, channel: "pos" },
      include: { customer: true, items: true },
    });
    if (!order) {
      res.status(404).json({ error: "Vente POS introuvable." });
      return;
    }
    if (order.status === "paid") {
      res.json({ order: serializeOrder(order), alreadyPaid: true });
      return;
    }
    console.log(`[POS][mark-paid] orderId=${orderId} cashier=${req.user?.email || "n/a"}`);
    const paidOrder = await applyPaidPosSideEffects(orderId);
    res.json({ order: serializeOrder(paidOrder), alreadyPaid: false });
  } catch (error) {
    console.error("[POS][mark-paid] Erreur", error instanceof Error ? error.message : error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Impossible de marquer la vente comme payée." });
  }
});

// Historique POS
posRouter.get("/history", async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 25)));
    const period = typeof req.query.period === "string" ? req.query.period : "all";
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "";

    const where: Prisma.OrderWhereInput = { channel: "pos" };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: "insensitive" } },
        { customer: { firstName: { contains: search, mode: "insensitive" } } },
        { customer: { lastName: { contains: search, mode: "insensitive" } } },
        { customer: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    const now = new Date();
    if (period !== "all") {
      const start = new Date(now);
      if (period === "today") start.setHours(0, 0, 0, 0);
      if (period === "week") start.setDate(now.getDate() - 7);
      if (period === "month") start.setMonth(now.getMonth() - 1);
      where.createdAt = { gte: start };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { customer: true, items: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ orders: orders.map(serializeOrder), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Impossible de charger l'historique POS." });
  }
});

posRouter.get("/history/:orderId", async (req: AuthRequest, res: Response) => {
  try {
    const order = await prisma.order.findFirst({ where: { id: req.params.orderId, channel: "pos" }, include: { customer: true, items: true } });
    if (!order) {
      res.status(404).json({ error: "Vente POS introuvable." });
      return;
    }
    res.json({ order: serializeOrder(order) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Impossible de charger la vente POS." });
  }
});

// Statistiques POS — ventilation par mode de paiement (5 modes)
posRouter.get("/stats", async (req: AuthRequest, res: Response) => {
  try {
    const period = typeof req.query.period === "string" ? req.query.period : "today";
    const now = new Date();
    const start = new Date(now);
    if (period === "today") start.setHours(0, 0, 0, 0);
    else if (period === "week") start.setDate(now.getDate() - 7);
    else if (period === "month") start.setMonth(now.getMonth() - 1);
    else start.setHours(0, 0, 0, 0);

    const orders = await prisma.order.findMany({
      where: { channel: "pos", status: "paid", createdAt: { gte: start } },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });

    const revenue = money(orders.reduce((sum, order) => sum + (order.totalTTC || order.total || 0), 0));
    const salesCount = orders.length;
    const averageOrder = salesCount > 0 ? money(revenue / salesCount) : 0;

    // Ventilation par mode de paiement (5 modes + rétrocompatibilité card/manual)
    const paymentBreakdown = orders.reduce(
      (acc, order) => {
        const amount = order.totalTTC || order.total || 0;
        const method = order.paymentMethod as string;
        if (method === "cash") {
          acc.cash.revenue = money(acc.cash.revenue + amount);
          acc.cash.count += 1;
        } else if (method === "virement") {
          acc.virement.revenue = money(acc.virement.revenue + amount);
          acc.virement.count += 1;
        } else if (method === "mollie_manual") {
          acc.mollie_manual.revenue = money(acc.mollie_manual.revenue + amount);
          acc.mollie_manual.count += 1;
        } else if (method === "split") {
          acc.split.revenue = money(acc.split.revenue + amount);
          acc.split.count += 1;
        } else {
          // indy + rétrocompatibilité card/manual
          acc.indy.revenue = money(acc.indy.revenue + amount);
          acc.indy.count += 1;
        }
        return acc;
      },
      {
        indy: { revenue: 0, count: 0 },
        mollie_manual: { revenue: 0, count: 0 },
        cash: { revenue: 0, count: 0 },
        virement: { revenue: 0, count: 0 },
        split: { revenue: 0, count: 0 },
        // Rétrocompatibilité pour l'ancien frontend stats qui lit .card
        card: { revenue: 0, count: 0 },
      }
    );

    const productTotals = new Map<string, { name: string; quantity: number; revenue: number }>();
    for (const order of orders) {
      for (const item of order.items) {
        const key = item.productId || item.name;
        const current = productTotals.get(key) || { name: item.name, quantity: 0, revenue: 0 };
        current.quantity += item.quantity;
        current.revenue = money(current.revenue + item.price * item.quantity - item.discountAmount);
        productTotals.set(key, current);
      }
    }
    const topProducts = Array.from(productTotals.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 5);

    res.json({ period, start, salesCount, revenue, averageOrder, paymentBreakdown, topProducts, latestOrder: orders[0] ? serializeOrder(orders[0]) : null });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Impossible de charger les statistiques POS." });
  }
});
