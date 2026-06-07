import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import campaignManager from "../services/hermes/modules/campaignManager";

export const hermesCampaignsRouter = Router();

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

hermesCampaignsRouter.use(requireAdmin);

hermesCampaignsRouter.get("/", async (req, res) => {
  try {
    const result = await campaignManager.getPlans({
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      targetAudience: typeof req.query.targetAudience === "string" ? req.query.targetAudience : undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    });
    res.json(result);
  } catch (error) {
    console.error("Erreur récupération campagnes Hermes:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

hermesCampaignsRouter.get("/stats", async (_req, res) => {
  try {
    const stats = await campaignManager.getStats();
    res.json(stats);
  } catch (error) {
    console.error("Erreur stats campagnes Hermes:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

hermesCampaignsRouter.get("/:id", async (req, res) => {
  try {
    const plan = await campaignManager.getPlan(req.params.id);
    if (!plan) return res.status(404).json({ error: "Campagne non trouvée" });
    res.json(plan);
  } catch (error) {
    console.error("Erreur récupération campagne Hermes:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

hermesCampaignsRouter.post("/", async (req, res) => {
  try {
    const { name, targetAudience, subject } = req.body;
    if (!name || !targetAudience || !subject) {
      return res.status(400).json({ error: "name, targetAudience et subject sont requis" });
    }

    const plan = await campaignManager.createPlan(req.body);
    res.status(201).json(plan);
  } catch (error) {
    console.error("Erreur création campagne Hermes:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Erreur serveur" });
  }
});

hermesCampaignsRouter.patch("/:id", async (req, res) => {
  try {
    const plan = await campaignManager.updatePlan(req.params.id, req.body);
    res.json(plan);
  } catch (error) {
    console.error("Erreur mise à jour campagne Hermes:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Erreur serveur" });
  }
});

hermesCampaignsRouter.post("/:id/approve", async (req, res) => {
  try {
    const plan = await campaignManager.approvePlan(req.params.id);
    res.json(plan);
  } catch (error) {
    console.error("Erreur approbation campagne Hermes:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Erreur serveur" });
  }
});

hermesCampaignsRouter.post("/:id/schedule", async (req, res) => {
  try {
    const { scheduledAt } = req.body;
    if (typeof scheduledAt !== "string") return res.status(400).json({ error: "scheduledAt requis" });

    const plan = await campaignManager.schedulePlan(req.params.id, scheduledAt);
    res.json(plan);
  } catch (error) {
    console.error("Erreur planification campagne Hermes:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Erreur serveur" });
  }
});

hermesCampaignsRouter.post("/:id/send-now", async (req, res) => {
  try {
    const plan = await campaignManager.sendPlanNow(req.params.id);
    res.json(plan);
  } catch (error) {
    console.error("Erreur envoi campagne Hermes:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Erreur serveur" });
  }
});

hermesCampaignsRouter.post("/:id/sync-stats", async (req, res) => {
  try {
    const plan = await campaignManager.syncStats(req.params.id);
    if (!plan) return res.status(404).json({ error: "Campagne ou identifiant Brevo introuvable" });
    res.json(plan);
  } catch (error) {
    console.error("Erreur synchronisation stats campagne Hermes:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Erreur serveur" });
  }
});

hermesCampaignsRouter.delete("/:id", async (req, res) => {
  try {
    await campaignManager.deletePlan(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    console.error("Erreur suppression campagne Hermes:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Erreur serveur" });
  }
});
