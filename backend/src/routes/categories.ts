import { Router, Request, Response } from "express";
import { prisma } from "../utils/prisma";
import { requireAdmin } from "../middleware/auth";

export const categoriesRouter = Router();

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
    const products = await prisma.product.findMany({
      where: { status: "active", OR: [{ category: slug }, { subcategory: slug }] },
      orderBy: { rating: "desc" },
    });
    res.json(products.map(p => ({ ...p, images: JSON.parse(p.images || "[]"), tags: JSON.parse(p.tags || "[]") })));
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
