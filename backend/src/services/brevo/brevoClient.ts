import { BrevoClient } from "@getbrevo/brevo";

export const BREVO_LISTS = {
  b2c: 5,
  b2b: 6,
  inactifs: 7,
} as const;

type TargetAudience = "b2c" | "b2b" | "inactifs" | "all" | string;

interface CreateCampaignInput {
  name: string;
  subject: string;
  htmlContent: string;
  listIds: number[];
  preheader?: string;
  scheduledAt?: string;
}

interface CachedListsStats {
  value: unknown;
  expiresAt: number;
}

class BrevoMarketingClient {
  private client: BrevoClient | null = null;
  private configured = false;
  private listsStatsCache: CachedListsStats | null = null;

  constructor() {
    const apiKey = process.env.BREVO_API_KEY;
    if (apiKey) {
      this.client = new BrevoClient({ apiKey });
      this.configured = true;
    }
  }

  isConfigured(): boolean {
    return this.configured && Boolean(this.client);
  }

  getListIds(targetAudience: TargetAudience): number[] {
    const normalized = String(targetAudience || "").trim().toLowerCase();

    if (["b2c", "clients", "particuliers"].includes(normalized)) return [BREVO_LISTS.b2c];
    if (["b2b", "pros", "professionnels", "pro"].includes(normalized)) return [BREVO_LISTS.b2b];
    if (["inactifs", "inactive", "inactives"].includes(normalized)) return [BREVO_LISTS.inactifs];
    if (["all", "tous", "toutes", "global"].includes(normalized)) {
      return [BREVO_LISTS.b2c, BREVO_LISTS.b2b, BREVO_LISTS.inactifs];
    }

    return [BREVO_LISTS.b2c];
  }

  async createCampaign(input: CreateCampaignInput): Promise<{ id: number }> {
    if (!this.client) throw new Error("Brevo non configuré");

    const response = await this.client.emailCampaigns.createEmailCampaign({
      name: input.name,
      subject: input.subject,
      sender: {
        name: process.env.BREVO_SENDER_NAME || "Barber Paradise",
        email: process.env.BREVO_SENDER_EMAIL || "contact@barberparadise.fr",
      },
      htmlContent: input.htmlContent,
      previewText: input.preheader,
      recipients: { listIds: input.listIds },
      scheduledAt: input.scheduledAt,
      mirrorActive: true,
      tag: "hermes-agent",
    });

    const data = (response as any).data ?? response;
    const id = Number(data?.id);
    if (!Number.isFinite(id)) {
      throw new Error("Brevo n'a pas retourné d'identifiant de campagne valide.");
    }

    return { id };
  }

  async scheduleCampaign(campaignId: number, scheduledAt: string): Promise<void> {
    if (!this.client) throw new Error("Brevo non configuré");

    await this.client.emailCampaigns.updateEmailCampaign({
      campaignId,
      scheduledAt,
    });
  }

  async sendCampaignNow(campaignId: number): Promise<void> {
    if (!this.client) throw new Error("Brevo non configuré");

    await this.client.emailCampaigns.sendEmailCampaignNow({ campaignId });
  }

  async getCampaignStats(campaignId: number) {
    if (!this.client) throw new Error("Brevo non configuré");

    const response = await this.client.emailCampaigns.getEmailCampaign({ campaignId });
    const campaign = (response as any).data ?? response;
    const stats = campaign?.statistics ?? campaign?.stats ?? campaign;
    const globalStats = stats?.globalStats ?? stats;

    return {
      sent: Number(globalStats?.sent ?? globalStats?.sentCount ?? campaign?.sent ?? 0),
      delivered: Number(globalStats?.delivered ?? globalStats?.deliveredCount ?? 0),
      opened: Number(globalStats?.uniqueViews ?? globalStats?.opened ?? globalStats?.openers ?? 0),
      clicked: Number(globalStats?.clickers ?? globalStats?.clicked ?? globalStats?.uniqueClicks ?? 0),
      unsubscribed: Number(globalStats?.unsubscriptions ?? globalStats?.unsubscribed ?? 0),
      bounced: Number(globalStats?.hardBounces ?? globalStats?.softBounces ?? globalStats?.bounced ?? 0),
    };
  }

  async getListInfo(listId: number) {
    if (!this.client) throw new Error("Brevo non configuré");

    const response = await this.client.contacts.getList({ listId });
    const list = (response as any).data ?? response;

    return {
      id: Number(list?.id ?? listId),
      name: String(list?.name ?? `Liste ${listId}`),
      totalSubscribers: Number(list?.totalSubscribers ?? list?.uniqueSubscribers ?? 0),
      totalBlacklisted: Number(list?.totalBlacklisted ?? 0),
    };
  }

  async getAllListsStats() {
    if (!this.client) throw new Error("Brevo non configuré");

    const now = Date.now();
    if (this.listsStatsCache && this.listsStatsCache.expiresAt > now) {
      return this.listsStatsCache.value;
    }

    const results = await Promise.all([
      this.getListInfo(BREVO_LISTS.b2c),
      this.getListInfo(BREVO_LISTS.b2b),
      this.getListInfo(BREVO_LISTS.inactifs),
    ]);

    const value = {
      b2c: results[0],
      b2b: results[1],
      inactifs: results[2],
      total: results.reduce((sum, list) => sum + list.totalSubscribers, 0),
    };

    this.listsStatsCache = {
      value,
      expiresAt: now + 5 * 60 * 1000,
    };

    return value;
  }
}

export default new BrevoMarketingClient();
