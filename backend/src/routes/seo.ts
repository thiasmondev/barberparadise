// ============================================================
// BARBER PARADISE — Routes API SEO Agent
// ============================================================
import { Router } from "express";
import { requireAdmin, AuthRequest } from "../middleware/auth";
import { prisma } from "../utils/prisma";
import {
  calculateSeoScore,
  optimizeProduct,
  generateBlogArticle,
  type ProductData,
} from "../services/seo-agent";

export const seoRouter = Router();

// All SEO routes require admin auth
seoRouter.use(requireAdmin as any);

// ─── Dashboard SEO Stats ────────────────────────────────────
seoRouter.get("/dashboard", async (_req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { status: "active" },
      select: {
        id: true,
        name: true,
        brand: true,
        category: true,
        subcategory: true,
        price: true,
        originalPrice: true,
        description: true,
        shortDescription: true,
        images: true,
        tags: true,
        features: true,
      },
    });

    let totalScore = 0;
    let excellent = 0; // 80+
    let good = 0; // 60-79
    let average = 0; // 40-59
    let poor = 0; // <40

    const scoredProducts = products.map((p) => {
      const { score, details } = calculateSeoScore(p as ProductData);
      totalScore += score;
      if (score >= 80) excellent++;
      else if (score >= 60) good++;
      else if (score >= 40) average++;
      else poor++;
      return {
        id: p.id,
        name: p.name,
        brand: p.brand,
        category: p.category,
        score,
        mainIssue: details.sort((a, b) => (a.score / a.max) - (b.score / b.max))[0]?.tip || "",
      };
    });

    // Sort by score ascending (worst first for priority)
    const priorityProducts = [...scoredProducts].sort((a, b) => a.score - b.score).slice(0, 20);

    // Blog stats
    const blogCount = await prisma.blogPost.count();
    const publishedBlogCount = await prisma.blogPost.count({ where: { published: true } });

    res.json({
      totalProducts: products.length,
      averageScore: products.length > 0 ? Math.round(totalScore / products.length) : 0,
      distribution: { excellent, good, average, poor },
      priorityProducts,
      blogStats: { total: blogCount, published: publishedBlogCount },
    });
  } catch (err: any) {
    console.error("SEO Dashboard error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Analyze Single Product ─────────────────────────────────
seoRouter.get("/analyze/:id", async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
    });
    if (!product) {
      res.status(404).json({ error: "Produit non trouvé" });
      return;
    }

    const { score, details } = calculateSeoScore(product as ProductData);
    res.json({ product, score, details });
  } catch (err: any) {
    console.error("SEO Analyze error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Optimize Single Product (AI) ───────────────────────────
seoRouter.post("/optimize/:id", async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
    });
    if (!product) {
      res.status(404).json({ error: "Produit non trouvé" });
      return;
    }

    const optimization = await optimizeProduct(product as ProductData);
    res.json({ product, optimization });
  } catch (err: any) {
    console.error("SEO Optimize error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Apply Optimization to Product ──────────────────────────
seoRouter.post("/apply/:id", async (req, res) => {
  try {
    const { optimizedTitle, metaDescription, seoDescription, suggestedTags } = req.body;

    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
    });
    if (!product) {
      res.status(404).json({ error: "Produit non trouvé" });
      return;
    }

    const updateData: Record<string, any> = {};
    if (optimizedTitle) updateData.name = optimizedTitle;
    if (metaDescription) updateData.shortDescription = metaDescription;
    if (seoDescription) updateData.description = seoDescription;
    if (suggestedTags && Array.isArray(suggestedTags)) {
      updateData.tags = JSON.stringify(suggestedTags);
    }

    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json({ success: true, product: updated });
  } catch (err: any) {
    console.error("SEO Apply error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Bulk Optimize (queue multiple products) ────────────────
seoRouter.post("/bulk-optimize", async (req, res) => {
  try {
    const { productIds, autoApply } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      res.status(400).json({ error: "productIds requis (array)" });
      return;
    }

    if (productIds.length > 20) {
      res.status(400).json({ error: "Maximum 20 produits par lot" });
      return;
    }

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    const results: { id: string; name: string; success: boolean; optimization?: any; error?: string }[] = [];

    for (const product of products) {
      try {
        const optimization = await optimizeProduct(product as ProductData);

        if (autoApply) {
          await prisma.product.update({
            where: { id: product.id },
            data: {
              name: optimization.optimizedTitle,
              shortDescription: optimization.metaDescription,
              description: optimization.seoDescription,
              tags: JSON.stringify(optimization.suggestedTags),
            },
          });
        }

        results.push({
          id: product.id,
          name: product.name,
          success: true,
          optimization,
        });
      } catch (err: any) {
        results.push({
          id: product.id,
          name: product.name,
          success: false,
          error: err.message,
        });
      }
    }

    res.json({
      total: products.length,
      success: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      autoApplied: autoApply || false,
      results,
    });
  } catch (err: any) {
    console.error("SEO Bulk Optimize error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Score All Products ─────────────────────────────────────
seoRouter.get("/scores", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const sort = (req.query.sort as string) || "score_asc";
    const category = req.query.category as string;
    const minScore = parseInt(req.query.minScore as string);
    const maxScore = parseInt(req.query.maxScore as string);

    const where: any = { status: "active" };
    if (category) where.category = category;

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        brand: true,
        category: true,
        subcategory: true,
        price: true,
        originalPrice: true,
        description: true,
        shortDescription: true,
        images: true,
        tags: true,
        features: true,
      },
    });

    let scoredProducts = products.map((p) => {
      const { score, details } = calculateSeoScore(p as ProductData);
      return { ...p, seoScore: score, seoDetails: details };
    });

    // Filter by score range
    if (!isNaN(minScore)) scoredProducts = scoredProducts.filter((p) => p.seoScore >= minScore);
    if (!isNaN(maxScore)) scoredProducts = scoredProducts.filter((p) => p.seoScore <= maxScore);

    // Sort
    if (sort === "score_asc") scoredProducts.sort((a, b) => a.seoScore - b.seoScore);
    else if (sort === "score_desc") scoredProducts.sort((a, b) => b.seoScore - a.seoScore);
    else if (sort === "name") scoredProducts.sort((a, b) => a.name.localeCompare(b.name));

    const total = scoredProducts.length;
    const paginated = scoredProducts.slice((page - 1) * limit, page * limit);

    res.json({
      products: paginated,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    console.error("SEO Scores error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Generate Blog Article (AI) ─────────────────────────────
seoRouter.post("/blog/generate", async (req, res) => {
  try {
    const { topic, type, relatedProductIds, keywords } = req.body;

    if (!topic || !type) {
      res.status(400).json({ error: "topic et type requis" });
      return;
    }

    let relatedProducts: { name: string; slug: string; brand: string }[] = [];
    if (relatedProductIds && Array.isArray(relatedProductIds) && relatedProductIds.length > 0) {
      const products = await prisma.product.findMany({
        where: { id: { in: relatedProductIds } },
        select: { name: true, slug: true, brand: true },
      });
      relatedProducts = products;
    }

    const article = await generateBlogArticle({
      topic,
      type,
      relatedProducts,
      keywords,
    });

    res.json(article);
  } catch (err: any) {
    console.error("SEO Blog Generate error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Save Generated Blog Article ────────────────────────────
seoRouter.post("/blog/save", async (req, res) => {
  try {
    const { title, slug, excerpt, content, category, readTime, published } = req.body;

    if (!title || !slug || !content) {
      res.status(400).json({ error: "title, slug et content requis" });
      return;
    }

    // Check slug uniqueness
    const existing = await prisma.blogPost.findUnique({ where: { slug } });
    if (existing) {
      res.status(400).json({ error: "Un article avec ce slug existe déjà" });
      return;
    }

    const article = await prisma.blogPost.create({
      data: {
        title,
        slug,
        excerpt: excerpt || "",
        content,
        image: "",
        author: "Barber Paradise",
        category: category || "guide",
        readTime: readTime || 5,
        published: published || false,
      },
    });

    res.json({ success: true, article });
  } catch (err: any) {
    console.error("SEO Blog Save error:", err);
    res.status(500).json({ error: err.message });
  }
});
