import { Prisma, Promotion } from "@prisma/client";
import { prisma } from "../utils/prisma";

export type PromotionCustomerType = "all" | "b2c" | "b2b";
export type PromotionMethod = "code" | "automatic";
export type PromotionType = "percentage" | "fixed_amount" | "free_shipping" | "buy_x_get_y";
export type PromotionAppliesTo = "all" | "products" | "categories";

export type PromotionCartItem = {
  productId: string;
  categoryId?: string | null;
  quantity: number;
  price: number;
};

export type PromotionValidationResult = {
  valid: boolean;
  discount?: number;
  discountType?: string;
  promotionId?: string;
  code?: string | null;
  name?: string;
  message?: string;
};

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 48);
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function normalizeOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeInteger(value: unknown): number | null | undefined {
  const number = normalizeNumber(value);
  if (number === undefined || number === null) return number;
  return Math.max(0, Math.trunc(number));
}

function sanitizePromotionData(input: Record<string, unknown>, isCreate = false): Prisma.PromotionUncheckedCreateInput | Prisma.PromotionUncheckedUpdateInput {
  const data: Record<string, unknown> = {};

  if ("code" in input) {
    const code = typeof input.code === "string" ? normalizeCode(input.code) : "";
    data.code = code || null;
  }
  if ("name" in input) data.name = String(input.name || "").trim();
  if ("description" in input) data.description = typeof input.description === "string" && input.description.trim() ? input.description.trim() : null;
  if ("method" in input) data.method = input.method === "automatic" ? "automatic" : "code";
  if ("type" in input) {
    const allowedTypes = ["percentage", "fixed_amount", "free_shipping", "buy_x_get_y"];
    data.type = allowedTypes.includes(String(input.type)) ? String(input.type) : "percentage";
  }
  if ("value" in input) data.value = normalizeNumber(input.value);
  if ("valueType" in input) data.valueType = input.valueType === "fixed" ? "fixed" : "percentage";
  if ("appliesTo" in input) {
    const allowedScopes = ["all", "products", "categories"];
    data.appliesTo = allowedScopes.includes(String(input.appliesTo)) ? String(input.appliesTo) : "all";
  }
  if ("productIds" in input) data.productIds = normalizeStringArray(input.productIds);
  if ("categoryIds" in input) data.categoryIds = normalizeStringArray(input.categoryIds);
  if ("minOrderAmount" in input) data.minOrderAmount = normalizeNumber(input.minOrderAmount);
  if ("minQuantity" in input) data.minQuantity = normalizeInteger(input.minQuantity);
  if ("customerType" in input) {
    const allowedCustomerTypes = ["all", "b2c", "b2b"];
    data.customerType = allowedCustomerTypes.includes(String(input.customerType)) ? String(input.customerType) : "all";
  }
  if ("usageLimit" in input) data.usageLimit = normalizeInteger(input.usageLimit);
  if ("usagePerCustomer" in input) data.usagePerCustomer = normalizeInteger(input.usagePerCustomer);
  if ("stackable" in input) data.stackable = Boolean(input.stackable);
  if ("isActive" in input) data.isActive = Boolean(input.isActive);
  if ("startsAt" in input) data.startsAt = normalizeOptionalDate(input.startsAt);
  if ("endsAt" in input) data.endsAt = normalizeOptionalDate(input.endsAt);
  if ("createdBy" in input) data.createdBy = typeof input.createdBy === "string" ? input.createdBy : null;
  if ("metadata" in input) data.metadata = input.metadata as Prisma.InputJsonValue;

  if (isCreate) {
    if (!data.name) data.name = data.code ? `Promotion ${data.code}` : "Promotion automatique";
    if (!data.method) data.method = data.code ? "code" : "automatic";
    if (!data.type) data.type = "percentage";
    if (!data.valueType) data.valueType = data.type === "fixed_amount" ? "fixed" : "percentage";
    if (!data.appliesTo) data.appliesTo = "all";
    if (!data.customerType) data.customerType = "all";
    if (data.productIds === undefined) data.productIds = [];
    if (data.categoryIds === undefined) data.categoryIds = [];
  }

  if (data.method === "automatic") data.code = null;
  return data as Prisma.PromotionUncheckedCreateInput | Prisma.PromotionUncheckedUpdateInput;
}

function isPromotionCurrentlyActive(promotion: Promotion, now = new Date()): boolean {
  if (!promotion.isActive) return false;
  if (promotion.startsAt && promotion.startsAt > now) return false;
  if (promotion.endsAt && promotion.endsAt < now) return false;
  return true;
}

