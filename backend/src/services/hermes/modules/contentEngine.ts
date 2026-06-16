import { PrismaClient } from "@prisma/client";
import telegramNotifier from "../../telegram/telegramNotifier";

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

interface PublishDraftResult {
  draft: Awaited<ReturnType<typeof prisma.contentDraft.update>>;
  article?: Awaited<ReturnType<typeof prisma.blogArticle.create>> | Awaited<ReturnType<typeof prisma.blogArticle.update>>;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 90) || "article-blog";
}

function stripMarkdown(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s*(Meta Title|Meta Description|Keywords?|Slug)\s*:.+$/gim, " ")
    .replace(/[#>*_~\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function estimateReadTime(content: string): number {
  const words = stripMarkdown(content).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
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
      telegramNotifier.notifyDraftReady({ type, title, id: draft.id }).catch(console.error);
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

  private async ensureUniqueBlogSlug(baseSlug: string, currentId?: string): Promise<string> {
    const base = slugify(baseSlug);
    let candidate = base;
    let suffix = 2;

    while (true) {
      const existing = await prisma.blogArticle.findUnique({ where: { slug: candidate } });
      if (!existing || existing.id === currentId) return candidate;
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
  }

  private buildBlogArticleData(draft: Awaited<ReturnType<typeof prisma.contentDraft.findUnique>>, slug: string) {
    if (!draft) throw new Error("Brouillon introuvable");
    const metadata = getRecord(draft.metadata);
    const category = typeof metadata.category === "string" && metadata.category.trim() ? metadata.category.trim() : "Conseils barbier";
    const linkedProductIds = toStringArray(metadata.linkedProductIds ?? metadata.productIds ?? metadata.products);
    const excerpt =
      typeof metadata.excerpt === "string" && metadata.excerpt.trim()
        ? metadata.excerpt.trim()
        : stripMarkdown(draft.content).substring(0, 220);

    return {
      slug,
      title: draft.title,
      excerpt,
      content: draft.content,
      coverImage: typeof metadata.coverImage === "string" && metadata.coverImage.trim() ? metadata.coverImage.trim() : null,
      category,
      tags: draft.seoKeywords,
      readTime: estimateReadTime(draft.content),
      seoMetaTitle: draft.seoMetaTitle || draft.title,
      seoMetaDescription: draft.seoMetaDescription || excerpt.substring(0, 160),
      seoKeywords: draft.seoKeywords,
      status: "published",
      publishedAt: new Date(),
      linkedProductIds,
      sourceDraftId: draft.id,
    };
  }

  private async createOrUpdateBlogArticleFromDraft(draftId: string) {
    const draft = await prisma.contentDraft.findUnique({ where: { id: draftId } });
    if (!draft) throw new Error("Brouillon introuvable");
    if (draft.type !== "blog") return undefined;

    const existing = await prisma.blogArticle.findUnique({ where: { sourceDraftId: draft.id } });
    const slug = await this.ensureUniqueBlogSlug(draft.seoSlug || draft.title, existing?.id);
    const data = this.buildBlogArticleData(draft, slug);

    if (existing) return prisma.blogArticle.update({ where: { id: existing.id }, data });
    return prisma.blogArticle.create({ data });
  }

  async publishDraft(draftId: string): Promise<PublishDraftResult> {
    const article = await this.createOrUpdateBlogArticleFromDraft(draftId);
    const draft = await prisma.contentDraft.update({
      where: { id: draftId },
      data: { status: "published", publishedAt: new Date() },
    });
    return { draft, article };
  }

  async updateDraftStatus(draftId: string, status: string) {
    const validStatuses = ["draft", "review", "approved", "published", "rejected"];
    if (!validStatuses.includes(status)) {
      throw new Error(`Statut invalide: ${status}`);
    }

    if (status === "published") {
      const { draft } = await this.publishDraft(draftId);
      return draft;
    }

    return prisma.contentDraft.update({
      where: { id: draftId },
      data: { status, publishedAt: null },
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
