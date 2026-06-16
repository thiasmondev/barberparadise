import { Router, Request, Response } from "express";
import { prisma } from "../utils/prisma";

export const blogRouter = Router();
export const adminBlogRouter = Router();

const BLOG_STATUSES = new Set(["draft", "published"]);

function toPositiveInt(value: unknown, fallback: number, max = 100): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 90) || "article-blog";
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function stripMarkdown(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function estimateReadTime(content: string): number {
  const words = stripMarkdown(content).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function deriveExcerpt(content: string, fallback = ""): string {
  return stripMarkdown(content || fallback).substring(0, 220);
}

async function ensureUniqueSlug(baseSlug: string, currentId?: string): Promise<string> {
  const base = slugify(baseSlug);
  let candidate = base;
  let suffix = 2;

  while (true) {
    const existing = await prisma.blogArticle.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === currentId) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

function blogArticleSelect() {
  return {
    id: true,
    slug: true,
    title: true,
    excerpt: true,
    content: true,
    coverImage: true,
    category: true,
    tags: true,
    readTime: true,
    seoMetaTitle: true,
    seoMetaDescription: true,
    seoKeywords: true,
    status: true,
    publishedAt: true,
    viewCount: true,
    linkedProductIds: true,
    sourceDraftId: true,
    createdAt: true,
    updatedAt: true,
  };
}

function buildArticlePayload(body: Record<string, unknown>) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const status = typeof body.status === "string" && BLOG_STATUSES.has(body.status) ? body.status : "draft";
  const publishedAt = body.publishedAt ? new Date(String(body.publishedAt)) : status === "published" ? new Date() : null;

  return {
    title,
    content,
    excerpt: typeof body.excerpt === "string" && body.excerpt.trim() ? body.excerpt.trim() : deriveExcerpt(content, title),
    coverImage: typeof body.coverImage === "string" && body.coverImage.trim() ? body.coverImage.trim() : null,
    category: typeof body.category === "string" && body.category.trim() ? body.category.trim() : "Conseils barbier",
    tags: toStringArray(body.tags),
    readTime: Number.isFinite(Number(body.readTime)) && Number(body.readTime) > 0 ? Number(body.readTime) : estimateReadTime(content),
    seoMetaTitle: typeof body.seoMetaTitle === "string" && body.seoMetaTitle.trim() ? body.seoMetaTitle.trim() : title,
    seoMetaDescription:
      typeof body.seoMetaDescription === "string" && body.seoMetaDescription.trim()
        ? body.seoMetaDescription.trim()
        : deriveExcerpt(content, title).substring(0, 160),
    seoKeywords: toStringArray(body.seoKeywords),
    status,
    publishedAt,
    linkedProductIds: toStringArray(body.linkedProductIds),
    sourceDraftId: typeof body.sourceDraftId === "string" && body.sourceDraftId.trim() ? body.sourceDraftId.trim() : null,
  };
}

function requireArticleFields(title: string, content: string): string | null {
  if (!title) return "Le titre est requis.";
  if (!content) return "Le contenu est requis.";
  return null;
}

blogRouter.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = toPositiveInt(req.query.page, 1, 10_000);
    const limit = toPositiveInt(req.query.limit, 10, 50);
    const skip = (page - 1) * limit;
    const category = typeof req.query.category === "string" ? req.query.category.trim() : "";
    const tag = typeof req.query.tag === "string" ? req.query.tag.trim() : "";
    const where: Record<string, unknown> = { status: "published" };
    if (category) where.category = category;
    if (tag) where.tags = { has: tag };

    const [articles, total] = await Promise.all([
      prisma.blogArticle.findMany({ where, select: blogArticleSelect(), orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }], skip, take: limit }),
      prisma.blogArticle.count({ where }),
    ]);

    res.json({ articles, total, page, limit, totalPages: Math.ceil(total / limit), posts: articles });
  } catch (err) {
    console.error("Erreur liste blog:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

blogRouter.get("/categories", async (_req: Request, res: Response): Promise<void> => {
  try {
    const categories = await prisma.blogArticle.groupBy({
      by: ["category"],
      where: { status: "published" },
      _count: { category: true },
      orderBy: { category: "asc" },
    });
    res.json({ categories: categories.map((category) => ({ name: category.category, count: category._count.category })) });
  } catch (err) {
    console.error("Erreur catégories blog:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

blogRouter.get("/:slug", async (req: Request, res: Response): Promise<void> => {
  try {
    const article = await prisma.blogArticle.findUnique({ where: { slug: req.params.slug }, select: blogArticleSelect() });
    if (!article || article.status !== "published") {
      res.status(404).json({ error: "Article non trouvé" });
      return;
    }

    await prisma.blogArticle.update({ where: { id: article.id }, data: { viewCount: { increment: 1 } } });

    const [linkedProducts, relatedArticles] = await Promise.all([
      article.linkedProductIds.length
        ? prisma.product.findMany({
            where: { id: { in: article.linkedProductIds }, status: "active" },
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
              isNew: true,
              isPromo: true,
              inStock: true,
              stockCount: true,
            },
          })
        : Promise.resolve([]),
      prisma.blogArticle.findMany({
        where: { status: "published", id: { not: article.id }, OR: [{ category: article.category }, { tags: { hasSome: article.tags } }] },
        select: blogArticleSelect(),
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        take: 3,
      }),
    ]);

    res.json({ article: { ...article, viewCount: article.viewCount + 1 }, linkedProducts, relatedArticles });
  } catch (err) {
    console.error("Erreur détail blog:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

adminBlogRouter.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const page = toPositiveInt(req.query.page, 1, 10_000);
    const limit = toPositiveInt(req.query.limit, 20, 100);
    const skip = (page - 1) * limit;
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const category = typeof req.query.category === "string" ? req.query.category.trim() : "";
    const where: Record<string, unknown> = {};
    if (status && BLOG_STATUSES.has(status)) where.status = status;
    if (category) where.category = category;

    const [articles, total] = await Promise.all([
      prisma.blogArticle.findMany({ where, select: blogArticleSelect(), orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }], skip, take: limit }),
      prisma.blogArticle.count({ where }),
    ]);
    res.json({ articles, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("Erreur liste admin blog:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

adminBlogRouter.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const article = await prisma.blogArticle.findUnique({ where: { id: req.params.id }, select: blogArticleSelect() });
    if (!article) {
      res.status(404).json({ error: "Article non trouvé" });
      return;
    }
    res.json(article);
  } catch (err) {
    console.error("Erreur détail admin blog:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

adminBlogRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = buildArticlePayload(req.body as Record<string, unknown>);
    const error = requireArticleFields(payload.title, payload.content);
    if (error) {
      res.status(400).json({ error });
      return;
    }

    const slug = await ensureUniqueSlug(typeof req.body.slug === "string" && req.body.slug.trim() ? req.body.slug : payload.title);
    const article = await prisma.blogArticle.create({ data: { ...payload, slug } });
    res.status(201).json(article);
  } catch (err) {
    console.error("Erreur création admin blog:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Erreur création article" });
  }
});

adminBlogRouter.patch("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await prisma.blogArticle.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: "Article non trouvé" });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    if (typeof body.title === "string") data.title = body.title.trim();
    if (typeof body.content === "string") data.content = body.content.trim();
    if (typeof body.excerpt === "string") data.excerpt = body.excerpt.trim();
    if (typeof body.coverImage === "string") data.coverImage = body.coverImage.trim() || null;
    if (typeof body.category === "string") data.category = body.category.trim() || existing.category;
    if (body.tags !== undefined) data.tags = toStringArray(body.tags);
    if (body.seoKeywords !== undefined) data.seoKeywords = toStringArray(body.seoKeywords);
    if (body.linkedProductIds !== undefined) data.linkedProductIds = toStringArray(body.linkedProductIds);
    if (typeof body.seoMetaTitle === "string") data.seoMetaTitle = body.seoMetaTitle.trim() || null;
    if (typeof body.seoMetaDescription === "string") data.seoMetaDescription = body.seoMetaDescription.trim() || null;
    if (Number.isFinite(Number(body.readTime)) && Number(body.readTime) > 0) data.readTime = Number(body.readTime);
    if (typeof body.status === "string" && BLOG_STATUSES.has(body.status)) {
      data.status = body.status;
      data.publishedAt = body.status === "published" ? existing.publishedAt ?? new Date() : null;
    }
    if (typeof body.sourceDraftId === "string") data.sourceDraftId = body.sourceDraftId.trim() || null;
    if (typeof body.slug === "string" && body.slug.trim()) data.slug = await ensureUniqueSlug(body.slug, existing.id);
    if (!data.excerpt && typeof data.content === "string") data.excerpt = deriveExcerpt(data.content, String(data.title ?? existing.title));
    if (!data.readTime && typeof data.content === "string") data.readTime = estimateReadTime(data.content);

    const article = await prisma.blogArticle.update({ where: { id: existing.id }, data });
    res.json(article);
  } catch (err) {
    console.error("Erreur modification admin blog:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Erreur modification article" });
  }
});

adminBlogRouter.post("/:id/publish", async (req: Request, res: Response): Promise<void> => {
  try {
    const article = await prisma.blogArticle.update({ where: { id: req.params.id }, data: { status: "published", publishedAt: new Date() } });
    res.json(article);
  } catch (err) {
    console.error("Erreur publication admin blog:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Erreur publication article" });
  }
});

adminBlogRouter.post("/:id/unpublish", async (req: Request, res: Response): Promise<void> => {
  try {
    const article = await prisma.blogArticle.update({ where: { id: req.params.id }, data: { status: "draft", publishedAt: null } });
    res.json(article);
  } catch (err) {
    console.error("Erreur dépublication admin blog:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Erreur dépublication article" });
  }
});

adminBlogRouter.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.blogArticle.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error("Erreur suppression admin blog:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Erreur suppression article" });
  }
});
