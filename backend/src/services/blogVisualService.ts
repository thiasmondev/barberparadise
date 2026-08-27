import { v2 as cloudinary } from "cloudinary";
import OpenAI from "openai";
import imageGenerator from "./hermes/modules/imageGenerator";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export type BlogVisualSource = "ai" | "pexels";

export interface BlogVisualSectionInput {
  articleTitle: string;
  heading: string;
  content: string;
  category?: string;
}

export interface BlogImageAttribution {
  provider: "Pexels";
  photographer: string;
  photographerUrl: string;
  sourceUrl: string;
  photoId: string;
  imageUrl?: string;
}

export interface BlogVisualSuggestion {
  id: string;
  source: BlogVisualSource;
  previewUrl: string;
  sourceUrl: string;
  prompt: string;
  altText: string;
  attribution?: BlogImageAttribution;
}

interface VisualBrief {
  imagePrompt: string;
  searchQuery: string;
  altText: string;
}

interface PexelsPhoto {
  id: number;
  url: string;
  alt?: string;
  photographer: string;
  photographer_url: string;
  src: {
    original?: string;
    large2x?: string;
    large?: string;
    landscape?: string;
    medium?: string;
  };
}

function cleanText(value: string, maxLength: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function stripMarkdown(value: string): string {
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>|~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fallbackBrief(input: BlogVisualSectionInput): VisualBrief {
  const heading = cleanText(stripMarkdown(input.heading), 140) || cleanText(stripMarkdown(input.articleTitle), 140);
  const context = cleanText(stripMarkdown(input.content), 700);
  const topic = heading || "conseil de barbier professionnel";
  const query = cleanText(`${topic} barber professional grooming`, 180);

  return {
    imagePrompt: `Editorial lifestyle photograph for a premium French barber and grooming article. Illustrate the section "${topic}". Context: ${context || "professional barbering advice"}. Natural, authentic barbershop environment, refined masculine grooming aesthetic, warm directional light, realistic materials, thoughtful composition with clear visual storytelling, no text, no watermark, no logo, no collage. Landscape 16:9 composition.`,
    searchQuery: query,
    altText: cleanText(`Illustration : ${topic}`, 150),
  };
}

function parseBrief(content: string, fallback: VisualBrief): VisualBrief {
  try {
    const normalized = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(normalized) as Partial<VisualBrief>;
    return {
      imagePrompt: typeof parsed.imagePrompt === "string" && parsed.imagePrompt.trim().length >= 25
        ? cleanText(parsed.imagePrompt, 1_500)
        : fallback.imagePrompt,
      searchQuery: typeof parsed.searchQuery === "string" && parsed.searchQuery.trim().length >= 3
        ? cleanText(parsed.searchQuery, 180)
        : fallback.searchQuery,
      altText: typeof parsed.altText === "string" && parsed.altText.trim().length >= 3
        ? cleanText(parsed.altText, 150)
        : fallback.altText,
    };
  } catch {
    return fallback;
  }
}

async function createVisualBrief(input: BlogVisualSectionInput): Promise<VisualBrief> {
  const fallback = fallbackBrief(input);
  if (!process.env.DEEPSEEK_API_KEY) return fallback;

  const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.DEEPSEEK_API_BASE || "https://api.deepseek.com",
  });

  try {
    const response = await client.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL_FAST || "deepseek-chat",
      temperature: 0.35,
      max_tokens: 420,
      messages: [
        {
          role: "system",
          content: "Tu es directeur artistique pour un blog français de barbier. Réponds uniquement par un objet JSON valide avec les clés imagePrompt, searchQuery et altText. imagePrompt doit être en anglais, décrire une photographie éditoriale réaliste 16:9 sans texte, watermark, logo ni collage. searchQuery doit être une requête anglaise concise de 3 à 8 mots. altText doit être français, descriptif et inférieur à 150 caractères.",
        },
        {
          role: "user",
          content: JSON.stringify({
            articleTitle: cleanText(input.articleTitle, 180),
            sectionHeading: cleanText(stripMarkdown(input.heading), 160),
            sectionContent: cleanText(stripMarkdown(input.content), 900),
            category: cleanText(input.category || "Conseils barbier", 80),
          }),
        },
      ],
    });

    return parseBrief(response.choices[0]?.message?.content || "", fallback);
  } catch (error) {
    console.warn("[BlogVisual] Brief DeepSeek indisponible, fallback déterministe utilisé:", error instanceof Error ? error.message : error);
    return fallback;
  }
}

