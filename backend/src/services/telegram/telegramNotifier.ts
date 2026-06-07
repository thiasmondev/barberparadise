import telegramBotService from "./telegramBot";
import { escapeTelegramHtml } from "./telegramFormatter";

class TelegramNotifier {
  async notifyDraftReady(draft: { type: string; title: string; id: string }): Promise<void> {
    const typeLabels: Record<string, string> = {
      blog: "Article de blog",
      social_post: "Post social",
      email: "Email",
      product_description: "Fiche produit",
    };
    const label = typeLabels[draft.type] || "Contenu";

    await telegramBotService.sendToAdmin(
      `🔔 <b>Brouillon à valider</b>\n\n${escapeTelegramHtml(label)} : <b>${escapeTelegramHtml(draft.title)}</b>\n\n👉 Retrouve-le dans l'admin → Hermes → Brouillons`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Approuver", callback_data: `draft_approve:${draft.id}` },
              { text: "❌ Rejeter", callback_data: `draft_reject:${draft.id}` },
            ],
          ],
        },
      }
    );
  }

  async notifyCampaignSent(campaign: {
    name: string;
    targetAudience: string;
    metricsSent?: number | null;
  }): Promise<void> {
    const audience = campaign.targetAudience.toUpperCase();
    const sentCount = campaign.metricsSent ?? "?";

    await telegramBotService.sendToAdmin(
      `🚀 <b>Campagne envoyée !</b>\n\n📧 ${escapeTelegramHtml(campaign.name)}\n👥 Cible : ${escapeTelegramHtml(audience)}\n📤 ${sentCount} email(s) envoyé(s)\n\n<i>Les stats détaillées seront disponibles dans quelques heures.</i>`
    );
  }

  async notifyCampaignStats(campaign: {
    name: string;
    metricsSent: number;
    metricsOpened: number;
    metricsClicked: number;
    metricsUnsubscribed: number;
  }): Promise<void> {
    const openRate = campaign.metricsSent > 0
      ? ((campaign.metricsOpened / campaign.metricsSent) * 100).toFixed(1)
      : "0";
    const clickRate = campaign.metricsSent > 0
      ? ((campaign.metricsClicked / campaign.metricsSent) * 100).toFixed(1)
      : "0";

    await telegramBotService.sendToAdmin(
      `📊 <b>Stats campagne : ${escapeTelegramHtml(campaign.name)}</b>\n\n📤 ${campaign.metricsSent} envoyés\n👁️ ${campaign.metricsOpened} ouvertures (${openRate}%)\n🖱️ ${campaign.metricsClicked} clics (${clickRate}%)\n🚪 ${campaign.metricsUnsubscribed} désinscription(s)`
    );
  }

  async notifyKpiAlert(message: string): Promise<void> {
    await telegramBotService.sendToAdmin(`📈 <b>Alerte KPI</b>\n\n${escapeTelegramHtml(message)}`);
  }

  async sendDailyDigest(data: {
    pendingDrafts: number;
    scheduledCampaigns: number;
    todayTasks: string[];
  }): Promise<void> {
    let text = "☀️ <b>Digest du jour — Barber Paradise</b>\n\n";

    if (data.pendingDrafts > 0) {
      text += `📝 ${data.pendingDrafts} brouillon(s) en attente de validation\n`;
    }
    if (data.scheduledCampaigns > 0) {
      text += `⏰ ${data.scheduledCampaigns} campagne(s) planifiée(s)\n`;
    }

    if (data.todayTasks.length > 0) {
      text += "\n<b>Suggestions du jour :</b>\n";
      data.todayTasks.forEach((task) => {
        text += `• ${escapeTelegramHtml(task)}\n`;
      });
    }

    text += "\nTape /new pour démarrer une session avec Buzz.";
    await telegramBotService.sendToAdmin(text);
  }
}

export default new TelegramNotifier();
