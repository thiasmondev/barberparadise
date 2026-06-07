import Replicate from "replicate";

type ReplicateRunOutput = string | Array<string | { url?: string | (() => string); toString?: () => string }>;

export interface GenerateImageParams {
  prompt: string;
  model?: string;
  width?: number;
  height?: number;
  aspectRatio?: string;
  numOutputs?: number;
}

export interface GenerateImageResult {
  imageUrl: string;
  replicateId: string;
  durationMs: number;
}

class ReplicateClient {
  private client: Replicate | null;
  private configured: boolean;

  constructor() {
    this.configured = Boolean(process.env.REPLICATE_API_TOKEN);
    this.client = this.configured
      ? new Replicate({ auth: process.env.REPLICATE_API_TOKEN })
      : null;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async generateImage(params: GenerateImageParams): Promise<GenerateImageResult> {
    if (!this.client) {
      throw new Error("Replicate non configuré. Ajouter REPLICATE_API_TOKEN dans les variables d’environnement.");
    }

    const model = params.model || process.env.REPLICATE_MODEL_DEFAULT || "black-forest-labs/flux-2-pro";
    const startTime = Date.now();

    const input: Record<string, unknown> = {
      prompt: params.prompt,
      num_outputs: params.numOutputs || 1,
      output_format: "webp",
      output_quality: 90,
    };

    input.aspect_ratio = params.aspectRatio || this.inferAspectRatio(params.width, params.height);

    const output = (await this.client.run(model as `${string}/${string}`, { input })) as ReplicateRunOutput;
    const durationMs = Date.now() - startTime;
    const imageUrl = this.extractImageUrl(output);

    return {
      imageUrl,
      replicateId: `flux-${Date.now()}`,
      durationMs,
    };
  }

  async generateImageFast(params: { prompt: string; aspectRatio?: string }): Promise<GenerateImageResult> {
    return this.generateImage({
      ...params,
      model: process.env.REPLICATE_MODEL_FAST || "black-forest-labs/flux-schnell",
    });
  }

  estimateCost(model: string): number {
    const costs: Record<string, number> = {
      "black-forest-labs/flux-2-pro": 0.05,
      "black-forest-labs/flux-2-max": 0.08,
      "black-forest-labs/flux-dev": 0.025,
      "black-forest-labs/flux-schnell": 0.003,
    };

    return costs[model] || 0.05;
  }

  private inferAspectRatio(width?: number, height?: number): string {
    if (!width || !height) return "1:1";

    const ratio = width / height;
    if (ratio > 1.7) return "16:9";
    if (ratio > 1.2) return "4:3";
    if (ratio < 0.6) return "9:16";
    if (ratio < 0.85) return "3:4";
    return "1:1";
  }

  private extractImageUrl(output: ReplicateRunOutput): string {
    if (typeof output === "string") return output;

    if (Array.isArray(output) && output.length > 0) {
      const firstOutput = output[0];
      if (typeof firstOutput === "string") return firstOutput;

      if (firstOutput && typeof firstOutput.url === "function") {
        return firstOutput.url();
      }

      if (firstOutput && typeof firstOutput.url === "string") {
        return firstOutput.url;
      }

      if (firstOutput && typeof firstOutput.toString === "function") {
        const stringValue = firstOutput.toString();
        if (stringValue && stringValue !== "[object Object]") return stringValue;
      }
    }

    throw new Error("Réponse Replicate inattendue lors de la génération d’image.");
  }
}

export default new ReplicateClient();
