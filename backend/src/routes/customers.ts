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

// GET /api/customers/me/orders — Commandes du client connecté
customersRouter.get("/me/orders", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orders = await prisma.order.findMany({
      where: { customerId: req.user!.id },
      include: { items: true, shippingAddress: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur récupération commandes" });
  }
});

// GET /api/customers/me/orders/:orderId — Détail d'une commande du client connecté
customersRouter.get("/me/orders/:orderId", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.orderId, customerId: req.user!.id },
      include: { items: true, shippingAddress: true },
    });

    if (!order) {
      res.status(404).json({ error: "Commande non trouvée" });
      return;
    }

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur récupération commande" });
  }
});

// GET /api/customers/me/addresses — Adresses du client connecté
customersRouter.get("/me/addresses", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const addresses = await prisma.address.findMany({
      where: { customerId: req.user!.id },
      orderBy: { createdAt: "desc" },
    });
    res.json(addresses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur récupération adresses" });
  }
});

// POST /api/customers/me/addresses — Ajouter une adresse client
customersRouter.post("/me/addresses", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, address, extension = "", postalCode, city, country = "France" } = req.body;
    if (!firstName || !lastName || !address || !postalCode || !city || !country) {
      res.status(400).json({ error: "Champs requis manquants" });
      return;
    }

    const created = await prisma.address.create({
      data: {
        customerId: req.user!.id,
        firstName,
        lastName,
        address,
        extension,
        postalCode,
        city,
        country,
      },
    });
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur création adresse" });
  }
});

// PUT /api/customers/me/addresses/:id — Modifier une adresse client
customersRouter.put("/me/addresses/:id", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, address, extension = "", postalCode, city, country = "France" } = req.body;
    if (!firstName || !lastName || !address || !postalCode || !city || !country) {
      res.status(400).json({ error: "Champs requis manquants" });
      return;
    }

    const updated = await prisma.address.updateMany({
      where: { id: req.params.id, customerId: req.user!.id },
      data: { firstName, lastName, address, extension, postalCode, city, country },
    });

    if (updated.count === 0) {
      res.status(404).json({ error: "Adresse non trouvée" });
      return;
    }

    const savedAddress = await prisma.address.findFirst({
      where: { id: req.params.id, customerId: req.user!.id },
    });

    res.json(savedAddress);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur mise à jour adresse" });
  }
});

// DELETE /api/customers/me/addresses/:id — Supprimer une adresse client
customersRouter.delete("/me/addresses/:id", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.address.deleteMany({
      where: { id: req.params.id, customerId: req.user!.id },
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur suppression adresse" });
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
