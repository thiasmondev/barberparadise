import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../utils/prisma";
import { getCustomerName, sendOrderShippedEmail } from "../services/emailService";
import { requireAdmin, AuthRequest } from "../middleware/auth";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

// ─── Cloudinary Config ───────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Multer (mémoire) ────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Seules les images sont acceptées"));
  },
});

export const adminRouter = Router();

type NumericInput = string | number | null | undefined;

function toOptionalInt(value: NumericInput): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toOptionalFloat(value: NumericInput): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function toRequiredInt(value: NumericInput, field: string): number {
  const parsed = toOptionalInt(value);
  if (parsed === undefined || parsed === null) throw new Error(`${field} est requis`);
  return parsed;
}

function toRequiredFloat(value: NumericInput, field: string): number {
  const parsed = toOptionalFloat(value);
  if (parsed === undefined || parsed === null) throw new Error(`${field} est requis`);
  return parsed;
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  return value === undefined ? undefined : Boolean(value);
}

function buildPackagingData(body: Record<string, unknown>) {
  const lengthCm = toRequiredFloat(body.lengthCm as NumericInput, "Longueur");
  const widthCm = toRequiredFloat(body.widthCm as NumericInput, "Largeur");
  const heightCm = toRequiredFloat(body.heightCm as NumericInput, "Hauteur");
  return {
    name: String(body.name || "").trim(),
    type: String(body.type || "").trim(),
    lengthCm,
    widthCm,
    heightCm,
    internalVolumeCm3: Math.round(lengthCm * widthCm * heightCm * 100) / 100,
    maxWeightG: toRequiredInt(body.maxWeightG as NumericInput, "Poids max supporté"),
    selfWeightG: toRequiredInt(body.selfWeightG as NumericInput, "Poids du carton vide"),
    costEur: toRequiredFloat(body.costEur as NumericInput, "Coût unitaire"),
    stock: toRequiredInt(body.stock as NumericInput, "Stock disponible"),
    isReinforced: Boolean(body.isReinforced),
    isActive: body.isActive === undefined ? true : Boolean(body.isActive),
  };
}

