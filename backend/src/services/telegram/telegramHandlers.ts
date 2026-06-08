import type TelegramBot from "node-telegram-bot-api";
import { hermesCore, type HermesModule } from "../hermes/hermesCore";
import contentEngine from "../hermes/modules/contentEngine";
import campaignManager from "../hermes/modules/campaignManager";
import imageGenerator from "../hermes/modules/imageGenerator";
import telegramBotService from "./telegramBot";
import { escapeTelegramHtml, markdownToTelegramHtml, splitTelegramMessage } from "./telegramFormatter";

type SessionState = {
  conversationId?: string;
  usePro: boolean;
};

const sessions = new Map<string, SessionState>();
let registered = false;

function getSession(chatId: number | string): SessionState {
  const key = chatId.toString();
  const existing = sessions.get(key);
  if (existing) return existing;

  const session: SessionState = { usePro: false };
  sessions.set(key, session);
  return session;
}

function getQuickActionsKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "📝 Article", callback_data: "quick:article" },
        { text: "📱 Post social", callback_data: "quick:social" },
      ],
      [
        { text: "📧 Campagne", callback_data: "quick:campaign" },
        { text: "📊 Analyse", callback_data: "quick:analysis" },
      ],
      [
        { text: "🎨 Visuel", callback_data: "quick:image" },
      ],
    ],
  };
}

async function sendLongMessage(chatId: number | string, text: string): Promise<void> {
  for (const part of splitTelegramMessage(text)) {
    await telegramBotService.sendMessage(chatId, part);
  }
}

async function rejectUnauthorized(chatId: number | string): Promise<void> {
  await telegramBotService.sendMessage(
    chatId,
    "⛔ Accès non autorisé. Buzz est réservé à l'administrateur Barber Paradise."
  );
}

async function handleStart(chatId: number | string): Promise<void> {
  await telegramBotService.sendMessage(
    chatId,
    "👋 <b>Salut Mathias, je suis Buzz.</b>\n\nJe connecte Telegram à Hermes pour piloter le marketing Barber Paradise : contenus, campagnes, analyses et brouillons.\n\nUtilise les boutons rapides ci-dessous ou tape simplement ta demande.",
    { reply_markup: getQuickActionsKeyboard() }
  );
}

async function handleHelp(chatId: number | string): Promise<void> {
  await telegramBotService.sendMessage(
    chatId,
    "<b>Commandes Buzz</b>\n\n/start — Démarrer Buzz\n/new — Nouvelle conversation Hermes\n/drafts — Voir les brouillons récents\n/campaigns — Voir les campagnes\n/images — Voir les derniers visuels générés\n/stats — Stats marketing rapides\n/pro — Activer DeepSeek V4-Pro\n/flash — Activer DeepSeek V4-Flash\n/help — Afficher cette aide\n\nTu peux aussi écrire librement : Buzz répond avec la même intelligence qu'Hermes dans le workspace. Pour générer un visuel, demande par exemple : « crée un visuel social pour une tondeuse premium »."
  );
}

async function handleNew(chatId: number | string): Promise<void> {
  sessions.set(chatId.toString(), { usePro: getSession(chatId).usePro });
  await telegramBotService.sendMessage(chatId, "🆕 Nouvelle conversation créée. Que veux-tu préparer aujourd'hui ?", {
    reply_markup: getQuickActionsKeyboard(),
  });
}

