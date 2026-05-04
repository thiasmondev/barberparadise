import { Router, Response } from "express";
import { prisma } from "../utils/prisma";
import { AuthRequest, requireAdmin } from "../middleware/auth";
import {
  calculateDiscountAmount,
  generateMarketingCampaignContent,
  MarketingGenerationInput,
  MarketingProductContext,
  slugifyMarketing,
} from "../services/marketingAgentService";
import {
  BREVO_LISTS,
  createBrevoEmailCampaign,
  getBrevoStatus,
  listBrevoLists,
  sendBrevoCampaignNow,
  upsertBrevoContact,
} from "../services/brevoMarketingService";

export const adminMarketingRouter = Router();
adminMarketingRouter.use(requireAdmin);

function asDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32);
}

function sendError(res: Response, error: unknown, fallback = "Erreur Marketing") {
  console.error(fallback, error);
  res.status(500).json({ error: error instanceof Error ? error.message : fallback });
}

async function getProductContext(productIds?: string[]): Promise<MarketingProductContext[]> {
  const products = await prisma.product.findMany({
    where: {
      status: "active",
      ...(productIds?.length ? { id: { in: productIds } } : {}),
    },
    take: productIds?.length ? 30 : 8,
    orderBy: [{ isPromo: "desc" }, { createdAt: "desc" }],
    select: { id: true, name: true, slug: true, brand: true, category: true, price: true, shortDescription: true },
  });
  return products;
}

adminMarketingRouter.get("/dashboard", async (_req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const [campaigns, activePromos, emailCampaigns, blogPosts, recentCampaigns, recentPromos] = await Promise.all([
      prisma.marketingCampaign.count(),
      prisma.promoCode.count({
        where: {
          active: true,
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
          AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
        },
      }),
      prisma.emailCampaign.count(),
      prisma.blogPost.count({ where: { status: "published" } }),
      prisma.marketingCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
      prisma.promoCode.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    ]);

    res.json({
      stats: { campaigns, activePromos, emailCampaigns, publishedBlogPosts: blogPosts },
      recentCampaigns,
      recentPromos,
      brevo: getBrevoStatus(),
    });
  } catch (error) {
    sendError(res, error, "Marketing dashboard error");
  }
});

adminMarketingRouter.get("/campaigns", async (_req: AuthRequest, res: Response) => {
  try {
    const campaigns = await prisma.marketingCampaign.findMany({
      orderBy: { createdAt: "desc" },
      include: { promoCodes: true, emailCampaigns: true, blogPosts: true },
    });
    res.json({ campaigns });
  } catch (error) {
    sendError(res, error, "Marketing campaigns list error");
  }
});

adminMarketingRouter.post("/campaigns", async (req: AuthRequest, res: Response) => {
  try {
    const { title, type, objective, audience, status, tone, channels, productIds, content, generatedAssets, startsAt, endsAt } = req.body;
    if (!title || !objective || !audience) {
      res.status(400).json({ error: "title, objective et audience sont requis" });
      return;
    }
    const campaign = await prisma.marketingCampaign.create({
      data: {
        title,
        slug: slugifyMarketing(req.body.slug || title),
        type: type || "multi_channel",
        objective,
        audience,
        status: status || "draft",
        tone: tone || "expert",
        channels: Array.isArray(channels) ? channels : [],
        productIds: Array.isArray(productIds) ? productIds : [],
        content: content || undefined,
        generatedAssets: generatedAssets || undefined,
        startsAt: asDate(startsAt),
        endsAt: asDate(endsAt),
      },
    });
    res.status(201).json({ campaign });
  } catch (error) {
    sendError(res, error, "Marketing campaign create error");
  }
});

adminMarketingRouter.put("/campaigns/:id", async (req: AuthRequest, res: Response) => {
  try {
    const data = { ...req.body };
    if (data.slug) data.slug = slugifyMarketing(data.slug);
    if (data.startsAt !== undefined) data.startsAt = asDate(data.startsAt);
    if (data.endsAt !== undefined) data.endsAt = asDate(data.endsAt);
    const campaign = await prisma.marketingCampaign.update({ where: { id: req.params.id }, data });
    res.json({ campaign });
  } catch (error) {
    sendError(res, error, "Marketing campaign update error");
  }
});

adminMarketingRouter.post("/generate", async (req: AuthRequest, res: Response) => {
  try {
    const input = req.body as MarketingGenerationInput;
    if (!input.objective || !input.audience) {
      res.status(400).json({ error: "objective et audience sont requis" });
      return;
    }
    const products = await getProductContext(input.productIds);
    const result = await generateMarketingCampaignContent(input, products);
    res.json({ result, products });
  } catch (error) {
    sendError(res, error, "Marketing generation error");
  }
});

