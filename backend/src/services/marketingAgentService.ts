import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-20250514";
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

export type MarketingGenerationInput = {
  objective: string;
  audience: string;
  tone?: string;
  channels?: string[];
  productIds?: string[];
  campaignType?: string;
  promoCode?: string;
  discountType?: string;
  discountValue?: number;
};

export type MarketingProductContext = {
  id: string;
  name: string;
  slug: string;
  brand: string;
  category: string;
  price: number;
  shortDescription: string;
};

export type MarketingGenerationResult = {
  title: string;
  slug: string;
  objective: string;
  audience: string;
  channels: string[];
  blogPost: {
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    categorySlug: string;
    tags: string[];
    metaTitle: string;
    metaDescription: string;
  };
  emailCampaign: {
    name: string;
    subject: string;
    preheader: string;
    htmlContent: string;
    textContent: string;
  };
  promoCode: {
    code: string;
    label: string;
    description: string;
    type: string;
    value: number;
  };
  socialPosts: {
    instagram: string;
    facebook: string;
    tiktokHook: string;
  };
  landingSections: string[];
};

export function slugifyMarketing(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "campagne-marketing";
}

function safeJson(raw: string): Partial<MarketingGenerationResult> | null {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned) as Partial<MarketingGenerationResult>;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as Partial<MarketingGenerationResult>;
    } catch {
      return null;
    }
  }
}

function fallbackGeneration(input: MarketingGenerationInput, products: MarketingProductContext[]): MarketingGenerationResult {
  const primaryProduct = products[0];
  const productName = primaryProduct?.name || "sélection BarberParadise";
  const objective = input.objective.trim();
  const title = objective.length > 8 ? objective : `Campagne ${productName}`;
  const slug = slugifyMarketing(title);
  const code = (input.promoCode || slug.replace(/-/g, "").slice(0, 10) || "BARBER10").toUpperCase();
  const type = input.discountType || "percentage";
  const value = Number(input.discountValue || 10);
  const productLinks = products
    .map(product => `<li><a href="/produit/${product.slug}">${product.name}</a> — ${product.brand}</li>`)
    .join("");

  return {
    title,
    slug,
    objective,
    audience: input.audience || "clients BarberParadise",
    channels: input.channels?.length ? input.channels : ["blog", "email", "promotion"],
    blogPost: {
      title: `${title} : conseils et sélection professionnelle`,
      slug,
      excerpt: `Une campagne BarberParadise pensée pour ${input.audience || "les clients exigeants"}, avec des conseils concrets et une sélection adaptée.`,
      content: `<h2>${title}</h2><p>${objective}</p><p>BarberParadise accompagne les coiffeurs, barbiers et particuliers exigeants avec une sélection professionnelle, des conseils d'utilisation et une expérience d'achat claire.</p>${productLinks ? `<h2>Produits à mettre en avant</h2><ul>${productLinks}</ul>` : ""}<h2>Pourquoi agir maintenant ?</h2><p>Cette opération permet de découvrir les essentiels du grooming avec un avantage limité dans le temps, tout en gardant une approche experte et cohérente avec l'image BarberParadise.</p>`,
      categorySlug: input.campaignType || "guide",
      tags: ["barberparadise", "barbier", "coiffure homme", "grooming", "promotion"],
      metaTitle: `${title} | BarberParadise`,
      metaDescription: `Découvrez la campagne ${title} sur BarberParadise : conseils professionnels, sélection de produits et avantage exclusif.`,
    },
    emailCampaign: {
      name: title,
      subject: `${title} : votre sélection BarberParadise`,
      preheader: `Conseils experts et avantage ${code} à découvrir maintenant.`,
      htmlContent: `<h1>${title}</h1><p>${objective}</p><p>Profitez du code <strong>${code}</strong> sur BarberParadise.</p><p><a href="https://barberparadise.fr/catalogue">Découvrir la sélection</a></p>`,
      textContent: `${title}\n\n${objective}\n\nCode : ${code}\nhttps://barberparadise.fr/catalogue`,
    },
    promoCode: {
      code,
      label: `Offre ${code}`,
      description: `Avantage marketing généré pour la campagne ${title}.`,
      type,
      value,
    },
    socialPosts: {
      instagram: `${title}\n\nUne sélection pro, des conseils simples, et un avantage limité avec le code ${code}.`,
      facebook: `Nouvelle opération BarberParadise : ${title}. Découvrez notre sélection et profitez du code ${code}.`,
      tiktokHook: `Trois raisons de tester ${productName} dès maintenant chez BarberParadise.`,
    },
    landingSections: [
      "Promesse claire orientée résultat professionnel",
      "Sélection produits liée à la campagne",
      "Preuves : expertise barbier, livraison et retours",
      `Appel à l'action avec le code ${code}`,
    ],
  };
}

