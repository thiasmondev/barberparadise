// ============================================================
// BARBER PARADISE — Routes API SEO Agent
// ============================================================
import { Router } from "express";
import { v2 as cloudinary } from "cloudinary";
import { requireAdmin, AuthRequest } from "../middleware/auth";
import { prisma } from "../utils/prisma";
import {
  calculateSeoScore,
  optimizeProduct,
  generateBlogArticle,
  generateImageAlts,
  generateProductDraftFromUrl,
  type ProductData,
  type ProductDraftFromUrl,
} from "../services/seo-agent";

export const seoRouter = Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function hasCloudinaryConfig(): boolean {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

function isImportableImageUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

async function importDraftImagesToCloudinary(draft: ProductDraftFromUrl, productId: string): Promise<string[]> {
  if (!hasCloudinaryConfig()) return [];

  const candidates = Array.from(new Set((draft.imageUrls || []).filter(isImportableImageUrl))).slice(0, 8);
  const imported: string[] = [];

  for (const [index, imageUrl] of candidates.entries()) {
    try {
      const result = await cloudinary.uploader.upload(imageUrl, {
        folder: `barberparadise/products/${productId}`,
        public_id: `source-${index + 1}`,
        overwrite: true,
        resource_type: "image",
        transformation: [{ width: 1200, height: 1200, crop: "limit", quality: "auto", fetch_format: "auto" }],
      });
      if (result.secure_url) imported.push(result.secure_url);
    } catch (error) {
      console.warn("[SEO PRODUCT URL] Image import skipped:", imageUrl, error);
    }
  }

  return imported;
}

function slugifyProductUrlDraft(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "nouveau-produit";
}

async function getUniqueProductSlug(base: string): Promise<string> {
  const cleanBase = slugifyProductUrlDraft(base);
  let slug = cleanBase;
  let index = 2;
  while (await prisma.product.findUnique({ where: { slug } })) {
    slug = `${cleanBase}-${index}`;
    index += 1;
  }
  return slug;
}

function productDraftToCreateData(draft: ProductDraftFromUrl, slug: string, importedImageUrls: string[] = []) {
  const price = typeof draft.price === "number" && Number.isFinite(draft.price) ? draft.price : 0;
  const fallbackImageUrls = Array.from(new Set((draft.imageUrls || []).filter(isImportableImageUrl))).slice(0, 8);
  const storedImageUrls = importedImageUrls.length > 0 ? importedImageUrls.slice(0, 8) : fallbackImageUrls;
  const storedImageAlts = Array.isArray(draft.imageAlts) ? draft.imageAlts.slice(0, storedImageUrls.length || 8) : [];
  return {
    handle: slug,
    slug,
    name: draft.name.trim(),
    brand: draft.brand.trim() || "À compléter",
    category: draft.category.trim() || "accessoires",
    subcategory: draft.subcategory.trim() || "nouveautes",
    subsubcategory: draft.subsubcategory?.trim() || "",
    price,
    originalPrice: typeof draft.originalPrice === "number" && Number.isFinite(draft.originalPrice) ? draft.originalPrice : null,
    images: JSON.stringify(storedImageUrls),
    imageAlts: JSON.stringify(storedImageAlts),
    description: draft.seoDescription || draft.directAnswerIntro || draft.shortDescription,
    shortDescription: (draft.shortDescription || draft.directAnswerIntro || draft.name).slice(0, 180),
    features: JSON.stringify(Array.isArray(draft.features) ? draft.features.slice(0, 12) : []),
    tags: JSON.stringify(Array.isArray(draft.suggestedTags) ? draft.suggestedTags.slice(0, 12) : []),
    inStock: true,
    stockCount: 0,
    weightG: typeof draft.weightG === "number" ? Math.round(draft.weightG) : null,
    lengthCm: typeof draft.lengthCm === "number" ? draft.lengthCm : null,
    widthCm: typeof draft.widthCm === "number" ? draft.widthCm : null,
    heightCm: typeof draft.heightCm === "number" ? draft.heightCm : null,
    isFragile: Boolean(draft.isFragile),
    isLiquid: Boolean(draft.isLiquid),
    isAerosol: Boolean(draft.isAerosol),
    requiresGlass: Boolean(draft.requiresGlass),
    logisticNote: draft.logisticNote || `Brouillon créé depuis ${draft.sourceUrl}. Vérifier prix, stock, images et caractéristiques avant publication.`,
    status: "draft",
    isNew: true,
  };
}


// All SEO routes require admin auth
seoRouter.use(requireAdmin as any);


// ─── Create Product Draft from Brand URL ──────────────────────
seoRouter.post("/product-url/draft", async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== "string") {
      res.status(400).json({ error: "URL produit requise" });
      return;
    }

    const draft = await generateProductDraftFromUrl(url);
    res.json({ draft });
  } catch (err: any) {
    console.error("SEO Product URL draft error:", err);
    res.status(500).json({ error: err.message || "Erreur génération fiche produit depuis URL" });
  }
});