function getApplicableTotal(promotion: Promotion, cartTotal: number, cartItems: PromotionCartItem[]): number {
  if (promotion.appliesTo === "products" && promotion.productIds.length > 0) {
    return cartItems
      .filter((item) => promotion.productIds.includes(item.productId))
      .reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  if (promotion.appliesTo === "categories" && promotion.categoryIds.length > 0) {
    return cartItems
      .filter((item) => Boolean(item.categoryId) && promotion.categoryIds.includes(String(item.categoryId)))
      .reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  return cartTotal;
}

function calculatePromotionDiscount(promotion: Promotion, applicableTotal: number, shipping = 0): number {
  if (applicableTotal <= 0 && promotion.type !== "free_shipping") return 0;
  if (promotion.type === "percentage" && promotion.value) return money((applicableTotal * promotion.value) / 100);
  if (promotion.type === "fixed_amount" && promotion.value) return money(Math.min(promotion.value, applicableTotal));
  if (promotion.type === "free_shipping") return money(Math.max(0, shipping));
  return 0;
}

async function assertPromotionEligibility(params: {
  promotion: Promotion;
  cartTotal: number;
  cartItems: PromotionCartItem[];
  customerType?: "b2c" | "b2b";
  customerId?: string;
  customerEmail?: string;
}): Promise<string | null> {
  const { promotion } = params;
  if (!isPromotionCurrentlyActive(promotion)) return "Promotion inactive ou expirée.";
  if (promotion.customerType !== "all" && promotion.customerType !== (params.customerType || "b2c")) return "Cette promotion n'est pas valable pour ce type de compte.";
  if (promotion.minOrderAmount !== null && params.cartTotal < promotion.minOrderAmount) return `Montant minimum requis : ${promotion.minOrderAmount}€.`;
  if (promotion.minQuantity !== null) {
    const totalQuantity = params.cartItems.reduce((sum, item) => sum + item.quantity, 0);
    if (totalQuantity < promotion.minQuantity) return `Quantité minimum requise : ${promotion.minQuantity} articles.`;
  }
  if (promotion.usageLimit !== null && promotion.usageCount >= promotion.usageLimit) return "Cette promotion a atteint sa limite d'utilisation.";

  if (promotion.usagePerCustomer !== null && promotion.usagePerCustomer > 0) {
    const usageWhere: Prisma.PromotionUsageWhereInput = { promotionId: promotion.id };
    if (params.customerId) usageWhere.customerId = params.customerId;
    else if (params.customerEmail) usageWhere.customerEmail = params.customerEmail.trim().toLowerCase();
    else return null;

    const usageCount = await prisma.promotionUsage.count({ where: usageWhere });
    if (usageCount >= promotion.usagePerCustomer) return "Vous avez déjà utilisé cette promotion.";
  }

  return null;
}

class PromotionService {
  async validateCode(params: {
    code: string;
    cartTotal: number;
    cartItems: PromotionCartItem[];
    customerId?: string;
    customerEmail?: string;
    customerType?: "b2c" | "b2b";
    shipping?: number;
  }): Promise<PromotionValidationResult> {
    const code = normalizeCode(params.code || "");
    if (!code) return { valid: false, message: "Code promo requis." };

    const promotion = await prisma.promotion.findFirst({ where: { code, method: "code" } });
    if (!promotion) return { valid: false, message: "Code promo invalide ou expiré." };

    const error = await assertPromotionEligibility({ ...params, promotion });
    if (error) return { valid: false, message: error };

    const applicableTotal = getApplicableTotal(promotion, params.cartTotal, params.cartItems);
    const discount = calculatePromotionDiscount(promotion, applicableTotal, params.shipping || 0);
    if (discount <= 0 && promotion.type !== "free_shipping") return { valid: false, message: "Cette promotion ne s'applique à aucun article du panier." };

    return {
      valid: true,
      discount,
      discountType: promotion.type,
      promotionId: promotion.id,
      code: promotion.code,
      name: promotion.name,
    };
  }

  async getAutomaticDiscounts(params: {
    cartTotal: number;
    cartItems: PromotionCartItem[];
    customerType?: "b2c" | "b2b";
    shipping?: number;
  }): Promise<Array<{ promotionId: string; name: string; discount: number; discountType: string; stackable: boolean }>> {
    const now = new Date();
    const promotions = await prisma.promotion.findMany({
      where: {
        method: "automatic",
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: [{ stackable: "asc" }, { createdAt: "desc" }],
    });

    const results = [] as Array<{ promotionId: string; name: string; discount: number; discountType: string; stackable: boolean }>;
    for (const promotion of promotions) {
      const error = await assertPromotionEligibility({ promotion, cartTotal: params.cartTotal, cartItems: params.cartItems, customerType: params.customerType });
      if (error) continue;
      const applicableTotal = getApplicableTotal(promotion, params.cartTotal, params.cartItems);
      const discount = calculatePromotionDiscount(promotion, applicableTotal, params.shipping || 0);
      if (discount > 0 || promotion.type === "free_shipping") {
        results.push({ promotionId: promotion.id, name: promotion.name, discount, discountType: promotion.type, stackable: promotion.stackable });
      }
    }

    const stackableResults = results.filter((promotion) => promotion.stackable);
    const exclusiveBest = results.filter((promotion) => !promotion.stackable).sort((a, b) => b.discount - a.discount)[0];
    return exclusiveBest ? [exclusiveBest, ...stackableResults] : stackableResults;
  }

  async recordUsage(params: { promotionId: string; orderId: string; customerId?: string | null; customerEmail?: string | null; discountAmount: number }) {
    const existing = await prisma.promotionUsage.findFirst({ where: { promotionId: params.promotionId, orderId: params.orderId } });
    if (existing) return existing;

    const customerEmail = params.customerEmail ? params.customerEmail.trim().toLowerCase() : null;
    const [usage] = await prisma.$transaction([
      prisma.promotionUsage.create({
        data: {
          promotionId: params.promotionId,
          orderId: params.orderId,
          customerId: params.customerId || null,
          customerEmail,
          discountAmount: money(params.discountAmount),
        },
      }),
      prisma.promotion.update({ where: { id: params.promotionId }, data: { usageCount: { increment: 1 } } }),
    ]);
    return usage;
  }

  async create(data: Record<string, unknown>) {
    return prisma.promotion.create({ data: sanitizePromotionData(data, true) as Prisma.PromotionUncheckedCreateInput });
  }

  async list(filters: { method?: string; isActive?: boolean; type?: string; page?: number; limit?: number }) {
    const where: Prisma.PromotionWhereInput = {};
    if (filters.method) where.method = filters.method;
    if (filters.type) where.type = filters.type;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    const limit = Math.min(Math.max(filters.limit || 20, 1), 100);
    const page = Math.max(filters.page || 1, 1);
    const [promotions, total] = await Promise.all([
      prisma.promotion.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: (page - 1) * limit,
        include: { _count: { select: { usages: true } } },
      }),
      prisma.promotion.count({ where }),
    ]);
    return { promotions, total, page, limit };
  }

  async get(id: string) {
    return prisma.promotion.findUnique({
      where: { id },
      include: {
        usages: { orderBy: { usedAt: "desc" }, take: 50 },
        _count: { select: { usages: true } },
      },
    });
  }

  async update(id: string, data: Record<string, unknown>) {
    return prisma.promotion.update({ where: { id }, data: sanitizePromotionData(data) as Prisma.PromotionUncheckedUpdateInput });
  }

  async toggle(id: string) {
    const promotion = await prisma.promotion.findUnique({ where: { id } });
    if (!promotion) throw new Error("Promotion non trouvée");
    return prisma.promotion.update({ where: { id }, data: { isActive: !promotion.isActive } });
  }

  async duplicate(id: string) {
    const promotion = await prisma.promotion.findUnique({ where: { id } });
    if (!promotion) throw new Error("Promotion non trouvée");
    const duplicateCode = promotion.code ? `${promotion.code}_COPY_${Date.now().toString().slice(-4)}`.slice(0, 48) : null;
    return prisma.promotion.create({
      data: {
        code: duplicateCode,
        name: `${promotion.name} — copie`,
        description: promotion.description,
        method: promotion.method,
        type: promotion.type,
        value: promotion.value,
        valueType: promotion.valueType,
        appliesTo: promotion.appliesTo,
        productIds: promotion.productIds,
        categoryIds: promotion.categoryIds,
        minOrderAmount: promotion.minOrderAmount,
        minQuantity: promotion.minQuantity,
        customerType: promotion.customerType,
        usageLimit: promotion.usageLimit,
        usagePerCustomer: promotion.usagePerCustomer,
        stackable: promotion.stackable,
        isActive: false,
        startsAt: promotion.startsAt,
        endsAt: promotion.endsAt,
        createdBy: "admin",
        metadata: promotion.metadata === null ? Prisma.JsonNull : (promotion.metadata as Prisma.InputJsonValue),
      },
    });
  }

  async delete(id: string) {
    return prisma.promotion.delete({ where: { id } });
  }

  async getStats() {
    const now = new Date();
    const [total, active, expired, totalDiscounted, totalUsages, topPromos] = await Promise.all([
      prisma.promotion.count(),
      prisma.promotion.count({ where: { isActive: true, OR: [{ endsAt: null }, { endsAt: { gte: now } }] } }),
      prisma.promotion.count({ where: { endsAt: { lt: now } } }),
      prisma.promotionUsage.aggregate({ _sum: { discountAmount: true } }),
      prisma.promotionUsage.count(),
      prisma.promotion.findMany({ orderBy: { usageCount: "desc" }, take: 5, select: { id: true, code: true, name: true, usageCount: true, value: true, type: true } }),
    ]);

    return { total, active, expired, totalUsages, totalDiscountedAmount: money(totalDiscounted._sum.discountAmount || 0), topPromos };
  }
}

export const promotionService = new PromotionService();
export default promotionService;
