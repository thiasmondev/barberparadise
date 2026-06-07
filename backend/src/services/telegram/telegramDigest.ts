import cron from "node-cron";
import telegramBotService from "./telegramBot";
import telegramNotifier from "./telegramNotifier";
import contentEngine from "../hermes/modules/contentEngine";
import campaignManager from "../hermes/modules/campaignManager";

let scheduled = false;

export function scheduleTelegramDailyDigest(): void {
  if (scheduled) return;

  cron.schedule("0 8 * * *", async () => {
    if (!telegramBotService.isConfigured() || !telegramBotService.hasAdminChatId()) return;

    try {
      const [draftStats, campaignStats] = await Promise.all([
        contentEngine.getStats(),
        campaignManager.getStats(),
      ]);

      const pendingDrafts = (draftStats.byStatus.draft || 0) + (draftStats.byStatus.review || 0);
      const scheduledCampaigns = campaignStats.byStatus.scheduled || 0;
      const todayTasks: string[] = [];
      const dayOfWeek = new Date().getDay();

      if (pendingDrafts > 3) {
        todayTasks.push("Tu as plusieurs brouillons en attente — prends 10 minutes pour les valider.");
      }
      if (scheduledCampaigns > 0) {
        todayTasks.push(`${scheduledCampaigns} campagne(s) programmée(s) — vérifie le contenu et les audiences.`);
      }
      if (dayOfWeek === 1) {
        todayTasks.push("C'est lundi — bon moment pour planifier la communication de la semaine.");
      }
      if (dayOfWeek === 4) {
        todayTasks.push("C'est jeudi — idéal pour préparer un post orienté weekend.");
      }

      if (pendingDrafts > 0 || scheduledCampaigns > 0 || todayTasks.length > 0) {
        await telegramNotifier.sendDailyDigest({ pendingDrafts, scheduledCampaigns, todayTasks });
      }
    } catch (error) {
      console.error("[TelegramDigest] Erreur digest quotidien Buzz:", error);
    }
  });

  scheduled = true;
  console.log("[Telegram] Digest quotidien Buzz planifié à 8h00.");
}
