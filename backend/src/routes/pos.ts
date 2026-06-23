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

type MollieTerminal = {
  id: string;
  description?: string;
  status?: string;
  brand?: string;
  model?: string;
  serialNumber?: string | null;
};

type MolliePayment = {
  id: string;
  status: string;
  amount?: { currency: string; value: string };
  metadata?: Record<string, unknown>;
  _links?: {
    checkout?: { href?: string };
    changePaymentState?: { href?: string };
  };
};

type DiscountType = "percent" | "fixed";

type PosPaymentItemInput = {
  productId: string;
  variantId?: string | null;
  quantity: number;
  discountAmount?: number; // compatibilité ancien payload : remise fixe TTC de ligne
  lineDiscountType?: DiscountType | null;
  lineDiscountValue?: number | null;
};

type PosPaymentMethod = "card" | "cash" | "manual";

type PosPaymentBody = {
  items?: PosPaymentItemInput[];
  customerId?: string | null;
  terminalId?: string;
  posSessionId?: string | null;
  paymentMethod?: PosPaymentMethod;
  globalDiscount?: number; // compatibilité ancien payload : remise fixe TTC globale
  orderDiscountType?: DiscountType | null;
  orderDiscountValue?: number | null;
  notes?: string | null;
};

type NormalizedDiscount = { type: DiscountType | null; value: number };

function money(value: number): number {
  return Math.max(0, Math.round((value + Number.EPSILON) * 100) / 100);
}

function normalizeDiscountType(value: unknown): DiscountType | null {
  return value === "percent" || value === "fixed" ? value : null;
}

function normalizePaymentMethod(value: unknown): PosPaymentMethod {
  if (value === "cash") return "cash";
  if (value === "manual") return "manual";
  return "card";
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

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

function getBackendUrl(req: AuthRequest): string {
  return (process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
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

async function fetchMollie<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method || "GET";
  console.log(`[POS][Mollie] ${method} ${path}`);
  const response = await fetch(`https://api.mollie.com/v2${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireEnv("MOLLIE_API_KEY")}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  // Lire le body UNE SEULE FOIS pour éviter "Body has already been read"
  const text = await response.text();
  if (!response.ok) {
    console.error(`[POS][Mollie] HTTP ${response.status} ${response.statusText} — ${method} ${path}`, text.slice(0, 500));
  }
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = typeof data?.detail === "string" ? data.detail : typeof data?.message === "string" ? data.message : text;
    throw new Error(message || response.statusText);
  }
  return data as T;
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

async function applyPaidPosSideEffects(orderId: string) {
  const paidOrder = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) throw new Error("Vente POS introuvable.");
    if (order.status === "paid") {
      // Charger avec les relations pour être cohérent avec le retour normal
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

  // Génération de facture hors transaction (idempotente — ne bloque pas si erreur)
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

async function createMolliePosPayment(params: {
  req: AuthRequest;
  orderId: string;
  orderNumber: string;
  totalTTC: number;
  terminalId: string;
  description?: string;
}) {
  const webhookUrl = `${getBackendUrl(params.req)}/api/webhooks/mollie`;
  console.log(`[POS][Terminal] Création paiement Mollie — orderId=${params.orderId} orderNumber=${params.orderNumber} terminalId=${params.terminalId} amount=${params.totalTTC.toFixed(2)} ${CURRENCY} webhookUrl=${webhookUrl}`);
  const payment = await fetchMollie<MolliePayment>("/payments", {
    method: "POST",
    body: JSON.stringify({
      amount: { currency: CURRENCY, value: params.totalTTC.toFixed(2) },
      description: params.description || `Barber Paradise POS #${params.orderNumber}`,
      webhookUrl,
      method: "pointofsale",
      terminalId: params.terminalId,
      metadata: {
        order_type: "pos",
        orderId: params.orderId,
        order_id: params.orderId,
      },
    }),
  });
  console.log(`[POS][Terminal] Paiement Mollie créé — paymentId=${payment.id} status=${payment.status}`);
  return payment;
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

posRouter.get("/terminals", async (_req: AuthRequest, res: Response) => {
  try {
    const data = await fetchMollie<{ count?: number; _embedded?: { terminals?: MollieTerminal[] } }>("/terminals");
    const terminals = (data._embedded?.terminals || [])
      .filter((terminal) => terminal.status === "active")
      .map((terminal) => ({
        id: terminal.id,
        description: terminal.description || terminal.id,
        status: terminal.status,
        brand: terminal.brand,
        model: terminal.model,
        serialNumber: terminal.serialNumber,
      }));
    res.json({ terminals });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "Impossible de récupérer les terminaux Mollie." });
  }
});

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