adminMarketingRouter.post("/generate/save", async (req: AuthRequest, res: Response) => {
  try {
    const input = req.body as MarketingGenerationInput & { publishBlog?: boolean; createPromo?: boolean; createEmail?: boolean };
    if (!input.objective || !input.audience) {
      res.status(400).json({ error: "objective et audience sont requis" });
      return;
    }
    const products = await getProductContext(input.productIds);
    const result = await generateMarketingCampaignContent(input, products);

    const saved = await prisma.$transaction(async (tx) => {
      const campaign = await tx.marketingCampaign.create({
        data: {
          title: result.title,
          slug: result.slug,
          type: input.campaignType || "multi_channel",
          objective: result.objective,
          audience: result.audience,
          status: "draft",
          tone: input.tone || "expert",
          channels: result.channels,
          productIds: input.productIds || [],
          content: result as unknown as object,
          generatedAssets: { socialPosts: result.socialPosts, landingSections: result.landingSections },
        },
      });

      const blogPost = await tx.blogPost.create({
        data: {
          title: result.blogPost.title,
          slug: result.blogPost.slug,
          excerpt: result.blogPost.excerpt,
          content: result.blogPost.content,
          coverImage: null,
          categorySlug: result.blogPost.categorySlug || "guide",
          tags: result.blogPost.tags || [],
          metaTitle: result.blogPost.metaTitle,
          metaDescription: result.blogPost.metaDescription,
          status: input.publishBlog ? "published" : "draft",
          publishedAt: input.publishBlog ? new Date() : null,
          campaignId: campaign.id,
        },
      });

      const promoCode = input.createPromo !== false
        ? await tx.promoCode.create({
            data: {
              code: normalizeCode(result.promoCode.code),
              label: result.promoCode.label,
              description: result.promoCode.description,
              type: result.promoCode.type,
              value: result.promoCode.value,
              active: true,
              campaignId: campaign.id,
            },
          })
        : null;

      const emailCampaign = input.createEmail !== false
        ? await tx.emailCampaign.create({
            data: {
              campaignId: campaign.id,
              name: result.emailCampaign.name,
              subject: result.emailCampaign.subject,
              preheader: result.emailCampaign.preheader,
              htmlContent: result.emailCampaign.htmlContent,
              textContent: result.emailCampaign.textContent,
              status: "draft",
            },
          })
        : null;

      return { campaign, blogPost, promoCode, emailCampaign };
    });

    res.status(201).json({ result, saved });
  } catch (error) {
    sendError(res, error, "Marketing generation save error");
  }
});

adminMarketingRouter.get("/promocodes", async (_req: AuthRequest, res: Response) => {
  try {
    const promoCodes = await prisma.promoCode.findMany({ orderBy: { createdAt: "desc" }, include: { campaign: true } });
    res.json({ promoCodes });
  } catch (error) {
    sendError(res, error, "Promo codes list error");
  }
});

adminMarketingRouter.post("/promocodes", async (req: AuthRequest, res: Response) => {
  try {
    const { code, label, description, type, value, minAmount, maxUses, startsAt, endsAt, active, campaignId } = req.body;
    if (!code || !label || !type || value === undefined) {
      res.status(400).json({ error: "code, label, type et value sont requis" });
      return;
    }
    const promoCode = await prisma.promoCode.create({
      data: {
        code: normalizeCode(code),
        label,
        description: description || null,
        type,
        value: Number(value),
        minAmount: minAmount === undefined || minAmount === "" ? null : Number(minAmount),
        maxUses: maxUses === undefined || maxUses === "" ? null : Number(maxUses),
        startsAt: asDate(startsAt),
        endsAt: asDate(endsAt),
        active: active !== false,
        campaignId: campaignId || null,
      },
    });
    res.status(201).json({ promoCode });
  } catch (error) {
    sendError(res, error, "Promo code create error");
  }
});

adminMarketingRouter.put("/promocodes/:id", async (req: AuthRequest, res: Response) => {
  try {
    const data = { ...req.body };
    if (data.code) data.code = normalizeCode(data.code);
    if (data.value !== undefined) data.value = Number(data.value);
    if (data.minAmount !== undefined) data.minAmount = data.minAmount === "" ? null : Number(data.minAmount);
    if (data.maxUses !== undefined) data.maxUses = data.maxUses === "" ? null : Number(data.maxUses);
    if (data.startsAt !== undefined) data.startsAt = asDate(data.startsAt);
    if (data.endsAt !== undefined) data.endsAt = asDate(data.endsAt);
    const promoCode = await prisma.promoCode.update({ where: { id: req.params.id }, data });
    res.json({ promoCode });
  } catch (error) {
    sendError(res, error, "Promo code update error");
  }
});

