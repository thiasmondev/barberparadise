import TelegramBot from "node-telegram-bot-api";

class TelegramBotService {
  private bot: TelegramBot | null = null;
  private adminChatId: string | null = null;
  private configured = false;

  initialize(): void {
    if (this.bot) return;

    const token = process.env.TELEGRAM_BOT_TOKEN;
    this.adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || null;

    if (!token) {
      console.warn("[Telegram] TELEGRAM_BOT_TOKEN non défini — Buzz désactivé.");
      return;
    }

    this.bot = new TelegramBot(token, { polling: false });
    this.configured = true;
    console.log("[Telegram] Buzz initialisé en mode webhook.");
  }

  async setupWebhook(serverUrl: string): Promise<void> {
    if (!this.bot || !this.configured) return;

    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!secret) {
      console.warn("[Telegram] TELEGRAM_WEBHOOK_SECRET non défini — webhook Buzz non configuré.");
      return;
    }

    const cleanServerUrl = serverUrl.replace(/\/$/, "");
    const webhookUrl = `${cleanServerUrl}/api/telegram/webhook/${secret}`;

    try {
      await this.bot.setWebHook(webhookUrl, {
        allowed_updates: ["message", "callback_query"],
      });
      console.log("[Telegram] Webhook Buzz configuré.");
    } catch (error) {
      console.error("[Telegram] Erreur configuration webhook Buzz:", error);
    }
  }

  processUpdate(update: TelegramBot.Update): void {
    if (!this.bot) return;
    this.bot.processUpdate(update);
  }

  isAuthorized(chatId: number | string): boolean {
    if (!this.adminChatId) return false;
    return chatId.toString() === this.adminChatId;
  }

  async sendToAdmin(
    text: string,
    options?: TelegramBot.SendMessageOptions
  ): Promise<TelegramBot.Message | null> {
    if (!this.bot || !this.adminChatId) return null;
    return this.sendMessage(this.adminChatId, text, options);
  }

  async sendMessage(
    chatId: number | string,
    text: string,
    options?: TelegramBot.SendMessageOptions
  ): Promise<TelegramBot.Message | null> {
    if (!this.bot) return null;

    try {
      return await this.bot.sendMessage(chatId, text, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...options,
      });
    } catch (error) {
      console.error("[Telegram] Erreur envoi message Buzz:", error);
      return null;
    }
  }

  async sendTyping(chatId: number | string): Promise<void> {
    if (!this.bot) return;

    try {
      await this.bot.sendChatAction(chatId, "typing");
    } catch {
      // Ne pas bloquer l'expérience Hermes si Telegram refuse l'indicateur.
    }
  }

  getBot(): TelegramBot | null {
    return this.bot;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  hasAdminChatId(): boolean {
    return Boolean(this.adminChatId);
  }
}

export default new TelegramBotService();
