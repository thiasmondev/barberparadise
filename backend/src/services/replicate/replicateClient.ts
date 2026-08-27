import Replicate from "replicate";

type ReplicateRunOutput = unknown;

interface ReplicateRunner {
  run(model: string, options: { input: Record<string, unknown> }): Promise<ReplicateRunOutput>;
}

interface ErrorLike {
  message?: unknown;
  status?: unknown;
  response?: { status?: unknown; headers?: unknown };
  headers?: unknown;
}

export interface ReplicateErrorDetails {
  status?: number;
  retryAfterSeconds?: number;
  message: string;
}

export class ReplicateGenerationError extends Error {
  readonly status?: number;
  readonly retryAfterSeconds?: number;

  constructor(details: ReplicateErrorDetails) {
    super(
      details.status === 429
        ? "La génération IA est temporairement limitée. Réessayez dans quelques instants."
        : "La génération IA a échoué. Réessayez dans quelques instants."
    );
    this.name = "ReplicateGenerationError";
    this.status = details.status;
    this.retryAfterSeconds = details.retryAfterSeconds;
  }
}

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

function redactSensitiveText(value: string): string {
  return value
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s,;)}\]]+/gi, "$1[REDACTED]")
    .replace(/(bearer\s+)[^\s,;)}\]]+/gi, "$1[REDACTED]")
    .replace(/(replicate_api_token\s*[:=]\s*)[^\s,;)}\]]+/gi, "$1[REDACTED]")
    .replace(/(token\s*[:=]\s*)[^\s,;)}\]]+/gi, "$1[REDACTED]");
}

function getHeaderValue(headers: unknown, name: string): string | undefined {
  if (!headers || typeof headers !== "object") return undefined;
  const candidate = headers as { get?: (key: string) => unknown; [key: string]: unknown };
  if (typeof candidate.get === "function") {
    const value = candidate.get(name);
    return typeof value === "string" ? value : undefined;
  }
  const direct = candidate[name] ?? candidate[name.toLowerCase()] ?? candidate[name.toUpperCase()];
  return typeof direct === "string" ? direct : undefined;
}

function parseRetryAfter(value?: string): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(Math.ceil(seconds), 60);
  const retryAt = Date.parse(value);
  if (Number.isFinite(retryAt)) return Math.min(Math.max(0, Math.ceil((retryAt - Date.now()) / 1_000)), 60);
  return undefined;
}

export function getSafeReplicateErrorDetails(error: unknown): ReplicateErrorDetails {
  const candidate = (error && typeof error === "object" ? error : {}) as ErrorLike;
  const statusValue = candidate.status ?? candidate.response?.status;
  const status = typeof statusValue === "number" && Number.isFinite(statusValue) ? statusValue : undefined;
  const retryAfterSeconds = parseRetryAfter(getHeaderValue(candidate.response?.headers ?? candidate.headers, "retry-after"));
  const rawMessage = typeof candidate.message === "string" ? candidate.message : "Erreur externe non détaillée";
  return { status, retryAfterSeconds, message: redactSensitiveText(rawMessage).slice(0, 500) };
}

const wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export class ReplicateClient {
  private client: ReplicateRunner | null;
  private configured: boolean;

  constructor(client?: ReplicateRunner | null, private readonly sleep: (milliseconds: number) => Promise<void> = wait) {
    if (client !== undefined) {
      this.client = client;
      this.configured = Boolean(client);
      return;
    }

    this.configured = Boolean(process.env.REPLICATE_API_TOKEN);
    this.client = this.configured
      ? (new Replicate({ auth: process.env.REPLICATE_API_TOKEN }) as unknown as ReplicateRunner)
      : null;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async generateImage(params: GenerateImageParams): Promise<GenerateImageResult> {
    if (!this.client) {
      throw new ReplicateGenerationError({ message: "Replicate non configuré." });
    }

    const model = params.model || process.env.REPLICATE_MODEL_DEFAULT || "black-forest-labs/flux-2-pro";
    const startTime = Date.now();
    const input: Record<string, unknown> = {
      prompt: params.prompt,
      num_outputs: params.numOutputs || 1,
      output_format: "webp",
      output_quality: 90,
      aspect_ratio: params.aspectRatio || this.inferAspectRatio(params.width, params.height),
    };

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const output = await this.client.run(model, { input });
        const imageUrl = this.extractImageUrl(output);
        return { imageUrl, replicateId: `flux-${Date.now()}`, durationMs: Date.now() - startTime };
      } catch (error) {
        const details = getSafeReplicateErrorDetails(error);
        if (details.status === 429 && attempt === 0) {
          const retryAfterSeconds = details.retryAfterSeconds ?? 10;
          console.warn("[Replicate] Limite temporaire : nouvelle tentative planifiée", {
            model,
            status: details.status,
            retryAfterSeconds,
          });
          await this.sleep(retryAfterSeconds * 1_000);
          continue;
        }

        console.error("[Replicate] Génération échouée", {
          model,
          status: details.status ?? null,
          retryAfterSeconds: details.retryAfterSeconds ?? null,
          message: details.message,
        });
        throw new ReplicateGenerationError(details);
      }
    }

    throw new ReplicateGenerationError({ message: "La génération n’a pas pu être relancée." });
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
      const firstOutput = output[0] as { url?: string | (() => string); toString?: () => string } | string | undefined;
      if (typeof firstOutput === "string") return firstOutput;
      if (firstOutput && typeof firstOutput.url === "function") return firstOutput.url();
      if (firstOutput && typeof firstOutput.url === "string") return firstOutput.url;
      if (firstOutput && typeof firstOutput.toString === "function") {
        const stringValue = firstOutput.toString();
        if (stringValue && stringValue !== "[object Object]") return stringValue;
      }
    }
    throw new Error("Réponse Replicate inattendue lors de la génération d’image.");
  }
}

export default new ReplicateClient();