seoRouter.post("/product-url/create", async (req, res) => {
  try {
    const draft = req.body?.draft as ProductDraftFromUrl | undefined;
    if (!draft || !draft.name || !draft.seoDescription) {
      res.status(400).json({ error: "Brouillon produit incomplet" });
      return;
    }

    const slug = await getUniqueProductSlug(draft.name);
    const created = await prisma.product.create({ data: productDraftToCreateData(draft, slug, []) });
    const importedImages = await importDraftImagesToCloudinary(draft, created.id);
    const product = importedImages.length > 0
      ? await prisma.product.update({
          where: { id: created.id },
          data: {
            images: JSON.stringify(importedImages),
            imageAlts: JSON.stringify(Array.isArray(draft.imageAlts) ? draft.imageAlts.slice(0, importedImages.length) : []),
          },
        })
      : created;

    res.status(201).json({
      success: true,
      imageImport: {
        imported: importedImages.length,
        candidates: Array.isArray(draft.imageUrls) ? draft.imageUrls.length : 0,
        storage: importedImages.length > 0 ? "cloudinary" : "source_urls_pending_import",
      },
      product: {
        ...product,
        images: JSON.parse(product.images || "[]"),
        imageAlts: JSON.parse(product.imageAlts || "[]"),
        tags: JSON.parse(product.tags || "[]"),
        features: JSON.parse(product.features || "[]"),
      },
    });
  } catch (err: any) {
    console.error("SEO Product URL create error:", err);
    res.status(500).json({ error: err.message || "Erreur création brouillon produit" });
  }
});

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

