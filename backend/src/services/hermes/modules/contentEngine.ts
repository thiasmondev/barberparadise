import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface DraftSummary {
  type: string;
  title: string;
  id: string;
}

interface DraftFilters {
  type?: string;
  status?: string;
  page?: number;
  limit?: number;
}

interface DraftUpdateInput {
  title?: string;
  content?: string;
  seoMetaTitle?: string | null;
  seoMetaDescription?: string | null;
  seoKeywords?: string[];
  seoSlug?: string | null;
  metadata?: unknown;
  campaignPlanId?: string | null;
}

class ContentEngine {
  /**
   * Parse les blocs [DRAFT:type]...[/DRAFT] dans une réponse Hermes
   * et crée automatiquement des ContentDraft en base.
   */
  async extractAndSaveDrafts(
    assistantMessage: string,
    conversationId: string,
    messageId?: string
  ): Promise<DraftSummary[]> {
    const draftRegex = /\[DRAFT:(blog|social|email|product)\]([\s\S]*?)\[\/DRAFT\]/g;
    const drafts: DraftSummary[] = [];
    let match: RegExpExecArray | null;

    while ((match = draftRegex.exec(assistantMessage)) !== null) {
      const rawType = match[1];
      const content = match[2].trim();

      if (!content) continue;

      const typeMap: Record<string, string> = {
        blog: "blog",
        social: "social_post",
        email: "email",
        product: "product_description",
      };
      const type = typeMap[rawType] || rawType;

      const firstLine = content.split("\n")[0].replace(/^#+\s*/, "").trim();
      const title = firstLine.substring(0, 120) || `Brouillon ${type}`;
      const seoMeta = this.extractSeoMeta(content);

      const draft = await prisma.contentDraft.create({
        data: {
          type,
          title,
          content,
          status: "draft",
          conversationId,
          messageId,
          seoMetaTitle: seoMeta.metaTitle,
          seoMetaDescription: seoMeta.metaDescription,
          seoKeywords: seoMeta.keywords,
          seoSlug: seoMeta.slug,
        },
      });

      drafts.push({ type, title, id: draft.id });
    }

    return drafts;
  }

  private extractSeoMeta(content: string) {
    const metaTitleMatch = content.match(/Meta Title:\s*(.+)/i);
    const metaDescMatch = content.match(/Meta Description:\s*(.+)/i);
    const keywordsMatch = content.match(/Keywords?:\s*(.+)/i);
    const slugMatch = content.match(/Slug:\s*(.+)/i);

    return {
      metaTitle: metaTitleMatch?.[1]?.trim() || null,
      metaDescription: metaDescMatch?.[1]?.trim() || null,
      keywords:
        keywordsMatch?.[1]
          ?.split(",")
          .map((keyword: string) => keyword.trim())
          .filter(Boolean) || [],
      slug: slugMatch?.[1]?.trim() || null,
    };
  }

  async updateDraftStatus(draftId: string, status: string) {
    const validStatuses = ["draft", "review", "approved", "published", "rejected"];
    if (!validStatuses.includes(status)) {
      throw new Error(`Statut invalide: ${status}`);
    }

    const data: { status: string; publishedAt?: Date | null } = { status };
    if (status === "published") data.publishedAt = new Date();
    if (status !== "published") data.publishedAt = null;

    return prisma.contentDraft.update({
      where: { id: draftId },
      data,
    });
  }

  async getDrafts(filters: DraftFilters) {
    const where: { type?: string; status?: string } = {};
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;

    const limit = Math.min(Math.max(filters.limit || 20, 1), 100);
    const page = Math.max(filters.page || 1, 1);

    const [drafts, total] = await Promise.all([
      prisma.contentDraft.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.contentDraft.count({ where }),
    ]);

    return { drafts, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getDraft(id: string) {
    return prisma.contentDraft.findUnique({ where: { id } });
  }

  async updateDraft(id: string, data: DraftUpdateInput) {
    return prisma.contentDraft.update({ where: { id }, data: data as Record<string, unknown> });
  }

  async deleteDraft(id: string) {
    return prisma.contentDraft.delete({ where: { id } });
  }

  async getStats() {
    const [byStatus, byType, recentPublished] = await Promise.all([
      prisma.contentDraft.groupBy({
        by: ["status"],
        _count: true,
      }),
      prisma.contentDraft.groupBy({
        by: ["type"],
        _count: true,
      }),
      prisma.contentDraft.count({
        where: {
          status: "published",
          publishedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    return {
      byStatus: Object.fromEntries(byStatus.map((status) => [status.status, status._count])),
      byType: Object.fromEntries(byType.map((type) => [type.type, type._count])),
      publishedLast30Days: recentPublished,
    };
  }
}

export default new ContentEngine();
