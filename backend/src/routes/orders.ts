import { Router, Request, Response } from "express";
import { prisma } from "../utils/prisma";
import { formatPaymentMethod, getCustomerName, sendOrderConfirmationEmail, sendOrderShippedEmail } from "../services/emailService";
import { requireAuth, requireAdmin, AuthRequest } from "../middleware/auth";

export const ordersRouter = Router();

// Générer un numéro de commande unique
function generateOrderNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const rand = Math.floor(Math.random() * 100000).toString().padStart(5, "0");
  return `BP-${year}-${rand}`;
}

// POST /api/orders — Créer une commande
ordersRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { items, shippingAddress, email, customerId, notes } = req.body;

    if (!items || items.length === 0) {
      res.status(400).json({ error: "Panier vide" });
      return;
    }

    // Calculer le total
    let subtotal = 0;
    const orderItems = [];
    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) {
        res.status(400).json({ error: `Produit ${item.productId} non trouvé` });
        return;
      }
      subtotal += product.price * item.quantity;
      orderItems.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        image: JSON.parse(product.images || "[]")[0] || "",
      });
    }

    const shipping = subtotal >= 54 ? 0 : 4.90;
    const total = subtotal + shipping;

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        email,
        customerId: customerId || null,
        subtotal,
        shipping,
        total,
        notes,
        items: { create: orderItems },
        shippingAddress: {
          create: {
            firstName: shippingAddress.firstName,
            lastName: shippingAddress.lastName,
            address: shippingAddress.address,
            city: shippingAddress.city,
            postalCode: shippingAddress.postalCode,
            country: shippingAddress.country || "France",
          },
        },
      },
      include: { items: true, shippingAddress: true },
    });

    if (order.email) {
      await sendOrderConfirmationEmail({
        to: order.email,
        orderNumber: order.orderNumber,
        customerName: getCustomerName(null, order.email),
        items: order.items.map(item => ({ name: item.name, quantity: item.quantity, price: item.price, image: item.image })),
        totalHT: order.subtotal,
        vatAmount: order.vatAmount,
        totalTTC: order.total,
        shippingCost: order.shipping,
        shippingAddress: order.shippingAddress,
        paymentMethod: formatPaymentMethod(order.paymentMethod),
      });
    }

    res.status(201).json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur création commande" });
  }
});

// GET /api/orders/my — Mes commandes (client connecté)
ordersRouter.get("/my", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orders = await prisma.order.findMany({
      where: { customerId: req.user!.id },
      include: { items: true, shippingAddress: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /api/orders/:id — Détail d'une commande
ordersRouter.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true, shippingAddress: true },
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

// GET /api/orders — Liste toutes les commandes (admin)
ordersRouter.get("/", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = "1", limit = "20", status } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { items: true, shippingAddress: true },
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

// PUT /api/orders/:id/status — Mettre à jour le statut (admin)
ordersRouter.put("/:id/status", requireAdmin, async (req: Request, res: Response): Promise<void> => {
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
