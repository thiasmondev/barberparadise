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