adminMarketingRouter.post("/promocodes/preview", async (req: AuthRequest, res: Response) => {
  try {
    const { code, subtotal, shipping } = req.body;
    const promoCode = await prisma.promoCode.findUnique({ where: { code: normalizeCode(code || "") } });
    if (!promoCode || !promoCode.active) {
      res.status(404).json({ error: "Code promo introuvable ou inactif" });
      return;
    }
    const now = new Date();
    if ((promoCode.startsAt && promoCode.startsAt > now) || (promoCode.endsAt && promoCode.endsAt < now)) {
      res.status(400).json({ error: "Code promo hors période de validité" });
      return;
    }
    if (promoCode.maxUses !== null && promoCode.usedCount >= promoCode.maxUses) {
      res.status(400).json({ error: "Code promo épuisé" });
      return;
    }
    if (promoCode.minAmount !== null && Number(subtotal) < promoCode.minAmount) {
      res.status(400).json({ error: `Minimum d'achat requis : ${promoCode.minAmount} €` });
      return;
    }
    const discountAmount = calculateDiscountAmount({ subtotal: Number(subtotal), shipping: Number(shipping || 0), type: promoCode.type, value: promoCode.value });
    res.json({ promoCode, discountAmount });
  } catch (error) {
    sendError(res, error, "Promo code preview error");
  }
});

adminMarketingRouter.get("/email-campaigns", async (_req: AuthRequest, res: Response) => {
  try {
    const emailCampaigns = await prisma.emailCampaign.findMany({ orderBy: { createdAt: "desc" }, include: { campaign: true } });
    res.json({ emailCampaigns });
  } catch (error) {
    sendError(res, error, "Email campaigns list error");
  }
});

adminMarketingRouter.post("/email-campaigns", async (req: AuthRequest, res: Response) => {
  try {
    const { campaignId, name, subject, preheader, htmlContent, textContent, senderName, senderEmail, brevoListId, segment, scheduledAt } = req.body;
    if (!name || !subject || !htmlContent) {
      res.status(400).json({ error: "name, subject et htmlContent sont requis" });
      return;
    }
    const emailCampaign = await prisma.emailCampaign.create({
      data: {
        campaignId: campaignId || null,
        name,
        subject,
        preheader: preheader || null,
        htmlContent,
        textContent: textContent || null,
        senderName: senderName || null,
        senderEmail: senderEmail || null,
        brevoListId: brevoListId ? Number(brevoListId) : null,
        segment: segment || null,
        scheduledAt: asDate(scheduledAt),
        status: "draft",
      },
    });
    res.status(201).json({ emailCampaign });
  } catch (error) {
    sendError(res, error, "Email campaign create error");
  }
});

adminMarketingRouter.post("/email-campaigns/:id/brevo", async (req: AuthRequest, res: Response) => {
  try {
    const emailCampaign = await prisma.emailCampaign.findUnique({ where: { id: req.params.id } });
    if (!emailCampaign) {
      res.status(404).json({ error: "Campagne email introuvable" });
      return;
    }
    const listIdsBySegment: Record<string, number[]> = {
      all: [BREVO_LISTS.b2c, BREVO_LISTS.b2b],
      b2c: [BREVO_LISTS.b2c],
      b2b: [BREVO_LISTS.b2b],
      inactive: [BREVO_LISTS.inactive],
    };
    const segmentKey = String(req.body.segment || emailCampaign.segment || "all");
    const listIds = req.body.listIds?.length
      ? req.body.listIds.map(Number)
      : emailCampaign.brevoListId
      ? [emailCampaign.brevoListId]
      : listIdsBySegment[segmentKey] || listIdsBySegment.all;
    if (!listIds.length) {
      res.status(400).json({ error: "Au moins une liste Brevo est requise" });
      return;
    }
    const created = await createBrevoEmailCampaign({
      name: emailCampaign.name,
      subject: emailCampaign.subject,
      senderName: req.body.senderName || emailCampaign.senderName || "BarberParadise",
      senderEmail: req.body.senderEmail || emailCampaign.senderEmail || "contact@barberparadise.fr",
      htmlContent: emailCampaign.htmlContent,
      listIds,
      scheduledAt: emailCampaign.scheduledAt,
    });
    const updated = await prisma.emailCampaign.update({
      where: { id: emailCampaign.id },
      data: { brevoCampaignId: created.id, brevoListId: listIds[0], status: emailCampaign.scheduledAt ? "scheduled" : "ready" },
    });
    res.json({ emailCampaign: updated, brevo: created });
  } catch (error) {
    sendError(res, error, "Brevo campaign create error");
  }
});

