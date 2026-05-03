import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const router = Router();
const prisma = new PrismaClient();

type CustomerToken = { id: string; email: string };

type BrandProduct = {
  images?: string | null;
  features?: string | null;
  tags?: string | null;
  price: number;
  priceProEur?: number | null;
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

function serializeBrandProduct<T extends BrandProduct>(product: T, isApprovedPro: boolean) {
  const hasPriceProEur = typeof product.priceProEur === "number" && product.priceProEur > 0;
  const pricePublic = product.price;
  const price = isApprovedPro && hasPriceProEur ? product.priceProEur! : pricePublic;
  const serialized = {
    ...product,
    price,
    pricePublic,
    isPro: isApprovedPro,
    hasPriceProEur,
  };

  if (!isApprovedPro) {
    const { priceProEur: _priceProEur, ...publicProduct } = serialized;
    return publicProduct;
  }

  return serialized;
}

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

    const [products, total, isApprovedPro] = await Promise.all([
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
          priceProEur: true,
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
      isApprovedProRequest(req),
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
      products: products.map((product) => serializeBrandProduct(product, isApprovedPro)),
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

// ─── PATCH /api/brands/:id (admin) ──────────────────────────
// Mise à jour d'une marque (logo, description, bannerImage, website, name)
router.patch("/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const adminToken = req.headers["x-admin-token"] || req.headers["authorization"]?.replace("Bearer ", "");

  // Vérification basique du token admin
  if (!adminToken) {
    return res.status(401).json({ error: "Token admin requis" });
  }

  try {
    const { name, description, logo, bannerImage, website } = req.body;

    const updated = await prisma.brand.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(logo !== undefined && { logo }),
        ...(bannerImage !== undefined && { bannerImage }),
        ...(website !== undefined && { website }),
      },
    });

    res.json(updated);
  } catch (err) {
    console.error(`PATCH /api/brands/${id} error:`, err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
