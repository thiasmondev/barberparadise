import { Router, Request, Response } from "express";
import { prisma } from "../utils/prisma";
import { requireAdmin } from "../middleware/auth";

export const blogRouter = Router();

// GET /api/blog — Articles publiés
blogRouter.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = "1", limit = "10", category } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { status: "published" };
    if (category) where.categorySlug = category;

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({ where, orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }], skip, take: parseInt(limit) }),
      prisma.blogPost.count({ where }),
    ]);
    res.json({ posts, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /api/blog/:slug
blogRouter.get("/:slug", async (req: Request, res: Response): Promise<void> => {
  try {
    const post = await prisma.blogPost.findUnique({ where: { slug: req.params.slug } });
    if (!post || post.status !== "published") {
      res.status(404).json({ error: "Article non trouvé" });
      return;
    }
    res.json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /api/blog (admin)
blogRouter.post("/", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const post = await prisma.blogPost.create({ data: req.body });
    res.status(201).json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur création article" });
  }
});

// PUT /api/blog/:id (admin)
blogRouter.put("/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const post = await prisma.blogPost.update({ where: { id: req.params.id }, data: req.body });
    res.json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur modification article" });
  }
});

// DELETE /api/blog/:id (admin)
blogRouter.delete("/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.blogPost.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur suppression article" });
  }
});
