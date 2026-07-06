import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { getActiveAutomaticProductPromotions, getBestAutomaticPromotionForProduct, type ProductAutomaticPromotion, type CategoryPromotionTargets, type AppliedProductPromotion, type JsonProduct } from "../services/productPricingService";
import type { Promotion } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { requireAdmin } from "../middleware/auth";
import { buildCategorySlugFilter, collectChildSlugs } from "../utils/categoryFilters";

export const productsRouter = Router();

type CustomerToken = { id: string; email: string };

type JsonProductVariant = {
  price?: number | null;
  priceProEur?: number | null;
  stock?: number;
  inStock?: boolean;
};





async function isApprovedProRequest(req: Request): Promise<boolean> {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token || !process.env.JWT_SECRET) return false;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as CustomerToken;
    const account = await prisma.proAccount.findUnique({
      where: { customerId: decoded.id },
      select: { status: true },
    });
    return account?.status === "approved";
  } catch {
    return false;
  }
}

function parseJsonArray(value?: string | null): unknown[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeSearchText(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildSearchTermVariants(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const variants = new Set<string>([trimmed]);
  const apostropheChars = /['’‘`´]/g;
  const normalizedApostrophe = trimmed.replace(apostropheChars, "'");
  variants.add(normalizedApostrophe);
  variants.add(normalizedApostrophe.replace(/'/g, "’"));
  variants.add(normalizedApostrophe.replace(/'/g, "‘"));

  return Array.from(variants).filter(Boolean);
}

function buildProductSearchConditions(query: string, includeDescription: boolean) {
  const variants = buildSearchTermVariants(query);
  return variants.flatMap((term) => [
    { name: { contains: term, mode: "insensitive" as const } },
    ...(includeDescription ? [{ description: { contains: term, mode: "insensitive" as const } }] : []),
    { brand: { contains: term, mode: "insensitive" as const } },
    { slug: { contains: term, mode: "insensitive" as const } },
    { category: { contains: term, mode: "insensitive" as const } },
    { tags: { contains: term, mode: "insensitive" as const } },
    { variants: { some: { name: { contains: term, mode: "insensitive" as const } } } },
    { variants: { some: { sku: { contains: term, mode: "insensitive" as const } } } },
    { variants: { some: { color: { contains: term, mode: "insensitive" as const } } } },
    { variants: { some: { size: { contains: term, mode: "insensitive" as const } } } },
  ]);
}

function scoreText(value: unknown, query: string, weights: { exact: number; starts: number; contains: number }): number {
  const text = normalizeSearchText(value);
  if (!text || !query) return 0;
  if (text === query) return weights.exact;
  if (text.startsWith(query)) return weights.starts;
  if (text.includes(query)) return weights.contains;
  return 0;
}

// La recherche rapide privilégie les champs métier visibles et ignore la description longue.
// Cela évite que « peigne » affiche en priorité des cires/pâtes dont la description mentionne simplement l’usage au peigne.
function scoreQuickSearchProduct(product: JsonProduct & Record<string, any>, query: string): number {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 0;

  let score = 0;
  score += scoreText(product.name, normalizedQuery, { exact: 1000, starts: 850, contains: 700 });
  score += scoreText(product.slug, normalizedQuery, { exact: 650, starts: 520, contains: 450 });
  score += scoreText(product.category, normalizedQuery, { exact: 500, starts: 380, contains: 280 });
  score += scoreText(product.brand, normalizedQuery, { exact: 400, starts: 300, contains: 180 });
  score += scoreText(product.tags, normalizedQuery, { exact: 360, starts: 260, contains: 220 });

  if (Array.isArray(product.variants)) {
    score += Math.max(
      0,
      ...product.variants.map((variant) =>
        scoreText((variant as Record<string, any>).name, normalizedQuery, { exact: 450, starts: 350, contains: 260 }) +
        scoreText((variant as Record<string, any>).sku, normalizedQuery, { exact: 320, starts: 240, contains: 160 }) +
        scoreText((variant as Record<string, any>).color, normalizedQuery, { exact: 180, starts: 120, contains: 80 }) +
        scoreText((variant as Record<string, any>).size, normalizedQuery, { exact: 180, starts: 120, contains: 80 })
      )
    );
  }

  return score;
}




function buildQuickSearchWhere(query: string) {
  return {
    OR: buildProductSearchConditions(query, false),
  };
}

function serializeProduct<T extends JsonProduct & { price: number }>(
  product: T,
  isApprovedPro: boolean,
  promotions: ProductAutomaticPromotion[] = [],
  categoryTargets: CategoryPromotionTargets = { categoryIds: new Set(), categorySlugs: new Set() },
) {
  const parsed = {
    ...product,
    images: parseJsonArray(product.images),
    features: parseJsonArray(product.features),
    tags: parseJsonArray(product.tags),
  } as unknown as Omit<T, "images" | "features" | "tags"> & {
    images: unknown[];
    features: unknown[];
    tags: unknown[];
    price: number;
    priceProEur?: number | null;
    variants?: JsonProductVariant[];
  };

  const productForPromotion: JsonProduct = product;
  const hasPriceProEur = typeof parsed.priceProEur === "number" && parsed.priceProEur > 0;
  const pricePublic = parsed.price;
  const price = isApprovedPro && hasPriceProEur ? parsed.priceProEur! : pricePublic;
  const automaticPromotion = getBestAutomaticPromotionForProduct(productForPromotion, pricePublic, promotions, categoryTargets, isApprovedPro);
  const variants = parsed.variants?.map((variant) => {
    const variantPublicPrice = variant.price ?? pricePublic;
    const variantHasPriceProEur = typeof variant.priceProEur === "number" && variant.priceProEur > 0;
    const variantAutomaticPromotion = !isApprovedPro
      ? getBestAutomaticPromotionForProduct(productForPromotion, variantPublicPrice, promotions, categoryTargets, isApprovedPro)
      : null;
    const variantPrice = isApprovedPro
      ? (variantHasPriceProEur ? variant.priceProEur! : (hasPriceProEur ? parsed.priceProEur! : variantPublicPrice))
      : (variantAutomaticPromotion ? variantAutomaticPromotion.price : variantPublicPrice);
    const serializedVariant = {
      ...variant,
      price: variantPrice,
      pricePublic: variantPublicPrice,
      compareAtPrice: variantAutomaticPromotion ? variantAutomaticPromotion.compareAtPrice : null,
      originalPrice: variantAutomaticPromotion ? variantAutomaticPromotion.compareAtPrice : null,
      isPromo: Boolean(variantAutomaticPromotion),
      ...(variantAutomaticPromotion ? {
        automaticPromotionName: variantAutomaticPromotion.promotionName,
        automaticPromotionDiscountPercent: variantAutomaticPromotion.discountPercent,
      } : {}),
      hasPriceProEur: variantHasPriceProEur || (isApprovedPro && hasPriceProEur),
    };
    delete (serializedVariant as any).purchasePrice;
    if (!isApprovedPro) {
      const { priceProEur: _variantPriceProEur, ...publicVariant } = serializedVariant;
      return publicVariant;
    }
    return serializedVariant;
  });

  const existingCompareAtPrice = (parsed as any).compareAtPrice ?? (parsed as any).originalPrice ?? null;
  const salePrice = automaticPromotion && !isApprovedPro ? automaticPromotion.price : price;
  const compareAtPrice = automaticPromotion && !isApprovedPro
    ? automaticPromotion.compareAtPrice
    : existingCompareAtPrice;
  const hasVariants = Boolean(variants?.length);
  const variantStockCount = variants?.reduce((sum, variant) => sum + Math.max(0, variant.stock || 0), 0) ?? 0;
  const variantInStock = variants?.some((variant) => variant.inStock && (variant.stock || 0) > 0) ?? false;

  const serialized = {
    ...parsed,
    ...(variants ? { variants } : {}),
    inStock: hasVariants ? variantInStock : (parsed as any).inStock,
    stockCount: hasVariants ? variantStockCount : (parsed as any).stockCount,
    price: salePrice,
    pricePublic,
    compareAtPrice,
    originalPrice: compareAtPrice,
    isPromo: Boolean((parsed as any).isPromo || (compareAtPrice && compareAtPrice > salePrice)),
    ...(automaticPromotion && !isApprovedPro ? {
      automaticPromotionName: automaticPromotion.promotionName,
      automaticPromotionDiscountPercent: automaticPromotion.discountPercent,
    } : {}),
    isPro: isApprovedPro,
    hasPriceProEur,
  };
  delete (serialized as any).purchasePrice;

  if (!isApprovedPro) {
    const { priceProEur: _priceProEur, ...publicProduct } = serialized;
    return publicProduct;
  }

  return serialized;
}

async function getAllChildSlugs(parentSlug: string): Promise<string[]> {
  return collectChildSlugs(parentSlug, (slug) =>
    prisma.category.findMany({
      where: { parentSlug: slug },
      select: { slug: true },
    }),
  );
}

// GET /api/products — Liste avec filtres et pagination
productsRouter.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = "1", limit = "24",
      category, subcategory, brand, search,
      minPrice, maxPrice, inStock, isPromo, isNew,
      sort = "name_asc",
    } = req.query as Record<string, string>;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { status: "active" };
    // Filtrage catégorie : récupère récursivement les enfants pour inclure tous les produits des sous-catégories imbriquées.
    if (category && subcategory) {
      const allSubcategorySlugs = await getAllChildSlugs(subcategory);
      where.AND = [
        { category: { equals: category, mode: "insensitive" } },
        { OR: buildCategorySlugFilter(allSubcategorySlugs) },
      ];
    } else if (category) {
      const allCategorySlugs = await getAllChildSlugs(category);
      where.OR = buildCategorySlugFilter(allCategorySlugs);
    } else if (subcategory) {
      const allSubcategorySlugs = await getAllChildSlugs(subcategory);
      where.OR = buildCategorySlugFilter(allSubcategorySlugs);
    }
    if (brand) {
      const brandValues = String(brand).split(",").map((item) => item.trim()).filter(Boolean);
      if (brandValues.length === 1) where.brand = { equals: brandValues[0], mode: "insensitive" };
      else if (brandValues.length > 1) where.OR = [...(where.OR || []), ...brandValues.map((name) => ({ brand: { equals: name, mode: "insensitive" } }))];
    }
    if (search) {
      // Utiliser AND pour combiner avec un éventuel OR de catégorie
      const searchOr = buildProductSearchConditions(search, true);
      if (where.OR) {
        // Combiner : catégorie AND search
        where.AND = [{ OR: where.OR }, { OR: searchOr }];
        delete where.OR;
      } else {
        where.OR = searchOr;
      }
    }
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }
    if (inStock === "true") where.inStock = true;
    if (isPromo === "true") where.isPromo = true;
    if (isNew === "true") where.isNew = true;

    // Tri
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orderBy: any = { name: "asc" };
    if (sort === "price_asc") orderBy = { price: "asc" };
    else if (sort === "price_desc") orderBy = { price: "desc" };
    else if (sort === "rating_desc") orderBy = { rating: "desc" };
    else if (sort === "updated_desc") orderBy = { updatedAt: "desc" };
    else if (sort === "newest") orderBy = { createdAt: "desc" };

    const [products, total, isApprovedPro, promotionData] = await Promise.all([
      prisma.product.findMany({ where, orderBy, skip, take, include: { variants: { orderBy: { order: "asc" } } } }),
      prisma.product.count({ where }),
      isApprovedProRequest(req),
      getActiveAutomaticProductPromotions(),
    ]);

    res.json({
      products: products.map((product) => serializeProduct(product, isApprovedPro, promotionData.promotions, promotionData.categoryTargets)),
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        pages: Math.ceil(total / take),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /api/products/featured — Produits mis en avant
productsRouter.get("/featured", async (req: Request, res: Response): Promise<void> => {
  try {
    const [products, isApprovedPro, promotionData] = await Promise.all([
      prisma.product.findMany({
        where: { status: "active", rating: { gte: 4.5 } },
        orderBy: { rating: "desc" },
        take: 8,
        include: { variants: { orderBy: { order: "asc" } } },
      }),
      isApprovedProRequest(req),
      getActiveAutomaticProductPromotions(),
    ]);
    res.json(products.map((product) => serializeProduct(product, isApprovedPro, promotionData.promotions, promotionData.categoryTargets)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /api/products/promo — Produits en promotion
productsRouter.get("/promo", async (req: Request, res: Response): Promise<void> => {
  try {
    const [products, isApprovedPro, promotionData] = await Promise.all([
      prisma.product.findMany({
        where: { status: "active", isPromo: true },
        orderBy: { rating: "desc" },
        take: 12,
        include: { variants: { orderBy: { order: "asc" } } },
      }),
      isApprovedProRequest(req),
      getActiveAutomaticProductPromotions(),
    ]);
    res.json(products.map((product) => serializeProduct(product, isApprovedPro, promotionData.promotions, promotionData.categoryTargets)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /api/products/nouveautes — Nouveautés avec prix professionnel cohérent
productsRouter.get("/nouveautes", async (req: Request, res: Response): Promise<void> => {
  try {
    const [products, isApprovedPro, promotionData] = await Promise.all([
      prisma.product.findMany({
        where: { status: "active", isNew: true },
        orderBy: { createdAt: "desc" },
        take: 24,
        include: { variants: { orderBy: { order: "asc" } } },
      }),
      isApprovedProRequest(req),
      getActiveAutomaticProductPromotions(),
    ]);
    res.json(products.map((product) => serializeProduct(product, isApprovedPro, promotionData.promotions, promotionData.categoryTargets)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /api/products/reviews/public — Avis approuvés pour la homepage
productsRouter.get("/reviews/public", async (_req: Request, res: Response): Promise<void> => {
  try {
    const reviews = await prisma.review.findMany({
      where: { approved: true },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        product: { select: { name: true, brand: true } },
      },
    });
    res.json(reviews);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /api/products/search?q=terme — Recherche rapide header/catalogue
productsRouter.get("/search", async (req: Request, res: Response): Promise<void> => {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) {
      res.json([]);
      return;
    }
    const [products, isApprovedPro, promotionData] = await Promise.all([
      prisma.product.findMany({
        where: {
          status: "active",
          ...buildQuickSearchWhere(q),
        },
        orderBy: { name: "asc" },
        take: 40,
        include: { variants: { orderBy: { order: "asc" } } },
      }),
      isApprovedProRequest(req),
      getActiveAutomaticProductPromotions(),
    ]);

    const rankedProducts = products
      .map((product) => ({ product, score: scoreQuickSearchProduct(product, q) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name, "fr"))
      .slice(0, 8)
      .map((item) => item.product);

    res.json(rankedProducts.map((product) => serializeProduct(product, isApprovedPro, promotionData.promotions, promotionData.categoryTargets)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur recherche produits" });
  }
});

// GET /api/products/:slug — Détail d'un produit
productsRouter.get("/:slug", async (req: Request, res: Response): Promise<void> => {
  try {
    const [product, isApprovedPro, promotionData] = await Promise.all([
      prisma.product.findUnique({
        where: { slug: req.params.slug },
        include: {
          reviews: { where: { approved: true }, orderBy: { createdAt: "desc" }, take: 10 },
          variants: { orderBy: { order: "asc" } },
        },
      }),
      isApprovedProRequest(req),
      getActiveAutomaticProductPromotions(),
    ]);

    if (!product) {
      res.status(404).json({ error: "Produit non trouvé" });
      return;
    }

    const recommendedProductIds = Array.isArray(product.recommendedProductIds)
      ? product.recommendedProductIds.filter((id) => typeof id === "string" && id !== product.id).slice(0, 4)
      : [];
    const recommendedProducts = recommendedProductIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: recommendedProductIds }, status: "active" },
          include: { variants: { orderBy: { order: "asc" } } },
        })
      : [];
    const recommendedById = new Map(recommendedProducts.map((item) => [item.id, item]));
    const orderedRecommendedProducts = recommendedProductIds
      .map((id) => recommendedById.get(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    res.json({
      ...serializeProduct(product, isApprovedPro, promotionData.promotions, promotionData.categoryTargets),
      recommendedProducts: orderedRecommendedProducts.map((item) => serializeProduct(item, isApprovedPro, promotionData.promotions, promotionData.categoryTargets)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /api/products — Créer un produit (admin)
productsRouter.post("/", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = req.body;
    const product = await prisma.product.create({
      data: {
        ...data,
        images: JSON.stringify(data.images || []),
        features: JSON.stringify(data.features || []),
        tags: JSON.stringify(data.tags || []),
      },
    });
    res.status(201).json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur création produit" });
  }
});

// PUT /api/products/:id — Modifier un produit (admin)
productsRouter.put("/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = req.body;
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...data,
        images: data.images ? JSON.stringify(data.images) : undefined,
        features: data.features ? JSON.stringify(data.features) : undefined,
        tags: data.tags ? JSON.stringify(data.tags) : undefined,
      },
    });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur modification produit" });
  }
});

// DELETE /api/products/:id — Supprimer un produit (admin)
productsRouter.delete("/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.product.update({
      where: { id: req.params.id },
      data: { status: "archived" },
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur suppression produit" });
  }
});
