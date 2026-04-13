import { Router, Request, Response } from "express";
import { prisma } from "../utils/prisma";
import { requireAdmin } from "../middleware/auth";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

// ─── Cloudinary Config ───────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dopr7tgf8",
  api_key: process.env.CLOUDINARY_API_KEY || "417132953848714",
  api_secret: process.env.CLOUDINARY_API_SECRET || "w2ZrORm8B4GTORmWCvBFkwmYXUM",
});

// ─── Multer (mémoire) ────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Seules les images sont acceptées"));
  },
});

export const adminRouter = Router();

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

    // Identifier les slugs de chaque niveau
    const rootSlugs = new Set(allCategoryRows.filter(c => !c.parentSlug).map(c => c.slug));
    const level2Slugs = new Set(allCategoryRows.filter(c => c.parentSlug && rootSlugs.has(c.parentSlug)).map(c => c.slug));
    const level3Slugs = new Set(allCategoryRows.filter(c => c.parentSlug && level2Slugs.has(c.parentSlug)).map(c => c.slug));

    // Map slug -> nom pour affichage
    const nameMap = new Map(allCategoryRows.map(c => [c.slug, c.name]));
    const parentMap = new Map(allCategoryRows.map(c => [c.slug, c.parentSlug]));

    // Catégories (niveau 1) : toutes les racines + celles utilisées dans les produits
    const categorySlugs = new Set([
      ...rootSlugs,
      ...productCategories.map(c => c.category).filter(Boolean),
    ]);

    // Sous-catégories (niveaux 2 et 3) : toutes + celles utilisées dans les produits
    const subcategorySlugs = new Set([
      ...level2Slugs,
      ...level3Slugs,
      ...productSubcategories.map(s => s.subcategory).filter(Boolean),
    ]);

    // Construire les suggestions enrichies avec label hiérarchique
    const categoriesWithLabels = [...categorySlugs].sort().map(slug => ({
      slug,
      label: nameMap.has(slug) ? `${nameMap.get(slug)} (• ${slug})` : slug,
    }));

    const subcategoriesWithLabels = [...subcategorySlugs].sort().map(slug => {
      const name = nameMap.get(slug) || slug;
      const parent = parentMap.get(slug) || "";
      const parentName = nameMap.get(parent) || parent;
      const isLevel3 = level3Slugs.has(slug);
      return {
        slug,
        label: isLevel3
          ? `↳ ${name} (sous ${parentName})`
          : parentName
          ? `${name} (${parentName})`
          : name,
        parent,
      };
    });

    res.json({
      brands: brands.map(b => b.brand).filter(Boolean),
      categories: [...categorySlugs].sort(),
      subcategories: [...subcategorySlugs].sort(),
      categoriesWithLabels,
      subcategoriesWithLabels,
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
    const { name, brand, category, subcategory, price, originalPrice, inStock, description, isActive } = req.body;
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        name: name || undefined,
        brand: brand || undefined,
        category: category || undefined,
        subcategory: subcategory || undefined,
        price: price !== undefined ? parseFloat(price) : undefined,
        originalPrice: originalPrice ? parseFloat(originalPrice) : undefined,
        inStock: inStock ? true : false,
        description: description || undefined,
        status: isActive !== undefined ? (isActive ? "active" : "inactive") : undefined,
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
    const { name, brand, category, subcategory, price, originalPrice, inStock, description, isActive } = req.body;
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
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
    });
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
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "Aucun fichier fourni" });
        return;
      }
      // Upload vers Cloudinary depuis le buffer mémoire
      const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `barberparadise/products/${req.params.id}`,
            transformation: [{ width: 1200, height: 1200, crop: "limit", quality: "auto", fetch_format: "auto" }],
          },
          (error, result) => {
            if (error || !result) reject(error || new Error("Upload échoué"));
            else resolve(result as { secure_url: string; public_id: string });
          }
        );
        stream.end(req.file!.buffer);
      });

      // Ajouter l'URL à la liste d'images du produit
      const product = await prisma.product.findUnique({ where: { id: req.params.id } });
      if (!product) { res.status(404).json({ error: "Produit introuvable" }); return; }
      const images: string[] = JSON.parse(product.images || "[]");
      images.push(result.secure_url);
      const updated = await prisma.product.update({
        where: { id: req.params.id },
        data: { images: JSON.stringify(images) },
      });
      res.json({ url: result.secure_url, public_id: result.public_id, images });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur upload image" });
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

export default adminRouter;