// GET /api/admin/stats — Statistiques du tableau de bord
adminRouter.get("/stats", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const [totalProducts, totalOrders, totalCustomers, recentOrders, ordersByStatus] = await Promise.all([
      prisma.product.count({ where: { status: "active" } }),
      prisma.order.count(),
      prisma.customer.count(),
      prisma.order.findMany({
        select: { id: true, total: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.order.groupBy({
        by: ["status"],
        _count: { status: true },
        _sum: { total: true },
      }),
    ]);

    let totalRevenue = 0;
    await prisma.order.findMany({ select: { total: true } }).then(orders => {
      totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    });

    res.json({
      totalProducts,
      totalOrders,
      totalCustomers,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      recentOrders,
      ordersByStatus: ordersByStatus.map(s => ({
        status: s.status,
        count: s._count.status,
        revenue: s._sum.total || 0,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /api/admin/products/meta — Marques + toutes catégories/sous-catégories (3 niveaux) pour autocomplétion
adminRouter.get("/products/meta", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const [brands, allCategoryRows, productCategories, productSubcategories] = await Promise.all([
      // Marques distinctes depuis les produits
      prisma.product.findMany({
        select: { brand: true },
        distinct: ["brand"],
        where: { brand: { not: "" } },
        orderBy: { brand: "asc" },
      }),
      // Toutes les entrées de la table Category (3 niveaux)
      prisma.category.findMany({
        select: { slug: true, name: true, parentSlug: true },
        orderBy: [{ parentSlug: "asc" }, { name: "asc" }],
      }),
      // Catégories utilisées dans les produits (complément)
      prisma.product.findMany({
        select: { category: true },
        distinct: ["category"],
        where: { category: { not: "" } },
      }),
      // Sous-catégories utilisées dans les produits (complément)
      prisma.product.findMany({
        select: { subcategory: true },
        distinct: ["subcategory"],
        where: { subcategory: { not: "" } },
      }),
    ]);

    // Map slug -> nom et parent pour affichage
    const nameMap = new Map(allCategoryRows.map(c => [c.slug, c.name]));
    const parentMap = new Map(allCategoryRows.map(c => [c.slug, c.parentSlug || ""]));

    // Identifier les slugs de chaque niveau (structure à 4 niveaux possible)
    // Niveau 0 : racines (parentSlug vide/null)
    const rootSlugs = new Set(allCategoryRows.filter(c => !c.parentSlug).map(c => c.slug));
    // Niveau 1 : enfants directs des racines (ex: cheveux, barbe, peignes...)
    const level1Slugs = new Set(allCategoryRows.filter(c => c.parentSlug && rootSlugs.has(c.parentSlug)).map(c => c.slug));
    // Niveau 2 : enfants des niveau 1 (ex: cires, gel, laques...)
    const level2Slugs = new Set(allCategoryRows.filter(c => c.parentSlug && level1Slugs.has(c.parentSlug)).map(c => c.slug));
    // Niveau 3 : enfants des niveau 2 (ex: cire-brillante, cire-mat-naturel...)
    const level3Slugs = new Set(allCategoryRows.filter(c => c.parentSlug && level2Slugs.has(c.parentSlug)).map(c => c.slug));

    // Pour le champ "Catégorie" (niveau 1) : enfants directs des racines
    const categorySlugs = new Set([
      ...level1Slugs,
      ...productCategories.map(c => c.category).filter(Boolean),
    ]);

    // Pour le champ "Sous-catégorie" (niveau 2) : enfants des catégories
    const subcategorySlugs = new Set([
      ...level2Slugs,
      ...productSubcategories.map(s => s.subcategory).filter(Boolean),
    ]);

    // Construire les suggestions enrichies avec label hiérarchique
    const categoriesWithLabels = [...categorySlugs].sort().map(slug => ({
      slug,
      label: nameMap.has(slug) ? `${nameMap.get(slug)!}` : slug,
      parent: parentMap.get(slug) || "",
    }));

    const subcategoriesWithLabels = [...subcategorySlugs].sort().map(slug => {
      const name = nameMap.get(slug) || slug;
      const parent = parentMap.get(slug) || "";
      const parentName = nameMap.get(parent) || parent;
      return {
        slug,
        label: parentName ? `${name} (${parentName})` : name,
        parent,
      };
    });

    // Sous-sous-catégories (niveau 3) séparées pour le 3e champ
    const subsubcategoriesWithLabels = [...level3Slugs].sort().map(slug => {
      const name = nameMap.get(slug) || slug;
      const parent = parentMap.get(slug) || "";
      const parentName = nameMap.get(parent) || parent;
      return { slug, label: `${name} (sous ${parentName})`, parent };
    });

    // Map parentSlug (niveau 2) -> enfants niveau 3 (pour filtrage dynamique du 3e champ)
    const level3ByParent: Record<string, { slug: string; label: string }[]> = {};
    for (const slug of level3Slugs) {
      const parent = parentMap.get(slug) || "";
      if (!level3ByParent[parent]) level3ByParent[parent] = [];
      level3ByParent[parent].push({ slug, label: nameMap.get(slug) || slug });
    }

    // Map parentSlug (niveau 1) -> enfants niveau 2 (pour filtrage dynamique du 2e champ)
    const level2ByParent: Record<string, { slug: string; label: string }[]> = {};
    for (const slug of level2Slugs) {
      const parent = parentMap.get(slug) || "";
      if (!level2ByParent[parent]) level2ByParent[parent] = [];
      level2ByParent[parent].push({ slug, label: nameMap.get(slug) || slug });
    }

    res.json({
      brands: brands.map(b => b.brand).filter(Boolean),
      categories: [...categorySlugs].sort(),
      subcategories: [...subcategorySlugs].sort(),
      categoriesWithLabels,
      subcategoriesWithLabels,
      subsubcategoriesWithLabels,
      level3ByParent,
      level2ByParent,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /api/admin/products — Liste produits pour l'admin
adminRouter.get("/products", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = "1", limit = "50", search, category, status } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (search) where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { brand: { contains: search, mode: "insensitive" } },
    ];
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.product.count({ where }),
    ]);
    res.json({
      products: products.map(p => ({
        ...p,
        images: JSON.parse(p.images || "[]"),
        tags: JSON.parse(p.tags || "[]"),
      })),
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// PATCH /api/admin/products/:id — Modifier un produit
adminRouter.patch("/products/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name, brand, category, subcategory, subsubcategory, price, originalPrice, inStock,
      description, isActive, isNew, weightG, lengthCm, widthCm, heightCm, isFragile,
      isLiquid, isAerosol, requiresGlass, logisticNote,
    } = req.body;
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        name: name || undefined,
        brand: brand || undefined,
        category: category || undefined,
        subcategory: subcategory || undefined,
        subsubcategory: subsubcategory !== undefined ? (subsubcategory || "") : undefined,
        price: price !== undefined ? parseFloat(price) : undefined,
        originalPrice: originalPrice !== undefined ? toOptionalFloat(originalPrice) : undefined,
        inStock: inStock !== undefined ? Boolean(inStock) : undefined,
        description: description || undefined,
        status: isActive !== undefined ? (isActive ? "active" : "inactive") : undefined,
        isNew: isNew !== undefined ? Boolean(isNew) : undefined,
        weightG: toOptionalInt(weightG),
        lengthCm: toOptionalFloat(lengthCm),
        widthCm: toOptionalFloat(widthCm),
        heightCm: toOptionalFloat(heightCm),
        isFragile: toOptionalBoolean(isFragile),
        isLiquid: toOptionalBoolean(isLiquid),
        isAerosol: toOptionalBoolean(isAerosol),
        requiresGlass: toOptionalBoolean(requiresGlass),
        logisticNote: logisticNote !== undefined ? (String(logisticNote).trim() || null) : undefined,
      },
    });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur mise à jour produit" });
  }
});

// DELETE /api/admin/products/:id — Supprimer un produit
adminRouter.delete("/products/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur suppression produit" });
  }
});

// POST /api/admin/products — Créer un produit
adminRouter.post("/products", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name, brand, category, subcategory, price, originalPrice, inStock, description, isActive,
      weightG, lengthCm, widthCm, heightCm, isFragile, isLiquid, isAerosol, requiresGlass, logisticNote,
    } = req.body;
    const product = await prisma.product.create({
      data: {
        handle: name.toLowerCase().replace(/ +/g, "-"),
        slug: name.toLowerCase().replace(/ +/g, "-"),
        shortDescription: description ? description.substring(0, 100) : "",
        name,
        brand,
        category,
        subcategory,
        price: parseFloat(price),
        originalPrice: originalPrice ? parseFloat(originalPrice) : null,
        inStock: inStock ? true : false,
        description,
        status: isActive ? "active" : "inactive",
        weightG: toOptionalInt(weightG),
        lengthCm: toOptionalFloat(lengthCm),
        widthCm: toOptionalFloat(widthCm),
        heightCm: toOptionalFloat(heightCm),
        isFragile: Boolean(isFragile),
        isLiquid: Boolean(isLiquid),
        isAerosol: Boolean(isAerosol),
        requiresGlass: Boolean(requiresGlass),
        logisticNote: logisticNote !== undefined ? (String(logisticNote).trim() || null) : null,
        images: "[]",
        tags: "[]",
      },
    });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur création produit" });
  }
});

