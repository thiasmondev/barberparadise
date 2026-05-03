import { Router, Response } from "express";
import { prisma } from "../utils/prisma";
import { requireAuth, requireAdmin, AuthRequest } from "../middleware/auth";
import { sendEmail, getCustomerName } from "../services/emailService";

export const proRouter = Router();

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeVatNumber(value: unknown): string | null {
  const normalized = normalizeOptionalString(value);
  return normalized ? normalized.toUpperCase().replace(/\s+/g, "") : null;
}

async function notifyProRequest(params: {
  customerEmail: string;
  customerName: string;
  companyName: string;
  activity: string;
  phone: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string | null;
}) {
  if (params.status === "pending") {
    await Promise.all([
      sendEmail({
        to: params.customerEmail,
        subject: "Demande de compte professionnel reçue",
        html: `<p>Bonjour ${params.customerName},</p><p>Votre demande de compte professionnel pour <strong>${params.companyName}</strong> a bien été reçue. Notre équipe la vérifie avant activation des tarifs professionnels.</p>`,
      }),
      sendEmail({
        to: process.env.ADMIN_NOTIFICATION_EMAIL || "contact@barberparadise.fr",
        subject: "Nouvelle demande de compte professionnel",
        html: `<p>Nouvelle demande pro à traiter.</p><ul><li>Client : ${params.customerName} (${params.customerEmail})</li><li>Entreprise : ${params.companyName}</li><li>Activité : ${params.activity}</li><li>Téléphone : ${params.phone}</li></ul>`,
      }),
    ]);
    return;
  }

  if (params.status === "approved") {
    await sendEmail({
      to: params.customerEmail,
      subject: "Compte professionnel Barber Paradise activé",
      html: `<p>Bonjour ${params.customerName},</p><p>Votre compte professionnel est activé. Vous pouvez maintenant accéder aux prix professionnels, sous réserve du minimum de commande de 200 € HT.</p>`,
    });
    return;
  }

  await sendEmail({
    to: params.customerEmail,
    subject: "Demande de compte professionnel Barber Paradise",
    html: `<p>Bonjour ${params.customerName},</p><p>Votre demande de compte professionnel n’a pas pu être validée pour le moment.</p>${params.rejectionReason ? `<p>Motif : ${params.rejectionReason}</p>` : ""}`,
  });
}

// GET /api/pro/me — statut professionnel du client connecté
proRouter.get("/me", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const proAccount = await prisma.proAccount.findUnique({ where: { customerId: req.user!.id } });
    res.json({ proAccount, isApprovedPro: proAccount?.status === "approved" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur récupération statut professionnel" });
  }
});

// POST /api/pro/register — demande de compte professionnel
proRouter.post("/register", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const companyName = normalizeOptionalString(req.body.companyName);
    const activity = normalizeOptionalString(req.body.activity);
    const phone = normalizeOptionalString(req.body.phone);
    const siret = normalizeOptionalString(req.body.siret);
    const vatNumber = normalizeVatNumber(req.body.vatNumber);

    if (!companyName || !activity || !phone) {
      res.status(400).json({ error: "Entreprise, activité et téléphone sont requis" });
      return;
    }

    const customer = await prisma.customer.findUnique({ where: { id: req.user!.id } });
    if (!customer) {
      res.status(404).json({ error: "Client non trouvé" });
      return;
    }

    const proAccount = await prisma.proAccount.upsert({
      where: { customerId: req.user!.id },
      create: {
        customerId: req.user!.id,
        companyName,
        activity,
        phone,
        siret,
        vatNumber,
        status: "pending",
        rejectionReason: null,
      },
      update: {
        companyName,
        activity,
        phone,
        siret,
        vatNumber,
        status: "pending",
        rejectionReason: null,
        approvedAt: null,
        approvedBy: null,
      },
    });

    await notifyProRequest({
      customerEmail: customer.email,
      customerName: getCustomerName(customer, customer.email),
      companyName,
      activity,
      phone,
      status: "pending",
    });

    res.status(201).json({ proAccount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur création demande professionnelle" });
  }
});

// GET /api/pro/admin/accounts — liste des comptes pro
proRouter.get("/admin/accounts", requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const where = status ? { status } : {};
    const accounts = await prisma.proAccount.findMany({
      where,
      include: { customer: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, createdAt: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ accounts });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur récupération comptes professionnels" });
  }
});

// GET /api/pro/admin/accounts/:id — détail admin
proRouter.get("/admin/accounts/:id", requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const account = await prisma.proAccount.findUnique({
      where: { id: req.params.id },
      include: { customer: { include: { orders: { orderBy: { createdAt: "desc" }, take: 10 } } } },
    });
    if (!account) {
      res.status(404).json({ error: "Compte professionnel non trouvé" });
      return;
    }
    res.json(account);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur récupération compte professionnel" });
  }
});

async function updateProStatus(req: AuthRequest, res: Response, status: "approved" | "rejected" | "suspended", rejectionReason?: string | null) {
  const currentAccount = await prisma.proAccount.findUnique({
    where: { id: req.params.id },
    include: { customer: true },
  });

  if (!currentAccount) {
    res.status(404).json({ error: "Compte professionnel non trouvé" });
    return;
  }

  if (currentAccount.status === status) {
    const labels: Record<typeof status, string> = {
      approved: "approuvé",
      rejected: "refusé",
      suspended: "suspendu",
    };
    res.status(400).json({ error: `Compte déjà ${labels[status]}` });
    return;
  }

  const account = await prisma.proAccount.update({
    where: { id: req.params.id },
    data: {
      status,
      rejectionReason: status === "rejected" || status === "suspended" ? rejectionReason || (status === "rejected" ? "Demande refusée" : "Compte suspendu") : null,
      approvedAt: status === "approved" ? new Date() : null,
      approvedBy: status === "approved" ? req.user?.email || req.user?.id || null : null,
    },
    include: { customer: true },
  });

  if (status === "approved" || status === "rejected") {
    await notifyProRequest({
      customerEmail: account.customer.email,
      customerName: getCustomerName(account.customer, account.customer.email),
      companyName: account.companyName,
      activity: account.activity,
      phone: account.phone,
      status,
      rejectionReason: account.rejectionReason,
    });
  } else {
    await sendEmail({
      to: account.customer.email,
      subject: "Compte professionnel Barber Paradise suspendu",
      html: `<p>Bonjour ${getCustomerName(account.customer, account.customer.email)},</p><p>Votre compte professionnel est temporairement suspendu. Les tarifs professionnels sont désactivés jusqu’à nouvelle validation.</p>${account.rejectionReason ? `<p>Motif : ${account.rejectionReason}</p>` : ""}`,
    });
  }

  res.json({ account });
}

// POST /api/pro/admin/accounts/:id/approve
proRouter.post("/admin/accounts/:id/approve", requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await updateProStatus(req, res, "approved");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur validation compte professionnel" });
  }
});

// POST /api/pro/admin/accounts/:id/reject
proRouter.post("/admin/accounts/:id/reject", requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await updateProStatus(req, res, "rejected", normalizeOptionalString(req.body.reason));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur refus compte professionnel" });
  }
});

// POST /api/pro/admin/accounts/:id/suspend
proRouter.post("/admin/accounts/:id/suspend", requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await updateProStatus(req, res, "suspended", normalizeOptionalString(req.body.reason) || "Compte suspendu");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur suspension compte professionnel" });
  }
});
