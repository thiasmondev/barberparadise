import { Router, Request, Response } from "express";
import { v2 as cloudinary } from "cloudinary";
import { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { requireAdmin } from "../middleware/auth";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const carouselRouter = Router();

const ALLOWED_CTA_STYLES = new Set(["primary", "secondary", "outline"]);
const ALLOWED_TEXT_POSITIONS = new Set(["left", "center", "right"]);
const ALLOWED_CATEGORIES = new Set(["promo", "nouveaute", "event", "saison", "general"]);

function normalizeNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeRequiredImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return fallback;
}

function normalizeFloat(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function normalizeCategory(value: unknown): string {
  if (typeof value !== "string") return "general";
  const normalized = value.trim().toLowerCase();
  return ALLOWED_CATEGORIES.has(normalized) ? normalized : "general";
}

function normalizeCtaStyle(value: unknown): string {
  if (typeof value !== "string") return "primary";
  const normalized = value.trim().toLowerCase();
  return ALLOWED_CTA_STYLES.has(normalized) ? normalized : "primary";
}

function normalizeTextPosition(value: unknown): string {
  if (typeof value !== "string") return "left";
  const normalized = value.trim().toLowerCase();
  return ALLOWED_TEXT_POSITIONS.has(normalized) ? normalized : "left";
}

function normalizeHexColor(value: unknown): string {
  if (typeof value !== "string") return "#FFFFFF";
  const trimmed = value.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(trimmed) ? trimmed : "#FFFFFF";
}

function normalizeMetadata(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "object" || Array.isArray(value) || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value as Prisma.InputJsonValue;
  }
  return undefined;
}

async function nextCarouselPosition(): Promise<number> {
  const lastSlide = await prisma.carouselSlide.findFirst({ orderBy: { position: "desc" } });
  return (lastSlide?.position ?? -1) + 1;
}

function buildCreateData(body: Record<string, unknown>, forcedCreatedBy?: string): Prisma.CarouselSlideCreateInput | { error: string } {
  const imageUrl = normalizeRequiredImageUrl(body.imageUrl);
  if (!imageUrl) return { error: "imageUrl est requis." };

  const title = normalizeNullableString(body.title);
  const subtitle = normalizeNullableString(body.subtitle);
  const imageAlt = normalizeNullableString(body.imageAlt) ?? title ?? "Barber Paradise";
  const startDate = normalizeDate(body.startDate);
  const endDate = normalizeDate(body.endDate);
  const overlayOpacity = Math.min(1, Math.max(0, normalizeFloat(body.overlayOpacity, 0.3)));
  const metadata = normalizeMetadata(body.metadata);

  const data: Prisma.CarouselSlideCreateInput = {
    title,
    subtitle,
    description: normalizeNullableString(body.description),
    imageUrl,
    imageMobileUrl: normalizeNullableString(body.imageMobileUrl),
    imageAlt,
    cloudinaryId: normalizeNullableString(body.cloudinaryId),
    mobileCloudinaryId: normalizeNullableString(body.mobileCloudinaryId),
    ctaText: normalizeNullableString(body.ctaText),
    ctaLink: normalizeNullableString(body.ctaLink),
    ctaStyle: normalizeCtaStyle(body.ctaStyle),
    textPosition: normalizeTextPosition(body.textPosition),
    textColor: normalizeHexColor(body.textColor),
    overlayOpacity,
    isActive: normalizeBoolean(body.isActive, true),
    startDate: startDate ?? null,
    endDate: endDate ?? null,
    position: Number.isFinite(Number(body.position)) ? Number(body.position) : 0,
    category: normalizeCategory(body.category),
    createdBy: forcedCreatedBy ?? normalizeNullableString(body.createdBy) ?? "admin",
  };

  if (metadata !== undefined) data.metadata = metadata;
  return data;
}