// GET /api/admin/packaging — Liste des emballages logistiques
adminRouter.get("/packaging", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const packaging = await prisma.packaging.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] });
    res.json({ packaging });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur chargement emballages" });
  }
});

// POST /api/admin/packaging — Créer un emballage logistique
adminRouter.post("/packaging", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = buildPackagingData(req.body || {});
    if (!data.name) {
      res.status(400).json({ error: "Le nom de l'emballage est requis" });
      return;
    }
    if (!["carton", "enveloppe", "tube"].includes(data.type)) {
      res.status(400).json({ error: "Le type doit être carton, enveloppe ou tube" });
      return;
    }
    const packaging = await prisma.packaging.create({ data });
    res.status(201).json(packaging);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err instanceof Error ? err.message : "Erreur création emballage" });
  }
});

// PATCH /api/admin/packaging/:id — Modifier un emballage logistique
adminRouter.patch("/packaging/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = buildPackagingData(req.body || {});
    if (!data.name) {
      res.status(400).json({ error: "Le nom de l'emballage est requis" });
      return;
    }
    if (!["carton", "enveloppe", "tube"].includes(data.type)) {
      res.status(400).json({ error: "Le type doit être carton, enveloppe ou tube" });
      return;
    }
    const packaging = await prisma.packaging.update({ where: { id: parseInt(req.params.id, 10) }, data });
    res.json(packaging);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err instanceof Error ? err.message : "Erreur mise à jour emballage" });
  }
});

