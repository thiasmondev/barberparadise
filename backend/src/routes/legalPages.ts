import { Router } from "express";
import { requireAdmin, AuthRequest } from "../middleware/auth";
import { prisma } from "../utils/prisma";

export const legalPagesRouter = Router();

function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

legalPagesRouter.get("/", async (_req, res) => {
  try {
    const pages = await prisma.legalPage.findMany({
      orderBy: { slug: "asc" },
    });

    res.json(pages);
  } catch (error) {
    console.error("Erreur récupération pages légales:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des pages légales" });
  }
});

legalPagesRouter.get("/:slug", async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const page = await prisma.legalPage.findUnique({
      where: { slug },
    });

    if (!page) {
      res.status(404).json({ error: "Page légale introuvable" });
      return;
    }

    res.json(page);
  } catch (error) {
    console.error("Erreur récupération page légale:", error);
    res.status(500).json({ error: "Erreur lors de la récupération de la page légale" });
  }
});

legalPagesRouter.put("/:slug", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const { title, content } = req.body as { title?: unknown; content?: unknown };

    if (typeof title !== "string" || title.trim().length === 0) {
      res.status(400).json({ error: "Le titre est obligatoire" });
      return;
    }

    if (typeof content !== "string" || content.trim().length === 0) {
      res.status(400).json({ error: "Le contenu Markdown est obligatoire" });
      return;
    }

    const page = await prisma.legalPage.update({
      where: { slug },
      data: {
        title: title.trim(),
        content,
      },
    });

    res.json(page);
  } catch (error: any) {
    if (error?.code === "P2025") {
      res.status(404).json({ error: "Page légale introuvable" });
      return;
    }

    console.error("Erreur mise à jour page légale:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour de la page légale" });
  }
});
