import { PrismaClient } from "@prisma/client";
import brevoClient from "../../brevo/brevoClient";

const prisma = new PrismaClient();

interface CreatePlanInput {
  name: string;
  targetAudience: string;
  subject: string;
  preheader?: string;
  htmlContent?: string;
  strategyBrief?: string;
  estimatedROI?: string;
  scheduledAt?: string;
  conversationId?: string;
  metadata?: unknown;
}

interface PlanFilters {
  status?: string;
  targetAudience?: string;
  page?: number;
  limit?: number;
}

class CampaignManager {
  async createPlan(data: CreatePlanInput) {
    const listIds = brevoClient.getListIds(data.targetAudience);

    return prisma.campaignPlan.create({
      data: {
        name: data.name,
        targetAudience: data.targetAudience,
        brevoListIds: listIds,
        subject: data.subject,
        preheader: data.preheader,
        htmlContent: data.htmlContent,
        strategyBrief: data.strategyBrief,
        estimatedROI: data.estimatedROI,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        conversationId: data.conversationId,
        metadata: data.metadata as any,
        status: "draft",
      },
    });
  }

  async updatePlan(id: string, data: Record<string, unknown>) {
    const updateData = { ...data } as any;

    if (typeof updateData.targetAudience === "string") {
      updateData.brevoListIds = brevoClient.getListIds(updateData.targetAudience);
    }

    if (typeof updateData.scheduledAt === "string") {
      updateData.scheduledAt = new Date(updateData.scheduledAt);
    }

    return prisma.campaignPlan.update({ where: { id }, data: updateData });
  }

  async approvePlan(id: string) {
    const plan = await prisma.campaignPlan.findUnique({ where: { id } });
    if (!plan) throw new Error("Plan non trouvé");
    if (!plan.htmlContent) throw new Error("Le contenu HTML est requis avant approbation");

    if (!brevoClient.isConfigured()) {
      throw new Error("Brevo n'est pas configuré. Ajouter BREVO_API_KEY dans les env vars.");
    }

    const brevoCampaign = await brevoClient.createCampaign({
      name: plan.name,
      subject: plan.subject,
      htmlContent: plan.htmlContent,
      listIds: plan.brevoListIds,
      preheader: plan.preheader || undefined,
      scheduledAt: plan.scheduledAt?.toISOString(),
    });

    return prisma.campaignPlan.update({
      where: { id },
      data: {
        status: "approved",
        brevoCampaignId: brevoCampaign.id,
      },
    });
  }

  async schedulePlan(id: string, scheduledAt: string) {
    const plan = await prisma.campaignPlan.findUnique({ where: { id } });
    if (!plan) throw new Error("Plan non trouvé");
    if (!plan.brevoCampaignId) throw new Error("La campagne doit être approuvée dans Brevo d'abord");

    await brevoClient.scheduleCampaign(plan.brevoCampaignId, scheduledAt);

    return prisma.campaignPlan.update({
      where: { id },
      data: {
        status: "scheduled",
        scheduledAt: new Date(scheduledAt),
      },
    });
  }

  async sendPlanNow(id: string) {
    const plan = await prisma.campaignPlan.findUnique({ where: { id } });
    if (!plan) throw new Error("Plan non trouvé");
    if (!plan.brevoCampaignId) throw new Error("La campagne doit être approuvée dans Brevo d'abord");

    await brevoClient.sendCampaignNow(plan.brevoCampaignId);

    return prisma.campaignPlan.update({
      where: { id },
      data: {
        status: "sent",
        sentAt: new Date(),
      },
    });
  }

  async syncStats(id: string) {
    const plan = await prisma.campaignPlan.findUnique({ where: { id } });
    if (!plan || !plan.brevoCampaignId) return null;

    const stats = await brevoClient.getCampaignStats(plan.brevoCampaignId);

    return prisma.campaignPlan.update({
      where: { id },
      data: {
        metricsSent: stats.sent,
        metricsDelivered: stats.delivered,
        metricsOpened: stats.opened,
        metricsClicked: stats.clicked,
        metricsUnsubscribed: stats.unsubscribed,
        metricsBounced: stats.bounced,
      },
    });
  }

  async getPlans(filters: PlanFilters) {
    const where: { status?: string; targetAudience?: string } = {};
    if (filters.status) where.status = filters.status;
    if (filters.targetAudience) where.targetAudience = filters.targetAudience;

    const limit = Math.min(Math.max(filters.limit || 20, 1), 100);
    const page = Math.max(filters.page || 1, 1);

    const [plans, total] = await Promise.all([
      prisma.campaignPlan.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: (page - 1) * limit,
        include: { drafts: true },
      }),
      prisma.campaignPlan.count({ where }),
    ]);

    return { plans, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getPlan(id: string) {
    return prisma.campaignPlan.findUnique({
      where: { id },
      include: { drafts: true },
    });
  }

  async deletePlan(id: string) {
    const plan = await prisma.campaignPlan.findUnique({ where: { id } });
    if (!plan) throw new Error("Plan non trouvé");
    if (!["draft", "rejected", "cancelled"].includes(plan.status)) {
      throw new Error("Impossible de supprimer une campagne approuvée ou envoyée");
    }
    return prisma.campaignPlan.delete({ where: { id } });
  }

  async getStats() {
    const [byStatus, sentCampaigns, listsStats] = await Promise.all([
      prisma.campaignPlan.groupBy({ by: ["status"], _count: true }),
      prisma.campaignPlan.findMany({
        where: { status: "sent", metricsSent: { not: null } },
        orderBy: { sentAt: "desc" },
        take: 10,
        select: {
          id: true,
          name: true,
          sentAt: true,
          metricsSent: true,
          metricsOpened: true,
          metricsClicked: true,
          targetAudience: true,
        },
      }),
      brevoClient.isConfigured() ? brevoClient.getAllListsStats() : null,
    ]);

    return {
      byStatus: Object.fromEntries(byStatus.map((status) => [status.status, status._count])),
      recentSent: sentCampaigns,
      lists: listsStats,
      brevoConfigured: brevoClient.isConfigured(),
    };
  }
}

export default new CampaignManager();