// DELETE /api/admin/packaging/:id — Supprimer un emballage logistique
adminRouter.delete("/packaging/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.packaging.delete({ where: { id: parseInt(req.params.id, 10) } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur suppression emballage" });
  }
});

// GET /api/admin/orders — Liste commandes pour l'admin
adminRouter.get("/orders", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = "1", limit = "20", status } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (status) where.status = status;
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { items: true, shippingAddress: true, customer: { select: { firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.order.count({ where }),
    ]);
    res.json({ orders, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /api/admin/orders/:id — Détail d'une commande
adminRouter.get("/orders/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true, shippingAddress: true, customer: true },
    });
    if (!order) {
      res.status(404).json({ error: "Commande non trouvée" });
      return;
    }
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// PATCH /api/admin/orders/:id/status — Changer le statut d'une commande
adminRouter.patch("/orders/:id/status", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    const previousOrder = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { customer: true },
    });
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
      include: { customer: true },
    });
    const shippingEmailStatuses = new Set(["shipped", "delivered", "EXPÉDIÉ"]);
    if (shippingEmailStatuses.has(status) && !shippingEmailStatuses.has(previousOrder?.status || "") && order.email) {
      await sendOrderShippedEmail({
        to: order.email,
        orderNumber: order.orderNumber,
        customerName: getCustomerName(order.customer, order.email),
      });
    }
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur mise à jour statut" });
  }
});

// GET /api/admin/customers — Liste clients pour l'admin
adminRouter.get("/customers", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = "1", limit = "20", search } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
      ];
    }
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        select: {
          id: true, email: true, firstName: true, lastName: true,
          phone: true, createdAt: true,
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.customer.count({ where }),
    ]);
    res.json({ customers, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /api/admin/customers/:id — Détail d'un client
adminRouter.get("/customers/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        orders: {
          include: { items: true, shippingAddress: true },
          orderBy: { createdAt: "desc" },
        },
        addresses: true,
        _count: { select: { orders: true, wishlist: true } },
      },
    });
    if (!customer) {
      res.status(404).json({ error: "Client non trouvé" });
      return;
    }
    const { password: _, ...safeCustomer } = customer;
    res.json(safeCustomer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /api/admin/reviews — Avis en attente de modération
adminRouter.get("/reviews", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const reviews = await prisma.review.findMany({
      where: { approved: false },
      include: { product: { select: { name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(reviews);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// PUT /api/admin/reviews/:id/approve — Approuver un avis
adminRouter.put("/reviews/:id/approve", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const review = await prisma.review.update({
      where: { id: req.params.id },
      data: { approved: true },
    });
    res.json(review);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur approbation avis" });
  }
});

// ─── POST /api/admin/products/:id/images — Upload image vers Cloudinary ────
adminRouter.post(
  "/products/:id/images",
  requireAdmin,
  upload.single("image"),
  async (req: Request & { file?: Express.Multer.File }, res: Response): Promise<void> => {
    try {
      let secureUrl: string;

      if (req.body?.url) {
        // Mode 1 : URL déjà uploadée vers Cloudinary depuis le frontend (preset non signé)
        secureUrl = req.body.url;
      } else if (req.file) {
        // Mode 2 : Upload depuis le backend via Cloudinary API signée (fallback)
        const uploadedFile = req.file;
        const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: `barberparadise/products/${req.params.id}`,
              transformation: [{ width: 1200, height: 1200, crop: "limit", quality: "auto", fetch_format: "auto" }],
            },
            (error, result) => {
              if (error || !result) reject(error || new Error("Upload échoué"));
              else resolve(result as { secure_url: string });
            }
          );
          stream.end(uploadedFile.buffer);
        });
        secureUrl = result.secure_url;
      } else {
        res.status(400).json({ error: "Aucun fichier ni URL fourni" });
        return;
      }

      // Ajouter l'URL à la liste d'images du produit
      const product = await prisma.product.findUnique({ where: { id: req.params.id } });
      if (!product) { res.status(404).json({ error: "Produit introuvable" }); return; }
      const images: string[] = JSON.parse(product.images || "[]");
      images.push(secureUrl);
      await prisma.product.update({
        where: { id: req.params.id },
        data: { images: JSON.stringify(images) },
      });
      res.json({ url: secureUrl, images });
    } catch (err: any) {
      console.error("[UPLOAD IMAGE ERROR]", err);
      const msg = err?.message || err?.error?.message || JSON.stringify(err) || "Erreur upload image";
      res.status(500).json({ error: msg });
    }
  }
);

// ─── PUT /api/admin/products/:id/images — Réorganiser / remplacer la liste d'images ─
adminRouter.put("/products/:id/images", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { images } = req.body as { images: string[] };
    if (!Array.isArray(images)) { res.status(400).json({ error: "images doit être un tableau" }); return; }
    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: { images: JSON.stringify(images) },
    });
    res.json({ images: JSON.parse(updated.images || "[]") });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur mise à jour images" });
  }
});

