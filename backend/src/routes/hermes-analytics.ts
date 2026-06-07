import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import analyticsModule from "../services/hermes/modules/analytics";

export const hermesAnalyticsRouter = Router();

function requireAdmin(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token manquant" });
  }

  const token = authHeader.slice(7);
  try {
    jwt.verify(token, process.env.ADMIN_JWT_SECRET!);
    next();
  } catch {
    return res.status(401).json({ error: "Token invalide" });
  }
}

hermesAnalyticsRouter.use(requireAdmin);

hermesAnalyticsRouter.get("/kpis", async (req, res) => {
  try {
    const kpis = await analyticsModule.getKPIs({
      startDate: typeof req.query.startDate === "string" ? req.query.startDate : undefined,
      endDate: typeof req.query.endDate === "string" ? req.query.endDate : undefined,
      source: typeof req.query.source === "string" ? req.query.source : undefined,
      period: typeof req.query.period === "string" ? (req.query.period as "day" | "week" | "month") : undefined,
    });
    res.json({ kpis });
  } catch (error) {
    console.error("Erreur récupération KPI Hermes:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

hermesAnalyticsRouter.get("/report", async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    const report = await analyticsModule.generateReport(days);
    res.json(report);
  } catch (error) {
    console.error("Erreur rapport analytics Hermes:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Erreur serveur" });
  }
});

hermesAnalyticsRouter.get("/context", async (_req, res) => {
  try {
    const context = await analyticsModule.getContextSummary();
    res.json({ context });
  } catch (error) {
    console.error("Erreur contexte analytics Hermes:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Erreur serveur" });
  }
});

hermesAnalyticsRouter.post("/collect", async (_req, res) => {
  try {
    const report = await analyticsModule.collectDailyKPIs();
    res.json({ ok: true, report });
  } catch (error) {
    console.error("Erreur collecte analytics Hermes:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Erreur serveur" });
  }
});