// ─── GEO Optimize Single Product (Schema.org + FAQ) ─────────
seoRouter.post("/geo-optimize/:id", async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { variants: true },
    });
    if (!product) {
      res.status(404).json({ error: "Produit non trouvé" });
      return;
    }

    const { optimizeProductGeo } = await import("../services/seo-agent");
    const productData = {
      ...product,
      variants: product.variants?.map((v: any) => ({
        name: v.name,
        price: v.price,
        inStock: v.inStock,
      })),
    };

    const geoOptimization = await optimizeProductGeo(productData as any);
    res.json({ product, geoOptimization });
  } catch (err: any) {
    console.error("GEO Optimize error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Apply GEO Optimization (Schema + FAQ) ──────────────────
seoRouter.post("/geo-apply/:id", async (req, res) => {
  try {
    const { schemaJsonLd, faqItems, directAnswerIntro } = req.body;

    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
    });
    if (!product) {
      res.status(404).json({ error: "Produit non trouvé" });
      return;
    }

    const updateData: Record<string, any> = {};

    // Stocker le schema JSON-LD et la FAQ dans les features du produit
    const existingFeatures = (() => {
      try { return JSON.parse(product.features || "{}"); } catch { return {}; }
    })();

    if (schemaJsonLd) existingFeatures.schemaJsonLd = schemaJsonLd;
    if (faqItems && Array.isArray(faqItems)) existingFeatures.faqItems = faqItems;
    if (directAnswerIntro) existingFeatures.directAnswerIntro = directAnswerIntro;

    updateData.features = JSON.stringify(existingFeatures);

    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json({ success: true, product: updated });
  } catch (err: any) {
    console.error("GEO Apply error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GEO Score Single Product ────────────────────────────────
seoRouter.get("/geo-score/:id", async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
    });
    if (!product) {
      res.status(404).json({ error: "Produit non trouvé" });
      return;
    }

    const { calculateGeoScore } = await import("../services/seo-agent");
    const { score, details } = calculateGeoScore(product as any);
    res.json({ product, geoScore: score, geoDetails: details });
  } catch (err: any) {
    console.error("GEO Score error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Generate llms.txt ───────────────────────────────────────
seoRouter.post("/generate-llms-txt", async (req, res) => {
  try {
    const { generateLlmsTxt } = await import("../services/seo-agent");

    // Récupérer les catégories avec le nombre de produits
    const categories = await prisma.category.findMany({
      where: { parentSlug: null as any },
      orderBy: { order: "asc" },
    });

    const categoriesWithCount = await Promise.all(
      categories.map(async (cat: any) => {
        const count = await prisma.product.count({
          where: { category: cat.slug, status: "active" },
        });
        return { name: cat.name, slug: cat.slug, productCount: count };
      })
    );

    // Récupérer les 20 meilleurs produits (en stock, les plus récents)
    const topProducts = await prisma.product.findMany({
      where: { status: "active", inStock: true },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { name: true, brand: true, category: true, price: true, slug: true },
    });

    const totalProducts = await prisma.product.count({ where: { status: "active" } });

    const { content } = await generateLlmsTxt({
      categories: categoriesWithCount,
      topProducts,
      totalProducts,
      siteUrl: "https://barberparadise.fr",
    });

    res.json({ content });
  } catch (err: any) {
    console.error("Generate llms.txt error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GEO Dashboard (scores GEO de tous les produits) ────────
seoRouter.get("/geo-dashboard", async (_req, res) => {
  try {
    const { calculateGeoScore } = await import("../services/seo-agent");

    const products = await prisma.product.findMany({
      where: { status: "active" },
      select: {
        id: true, name: true, brand: true, category: true,
        description: true, shortDescription: true, images: true, tags: true, features: true,
        price: true, originalPrice: true, subcategory: true,
      },
      take: 100,
    });

    let totalGeoScore = 0;
    let geoExcellent = 0, geoGood = 0, geoAverage = 0, geoPoor = 0;

    const scoredProducts = products.map((p: any) => {
      const { score } = calculateGeoScore(p);
      totalGeoScore += score;
      if (score >= 80) geoExcellent++;
      else if (score >= 60) geoGood++;
      else if (score >= 40) geoAverage++;
      else geoPoor++;

      // Vérifier si le produit a déjà un schema JSON-LD
      let hasSchema = false;
      let hasFaq = false;
      try {
        const features = JSON.parse(p.features || "{}");
        hasSchema = !!features.schemaJsonLd;
        hasFaq = !!(features.faqItems && features.faqItems.length > 0);
      } catch { /* */ }

      return { id: p.id, name: p.name, brand: p.brand, category: p.category, geoScore: score, hasSchema, hasFaq };
    });

    const priorityProducts = [...scoredProducts]
      .sort((a: any, b: any) => a.geoScore - b.geoScore)
      .slice(0, 20);

    res.json({
      totalProducts: products.length,
      averageGeoScore: products.length > 0 ? Math.round(totalGeoScore / products.length) : 0,
      distribution: { excellent: geoExcellent, good: geoGood, average: geoAverage, poor: geoPoor },
      productsWithSchema: scoredProducts.filter((p: any) => p.hasSchema).length,
      productsWithFaq: scoredProducts.filter((p: any) => p.hasFaq).length,
      priorityProducts,
    });
  } catch (err: any) {
    console.error("GEO Dashboard error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GEO Enrichi : Snippet vocal + E-E-A-T + Longue traîne ──
seoRouter.post("/geo-enrich/:id", async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { variants: true },
    });
    if (!product) {
      res.status(404).json({ error: "Produit non trouvé" });
      return;
    }

    const { generateGeoEnrichedContent } = await import("../services/seo-agent");
    const enriched = await generateGeoEnrichedContent(product as any);
    res.json({ product, enriched });
  } catch (err: any) {
    console.error("GEO Enrich error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Appliquer le contenu GEO enrichi ───────────────────────
seoRouter.post("/geo-enrich-apply/:id", async (req, res) => {
  try {
    const { voiceSnippet, eeaatContent, longTailQuestions, competitorComparison, useCases, buyingGuideSnippet, entityKeywords } = req.body;

    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) {
      res.status(404).json({ error: "Produit non trouvé" });
      return;
    }

    const existingFeatures = (() => {
      try { return JSON.parse(product.features || "{}"); } catch { return {}; }
    })();

    if (voiceSnippet !== undefined) existingFeatures.voiceSnippet = voiceSnippet;
    if (eeaatContent !== undefined) existingFeatures.eeaatContent = eeaatContent;
    if (longTailQuestions !== undefined) existingFeatures.longTailQuestions = longTailQuestions;
    if (competitorComparison !== undefined) existingFeatures.competitorComparison = competitorComparison;
    if (useCases !== undefined) existingFeatures.useCases = useCases;
    if (buyingGuideSnippet !== undefined) existingFeatures.buyingGuideSnippet = buyingGuideSnippet;
    if (entityKeywords !== undefined) existingFeatures.entityKeywords = entityKeywords;

    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: { features: JSON.stringify(existingFeatures) },
    });

    res.json({ success: true, product: updated });
  } catch (err: any) {
    console.error("GEO Enrich Apply error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Audit GEO global du site ────────────────────────────────
seoRouter.get("/geo-audit", async (_req, res) => {
  try {
    const { runGeoAudit } = await import("../services/seo-agent");

    const products = await prisma.product.findMany({
      where: { status: "active" },
      select: {
        id: true, name: true, brand: true, category: true, subcategory: true,
        description: true, shortDescription: true, images: true, tags: true,
        features: true, price: true, originalPrice: true, inStock: true,
      },
      take: 200,
    });

    const auditResult = await runGeoAudit(products as any[]);

    // Vérifier si llms.txt existe (on suppose qu'il est déployé si au moins 1 produit a un schema)
    auditResult.llmsTxtExists = auditResult.productsWithSchema > 0;

    res.json(auditResult);
  } catch (err: any) {
    console.error("GEO Audit error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Déployer llms.txt (sauvegarder dans la base) ───────────
seoRouter.post("/deploy-llms-txt", async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      res.status(400).json({ error: "Contenu llms.txt requis" });
      return;
    }

    // Sauvegarder dans la table des settings (ou une table dédiée)
    // Pour l'instant, on le stocke dans un enregistrement BlogPost spécial
    const existing = await prisma.blogPost.findUnique({ where: { slug: "__llms-txt__" } });

    if (existing) {
      await prisma.blogPost.update({
        where: { slug: "__llms-txt__" },
        data: { content, updatedAt: new Date() },
      });
    } else {
      await prisma.blogPost.create({
        data: {
          title: "llms.txt",
          slug: "__llms-txt__",
          excerpt: "Fichier llms.txt pour les LLM",
          content,
          image: "",
          author: "system",
          category: "system",
          readTime: 0,
          published: false,
        },
      });
    }

    res.json({ success: true, message: "llms.txt déployé avec succès" });
  } catch (err: any) {
    console.error("Deploy llms.txt error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Générateur de guide d'achat par catégorie ───────────────
seoRouter.post("/generate-buying-guide", async (req, res) => {
  try {
    const { category } = req.body;
    if (!category) {
      res.status(400).json({ error: "category requis" });
      return;
    }

    const { generateBlogArticle } = await import("../services/seo-agent");

    // Récupérer les produits de la catégorie
    const products = await prisma.product.findMany({
      where: { category, status: "active" },
      select: { name: true, slug: true, brand: true, price: true },
      orderBy: { price: "desc" },
      take: 10,
    });

    const article = await generateBlogArticle({
      topic: `Guide d'achat ${category} 2026 — Meilleurs produits pour barbiers`,
      type: "guide",
      relatedProducts: products,
      keywords: [category, "barbier", "professionnel", "guide d'achat 2026"],
    });

    res.json(article);
  } catch (err: any) {
    console.error("Generate buying guide error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Contenu GEO pour une catégorie ─────────────────────────
seoRouter.post("/geo-category", async (req, res) => {
  try {
    const { categorySlug } = req.body;
    if (!categorySlug) {
      res.status(400).json({ error: "categorySlug requis" });
      return;
    }

    const { generateCategoryGeoContent } = await import("../services/seo-agent");

    const category = await prisma.category.findUnique({ where: { slug: categorySlug } });
    const productCount = await prisma.product.count({ where: { category: categorySlug, status: "active" } });
    const topProducts = await prisma.product.findMany({
      where: { category: categorySlug, status: "active" },
      select: { name: true, brand: true, price: true },
      orderBy: { price: "desc" },
      take: 8,
    });

    const result = await generateCategoryGeoContent({
      categoryName: category?.name || categorySlug,
      categorySlug,
      productCount,
      topProducts,
    });

    res.json(result);
  } catch (err: any) {
    console.error("GEO Category error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/seo/image-alts/generate/:id — Générer alt texts pour un produit ─
seoRouter.post("/image-alts/generate/:id", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) { res.status(404).json({ error: "Produit introuvable" }); return; }

    const alts = await generateImageAlts({
      id: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category,
      subcategory: product.subcategory || "",
      images: product.images || "[]",
    });

    // Sauvegarder en base
    await prisma.product.update({
      where: { id: product.id },
      data: { imageAlts: JSON.stringify(alts) },
    });

    res.json({ alts, saved: true });
  } catch (err: any) {
    console.error("Image alts generate error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/seo/image-alts/:id — Sauvegarder alt texts manuellement ─────────
seoRouter.put("/image-alts/:id", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { alts } = req.body as { alts: string[] };
    if (!Array.isArray(alts)) { res.status(400).json({ error: "alts doit être un tableau" }); return; }

    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: { imageAlts: JSON.stringify(alts) },
    });

    res.json({ alts, saved: true });
  } catch (err: any) {
    console.error("Image alts save error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/seo/image-alts/bulk — Générer en masse (batch de 10) ──────────
seoRouter.post("/image-alts/bulk", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  try {
    // Récupérer tous les produits sans alt texts ou avec alt texts vides
    const products = await prisma.product.findMany({
      where: { status: "active" },
      select: { id: true, name: true, brand: true, category: true, subcategory: true, images: true, imageAlts: true },
    });

    const toProcess = products.filter((p) => {
      if (!p.imageAlts) return true;
      try {
        const alts = JSON.parse(p.imageAlts);
        return !Array.isArray(alts) || alts.length === 0 || alts.every((a: string) => !a.trim());
      } catch { return true; }
    });

    if (toProcess.length === 0) {
      res.json({ processed: 0, total: 0, message: "Tous les produits ont déjà des alt texts" });
      return;
    }

    // Traiter par batch de 10
    const BATCH_SIZE = 10;
    let processed = 0;
    const errors: string[] = [];

    for (let i = 0; i < Math.min(toProcess.length, BATCH_SIZE); i++) {
      const p = toProcess[i];
      try {
        const alts = await generateImageAlts({
          id: p.id,
          name: p.name,
          brand: p.brand,
          category: p.category,
          subcategory: p.subcategory || "",
          images: p.images || "[]",
        });
        await prisma.product.update({
          where: { id: p.id },
          data: { imageAlts: JSON.stringify(alts) },
        });
        processed++;
      } catch (e: any) {
        errors.push(`${p.name}: ${e.message}`);
      }
    }

    res.json({
      processed,
      total: toProcess.length,
      remaining: Math.max(0, toProcess.length - BATCH_SIZE),
      errors: errors.length > 0 ? errors : undefined,
      message: `${processed} produits traités sur ${toProcess.length} à traiter`,
    });
  } catch (err: any) {
    console.error("Image alts bulk error:", err);
    res.status(500).json({ error: err.message });
  }
});