// ─── DELETE /api/admin/products/:id/images — Supprimer une image ────────────
adminRouter.delete("/products/:id/images", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { url } = req.body as { url: string };
    if (!url) { res.status(400).json({ error: "URL manquante" }); return; }

    // Supprimer de Cloudinary si c'est une URL Cloudinary
    if (url.includes("cloudinary.com")) {
      try {
        const parts = url.split("/");
        const filenameWithExt = parts[parts.length - 1];
        const filename = filenameWithExt.split(".")[0];
        const folderIndex = parts.indexOf("barberparadise");
        const publicId = folderIndex >= 0 ? parts.slice(folderIndex).join("/").replace(/\.[^.]+$/, "") : filename;
        await cloudinary.uploader.destroy(publicId);
      } catch (e) {
        console.warn("Impossible de supprimer de Cloudinary:", e);
      }
    }

    // Retirer l'URL de la liste
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) { res.status(404).json({ error: "Produit introuvable" }); return; }
    const images: string[] = JSON.parse(product.images || "[]").filter((img: string) => img !== url);
    await prisma.product.update({ where: { id: req.params.id }, data: { images: JSON.stringify(images) } });
    res.json({ success: true, images });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur suppression image" });
  }
});

// ─── VARIANTES PRODUIT ────────────────────────────────────────────

// GET /api/admin/products/:id/variants — Lister les variantes d'un produit
adminRouter.get("/products/:id/variants", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const variants = await prisma.productVariant.findMany({
      where: { productId: req.params.id },
      orderBy: { order: "asc" },
    });
    res.json(variants);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /api/admin/products/:id/variants — Créer une variante
adminRouter.post("/products/:id/variants", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, type, color, colorHex, size, price, stock, inStock, sku, image, order } = req.body;
    const variant = await prisma.productVariant.create({
      data: {
        productId: req.params.id,
        name: name || "",
        type: type || "other",
        color: color || "",
        colorHex: colorHex || "",
        size: size || "",
        price: price != null ? parseFloat(price) : null,
        stock: parseInt(stock) || 0,
        inStock: inStock !== false,
        sku: sku || "",
        image: image || "",
        order: parseInt(order) || 0,
      },
    });
    res.json(variant);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur création variante" });
  }
});

