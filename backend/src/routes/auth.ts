import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { prisma } from "../utils/prisma";
import { getCustomerName, sendPasswordResetEmail, sendWelcomeEmail } from "../services/emailService";

export const authRouter = Router();

const PASSWORD_RESET_TOKEN_MINUTES = 60;

function getFrontendUrl(): string {
  return process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "http://localhost:3000";
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// ─── Rate Limiting ────────────────────────────────────────────
// Max 10 tentatives par IP sur 15 minutes pour login et register
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de tentatives. Réessayez dans 15 minutes." },
  skipSuccessfulRequests: false,
});

// POST /api/auth/register — Inscription client
authRouter.post("/register", authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;

    if (!email || !password || !firstName || !lastName) {
      res.status(400).json({ error: "Champs requis manquants" });
      return;
    }

    const existing = await prisma.customer.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: "Email déjà utilisé" });
      return;
    }

    const hashed = await bcrypt.hash(password, 12);
    const customer = await prisma.customer.create({
      data: { email, password: hashed, firstName, lastName, phone },
    });

    // JWT_SECRET est garanti défini (validé au démarrage dans index.ts)
    const token = jwt.sign(
      { id: customer.id, email: customer.email },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" }
    );

    await sendWelcomeEmail({
      to: customer.email,
      customerName: getCustomerName(customer, customer.email),
      catalogueUrl: `${getFrontendUrl()}/catalogue`,
    });

    const { password: _, ...safeCustomer } = customer;
    res.status(201).json({ token, user: safeCustomer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur inscription" });
  }
});

// POST /api/auth/login — Connexion client
authRouter.post("/login", authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const customer = await prisma.customer.findUnique({ where: { email } });
    if (!customer) {
      res.status(401).json({ error: "Email ou mot de passe incorrect" });
      return;
    }

    const valid = await bcrypt.compare(password, customer.password);
    if (!valid) {
      res.status(401).json({ error: "Email ou mot de passe incorrect" });
      return;
    }

    // JWT_SECRET est garanti défini (validé au démarrage dans index.ts)
    const token = jwt.sign(
      { id: customer.id, email: customer.email },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" }
    );

    const { password: _, ...safeCustomer } = customer;
    res.json({ token, user: safeCustomer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur connexion" });
  }
});

// POST /api/auth/forgot-password — Demander un lien de réinitialisation
// eslint-disable-next-line @typescript-eslint/no-misused-promises
authRouter.post("/forgot-password", authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body as { email?: string };
    if (!email) {
      res.status(400).json({ error: "Email requis" });
      return;
    }

    const customer = await prisma.customer.findUnique({ where: { email: email.toLowerCase() } });
    if (customer) {
      await prisma.passwordResetToken.updateMany({
        where: { customerId: customer.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });

      const rawToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_MINUTES * 60 * 1000);
      await prisma.passwordResetToken.create({
        data: {
          customerId: customer.id,
          tokenHash: hashToken(rawToken),
          expiresAt,
        },
      });

      await sendPasswordResetEmail({
        to: customer.email,
        customerName: getCustomerName(customer, customer.email),
        resetUrl: `${getFrontendUrl()}/reinitialiser-mot-de-passe?token=${rawToken}`,
        expiresInMinutes: PASSWORD_RESET_TOKEN_MINUTES,
      });
    }

    res.json({ message: "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /api/auth/reset-password — Réinitialiser le mot de passe avec un token
// eslint-disable-next-line @typescript-eslint/no-misused-promises
authRouter.post("/reset-password", authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body as { token?: string; password?: string };
    if (!token || !password) {
      res.status(400).json({ error: "Token et mot de passe requis" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères" });
      return;
    }

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { customer: true },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      res.status(400).json({ error: "Lien de réinitialisation invalide ou expiré" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await prisma.$transaction([
      prisma.customer.update({ where: { id: resetToken.customerId }, data: { password: hashedPassword } }),
      prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
    ]);

    res.json({ message: "Mot de passe réinitialisé avec succès" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /api/auth/admin/login — Connexion admin (rate limiting aussi)
authRouter.post("/admin/login", authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) {
      res.status(401).json({ error: "Identifiants incorrects" });
      return;
    }

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      res.status(401).json({ error: "Identifiants incorrects" });
      return;
    }

    // ADMIN_JWT_SECRET est garanti défini (validé au démarrage dans index.ts)
    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      process.env.ADMIN_JWT_SECRET as string,
      { expiresIn: "24h" }
    );

    res.json({ token, admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur connexion admin" });
  }
});