function buildUpdateData(body: Record<string, unknown>): Prisma.CarouselSlideUpdateInput {
  const data: Prisma.CarouselSlideUpdateInput = {};

  const nullableFields = ["title", "subtitle", "description", "imageMobileUrl", "imageAlt", "cloudinaryId", "mobileCloudinaryId", "ctaText", "ctaLink", "createdBy"] as const;
  for (const field of nullableFields) {
    if (field in body) data[field] = normalizeNullableString(body[field]);
  }

  if ("imageUrl" in body) {
    const imageUrl = normalizeRequiredImageUrl(body.imageUrl);
    if (imageUrl) data.imageUrl = imageUrl;
  }
  if ("ctaStyle" in body) data.ctaStyle = normalizeCtaStyle(body.ctaStyle);
  if ("textPosition" in body) data.textPosition = normalizeTextPosition(body.textPosition);
  if ("textColor" in body) data.textColor = normalizeHexColor(body.textColor);
  if ("overlayOpacity" in body) data.overlayOpacity = Math.min(1, Math.max(0, normalizeFloat(body.overlayOpacity, 0.3)));
  if ("isActive" in body) data.isActive = normalizeBoolean(body.isActive, true);
  if ("category" in body) data.category = normalizeCategory(body.category);
  if ("position" in body && Number.isFinite(Number(body.position))) data.position = Number(body.position);
  if ("startDate" in body) data.startDate = normalizeDate(body.startDate) ?? null;
  if ("endDate" in body) data.endDate = normalizeDate(body.endDate) ?? null;
  if ("metadata" in body) {
    const metadata = normalizeMetadata(body.metadata);
    data.metadata = metadata === undefined ? Prisma.JsonNull : metadata;
  }

  return data;
}

function hasCloudinaryConfig(): boolean {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

async function destroyCloudinaryImage(publicId?: string | null) {
  if (!publicId || !hasCloudinaryConfig()) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.warn("[Carousel] Suppression Cloudinary impossible:", error);
  }
}

// PUBLIC — slides actives consommées par la home page.
carouselRouter.get("/active", async (_req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const slides = await prisma.carouselSlide.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: now } }] },
          { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        ],
      },
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    });
    res.json({ slides });
  } catch (error) {
    console.error("[Carousel] Erreur slides actives:", error);
    res.status(500).json({ error: "Erreur interne." });
  }
});

// Toutes les routes suivantes sont réservées à l’administration et à Buzz via token admin.
carouselRouter.use(requireAdmin);

carouselRouter.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const where: Prisma.CarouselSlideWhereInput = {};
    if (typeof req.query.category === "string" && req.query.category !== "all") where.category = normalizeCategory(req.query.category);
    if (typeof req.query.isActive === "string") where.isActive = req.query.isActive === "true";

    const slides = await prisma.carouselSlide.findMany({
      where,
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    });
    res.json({ slides });
  } catch (error) {
    console.error("[Carousel] Erreur liste admin:", error);
    res.status(500).json({ error: "Erreur interne." });
  }
});

carouselRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    const dataOrError = buildCreateData(body);
    if ("error" in dataOrError) {
      res.status(400).json({ error: dataOrError.error });
      return;
    }
    if (!Number.isFinite(Number(body.position))) dataOrError.position = await nextCarouselPosition();

    const slide = await prisma.carouselSlide.create({ data: dataOrError });
    res.status(201).json({ slide });
  } catch (error) {
    console.error("[Carousel] Erreur création:", error);
    res.status(500).json({ error: "Erreur interne." });
  }
});