// PUT /api/admin/variants/:variantId — Modifier une variante
adminRouter.put("/variants/:variantId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, type, color, colorHex, size, price, stock, inStock, sku, image, order } = req.body;
    const variant = await prisma.productVariant.update({
      where: { id: req.params.variantId },
      data: {
        name: name || "",
        type: type || "other",
        color: color || "",
        colorHex: colorHex || "",
        size: size || "",
        price: price != null && price !== "" ? parseFloat(price) : null,
        stock: parseInt(stock) || 0,
        inStock: inStock !== false,
        sku: sku || "",
        image: image || "",
        order: parseInt(order) || 0,
      },
    });
    res.json(variant);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur modification variante" });
  }
});

// DELETE /api/admin/variants/:variantId — Supprimer une variante
adminRouter.delete("/variants/:variantId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.productVariant.delete({ where: { id: req.params.variantId } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur suppression variante" });
  }
});

// PUT /api/admin/products/:id/variants/reorder — Réorganiser les variantes
adminRouter.put("/products/:id/variants/reorder", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { items } = req.body as { items: { id: string; order: number }[] };
    await Promise.all(
      items.map((item) => prisma.productVariant.update({ where: { id: item.id }, data: { order: item.order } }))
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur réorganisation variantes" });
  }
});

// POST /api/admin/change-password — Changer le mot de passe admin
adminRouter.post("/change-password", requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "Mot de passe actuel et nouveau mot de passe requis" });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ error: "Le nouveau mot de passe doit contenir au moins 8 caractères" });
      return;
    }

    // Récupérer l'admin connecté depuis le token
    const adminId = req.user?.id;
    if (!adminId) {
      res.status(401).json({ error: "Non authentifié" });
      return;
    }

    const admin = await prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin) {
      res.status(404).json({ error: "Admin introuvable" });
      return;
    }

    // Vérifier le mot de passe actuel
    const valid = await bcrypt.compare(currentPassword, admin.password);
    if (!valid) {
      res.status(401).json({ error: "Mot de passe actuel incorrect" });
      return;
    }

    // Hasher et sauvegarder le nouveau mot de passe
    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.admin.update({
      where: { id: adminId },
      data: { password: hashed },
    });

    res.json({ success: true, message: "Mot de passe modifié avec succès" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors du changement de mot de passe" });
  }
});

// ─── BRANDS ADMIN ──────────────────────────────────────────────────────────────────

// GET /api/admin/brands — Liste toutes les marques
adminRouter.get("/brands", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const brands = await prisma.brand.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    });
    res.json(brands.map((b) => ({
      id:           b.id,
      name:         b.name,
      slug:         b.slug,
      logo:         b.logo,
      bannerImage:  b.bannerImage,
      description:  b.description,
      website:      b.website,
      productCount: b._count.products,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /api/admin/brands/:id/stats — Statistiques avant suppression définitive d'une marque
adminRouter.get("/brands/:id/stats", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) { res.status(400).json({ error: "Identifiant de marque invalide" }); return; }

    const brand = await prisma.brand.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true, logo: true },
    });
    if (!brand) { res.status(404).json({ error: "Marque introuvable" }); return; }

    const products = await prisma.product.findMany({
      where: { brandId: id },
      select: { id: true, images: true },
    });
    const productIds = products.map((product) => product.id);
    const [reviewsCount, variantsCount] = productIds.length > 0
      ? await Promise.all([
          prisma.review.count({ where: { productId: { in: productIds } } }),
          prisma.productVariant.count({ where: { productId: { in: productIds } } }),
        ])
      : [0, 0];
    const imagesCount = products.reduce((total, product) => {
      try {
        const images = JSON.parse(product.images || "[]");
        return total + (Array.isArray(images) ? images.length : 0);
      } catch {
        return total;
      }
    }, 0);

    res.json({
      brand,
      productsCount: products.length,
      reviewsCount,
      variantsCount,
      imagesCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// DELETE /api/admin/brands/:id?confirm=true — Supprimer définitivement une marque et ses produits liés
adminRouter.delete("/brands/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) { res.status(400).json({ error: "Identifiant de marque invalide" }); return; }
    if (req.query.confirm !== "true") {
      res.status(400).json({ error: "Confirmation obligatoire pour supprimer définitivement une marque" });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const brand = await tx.brand.findUnique({
        where: { id },
        select: { id: true, name: true },
      });
      if (!brand) return null;

      const products = await tx.product.findMany({
        where: { brandId: id },
        select: { id: true },
      });
      const productIds = products.map((product) => product.id);

      if (productIds.length > 0) {
        await tx.review.deleteMany({ where: { productId: { in: productIds } } });
        await tx.productVariant.deleteMany({ where: { productId: { in: productIds } } });
        await tx.product.deleteMany({ where: { id: { in: productIds } } });
      }
      await tx.brand.delete({ where: { id } });

      return {
        deleted: true,
        productsDeleted: products.length,
        brandName: brand.name,
      };
    });

    if (!result) { res.status(404).json({ error: "Marque introuvable" }); return; }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur suppression marque" });
  }
});

