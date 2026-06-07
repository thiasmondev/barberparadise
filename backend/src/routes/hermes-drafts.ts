import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import contentEngine from "../services/hermes/modules/contentEngine";

export const hermesDraftsRouter = Router();

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

hermesDraftsRouter.use(requireAdmin);

hermesDraftsRouter.get("/", async (req, res) => {
  try {
    const result = await contentEngine.getDrafts({
      type: typeof req.query.type === "string" ? req.query.type : undefined,
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    });
    res.json(result);
  } catch (error) {
    console.error("Erreur récupération brouillons:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

hermesDraftsRouter.get("/stats", async (_req, res) => {
  try {
    const stats = await contentEngine.getStats();
    res.json(stats);
  } catch (error) {
    console.error("Erreur stats brouillons:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

hermesDraftsRouter.get("/:id", async (req, res) => {
  try {
    const draft = await contentEngine.getDraft(req.params.id);
    if (!draft) return res.status(404).json({ error: "Brouillon non trouvé" });
    res.json(draft);
  } catch (error) {
    console.error("Erreur récupération brouillon:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

hermesDraftsRouter.patch("/:id", async (req, res) => {
  try {
    const draft = await contentEngine.updateDraft(req.params.id, req.body);
    res.json(draft);
  } catch (error) {
    console.error("Erreur mise à jour brouillon:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Erreur serveur" });
  }
});

hermesDraftsRouter.post("/:id/publish", async (req, res) => {
  try {
    const draft = await contentEngine.updateDraftStatus(req.params.id, "published");
    res.json(draft);
  } catch (error) {
    console.error("Erreur publication brouillon:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Erreur serveur" });
  }
});

hermesDraftsRouter.post("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    if (typeof status !== "string") return res.status(400).json({ error: "Statut requis" });

    const draft = await contentEngine.updateDraftStatus(req.params.id, status);
    res.json(draft);
  } catch (error) {
    console.error("Erreur changement statut brouillon:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Erreur serveur" });
  }
});

hermesDraftsRouter.delete("/:id", async (req, res) => {
  try {
    await contentEngine.deleteDraft(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    console.error("Erreur suppression brouillon:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Erreur serveur" });
  }
});
