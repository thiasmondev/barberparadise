import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../utils/prisma";
import { requireAdmin } from "../middleware/auth";

export const categoriesRouter = Router();

type CustomerToken = { id: string; email: string };

type CategoryProduct = {
  images?: string | null;
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

function parseJsonArray(value?: string | null): unknown[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function serializeCategoryProduct<T extends CategoryProduct>(product: T, isApprovedPro: boolean) {
  const parsed = {
    ...product,
    images: parseJsonArray(product.images),
    tags: parseJsonArray(product.tags),
  } as Omit<T, "images" | "tags"> & {
    images: unknown[];
    tags: unknown[];
    price: number;
    priceProEur?: number | null;
  };
  const hasPriceProEur = typeof parsed.priceProEur === "number" && parsed.priceProEur > 0;
  const pricePublic = parsed.price;
  const price = isApprovedPro && hasPriceProEur ? parsed.priceProEur! : pricePublic;
  const serialized = {
    ...parsed,
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

// GET /api/categories
categoriesRouter.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    const categories = await prisma.category.findMany({ orderBy: [{ parentSlug: "asc" }, { order: "asc" }] });
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /api/categories/:slug/products
categoriesRouter.get("/:slug/products", async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;
    const [products, isApprovedPro] = await Promise.all([
      prisma.product.findMany({
        where: { status: "active", OR: [{ category: slug }, { subcategory: slug }] },
        orderBy: { rating: "desc" },
      }),
      isApprovedProRequest(req),
    ]);
    res.json(products.map((product) => serializeCategoryProduct(product, isApprovedPro)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /api/categories (admin)
categoriesRouter.post("/", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const category = await prisma.category.create({ data: req.body });
    res.status(201).json(category);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur création catégorie" });
  }
});

// PUT /api/categories/:id (admin)
categoriesRouter.put("/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const category = await prisma.category.update({ where: { id: req.params.id }, data: req.body });
    res.json(category);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur modification catégorie" });
  }
});

// PATCH /api/categories/reorder (admin) — Sauvegarder le nouvel ordre par drag-and-drop
categoriesRouter.patch("/reorder", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { items } = req.body as { items: { id: string; order: number }[] };
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "items requis" });
      return;
    }
    await Promise.all(
      items.map(({ id, order }) =>
        prisma.category.update({ where: { id }, data: { order } })
      )
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// DELETE /api/categories/:id (admin)
categoriesRouter.delete("/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur suppression catégorie" });
  }
});