// PATCH /api/admin/brands/:id — Mettre à jour les champs texte d'une marque
adminRouter.patch("/brands/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const { logo, bannerImage, description, website, name } = req.body;
    const updated = await prisma.brand.update({
      where: { id },
      data: {
        ...(name        !== undefined && { name }),
        ...(logo        !== undefined && { logo }),
        ...(bannerImage !== undefined && { bannerImage }),
        ...(description !== undefined && { description }),
        ...(website     !== undefined && { website }),
      },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /api/admin/brands/:id/upload-logo — Upload logo → Cloudinary → update Brand.logo
adminRouter.post(
  "/brands/:id/upload-logo",
  requireAdmin,
  upload.single("logo"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id   = parseInt(req.params.id, 10);
      const file = req.file;
      if (!file) { res.status(400).json({ error: "Aucun fichier reçu" }); return; }

      const uploadResult = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder:         "barberparadise/brands",
            public_id:      `brand-${id}-logo`,
            overwrite:      true,
            resource_type:  "image",
            transformation: [
              { width: 400, height: 400, crop: "fit" },
              { quality: "auto", fetch_format: "auto" },
            ],
          },
          (error, result) => { if (error) reject(error); else resolve(result); }
        );
        stream.end(file.buffer);
      });

      const logoUrl = uploadResult.secure_url as string;
      const updated = await prisma.brand.update({ where: { id }, data: { logo: logoUrl } });
      res.json({ success: true, logo: logoUrl, brand: updated });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur upload logo" });
    }
  }
);

// POST /api/admin/brands/:id/upload-banner — Upload bannière → Cloudinary → update Brand.bannerImage
adminRouter.post(
  "/brands/:id/upload-banner",
  requireAdmin,
  upload.single("banner"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id   = parseInt(req.params.id, 10);
      const file = req.file;
      if (!file) { res.status(400).json({ error: "Aucun fichier reçu" }); return; }

      const uploadResult = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder:         "barberparadise/brands",
            public_id:      `brand-${id}-banner`,
            overwrite:      true,
            resource_type:  "image",
            transformation: [
              { width: 1400, height: 400, crop: "fill", gravity: "center" },
              { quality: "auto", fetch_format: "auto" },
            ],
          },
          (error, result) => { if (error) reject(error); else resolve(result); }
        );
        stream.end(file.buffer);
      });

      const bannerUrl = uploadResult.secure_url as string;
      const updated = await prisma.brand.update({ where: { id }, data: { bannerImage: bannerUrl } });
      res.json({ success: true, bannerImage: bannerUrl, brand: updated });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur upload bannière" });
    }
  }
);

// PUT /api/admin/products/:id/image-alts — Mettre à jour les alt texts des images
adminRouter.put("/products/:id/image-alts", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageAlts } = req.body as { imageAlts: string[] };
    if (!Array.isArray(imageAlts)) { res.status(400).json({ error: "imageAlts doit être un tableau" }); return; }
    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: { imageAlts: JSON.stringify(imageAlts) },
    });
    res.json({ imageAlts: JSON.parse((updated as any).imageAlts || "[]") });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur mise à jour alt texts" });
  }
});

export default adminRouter;
