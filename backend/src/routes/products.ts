import { Router, Request, Response } from "express";
import { prisma } from "../utils/prisma";
import { requireAdmin } from "../middleware/auth";
import { buildCategorySlugFilter, collectChildSlugs } from "../utils/categoryFilters";

export const productsRouter = Router();

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
    if (brand) where.brand = { equals: brand, mode: "insensitive" };
    if (search) {
      // Utiliser AND pour combiner avec un éventuel OR de catégorie
      const searchOr = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { brand: { contains: search, mode: "insensitive" } },
      ];
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
    else if (sort === "newest") orderBy = { createdAt: "desc" };

    const [products, total] = await Promise.all([
      prisma.product.findMany({ where, orderBy, skip, take }),
      prisma.product.count({ where }),
    ]);

    // Parser les champs JSON
    const parsed = products.map(p => ({
      ...p,
      images: JSON.parse(p.images || "[]"),
      features: JSON.parse(p.features || "[]"),
      tags: JSON.parse(p.tags || "[]"),
    }));

    res.json({
      products: parsed,
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
productsRouter.get("/featured", async (_req: Request, res: Response): Promise<void> => {
  try {
    const products = await prisma.product.findMany({
      where: { status: "active", rating: { gte: 4.5 } },
      orderBy: { rating: "desc" },
      take: 8,
    });
    res.json(products.map(p => ({ ...p, images: JSON.parse(p.images || "[]"), tags: JSON.parse(p.tags || "[]") })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /api/products/promo — Produits en promotion
productsRouter.get("/promo", async (_req: Request, res: Response): Promise<void> => {
  try {
    const products = await prisma.product.findMany({
      where: { status: "active", isPromo: true },
      orderBy: { rating: "desc" },
      take: 12,
    });
    res.json(products.map(p => ({ ...p, images: JSON.parse(p.images || "[]"), tags: JSON.parse(p.tags || "[]") })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /api/products/:slug — Détail d'un produit
productsRouter.get("/:slug", async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await prisma.product.findUnique({
      where: { slug: req.params.slug },
      include: {
        reviews: { where: { approved: true }, orderBy: { createdAt: "desc" }, take: 10 },
        variants: { orderBy: { order: "asc" } },
      },
    });
    if (!product) {
      res.status(404).json({ error: "Produit non trouvé" });
      return;
    }
    res.json({
      ...product,
      images: JSON.parse(product.images || "[]"),
      features: JSON.parse(product.features || "[]"),
      tags: JSON.parse(product.tags || "[]"),
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
