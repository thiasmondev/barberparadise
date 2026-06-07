import brevoClient from "../../brevo/brevoClient";
import { prisma } from "../../../utils/prisma";
import campaignManager from "./campaignManager";
import contentEngine from "./contentEngine";
import imageGenerator from "./imageGenerator";

export interface KpiFilters {
  startDate?: string;
  endDate?: string;
  source?: string;
  period?: "day" | "week" | "month";
}

type AggregatedMetrics = Record<string, Record<string, number>>;

class AnalyticsModule {
  async collectDailyKPIs() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayStart = new Date(today);
    const dayEnd = new Date(today);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const [hermesStats, hermesConvos, blogCount, socialCount, productCount, imagesGenerated, imagesCost] =
      await Promise.all([
        prisma.hermesMessage.aggregate({
          where: { createdAt: { gte: dayStart, lt: dayEnd }, role: "assistant" },
          _count: true,
          _sum: { tokensInput: true, tokensOutput: true },
        }),
        prisma.hermesConversation.count({ where: { createdAt: { gte: dayStart, lt: dayEnd } } }),
        prisma.contentDraft.count({
          where: { publishedAt: { gte: dayStart, lt: dayEnd }, type: "blog", status: "published" },
        }),
        prisma.contentDraft.count({
          where: { publishedAt: { gte: dayStart, lt: dayEnd }, type: "social_post", status: "published" },
        }),
        prisma.contentDraft.count({
          where: { publishedAt: { gte: dayStart, lt: dayEnd }, type: "product_description", status: "published" },
        }),
        prisma.hermesImage.count({ where: { createdAt: { gte: dayStart, lt: dayEnd }, status: "completed" } }),
        prisma.hermesImage.aggregate({
          where: { createdAt: { gte: dayStart, lt: dayEnd }, status: "completed" },
          _sum: { costUsd: true },
        }),
      ]);

    const totalTokens = (hermesStats._sum.tokensInput || 0) + (hermesStats._sum.tokensOutput || 0);
    const hermesCost = (totalTokens / 1_000_000) * 0.28;

    await Promise.all([
      prisma.marketingKPI.upsert({
        where: { date_source: { date: today, source: "hermes" } },
        create: {
          date: today,
          source: "hermes",
          hermesConversations: hermesConvos,
          hermesMessages: hermesStats._count,
          hermesTokensUsed: totalTokens,
          hermesCostUsd: Number(hermesCost.toFixed(4)),
        },
        update: {
          hermesConversations: hermesConvos,
          hermesMessages: hermesStats._count,
          hermesTokensUsed: totalTokens,
          hermesCostUsd: Number(hermesCost.toFixed(4)),
        },
      }),
      prisma.marketingKPI.upsert({
        where: { date_source: { date: today, source: "content" } },
        create: {
          date: today,
          source: "content",
          blogPostsPublished: blogCount,
          socialPostsCreated: socialCount,
          productDescsUpdated: productCount,
        },
        update: {
          blogPostsPublished: blogCount,
          socialPostsCreated: socialCount,
          productDescsUpdated: productCount,
        },
      }),
      prisma.marketingKPI.upsert({
        where: { date_source: { date: today, source: "images" } },
        create: {
          date: today,
          source: "images",
          imagesGenerated,
          imagesCostUsd: imagesCost._sum.costUsd || 0,
        },
        update: {
          imagesGenerated,
          imagesCostUsd: imagesCost._sum.costUsd || 0,
        },
      }),
    ]);

    console.log(`[Analytics] KPIs du ${today.toISOString().split("T")[0]} collectés.`);

