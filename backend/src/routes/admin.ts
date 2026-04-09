import { Router, Request, Response } from "express";
import { prisma } from "../utils/prisma";
import { requireAdmin } from "../middleware/auth";

export const adminRouter = Router();

// GET /api/admin/stats — Statistiques du tableau de bord
adminRouter.get("/stats", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const [
      totalProducts,
      totalOrders,
      totalCustomers,
      recentOrders,
      ordersByStatus,
    ] = await Promise.all([
      prisma.product.count({ where: { status: "active" } }),
      prisma.order.count(),
      prisma.customer.count(),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { items: true },
      }),
      prisma.order.groupBy({
        by: ["status"],
        _count: { status: true },
        _sum: { total: true },
      }),
    ]);

    // Calcul du chiffre d'affaires total
    const totalRevenue = ordersByStatus.reduce((sum, s) => sum + (s._sum.total || 0), 0);

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

// GET /api/admin/products — Liste produits pour l'admin (avec tous les statuts)
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

// GET /api/admin/customers — Liste clients pour l'admin
adminRouter.get("/customers", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = "1", limit = "20" } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        select: {
          id: true, email: true, firstName: true, lastName: true,
          phone: true, createdAt: true,
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.customer.count(),
    ]);

    res.json({ customers, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// PUT /api/admin/products/:id/status — Changer le statut d'un produit
adminRouter.put("/products/:id/status", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur mise à jour statut" });
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

// PATCH /api/admin/products/:id — Modifier un produit
adminRouter.patch("/products/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, brand, category, subcategory, price, originalPrice, stock, description, isActive } = req.body;
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        name: name || undefined,
        brand: brand || undefined,
        category: category || undefined,
        subcategory: subcategory || undefined,
        price: price !== undefined ? parseFloat(price) : undefined,
        originalPrice: originalPrice ? parseFloat(originalPrice) : undefined,
        inStock: stock !== undefined ? parseInt(stock) : undefined,
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
    const { name, brand, category, subcategory, price, originalPrice, stock, description, isActive } = req.body;
    const product = await prisma.product.create({
      data: {
        name,
        brand,
        category,
        subcategory,
        price: parseFloat(price),
        originalPrice: originalPrice ? parseFloat(originalPrice) : null,
        inStock: stock !== undefined ? parseInt(stock) : undefined || 0,
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

// GET /api/admin/blog — Liste articles blog
adminRouter.get("/blog", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const posts = await prisma.blogPost.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ posts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /api/admin/blog — Créer article blog
adminRouter.post("/blog", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, slug, excerpt, content, category, isPublished } = req.body;
    const post = await prisma.blogPost.create({
      data: {
        title,
        slug: slug || title.toLowerCase().replace(/\s+/g, "-"),
        excerpt,
        content,
        category,
        published: isPublished !== undefined ? isPublished : false,
      },
    });
    res.json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur création article" });
  }
});

// PATCH /api/admin/blog/:id — Modifier article blog
adminRouter.patch("/blog/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, slug, excerpt, content, category, isPublished } = req.body;
    const post = await prisma.blogPost.update({
      where: { id: req.params.id },
      data: {
        title: title || undefined,
        slug: slug || undefined,
        excerpt: excerpt || undefined,
        content: content || undefined,
        category: category || undefined,
        published: isPublished !== undefined ? isPublished : undefined,
      },
    });
    res.json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur mise à jour article" });
  }
});

// DELETE /api/admin/blog/:id — Supprimer article blog
adminRouter.delete("/blog/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.blogPost.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur suppression article" });
  }
});