export async function generateMarketingCampaignContent(
  input: MarketingGenerationInput,
  products: MarketingProductContext[]
): Promise<MarketingGenerationResult> {
  if (!anthropic) {
    return fallbackGeneration(input, products);
  }

  const prompt = `Tu es l'Agent Marketing de BarberParadise.fr, e-commerce français pour coiffeurs, barbiers, formateurs et particuliers exigeants.

Objectif : ${input.objective}
Audience : ${input.audience}
Ton : ${input.tone || "expert, direct, premium, utile"}
Type de campagne : ${input.campaignType || "multi-canal"}
Canaux demandés : ${(input.channels || []).join(", ") || "blog, email, promotion, réseaux sociaux"}
Produits contexte : ${JSON.stringify(products, null, 2)}

Retourne uniquement un JSON valide avec cette structure exacte :
{
  "title": "string",
  "slug": "string-kebab-case",
  "objective": "string",
  "audience": "string",
  "channels": ["blog", "email"],
  "blogPost": { "title": "string", "slug": "string", "excerpt": "string", "content": "HTML long avec h2, h3, liens internes", "categorySlug": "guide", "tags": ["string"], "metaTitle": "string", "metaDescription": "string" },
  "emailCampaign": { "name": "string", "subject": "string", "preheader": "string", "htmlContent": "HTML", "textContent": "string" },
  "promoCode": { "code": "string", "label": "string", "description": "string", "type": "percentage|fixed|free_shipping", "value": 10 },
  "socialPosts": { "instagram": "string", "facebook": "string", "tiktokHook": "string" },
  "landingSections": ["string"]
}

Contraintes : jamais de promesse médicale, pas de réduction excessive sans contexte, style BarberParadise noir/rose premium, SEO naturel et utile.`;

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 5000,
    temperature: 0.45,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = message.content
    .filter(block => block.type === "text")
    .map(block => (block as { type: "text"; text: string }).text)
    .join("\n");
  const parsed = safeJson(raw);
  if (!parsed) return fallbackGeneration(input, products);

  const fallback = fallbackGeneration(input, products);
  return {
    ...fallback,
    ...parsed,
    slug: slugifyMarketing(parsed.slug || parsed.title || fallback.slug),
    channels: Array.isArray(parsed.channels) && parsed.channels.length ? parsed.channels : fallback.channels,
    blogPost: { ...fallback.blogPost, ...(parsed.blogPost || {}) },
    emailCampaign: { ...fallback.emailCampaign, ...(parsed.emailCampaign || {}) },
    promoCode: { ...fallback.promoCode, ...(parsed.promoCode || {}) },
    socialPosts: { ...fallback.socialPosts, ...(parsed.socialPosts || {}) },
    landingSections: Array.isArray(parsed.landingSections) ? parsed.landingSections : fallback.landingSections,
  };
}

export function calculateDiscountAmount(args: {
  subtotal: number;
  type: string;
  value: number;
  shipping?: number;
}): number {
  const subtotal = Math.max(0, Number(args.subtotal) || 0);
  const value = Math.max(0, Number(args.value) || 0);
  if (args.type === "percentage") return Math.min(subtotal, Number((subtotal * value / 100).toFixed(2)));
  if (args.type === "fixed") return Math.min(subtotal, Number(value.toFixed(2)));
  if (args.type === "free_shipping") return Math.max(0, Number((args.shipping || 0).toFixed(2)));
  return 0;
}