async function handleDrafts(chatId: number | string): Promise<void> {
  const { drafts } = await contentEngine.getDrafts({ limit: 5 });

  if (drafts.length === 0) {
    await telegramBotService.sendMessage(chatId, "Aucun brouillon récent pour le moment.");
    return;
  }

  for (const draft of drafts) {
    await telegramBotService.sendMessage(
      chatId,
      `📝 <b>${escapeTelegramHtml(draft.title)}</b>\nType : ${escapeTelegramHtml(draft.type)}\nStatut : ${escapeTelegramHtml(draft.status)}\nCréé le : ${draft.createdAt.toLocaleDateString("fr-FR")}`,
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
}

async function handleCampaigns(chatId: number | string): Promise<void> {
  const { plans: campaigns } = await campaignManager.getPlans({ limit: 5 });

  if (campaigns.length === 0) {
    await telegramBotService.sendMessage(chatId, "Aucune campagne récente pour le moment.");
    return;
  }

  let text = "<b>Campagnes récentes</b>\n\n";
  for (const campaign of campaigns) {
    const date = campaign.scheduledAt
      ? campaign.scheduledAt.toLocaleDateString("fr-FR")
      : campaign.sentAt
        ? campaign.sentAt.toLocaleDateString("fr-FR")
        : "Non planifiée";
    text += `📧 <b>${escapeTelegramHtml(campaign.name)}</b>\n`;
    text += `Statut : ${escapeTelegramHtml(campaign.status)}\n`;
    text += `Audience : ${escapeTelegramHtml(campaign.targetAudience)}\n`;
    text += `Date : ${date}\n\n`;
  }

  await telegramBotService.sendMessage(chatId, text.trim());
}

async function handleImages(chatId: number | string): Promise<void> {
  const { images } = await imageGenerator.getImages({ limit: 5, status: "completed" });

  if (images.length === 0) {
    await telegramBotService.sendMessage(chatId, "Aucun visuel généré pour le moment.");
    return;
  }

  await telegramBotService.sendMessage(chatId, "🎨 <b>Derniers visuels Hermes</b>");
  for (const image of images) {
    const caption = `🎨 <b>${escapeTelegramHtml(image.category || "Visuel")}</b>\n${escapeTelegramHtml(image.prompt.slice(0, 800))}`;
    if (image.cloudinaryUrl) {
      await telegramBotService.sendPhoto(chatId, image.cloudinaryUrl, { caption });
    } else {
      await telegramBotService.sendMessage(chatId, caption);
    }
  }
}

async function handleStats(chatId: number | string): Promise<void> {
  const [draftStats, campaignStats] = await Promise.all([
    contentEngine.getStats(),
    campaignManager.getStats(),
  ]);

  const pendingDrafts = (draftStats.byStatus.draft || 0) + (draftStats.byStatus.review || 0);
  const sentCampaigns = campaignStats.byStatus.sent || 0;
  const scheduledCampaigns = campaignStats.byStatus.scheduled || 0;

  let text = "📊 <b>Stats marketing rapides</b>\n\n";
  text += `📝 Brouillons en attente : ${pendingDrafts}\n`;
  text += `📧 Campagnes envoyées : ${sentCampaigns}\n`;
  text += `⏰ Campagnes programmées : ${scheduledCampaigns}\n`;

  const lists = Array.isArray(campaignStats.lists) ? campaignStats.lists : [];
  if (lists.length) {
    text += "\n<b>Listes Brevo</b>\n";
    for (const list of lists.slice(0, 5)) {
      text += `• ${escapeTelegramHtml(String(list.name))} : ${Number(list.totalSubscribers || 0)} contacts\n`;
    }
  }

  await telegramBotService.sendMessage(chatId, text.trim());
}

async function askHermes(
  chatId: number | string,
  userMessage: string,
  module?: HermesModule
): Promise<void> {
  const session = getSession(chatId);
  const typingInterval = setInterval(() => {
    telegramBotService.sendTyping(chatId).catch(() => undefined);
  }, 4000);

  await telegramBotService.sendTyping(chatId);

  try {
    const result = await hermesCore.chatSync({
      conversationId: session.conversationId,
      userMessage,
      module,
      usePro: session.usePro,
      channel: "telegram",
    });

    session.conversationId = result.conversationId;
    sessions.set(chatId.toString(), session);

    await sendLongMessage(chatId, markdownToTelegramHtml(result.response));

    if (result.drafts?.length) {
      await telegramBotService.sendMessage(
        chatId,
        `✅ ${result.drafts.length} brouillon(s) créé(s). Utilise /drafts pour les approuver ou les rejeter.`
      );
    }

    if (result.images?.length) {
      for (const image of result.images) {
        if (image.cloudinaryUrl) {
          await telegramBotService.sendPhoto(chatId, image.cloudinaryUrl, {
            caption: `🎨 <b>Visuel ${escapeTelegramHtml(image.category)}</b>\n${escapeTelegramHtml(image.prompt.slice(0, 850))}`,
          });
        }
      }
      await telegramBotService.sendMessage(chatId, `✅ ${result.images.length} visuel(s) traité(s). Utilise /images pour les retrouver.`);
    }
  } catch (error) {
    console.error("[TelegramHandlers] Erreur Hermes Buzz:", error);
    await telegramBotService.sendMessage(chatId, "❌ Erreur interne pendant la génération Hermes.");
  } finally {
    clearInterval(typingInterval);
  }
}

async function handleQuickAction(chatId: number | string, action: string): Promise<void> {
  const prompts: Record<string, { prompt: string; module: HermesModule }> = {
    article: {
      prompt: "Propose 3 idées d'articles SEO pour Barber Paradise et rédige le meilleur en brouillon [DRAFT:blog].",
      module: "content",
    },
    social: {
      prompt: "Crée un post social Barber Paradise prêt à publier pour générer de l'engagement cette semaine, en brouillon [DRAFT:social].",
      module: "content",
    },
    campaign: {
      prompt: "Propose une campagne email complète Barber Paradise avec cible, objet, contenu, timing et KPI attendus.",
      module: "campaigns",
    },
    analysis: {
      prompt: "Analyse les priorités marketing Barber Paradise de la semaine et propose un plan d'action concret.",
      module: "analytics",
    },
    image: {
      prompt: "Crée un prompt détaillé puis génère un visuel social premium pour Barber Paradise avec un bloc [IMAGE:social].",
      module: "images",
    },
  };

  const selected = prompts[action];
  if (!selected) return;
  await askHermes(chatId, selected.prompt, selected.module);
}

async function handleCallback(query: TelegramBot.CallbackQuery): Promise<void> {
  const bot = telegramBotService.getBot();
  const chatId = query.message?.chat.id;
  const data = query.data || "";

  if (!chatId) return;
  if (!telegramBotService.isAuthorized(chatId)) {
    await rejectUnauthorized(chatId);
    if (query.id && bot) await bot.answerCallbackQuery(query.id, { text: "Accès non autorisé" });
    return;
  }

  try {
    if (data.startsWith("quick:")) {
      await handleQuickAction(chatId, data.replace("quick:", ""));
    } else if (data.startsWith("draft_approve:")) {
      const draftId = data.replace("draft_approve:", "");
      await contentEngine.updateDraftStatus(draftId, "approved");
      await telegramBotService.sendMessage(chatId, "✅ Brouillon approuvé.");
    } else if (data.startsWith("draft_reject:")) {
      const draftId = data.replace("draft_reject:", "");
      await contentEngine.updateDraftStatus(draftId, "rejected");
      await telegramBotService.sendMessage(chatId, "❌ Brouillon rejeté.");
    }

    if (query.id && bot) await bot.answerCallbackQuery(query.id);
  } catch (error) {
    console.error("[TelegramHandlers] Erreur callback Buzz:", error);
    await telegramBotService.sendMessage(chatId, `❌ Erreur : ${escapeTelegramHtml((error as Error).message)}`);
    if (query.id && bot) await bot.answerCallbackQuery(query.id, { text: "Erreur" });
  }
}

async function handleMessage(message: TelegramBot.Message): Promise<void> {
  const chatId = message.chat.id;
  const text = message.text?.trim();

  if (!text) return;

  if (!telegramBotService.isAuthorized(chatId)) {
    await rejectUnauthorized(chatId);
    return;
  }

  const session = getSession(chatId);

  if (text === "/start") return handleStart(chatId);
  if (text === "/help") return handleHelp(chatId);
  if (text === "/new") return handleNew(chatId);
  if (text === "/drafts") return handleDrafts(chatId);
  if (text === "/campaigns") return handleCampaigns(chatId);
  if (text === "/images") return handleImages(chatId);
  if (text === "/stats") return handleStats(chatId);
  if (text === "/pro") {
    session.usePro = true;
    sessions.set(chatId.toString(), session);
    await telegramBotService.sendMessage(chatId, "⚡ Mode DeepSeek V4-Pro activé pour cette session Buzz.");
    return;
  }
  if (text === "/flash") {
    session.usePro = false;
    sessions.set(chatId.toString(), session);
    await telegramBotService.sendMessage(chatId, "⚡ Mode DeepSeek V4-Flash activé pour cette session Buzz.");
    return;
  }

  return askHermes(chatId, text);
}

export function registerTelegramHandlers(): void {
  const bot = telegramBotService.getBot();
  if (!bot || registered) return;

  bot.on("message", (message: TelegramBot.Message) => {
    handleMessage(message).catch((error) => console.error("[TelegramHandlers] Erreur message Buzz:", error));
  });

  bot.on("callback_query", (query: TelegramBot.CallbackQuery) => {
    handleCallback(query).catch((error) => console.error("[TelegramHandlers] Erreur callback Buzz:", error));
  });

  registered = true;
  console.log("[Telegram] Handlers Buzz enregistrés.");
}
