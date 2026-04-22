import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

// ─── GET /api/brands ──────────────────────────────────────────
// Liste toutes les marques avec le nombre de produits actifs
router.get("/", async (_req: Request, res: Response) => {
  try {
    const brands = await prisma.brand.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            products: {
              where: { status: "active" },
            },
          },
        },
      },
    });

    const result = brands.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      description: b.description,
      logo: b.logo,
      bannerImage: b.bannerImage,
      website: b.website,
      productCount: b._count.products,
    }));

    res.json(result);
  } catch (err) {
    console.error("GET /api/brands error:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ─── GET /api/brands/:slug ────────────────────────────────────
// Détail d'une marque + ses produits paginés
router.get("/:slug", async (req: Request, res: Response) => {
  const { slug } = req.params;
  const page = parseInt((req.query.page as string) || "1", 10);
  const limit = parseInt((req.query.limit as string) || "24", 10);
  const sort = (req.query.sort as string) || "newest";
  const skip = (page - 1) * limit;

  try {
    const brand = await prisma.brand.findUnique({
      where: { slug },
    });

    if (!brand) {
      return res.status(404).json({ error: "Marque introuvable" });
    }

    // Tri
    type OrderBy = { createdAt?: "asc" | "desc"; price?: "asc" | "desc"; rating?: "desc" };
    const orderBy: OrderBy =
      sort === "price-asc"
        ? { price: "asc" }
        : sort === "price-desc"
        ? { price: "desc" }
        : sort === "rating"
        ? { rating: "desc" }
        : { createdAt: "desc" };

    const where = { brandId: brand.id, status: "active" };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          slug: true,
          name: true,
          brand: true,
          price: true,
          originalPrice: true,
          images: true,
          rating: true,
          reviewCount: true,
          inStock: true,
          isNew: true,
          isPromo: true,
          category: true,
          subcategory: true,
        },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      brand: {
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        description: brand.description,
        logo: brand.logo,
        bannerImage: brand.bannerImage,
        website: brand.website,
      },
      products,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        page,
        limit,
      },
    });
  } catch (err) {
    console.error(`GET /api/brands/${slug} error:`, err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
