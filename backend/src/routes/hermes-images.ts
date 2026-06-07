import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import imageGenerator from "../services/hermes/modules/imageGenerator";

export const hermesImagesRouter = Router();

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

hermesImagesRouter.use(requireAdmin);

hermesImagesRouter.get("/", async (req, res) => {
  try {
    const tags = typeof req.query.tags === "string"
      ? req.query.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
      : undefined;

    const result = await imageGenerator.getImages({
      category: typeof req.query.category === "string" ? req.query.category : undefined,
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      tags,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    });

    res.json(result);
  } catch (error) {
    console.error("Erreur récupération images Hermes:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

hermesImagesRouter.get("/stats", async (_req, res) => {
  try {
    const stats = await imageGenerator.getStats();
    res.json(stats);
  } catch (error) {
    console.error("Erreur stats images Hermes:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

hermesImagesRouter.get("/:id", async (req, res) => {
  try {
    const image = await imageGenerator.getImage(req.params.id);
    if (!image) return res.status(404).json({ error: "Image non trouvée" });
    res.json(image);
  } catch (error) {
    console.error("Erreur récupération image Hermes:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

hermesImagesRouter.post("/generate", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ error: "prompt requis" });
    }

    const image = await imageGenerator.generate({
      prompt: prompt.trim(),
      category: typeof req.body.category === "string" ? req.body.category : "other",
      tags: Array.isArray(req.body.tags) ? req.body.tags : [],
      aspectRatio: typeof req.body.aspectRatio === "string" ? req.body.aspectRatio : undefined,
      useFastModel: Boolean(req.body.useFastModel),
      conversationId: typeof req.body.conversationId === "string" ? req.body.conversationId : undefined,
      messageId: typeof req.body.messageId === "string" ? req.body.messageId : undefined,
    });

    res.status(201).json(image);
  } catch (error) {
    console.error("Erreur génération image Hermes:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Erreur serveur" });
  }
});

hermesImagesRouter.patch("/:id", async (req, res) => {
  try {
    const image = await imageGenerator.updateImage(req.params.id, {
      category: typeof req.body.category === "string" ? req.body.category : undefined,
      tags: Array.isArray(req.body.tags) ? req.body.tags : undefined,
    });
    res.json(image);
  } catch (error) {
    console.error("Erreur mise à jour image Hermes:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Erreur serveur" });
  }
});

hermesImagesRouter.delete("/:id", async (req, res) => {
  try {
    await imageGenerator.deleteImage(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    console.error("Erreur suppression image Hermes:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Erreur serveur" });
  }
});
