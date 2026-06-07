import { v2 as cloudinary } from "cloudinary";
import { prisma } from "../../../utils/prisma";
import replicateClient from "../../replicate/replicateClient";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface GenerateHermesImageParams {
  prompt: string;
  category?: string;
  tags?: string[];
  aspectRatio?: string;
  useFastModel?: boolean;
  conversationId?: string;
  messageId?: string;
}

export interface HermesImageFilters {
  category?: string;
  status?: string;
  tags?: string[];
  page?: number;
  limit?: number;
}

class ImageGenerator {
  async generate(params: GenerateHermesImageParams) {
    if (!replicateClient.isConfigured()) {
      throw new Error("Replicate non configuré. Ajouter REPLICATE_API_TOKEN dans les variables d’environnement.");
    }

    if (!this.hasCloudinaryConfig()) {
      throw new Error("Cloudinary non configuré. Ajouter CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY et CLOUDINARY_API_SECRET.");
    }

    const model = params.useFastModel
      ? process.env.REPLICATE_MODEL_FAST || "black-forest-labs/flux-schnell"
      : process.env.REPLICATE_MODEL_DEFAULT || "black-forest-labs/flux-2-pro";

    const hermesImage = await prisma.hermesImage.create({
      data: {
        prompt: params.prompt,
        model,
        status: "processing",
        category: params.category || "other",
        tags: params.tags || [],
        aspectRatio: params.aspectRatio || "1:1",
        conversationId: params.conversationId,
        messageId: params.messageId,
      },
    });

    try {
      const result = params.useFastModel
        ? await replicateClient.generateImageFast({
            prompt: params.prompt,
            aspectRatio: params.aspectRatio,
          })
        : await replicateClient.generateImage({
            prompt: params.prompt,
            aspectRatio: params.aspectRatio,
          });

      const cloudinaryResult = await cloudinary.uploader.upload(result.imageUrl, {
        folder: "hermes/generated",
        public_id: `hermes_${hermesImage.id}`,
        resource_type: "image",
        format: "webp",
        quality: "auto:good",
        tags: ["hermes", "generated", params.category || "other", ...(params.tags || [])],
      });

      const estimatedCost = replicateClient.estimateCost(model);

      return prisma.hermesImage.update({
        where: { id: hermesImage.id },
        data: {
          status: "completed",
          replicateUrl: result.imageUrl,
          replicateId: result.replicateId,
          cloudinaryUrl: cloudinaryResult.secure_url,
          cloudinaryId: cloudinaryResult.public_id,
          width: cloudinaryResult.width,
          height: cloudinaryResult.height,
          durationMs: result.durationMs,
          costUsd: estimatedCost,
        },
      });
    } catch (error) {
      await prisma.hermesImage.update({
        where: { id: hermesImage.id },
        data: { status: "failed" },
      });
      throw error;
    }
  }

  async extractAndGenerateImages(
    assistantMessage: string,
    conversationId: string,
    messageId?: string
  ): Promise<Array<{ id: string; prompt: string; category: string; status: string; cloudinaryUrl?: string | null }>> {
    const imageRegex = /\[IMAGE:(product|social|banner|email|other)\]([\s\S]*?)\[\/IMAGE\]/g;
    const results: Array<{ id: string; prompt: string; category: string; status: string; cloudinaryUrl?: string | null }> = [];
    let match: RegExpExecArray | null;

    while ((match = imageRegex.exec(assistantMessage)) !== null) {
      const category = match[1];
      const prompt = match[2].trim();

      try {
        const image = await this.generate({
          prompt,
          category,
          conversationId,
          messageId,
          useFastModel: false,
        });

        results.push({
          id: image.id,
          prompt,
          category,
          status: image.status,
          cloudinaryUrl: image.cloudinaryUrl,
        });
      } catch (error) {
        console.error("[ImageGenerator] Erreur génération:", error);
        results.push({
          id: "error",
          prompt,
          category,
          status: "failed",
        });
      }
    }

    return results;
  }

  async getImages(filters: HermesImageFilters = {}) {
    const where: Record<string, unknown> = {};
    if (filters.category) where.category = filters.category;
    if (filters.status) where.status = filters.status;
    if (filters.tags && filters.tags.length > 0) {
      where.tags = { hasSome: filters.tags };
    }

    const limit = Math.min(Math.max(filters.limit || 20, 1), 100);
    const page = Math.max(filters.page || 1, 1);

    const [images, total] = await Promise.all([
      prisma.hermesImage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.hermesImage.count({ where }),
    ]);

    return { images, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getImage(id: string) {
    return prisma.hermesImage.findUnique({ where: { id } });
  }

  async updateImage(id: string, data: { category?: string; tags?: string[] }) {
    return prisma.hermesImage.update({
      where: { id },
      data: {
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.tags !== undefined ? { tags: data.tags } : {}),
      },
    });
  }

  async deleteImage(id: string) {
    const image = await prisma.hermesImage.findUnique({ where: { id } });
    if (!image) throw new Error("Image non trouvée");

    if (image.cloudinaryId) {
      try {
        await cloudinary.uploader.destroy(image.cloudinaryId);
      } catch (error) {
        console.error("[ImageGenerator] Erreur suppression Cloudinary:", error);
      }
    }

    return prisma.hermesImage.delete({ where: { id } });
  }

  async getStats() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [total, byCategory, byStatus, last30Days, totals] = await Promise.all([
      prisma.hermesImage.count(),
      prisma.hermesImage.groupBy({ by: ["category"], _count: true }),
      prisma.hermesImage.groupBy({ by: ["status"], _count: true }),
      prisma.hermesImage.count({ where: { createdAt: { gte: thirtyDaysAgo }, status: "completed" } }),
      prisma.hermesImage.aggregate({
        where: { status: "completed" },
        _sum: { costUsd: true },
        _avg: { durationMs: true },
      }),
    ]);

    return {
      total,
      byCategory: Object.fromEntries(byCategory.map((item) => [item.category || "other", item._count])),
      byStatus: Object.fromEntries(byStatus.map((item) => [item.status, item._count])),
      generatedLast30Days: last30Days,
      totalCostUsd: totals._sum.costUsd || 0,
      avgGenerationTimeMs: Math.round(totals._avg.durationMs || 0),
    };
  }

  private hasCloudinaryConfig(): boolean {
    return Boolean(
      process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    );
  }
}

const imageGenerator = new ImageGenerator();
export default imageGenerator;

export async function runImageGenerator(): Promise<{ status: string; message: string }> {
  const stats = await imageGenerator.getStats();
  return {
    status: "active",
    message: `Image Generator actif. ${stats.total} image(s) enregistrée(s), ${stats.generatedLast30Days} générée(s) sur 30 jours.`,
  };
}