adminMarketingRouter.post("/email-campaigns/:id/send", async (req: AuthRequest, res: Response) => {
  try {
    const emailCampaign = await prisma.emailCampaign.findUnique({ where: { id: req.params.id } });
    if (!emailCampaign?.brevoCampaignId) {
      res.status(400).json({ error: "Créez d'abord la campagne dans Brevo" });
      return;
    }
    const brevo = await sendBrevoCampaignNow(emailCampaign.brevoCampaignId);
    const updated = await prisma.emailCampaign.update({ where: { id: emailCampaign.id }, data: { status: "sent", sentAt: new Date() } });
    res.json({ emailCampaign: updated, brevo });
  } catch (error) {
    sendError(res, error, "Brevo campaign send error");
  }
});

adminMarketingRouter.get("/blog-posts", async (_req: AuthRequest, res: Response) => {
  try {
    const blogPosts = await prisma.blogPost.findMany({ orderBy: { createdAt: "desc" }, include: { campaign: true } });
    res.json({ blogPosts });
  } catch (error) {
    sendError(res, error, "Blog posts list error");
  }
});

adminMarketingRouter.post("/blog-posts", async (req: AuthRequest, res: Response) => {
  try {
    const { title, slug, excerpt, content, coverImage, categorySlug, tags, metaTitle, metaDescription, status, campaignId } = req.body;
    if (!title || !slug || !content) {
      res.status(400).json({ error: "title, slug et content sont requis" });
      return;
    }
    const blogPost = await prisma.blogPost.create({
      data: {
        title,
        slug: slugifyMarketing(slug),
        excerpt: excerpt || "",
        content,
        coverImage: coverImage || null,
        categorySlug: categorySlug || "guide",
        tags: Array.isArray(tags) ? tags : [],
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
        status: status || "draft",
        publishedAt: status === "published" ? new Date() : null,
        campaignId: campaignId || null,
      },
    });
    res.status(201).json({ blogPost });
  } catch (error) {
    sendError(res, error, "Blog post create error");
  }
});

adminMarketingRouter.put("/blog-posts/:id", async (req: AuthRequest, res: Response) => {
  try {
    const data = { ...req.body };
    if (data.slug) data.slug = slugifyMarketing(data.slug);
    if (data.status === "published" && data.publishedAt === undefined) data.publishedAt = new Date();
    const blogPost = await prisma.blogPost.update({ where: { id: req.params.id }, data });
    res.json({ blogPost });
  } catch (error) {
    sendError(res, error, "Blog post update error");
  }
});

adminMarketingRouter.get("/brevo/status", async (_req: AuthRequest, res: Response) => {
  res.json(getBrevoStatus());
});

adminMarketingRouter.get("/brevo/lists", async (_req: AuthRequest, res: Response) => {
  try {
    res.json({ lists: await listBrevoLists() });
  } catch (error) {
    sendError(res, error, "Brevo lists error");
  }
});

adminMarketingRouter.post("/brevo/sync-customers", async (req: AuthRequest, res: Response) => {
  try {
    const requestedListIds = Array.isArray(req.body.listIds) ? req.body.listIds.map(Number).filter(Boolean) : [];
    const customers = await prisma.customer.findMany({
      take: Number(req.body.limit || 200),
      orderBy: { createdAt: "desc" },
      include: { proAccount: { select: { status: true } } },
    });
    let synced = 0;
    for (const customer of customers) {
      const defaultListId = customer.proAccount?.status === "approved" ? BREVO_LISTS.b2b : BREVO_LISTS.b2c;
      const listIds = requestedListIds.length ? requestedListIds : [defaultListId];
      await upsertBrevoContact({ email: customer.email, firstName: customer.firstName, lastName: customer.lastName, listIds });
      synced += 1;
    }
    res.json({ synced });
  } catch (error) {
    sendError(res, error, "Brevo customers sync error");
  }
});

adminMarketingRouter.get("/settings", async (_req: AuthRequest, res: Response) => {
  try {
    const settings = await prisma.marketingSetting.findMany({ orderBy: { key: "asc" } });
    res.json({ settings });
  } catch (error) {
    sendError(res, error, "Marketing settings list error");
  }
});

adminMarketingRouter.put("/settings/:key", async (req: AuthRequest, res: Response) => {
  try {
    const setting = await prisma.marketingSetting.upsert({
      where: { key: req.params.key },
      create: { key: req.params.key, value: req.body.value ?? {} },
      update: { value: req.body.value ?? {} },
    });
    res.json({ setting });
  } catch (error) {
    sendError(res, error, "Marketing setting update error");
  }
});