function hasCloudinaryConfig(): boolean {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

function isSafeRemoteUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isAllowedBlogImageSource(value: unknown): value is string {
  if (!isSafeRemoteUrl(value)) return false;
  const url = new URL(value);
  if (url.protocol !== "https:") return false;
  return url.hostname === "images.pexels.com" || url.hostname.endsWith(".cloudinary.com");
}

export async function suggestBlogVisuals(source: BlogVisualSource, input: BlogVisualSectionInput): Promise<{ brief: VisualBrief; suggestions: BlogVisualSuggestion[] }> {
  const brief = await createVisualBrief(input);

  if (source === "ai") {
    if (!imageGenerator) throw new Error("Le service de génération d’images est indisponible.");

    const suggestions: BlogVisualSuggestion[] = [];
    const variations = ["wide editorial composition", "close detail composition", "human craft and tools composition"];

    // Flux 2 Pro est limité par compte : les appels sont volontairement séquentiels.
    for (const [index, variation] of variations.entries()) {
      const generated = await imageGenerator.generate({
        prompt: `${brief.imagePrompt}\nComposition variation ${index + 1}: ${variation}.`,
        category: "blog",
        tags: ["blog", "article-visual", "manual-suggestion"],
        aspectRatio: "16:9",
        useFastModel: false,
      });
      const sourceUrl = generated.cloudinaryUrl || generated.replicateUrl;
      if (!sourceUrl) throw new Error("La génération d’image n’a renvoyé aucune URL exploitable.");
      suggestions.push({
        id: generated.id,
        source: "ai",
        previewUrl: sourceUrl,
        sourceUrl,
        prompt: generated.prompt,
        altText: brief.altText,
      });
    }

    if (suggestions.length !== variations.length) {
      throw new Error("La génération IA n’a pas retourné toutes les propositions attendues.");
    }
    return { brief, suggestions };
  }

  if (!process.env.PEXELS_API_KEY) {
    throw new Error("La recherche d’images libres de droit n’est pas encore configurée. Ajouter PEXELS_API_KEY dans les variables d’environnement Render du backend.");
  }

  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", brief.searchQuery);
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("locale", "fr-FR");
  url.searchParams.set("per_page", "4");

  const response = await fetch(url, { headers: { Authorization: process.env.PEXELS_API_KEY } });
  if (!response.ok) {
    throw new Error(`La recherche d’images libres de droit a échoué (${response.status}).`);
  }

  const payload = await response.json() as { photos?: PexelsPhoto[] };
  const suggestions: BlogVisualSuggestion[] = [];
  for (const photo of (payload.photos || []).slice(0, 4)) {
    const sourceUrl = photo.src.large2x || photo.src.large || photo.src.landscape || photo.src.original;
    if (!sourceUrl) continue;
    suggestions.push({
      id: `pexels-${photo.id}`,
      source: "pexels",
      previewUrl: photo.src.medium || photo.src.landscape || sourceUrl,
      sourceUrl,
      prompt: brief.searchQuery,
      altText: cleanText(photo.alt || brief.altText, 150),
      attribution: {
        provider: "Pexels",
        photographer: cleanText(photo.photographer || "Photographe Pexels", 120),
        photographerUrl: isSafeRemoteUrl(photo.photographer_url) ? photo.photographer_url : "https://www.pexels.com",
        sourceUrl: isSafeRemoteUrl(photo.url) ? photo.url : "https://www.pexels.com",
        photoId: String(photo.id),
      },
    });
  }

  return { brief, suggestions };
}

export async function importBlogVisual(sourceUrl: string): Promise<string> {
  if (!isAllowedBlogImageSource(sourceUrl)) throw new Error("Cette image ne provient pas d’une proposition visuelle autorisée.");
  if (!hasCloudinaryConfig()) throw new Error("Cloudinary n’est pas configuré.");

  const uploaded = await cloudinary.uploader.upload(sourceUrl, {
    folder: "barberparadise/blog/articles",
    resource_type: "image",
    format: "webp",
    quality: "auto:good",
    tags: ["blog", "article-visual"],
  });

  return uploaded.secure_url;
}

export function validateBlogImageAttributions(value: unknown): BlogImageAttribution[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const candidate = item as Record<string, unknown>;
    const photographer = cleanText(String(candidate.photographer || ""), 120);
    const photographerUrl = typeof candidate.photographerUrl === "string" ? candidate.photographerUrl : "";
    const sourceUrl = typeof candidate.sourceUrl === "string" ? candidate.sourceUrl : "";
    const photoId = cleanText(String(candidate.photoId || ""), 80);
    const imageUrl = typeof candidate.imageUrl === "string" && isAllowedBlogImageSource(candidate.imageUrl) ? candidate.imageUrl : undefined;
    if (candidate.provider !== "Pexels" || !photographer || !photoId || !isSafeRemoteUrl(photographerUrl) || !isSafeRemoteUrl(sourceUrl)) return [];
    return [{ provider: "Pexels" as const, photographer, photographerUrl, sourceUrl, photoId, ...(imageUrl ? { imageUrl } : {}) }];
  });
}
