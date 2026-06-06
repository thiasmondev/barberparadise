import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { PrismaClient } from "@prisma/client";
import { requireAdmin } from "../middleware/auth";
import { hermesCore } from "../services/hermes/hermesCore";

const prisma = new PrismaClient();
export const hermesRouter = express.Router();

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de requêtes Hermes. Réessayez dans une minute." },
});

hermesRouter.use(requireAdmin);

hermesRouter.post("/chat", chatLimiter, async (req: Request, res: Response) => {
  try {
    const { conversationId, message, module, usePro } = req.body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      res.status(400).json({ error: "Le message est requis." });
      return;
    }

    await hermesCore.chat({
      conversationId: conversationId || null,
      userMessage: message.trim(),
      module: module || null,
      usePro: Boolean(usePro),
      res,
    });
  } catch (error) {
    console.error("[Hermes Route] Erreur chat:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Erreur interne Hermes." });
    }
  }
});

hermesRouter.post("/chat/sync", chatLimiter, async (req: Request, res: Response) => {
  try {
    const { conversationId, message, module, usePro, channel } = req.body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      res.status(400).json({ error: "Le message est requis." });
      return;
    }

    const result = await hermesCore.chatSync({
      conversationId: conversationId || null,
      userMessage: message.trim(),
      module: module || null,
      usePro: Boolean(usePro),
      channel: channel || "workspace",
    });

    res.json(result);
  } catch (error) {
    console.error("[Hermes Route] Erreur chat sync:", error);
    res.status(500).json({ error: "Erreur interne Hermes." });
  }
});

hermesRouter.get("/conversations", async (req: Request, res: Response) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const channel = typeof req.query.channel === "string" ? req.query.channel : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : "active";

    const where = {
      ...(channel ? { channel } : {}),
      ...(status ? { status } : {}),
    };

    const [conversations, total] = await Promise.all([
      prisma.hermesConversation.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: (page - 1) * limit,
        include: {
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
          _count: { select: { messages: true } },
        },
      }),
      prisma.hermesConversation.count({ where }),
    ]);

    res.json({
      conversations,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("[Hermes Route] Erreur liste conversations:", error);
    res.status(500).json({ error: "Erreur interne." });
  }
});

hermesRouter.get("/conversations/:id", async (req: Request, res: Response) => {
  try {
    const conversation = await prisma.hermesConversation.findUnique({
      where: { id: req.params.id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!conversation) {
      res.status(404).json({ error: "Conversation non trouvée." });
      return;
    }

    res.json(conversation);
  } catch (error) {
    console.error("[Hermes Route] Erreur détail conversation:", error);
    res.status(500).json({ error: "Erreur interne." });
  }
});

hermesRouter.patch("/conversations/:id/archive", async (req: Request, res: Response) => {
  try {
    const conversation = await prisma.hermesConversation.update({
      where: { id: req.params.id },
      data: { status: "archived" },
    });
    res.json(conversation);
  } catch (error) {
    console.error("[Hermes Route] Erreur archive:", error);
    res.status(500).json({ error: "Erreur interne." });
  }
});

hermesRouter.delete("/conversations/:id", async (req: Request, res: Response) => {
  try {
    await prisma.hermesConversation.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error("[Hermes Route] Erreur suppression:", error);
    res.status(500).json({ error: "Erreur interne." });
  }
});

hermesRouter.get("/stats", async (_req: Request, res: Response) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [totalConversations, activeConversations, totalMessages, recentMessages, tokenStats] = await Promise.all([
      prisma.hermesConversation.count(),
      prisma.hermesConversation.count({ where: { status: "active" } }),
      prisma.hermesMessage.count(),
      prisma.hermesMessage.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.hermesMessage.aggregate({
        where: { role: "assistant" },
        _sum: { tokensInput: true, tokensOutput: true },
        _avg: { durationMs: true },
      }),
    ]);

    res.json({
      totalConversations,
      activeConversations,
      totalMessages,
      last30DaysMessages: recentMessages,
      totalTokensInput: tokenStats._sum.tokensInput || 0,
      totalTokensOutput: tokenStats._sum.tokensOutput || 0,
      avgResponseTimeMs: Math.round(tokenStats._avg.durationMs || 0),
    });
  } catch (error) {
    console.error("[Hermes Route] Erreur stats:", error);
    res.status(500).json({ error: "Erreur interne." });
  }
});
