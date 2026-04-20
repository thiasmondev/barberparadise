import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { prisma } from "../utils/prisma";

export const authRouter = Router();

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