carouselRouter.post("/upload", async (req: Request, res: Response): Promise<void> => {
  try {
    if (!hasCloudinaryConfig()) {
      res.status(500).json({ error: "Cloudinary n’est pas configuré." });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const rawBase64 = typeof body.imageBase64 === "string" ? body.imageBase64.trim() : "";
    if (!rawBase64) {
      res.status(400).json({ error: "imageBase64 est requis." });
      return;
    }

    const dataUri = rawBase64.startsWith("data:image/") ? rawBase64 : `data:image/webp;base64,${rawBase64}`;
    const timestamp = Date.now();
    const uploadResult = await cloudinary.uploader.upload(dataUri, {
      folder: "carousel",
      public_id: `carousel_${timestamp}`,
      resource_type: "image",
      quality: "auto:good",
      format: "webp",
      transformation: [{ width: 1920, height: 600, crop: "fill", gravity: "center" }],
    });

    const mobileResult = await cloudinary.uploader.upload(dataUri, {
      folder: "carousel",
      public_id: `carousel_mobile_${timestamp}`,
      resource_type: "image",
      quality: "auto:good",
      format: "webp",
      transformation: [{ width: 1080, height: 1080, crop: "fill", gravity: "center" }],
    });

    const position = await nextCarouselPosition();
    const slide = await prisma.carouselSlide.create({
      data: {
        title: normalizeNullableString(body.title),
        subtitle: normalizeNullableString(body.subtitle),
        description: normalizeNullableString(body.description),
        imageUrl: uploadResult.secure_url,
        imageMobileUrl: mobileResult.secure_url,
        imageAlt: normalizeNullableString(body.imageAlt) ?? normalizeNullableString(body.title) ?? "Barber Paradise",
        cloudinaryId: uploadResult.public_id,
        mobileCloudinaryId: mobileResult.public_id,
        ctaText: normalizeNullableString(body.ctaText),
        ctaLink: normalizeNullableString(body.ctaLink),
        ctaStyle: normalizeCtaStyle(body.ctaStyle),
        textPosition: normalizeTextPosition(body.textPosition),
        textColor: normalizeHexColor(body.textColor),
        overlayOpacity: Math.min(1, Math.max(0, normalizeFloat(body.overlayOpacity, 0.3))),
        isActive: normalizeBoolean(body.isActive, true),
        startDate: normalizeDate(body.startDate) ?? null,
        endDate: normalizeDate(body.endDate) ?? null,
        position,
        category: normalizeCategory(body.category),
        createdBy: normalizeNullableString(body.createdBy) ?? "buzz",
      },
    });

    res.status(201).json({ slide });
  } catch (error) {
    console.error("[Carousel] Erreur upload:", error);
    res.status(500).json({ error: "Erreur interne." });
  }
});

carouselRouter.put("/reorder", async (req: Request, res: Response): Promise<void> => {
  try {
    const order = (req.body as { order?: unknown }).order;
    if (!Array.isArray(order)) {
      res.status(400).json({ error: "order doit être un tableau de { id, position }." });
      return;
    }

    const updates = order
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const record = item as { id?: unknown; position?: unknown };
        const id = typeof record.id === "string" ? record.id : null;
        const position = Number(record.position);
        if (!id || !Number.isInteger(position) || position < 0) return null;
        return { id, position };
      })
      .filter((item): item is { id: string; position: number } => Boolean(item));

    if (updates.length !== order.length) {
      res.status(400).json({ error: "Chaque entrée doit contenir un id et une position entière positive." });
      return;
    }

    await prisma.$transaction(updates.map(({ id, position }) => prisma.carouselSlide.update({ where: { id }, data: { position } })));
    res.json({ success: true });
  } catch (error) {
    console.error("[Carousel] Erreur réordonnancement:", error);
    res.status(500).json({ error: "Erreur interne." });
  }
});

carouselRouter.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const slide = await prisma.carouselSlide.findUnique({ where: { id: req.params.id } });
    if (!slide) {
      res.status(404).json({ error: "Slide non trouvée." });
      return;
    }
    res.json({ slide });
  } catch (error) {
    res.status(500).json({ error: "Erreur interne." });
  }
});

carouselRouter.patch("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const slide = await prisma.carouselSlide.update({ where: { id: req.params.id }, data: buildUpdateData(req.body as Record<string, unknown>) });
    res.json({ slide });
  } catch (error) {
    console.error("[Carousel] Erreur modification:", error);
    res.status(500).json({ error: "Erreur interne." });
  }
});

carouselRouter.patch("/:id/toggle", async (req: Request, res: Response): Promise<void> => {
  try {
    const slide = await prisma.carouselSlide.findUnique({ where: { id: req.params.id } });
    if (!slide) {
      res.status(404).json({ error: "Slide non trouvée." });
      return;
    }
    const updated = await prisma.carouselSlide.update({ where: { id: req.params.id }, data: { isActive: !slide.isActive } });
    res.json({ slide: updated });
  } catch (error) {
    res.status(500).json({ error: "Erreur interne." });
  }
});

carouselRouter.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const slide = await prisma.carouselSlide.findUnique({ where: { id: req.params.id } });
    if (!slide) {
      res.status(404).json({ error: "Slide non trouvée." });
      return;
    }

    await destroyCloudinaryImage(slide.cloudinaryId);
    await destroyCloudinaryImage(slide.mobileCloudinaryId);
    await prisma.carouselSlide.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error("[Carousel] Erreur suppression:", error);
    res.status(500).json({ error: "Erreur interne." });
  }
});

export default carouselRouter;
