import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type ProductAutomaticPromotion = {
  id: string;
  name: string;
  type: string;
  value: number | null;
  appliesTo: string;
  productIds: string[];
  categoryIds: string[];
  customerType: string;
  usageLimit: number | null;
  usageCount: number;
  minOrderAmount: number | null;
  minQuantity: number | null;
};

export type CategoryPromotionTargets = {
  categoryIds: Set<string>;
  categorySlugs: Set<string>;
};

export type AppliedProductPromotion = {
  price: number;
  compareAtPrice: number;
  discountPercent: number;
  promotionName: string;
};

export type JsonProduct = {
  id?: string;
  category?: string | null;
  subcategory?: string | null;
  subsubcategory?: string | null;
  [key: string]: any;
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeCategoryValue(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function isCustomerEligibleForPromotion(promotion: ProductAutomaticPromotion, isApprovedPro: boolean): boolean {
  if (promotion.customerType === "all") return true;
  return isApprovedPro ? promotion.customerType === "b2b" : promotion.customerType === "b2c";
}

function isProductTargetedByPromotion(
  promotion: ProductAutomaticPromotion,
  product: JsonProduct,
  categoryTargets: CategoryPromotionTargets,
): boolean {
  if (promotion.appliesTo === "all") return true;

  if (promotion.appliesTo === "products") {
    return Boolean(product.id && promotion.productIds.includes(product.id));
  }

  if (promotion.appliesTo === "categories") {
    const productCategoryValues = [product.category, product.subcategory, product.subsubcategory]
      .map(normalizeCategoryValue)
      .filter(Boolean);

    return productCategoryValues.some(
      (value) => categoryTargets.categoryIds.has(value) || categoryTargets.categorySlugs.has(value),
    );
  }

  return false;
}

export function getBestAutomaticPromotionForProduct(
  product: JsonProduct,
  publicPrice: number,
  promotions: ProductAutomaticPromotion[],
  categoryTargets: CategoryPromotionTargets,
  isApprovedPro: boolean,
): AppliedProductPromotion | null {
  if (!Number.isFinite(publicPrice) || publicPrice <= 0) return null;

  let best: AppliedProductPromotion | null = null;

  for (const promotion of promotions) {
    if (!isCustomerEligibleForPromotion(promotion, isApprovedPro)) continue;
    if (promotion.usageLimit !== null && promotion.usageCount >= promotion.usageLimit) continue;
    if (promotion.minOrderAmount !== null || (promotion.minQuantity !== null && promotion.minQuantity > 1)) continue;
    if (!isProductTargetedByPromotion(promotion, product, categoryTargets)) continue;

    let discountedPrice: number | null = null;
    if (promotion.type === "percentage" && promotion.value && promotion.value > 0) {
      discountedPrice = publicPrice * (1 - Math.min(promotion.value, 100) / 100);
    } else if (promotion.type === "fixed_amount" && promotion.value && promotion.value > 0 && promotion.appliesTo !== "all") {
      discountedPrice = Math.max(0, publicPrice - promotion.value);
    }

    if (discountedPrice === null) continue;

    const roundedDiscountedPrice = roundMoney(discountedPrice);
    if (roundedDiscountedPrice >= publicPrice) continue;

    const discountPercent = Math.max(1, Math.round(((publicPrice - roundedDiscountedPrice) / publicPrice) * 100));
    const candidate = {
      price: roundedDiscountedPrice,
      compareAtPrice: publicPrice,
      discountPercent,
      promotionName: promotion.name,
    };

    if (!best || best.price > candidate.price) best = candidate;
  }

  return best;
}

export async function getActiveAutomaticProductPromotions(): Promise<{
  promotions: ProductAutomaticPromotion[];
  categoryTargets: CategoryPromotionTargets;
}> {
  const now = new Date();
  const promotions = await prisma.promotion.findMany({
    where: {
      method: "automatic",
      isActive: true,
      type: { in: ["percentage", "fixed_amount"] },
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    select: {
      id: true,
      name: true,
      type: true,
      value: true,
      appliesTo: true,
      productIds: true,
      categoryIds: true,
      customerType: true,
      usageLimit: true,
      usageCount: true,
      minOrderAmount: true,
      minQuantity: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const rawCategoryIds = Array.from(new Set(promotions.flatMap((promotion) => promotion.categoryIds)));
  const categoryTargets: CategoryPromotionTargets = {
    categoryIds: new Set(rawCategoryIds.map(normalizeCategoryValue)),
    categorySlugs: new Set(),
  };

  if (rawCategoryIds.length > 0) {
    const categories = await prisma.category.findMany({
      where: { id: { in: rawCategoryIds } },
      select: { id: true, slug: true },
    });

    categories.forEach((category) => {
      categoryTargets.categoryIds.add(normalizeCategoryValue(category.id));
      categoryTargets.categorySlugs.add(normalizeCategoryValue(category.slug));
    });

    rawCategoryIds.forEach((value) => categoryTargets.categorySlugs.add(normalizeCategoryValue(value)));
  }

  return { promotions, categoryTargets };
}