    return this.generateReport(1);
  }

  async getKPIs(filters: KpiFilters = {}) {
    const endDate = filters.endDate ? new Date(filters.endDate) : new Date();
    const startDate = filters.startDate
      ? new Date(filters.startDate)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const where: Record<string, unknown> = { date: { gte: startDate, lte: endDate } };
    if (filters.source) where.source = filters.source;

    return prisma.marketingKPI.findMany({
      where,
      orderBy: { date: "asc" },
    });
  }

  async generateReport(days = 30) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const endDate = new Date();
    const kpis = await prisma.marketingKPI.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      orderBy: { date: "asc" },
    });

    const aggregated: AggregatedMetrics = {};
    for (const kpi of kpis) {
      if (!aggregated[kpi.source]) aggregated[kpi.source] = {};
      const agg = aggregated[kpi.source];

      this.addMetric(agg, "emailsSent", kpi.emailsSent);
      this.addMetric(agg, "emailsOpened", kpi.emailsOpened);
      this.addMetric(agg, "emailsClicked", kpi.emailsClicked);
      this.addMetric(agg, "emailsBounced", kpi.emailsBounced);
      this.addMetric(agg, "emailsUnsubs", kpi.emailsUnsubs);
      this.addMetric(agg, "blogPostsPublished", kpi.blogPostsPublished);
      this.addMetric(agg, "socialPostsCreated", kpi.socialPostsCreated);
      this.addMetric(agg, "productDescsUpdated", kpi.productDescsUpdated);
      this.addMetric(agg, "hermesConversations", kpi.hermesConversations);
      this.addMetric(agg, "hermesMessages", kpi.hermesMessages);
      this.addMetric(agg, "hermesTokensUsed", kpi.hermesTokensUsed);
      this.addMetric(agg, "hermesCostUsd", kpi.hermesCostUsd);
      this.addMetric(agg, "imagesGenerated", kpi.imagesGenerated);
      this.addMetric(agg, "imagesCostUsd", kpi.imagesCostUsd);
    }

    const [draftStats, campaignStats, imageStats, listsStats] = await Promise.all([
      contentEngine.getStats().catch(() => null),
      campaignManager.getStats().catch(() => null),
      imageGenerator.getStats().catch(() => null),
      brevoClient.isConfigured() ? brevoClient.getAllListsStats().catch(() => null) : Promise.resolve(null),
    ]);

    return {
      period: { startDate, endDate, days },
      aggregated,
      timeSeries: kpis,
      current: {
        drafts: draftStats,
        campaigns: campaignStats,
        images: imageStats,
        lists: listsStats,
      },
    };
  }

  async getContextSummary(): Promise<string> {
    const report = await this.generateReport(7);
    const agg = report.aggregated;
    const parts: string[] = ["=== CONTEXTE MARKETING (7 derniers jours) ==="];

    if (agg.content) {
      parts.push(
        `Contenu : ${agg.content.blogPostsPublished || 0} article(s), ${agg.content.socialPostsCreated || 0} post(s) social, ${agg.content.productDescsUpdated || 0} fiche(s) produit.`
      );
    }

    if (agg.hermes) {
      parts.push(
        `Hermes : ${agg.hermes.hermesConversations || 0} conversation(s), ${agg.hermes.hermesMessages || 0} message(s), coût estimé $${(agg.hermes.hermesCostUsd || 0).toFixed(2)}.`
      );
    }

    if (agg.images) {
      parts.push(
        `Images : ${agg.images.imagesGenerated || 0} image(s) générée(s), coût estimé $${(agg.images.imagesCostUsd || 0).toFixed(2)}.`
      );
    }

    const lists = report.current.lists as null | { b2c?: { totalSubscribers?: number }; b2b?: { totalSubscribers?: number }; total?: number };
    if (lists) {
      parts.push(
        `Listes Brevo : ${lists.b2c?.totalSubscribers || 0} B2C, ${lists.b2b?.totalSubscribers || 0} B2B, ${lists.total || 0} total.`
      );
    }

    const drafts = report.current.drafts as null | { byStatus?: Record<string, number> };
    if (drafts?.byStatus) {
      parts.push(
        `Pipeline contenu : ${drafts.byStatus.draft || 0} draft(s), ${drafts.byStatus.review || 0} en review, ${drafts.byStatus.approved || 0} approuvé(s).`
      );
    }

    return parts.join("\n");
  }

  private addMetric(target: Record<string, number>, key: string, value: number | null) {
    if (typeof value === "number") {
      target[key] = (target[key] || 0) + value;
    }
  }
}

const analyticsModule = new AnalyticsModule();
export default analyticsModule;

export async function runAnalytics(): Promise<{ status: string; message: string }> {
  const report = await analyticsModule.generateReport(7);
  return {
    status: "active",
    message: `Analytics actif. ${report.timeSeries.length} point(s) KPI sur les 7 derniers jours.`,
  };
}
