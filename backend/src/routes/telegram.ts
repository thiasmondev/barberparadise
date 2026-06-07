import { Router } from "express";
import telegramBotService from "../services/telegram/telegramBot";

const router = Router();

router.post("/webhook/:secret", (req, res) => {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!expectedSecret || req.params.secret !== expectedSecret) {
    return res.status(403).json({ error: "Invalid Telegram webhook secret" });
  }

  try {
    telegramBotService.processUpdate(req.body);
    return res.json({ ok: true });
  } catch (error) {
    console.error("[TelegramRoute] Erreur webhook Buzz:", error);
    return res.status(500).json({ error: "Telegram webhook processing failed" });
  }
});

router.get("/status", (_req, res) => {
  res.json({
    botName: "Buzz",
    username: "@buzz_bp_bot",
    configured: telegramBotService.isConfigured(),
    hasAdminChatId: telegramBotService.hasAdminChatId(),
    webhookSecretConfigured: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
    mode: "webhook",
  });
});

export default router;