posRouter.post("/sessions", async (req: AuthRequest, res: Response) => {
  try {
    if (req.auth?.type !== "jwt" || !req.user?.id) {
      res.status(403).json({ error: "Une session POS doit être ouverte par un administrateur connecté." });
      return;
    }
    const terminalId = typeof req.body.terminalId === "string" ? req.body.terminalId.trim() : "";
    if (!terminalId) {
      res.status(400).json({ error: "terminalId est requis." });
      return;
    }
    const session = await prisma.posSession.create({
      data: { adminId: req.user.id, terminalId, notes: typeof req.body.notes === "string" ? req.body.notes : null },
    });
    res.status(201).json({ session });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Impossible d’ouvrir la session POS." });
  }
});

posRouter.post("/sessions/:id/close", async (req: AuthRequest, res: Response) => {
  try {
    const session = await prisma.posSession.update({ where: { id: req.params.id }, data: { closedAt: new Date() } });
    res.json({ session });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Impossible de fermer la session POS." });
  }
});

posRouter.post("/payments", async (req: AuthRequest, res: Response) => {
  let createdOrderId: string | null = null;
  try {
    const body = req.body as PosPaymentBody;
    const paymentMethod = normalizePaymentMethod(body.paymentMethod);
    const terminalId = typeof body.terminalId === "string" ? body.terminalId.trim() : "";
    if (paymentMethod === "card" && !terminalId) {
      res.status(400).json({ error: "terminalId est requis pour un paiement carte." });
      return;
    }
    console.log(`[POS][/payments] méthode=${paymentMethod} terminalId=${terminalId || "n/a"} cashier=${req.user?.email || "n/a"}`);

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

    // Pour le mode carte (Mollie), un montant nul est rejeté par l'API de paiement.
    // Pour cash et manual, un total à 0€ est autorisé (échange, geste commercial, offert).
    if (paymentMethod === "card" && totalTTC <= 0) {
      res.status(400).json({ error: "Le total à encaisser doit être supérieur à 0 € pour un paiement par carte." });
      return;
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
        paymentProvider: (paymentMethod === "cash" || paymentMethod === "manual") ? "cash" : "mollie",
        subtotal,
        shipping: 0,
        total: totalTTC,
        totalHT,
        vatRate: VAT_RATE,
        vatAmount,
        totalTTC,
        currency: CURRENCY,
        channel: "pos",
        terminalId: paymentMethod === "card" ? terminalId : null,
        posSessionId: body.posSessionId || null,
        posPaymentStatus: "pending",
        posCashierId: req.user?.id || null,
        posCashierEmail: req.user?.email || null,
        discountAmount,
        orderDiscountType: orderDiscount.type,
        orderDiscountValue: orderDiscount.type ? orderDiscount.value : null,
        discountTotal: discountAmount,
        notes: body.notes || null,
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

    if (paymentMethod === "cash" || paymentMethod === "manual") {
      const paidOrder = await applyPaidPosSideEffects(order.id);
      res.status(201).json({ order: serializeOrder(paidOrder), paymentId: null, status: "paid", changePaymentStateUrl: null });
      return;
    }

    const payment = await createMolliePosPayment({ req, orderId: order.id, orderNumber, totalTTC, terminalId });
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { providerPaymentId: payment.id, posPaymentStatus: payment.status },
      include: { customer: true, items: true },
    });

    res.status(201).json({ order: serializeOrder(updated), paymentId: payment.id, status: payment.status, changePaymentStateUrl: payment._links?.changePaymentState?.href || null });
  } catch (error) {
    if (createdOrderId) {
      await prisma.order.update({ where: { id: createdOrderId }, data: { status: "cancelled", posPaymentStatus: "failed" } }).catch(() => undefined);
    }
    console.error("[POS][/payments] Erreur", error instanceof Error ? error.message : error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Impossible de créer le paiement POS." });
  }
});

posRouter.get("/payments/:paymentId/status", async (req: AuthRequest, res: Response) => {
  try {
    console.log(`[POS][/status] polling paymentId=${req.params.paymentId}`);
    const payment = await fetchMollie<MolliePayment>(`/payments/${encodeURIComponent(req.params.paymentId)}`);
    const order = await prisma.order.findFirst({
      where: { providerPaymentId: payment.id, channel: "pos" },
      include: { customer: true, items: true },
    });
    if (order) {
      const statusUpdate: Prisma.OrderUpdateInput = { posPaymentStatus: payment.status };
      if (payment.status === "paid") {
        const updated = await applyPaidPosSideEffects(order.id);
        res.json({ status: payment.status, paymentId: payment.id, order: serializeOrder(updated), changePaymentStateUrl: payment._links?.changePaymentState?.href || null });
        return;
      } else if (["failed", "canceled", "expired"].includes(payment.status)) {
        statusUpdate.status = "cancelled";
      }
      const updated = await prisma.order.update({ where: { id: order.id }, data: statusUpdate, include: { customer: true, items: true } });
      res.json({ status: payment.status, paymentId: payment.id, order: serializeOrder(updated), changePaymentStateUrl: payment._links?.changePaymentState?.href || null });
      return;
    }
    res.json({ status: payment.status, paymentId: payment.id, order: null, changePaymentStateUrl: payment._links?.changePaymentState?.href || null });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "Impossible de vérifier le paiement POS." });
  }
});

