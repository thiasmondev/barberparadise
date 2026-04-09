import { Router, Request, Response } from "express";
import { prisma } from "../utils/prisma";
import { requireAuth, requireAdmin, AuthRequest } from "../middleware/auth";

export const customersRouter = Router();

// GET /api/customers/me — Profil du client connecté
customersRouter.get("/me", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.user!.id },
      include: { addresses: true },
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

// PUT /api/customers/me — Mettre à jour le profil
customersRouter.put("/me", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, phone } = req.body;
    const customer = await prisma.customer.update({
      where: { id: req.user!.id },
      data: { firstName, lastName, phone },
    });
    const { password: _, ...safeCustomer } = customer;
    res.json(safeCustomer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur mise à jour profil" });
  }
});

// GET /api/customers/me/wishlist — Wishlist
customersRouter.get("/me/wishlist", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const items = await prisma.wishlistItem.findMany({
      where: { customerId: req.user!.id },
      include: { customer: false },
    });
    const productIds = items.map(i => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    res.json(products.map(p => ({ ...p, images: JSON.parse(p.images || "[]"), tags: JSON.parse(p.tags || "[]") })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /api/customers/me/wishlist/:productId — Ajouter à la wishlist
customersRouter.post("/me/wishlist/:productId", requireAuth, async (req
: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.wishlistItem.upsert({
      where: { customerId_productId: { customerId: req.user!.id, productId: req.params.productId } },
      create: { customerId: req.user!.id, productId: req.params.productId },
      update: {},
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur ajout wishlist" });
  }
});

// DELETE /api/customers/me/wishlist/:productId — Retirer de la wishlist
customersRouter.delete("/me/wishlist/:productId", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.wishlistItem.deleteMany({
      where: { customerId: req.user!.id, productId: req.params.productId },
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur suppression wishlist" });
  }
});

// GET /api/customers — Liste clients (admin)
customersRouter.get("/", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = "1", limit = "20" } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        select: { id: true, email: true, firstName: true, lastName: true, phone: true, createdAt: true },
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