posRouter.post("/payments/:paymentId/cancel", async (req: AuthRequest, res: Response) => {
  try {
    const paymentId = req.params.paymentId;
    await fetchMollie<Record<string, unknown>>(`/payments/${encodeURIComponent(paymentId)}`, { method: "DELETE" });
    await prisma.order.updateMany({ where: { providerPaymentId: paymentId, channel: "pos" }, data: { status: "cancelled", posPaymentStatus: "canceled" } });
    res.json({ ok: true });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "Impossible d’annuler le paiement POS." });
  }
});

posRouter.post("/quick-sale", async (req: AuthRequest, res: Response) => {
  let createdOrderId: string | null = null;
  try {
    const amount = money(Number(req.body.amount || 0));
    const paymentMethod = normalizePaymentMethod(req.body.paymentMethod);
    const terminalId = typeof req.body.terminalId === "string" ? req.body.terminalId.trim() : "";
    const description = typeof req.body.description === "string" && req.body.description.trim() ? req.body.description.trim().slice(0, 120) : "Vente personnalisée";
    if (paymentMethod === "card" && !terminalId) {
      res.status(400).json({ error: "terminalId est requis pour un paiement carte." });
      return;
    }
    // Pour le mode carte (Mollie), un montant nul est rejeté par l'API de paiement.
    // Pour cash et manual, un montant à 0€ est autorisé (échange, geste commercial, offert).
    if (paymentMethod === "card" && amount <= 0) {
      res.status(400).json({ error: "Le montant de vente personnalisée doit être supérieur à 0 € pour un paiement par carte." });
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

    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: customer?.id || null,
        email: customer?.email || POS_EMAIL_FALLBACK,
        customerEmail: customer?.email || null,
        isB2B: isB2BQuick,
        status: "pending_payment",
        paymentMethod,
        paymentProvider: (paymentMethod === "cash" || paymentMethod === "manual") ? "cash" : "mollie",
        subtotal: amount,
        shipping: 0,
        total: totalTTC,
        totalHT,
        vatRate: VAT_RATE,
        vatAmount,
        totalTTC,
        currency: CURRENCY,
        channel: "pos",
        terminalId: paymentMethod === "card" ? terminalId : null,
        posSessionId: req.body.posSessionId || null,
        posPaymentStatus: "pending",
        posCashierId: req.user?.id || null,
        posCashierEmail: req.user?.email || null,
        discountAmount: orderDiscountAmount,
        orderDiscountType: orderDiscount.type,
        orderDiscountValue: orderDiscount.type ? orderDiscount.value : null,
        discountTotal: orderDiscountAmount,
        notes: req.body.notes || null,
        items: { create: [{ name: description, price: amount, quantity: 1, image: "", discountAmount: orderDiscountAmount, lineDiscountType: orderDiscount.type, lineDiscountValue: orderDiscount.type ? orderDiscount.value : null, isCustomSale: true }] },
      },
      include: { customer: true, items: true },
    });
    createdOrderId = order.id;

    if (paymentMethod === "cash" || paymentMethod === "manual") {
      const paidOrder = await applyPaidPosSideEffects(order.id);
      res.status(201).json({ order: serializeOrder(paidOrder), paymentId: null, status: "paid", changePaymentStateUrl: null });
      return;
    }

    const payment = await createMolliePosPayment({ req, orderId: order.id, orderNumber, totalTTC, terminalId, description: `Barber Paradise POS - ${description}` });
    const updated = await prisma.order.update({ where: { id: order.id }, data: { providerPaymentId: payment.id, posPaymentStatus: payment.status }, include: { customer: true, items: true } });

    res.status(201).json({ order: serializeOrder(updated), paymentId: payment.id, status: payment.status, changePaymentStateUrl: payment._links?.changePaymentState?.href || null });
  } catch (error) {
    if (createdOrderId) {
      await prisma.order.update({ where: { id: createdOrderId }, data: { status: "cancelled", posPaymentStatus: "failed" } }).catch(() => undefined);
    }
    console.error("[POS][/quick-sale] Erreur", error instanceof Error ? error.message : error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Impossible de créer la vente personnalisée." });
  }
});

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
    res.status(500).json({ error: error instanceof Error ? error.message : "Impossible de charger l’historique POS." });
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
    const paymentBreakdown = orders.reduce(
      (acc, order) => {
        const amount = order.totalTTC || order.total || 0;
        if (order.paymentMethod === "cash") {
          acc.cash.revenue = money(acc.cash.revenue + amount);
          acc.cash.count += 1;
        } else {
          acc.card.revenue = money(acc.card.revenue + amount);
          acc.card.count += 1;
        }
        return acc;
      },
      { card: { revenue: 0, count: 0 }, cash: { revenue: 0, count: 0 } }
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
