// ============================================================
// BARBER PARADISE — Agent SEO (Anthropic Claude Sonnet 4)
// ============================================================
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-20250514";

// ─── Types ──────────────────────────────────────────────────

export interface ProductData {
  id: string;
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  price: number;
  originalPrice?: number | null;
  description: string;
  shortDescription: string;
  images: string;
  tags: string;
  features: string;
}

export interface SeoOptimization {
  optimizedTitle: string;
  metaDescription: string;
  seoDescription: string;
  suggestedTags: string[];
  imageAlts: string[];
  seoScore: number;
  suggestions: string[];
}

export interface BlogArticle {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  metaDescription: string;
  tags: string[];
  category: string;
  readTime: number;
}

// ─── SEO Score Calculator ───────────────────────────────────

export function calculateSeoScore(product: ProductData): {
  score: number;
  details: { criterion: string; score: number; max: number; tip: string }[];
} {
  const details: { criterion: string; score: number; max: number; tip: string }[] = [];
  const plainDesc = stripHtml(product.description);

  // 1. Title quality (20 pts)
  const titleLen = product.name.length;
  let titleScore = 0;
  if (titleLen >= 30 && titleLen <= 70) titleScore = 20;
  else if (titleLen >= 20 && titleLen <= 80) titleScore = 14;
  else if (titleLen >= 10) titleScore = 8;
  details.push({
    criterion: "Titre optimisé",
    score: titleScore,
    max: 20,
    tip: titleLen < 30
      ? "Titre trop court. Ajoutez des mots-clés pertinents."
      : titleLen > 70
      ? "Titre trop long. Raccourcissez-le à 60-70 caractères."
      : "Bonne longueur de titre.",
  });

  // 2. Description length (20 pts)
  let descScore = 0;
  if (plainDesc.length >= 300) descScore = 20;
  else if (plainDesc.length >= 150) descScore = 14;
  else if (plainDesc.length >= 50) descScore = 8;
  else descScore = 2;
  details.push({
    criterion: "Description riche",
    score: descScore,
    max: 20,
    tip: plainDesc.length < 300
      ? `Description trop courte (${plainDesc.length} car.). Visez 300+ caractères avec des mots-clés.`
      : "Bonne longueur de description.",
  });

  // 3. Description has HTML structure (15 pts)
  const hasH2 = /<h[23]/i.test(product.description);
  const hasList = /<[uo]l/i.test(product.description);
  const hasStrong = /<strong|<b>/i.test(product.description);
  let structScore = 0;
  if (hasH2) structScore += 6;
  if (hasList) structScore += 5;
  if (hasStrong) structScore += 4;
  details.push({
    criterion: "Structure HTML (H2, listes, gras)",
    score: structScore,
    max: 15,
    tip: !hasH2
      ? "Ajoutez des sous-titres H2/H3 pour structurer la description."
      : !hasList
      ? "Ajoutez des listes à puces pour les caractéristiques."
      : "Bonne structure HTML.",
  });

  // 4. Images (15 pts)
  let images: string[] = [];
  try { images = JSON.parse(product.images); } catch { images = []; }
  let imgScore = 0;
  if (images.length >= 3) imgScore = 15;
  else if (images.length >= 2) imgScore = 10;
  else if (images.length >= 1) imgScore = 5;
  details.push({
    criterion: "Images produit",
    score: imgScore,
    max: 15,
    tip: images.length < 3
      ? `Seulement ${images.length} image(s). Ajoutez-en pour atteindre 3+ images.`
      : "Bon nombre d'images.",
  });

  // 5. Tags/Keywords (15 pts)
  let tags: string[] = [];
  try { tags = JSON.parse(product.tags); } catch { tags = []; }
  let tagScore = 0;
  if (tags.length >= 5) tagScore = 15;
  else if (tags.length >= 3) tagScore = 10;
  else if (tags.length >= 1) tagScore = 5;
  details.push({
    criterion: "Tags / Mots-clés",
    score: tagScore,
    max: 15,
    tip: tags.length < 5
      ? `Seulement ${tags.length} tag(s). Ajoutez des mots-clés pertinents (5+ recommandés).`
      : "Bon nombre de tags.",
  });

  // 6. Short description / Meta (15 pts)
  const shortLen = product.shortDescription.length;
  let metaScore = 0;
  if (shortLen >= 100 && shortLen <= 160) metaScore = 15;
  else if (shortLen >= 50 && shortLen <= 200) metaScore = 10;
  else if (shortLen >= 20) metaScore = 5;
  details.push({
    criterion: "Meta description",
    score: metaScore,
    max: 15,
    tip: shortLen < 100
      ? "Meta description trop courte. Visez 120-155 caractères."
      : shortLen > 160
      ? "Meta description trop longue. Limitez à 155 caractères."
      : "Bonne longueur de meta description.",
  });

  const totalScore = details.reduce((sum, d) => sum + d.score, 0);
  return { score: totalScore, details };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
}

// ─── Helper: call Claude and parse JSON response ─────────────

async function callClaude(prompt: string, maxTokens: number): Promise<string> {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });

  // Extract text from the response content blocks
  const textBlock = message.content.find((block) => block.type === "text");
  return textBlock && textBlock.type === "text" ? textBlock.text : "{}";
}

function parseJsonResponse(raw: string): Record<string, unknown> {
  // Strip potential markdown code fences
  let jsonStr = raw.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();

  // Try to extract first JSON object if there's surrounding text
  const objMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (objMatch) jsonStr = objMatch[0];

  return JSON.parse(jsonStr);
}

// ─── AI Optimization ────────────────────────────────────────

export async function optimizeProduct(product: ProductData): Promise<SeoOptimization> {
  const plainDesc = stripHtml(product.description);
  let images: string[] = [];
  try { images = JSON.parse(product.images); } catch { images = []; }

  const prompt = `Tu es un expert SEO spécialisé dans le e-commerce de produits de barbier et coiffure professionnelle. Tu dois optimiser la fiche produit suivante pour le référencement Google France.

PRODUIT ACTUEL :
- Nom : ${product.name}
- Marque : ${product.brand}
- Catégorie : ${product.category} > ${product.subcategory}
- Prix : ${product.price}€${product.originalPrice ? ` (ancien prix : ${product.originalPrice}€)` : ""}
- Description actuelle : ${plainDesc.substring(0, 1500)}
- Nombre d'images : ${images.length}

INSTRUCTIONS :
Génère une optimisation SEO complète au format JSON avec les champs suivants :

1. "optimizedTitle" : Titre optimisé SEO (50-70 caractères). Inclure la marque, le type de produit, et un mot-clé fort. Pas de majuscules excessives.

2. "metaDescription" : Meta description (120-155 caractères). Accroche commerciale + mot-clé principal + appel à l'action.

3. "seoDescription" : Description longue optimisée en HTML (500-1000 mots). Structure avec :
   - Un paragraphe d'introduction avec le mot-clé principal
   - <h2> pour les sections principales (Caractéristiques, Avantages, Utilisation, Spécifications)
   - <ul><li> pour les listes de caractéristiques
   - <strong> pour les mots-clés importants
   - Vocabulaire naturel lié au barbier/coiffure professionnel
   - Mots-clés longue traîne intégrés naturellement

4. "suggestedTags" : Array de 8-12 tags/mots-clés pertinents en français (barbier, coiffure, professionnel, etc.)

5. "imageAlts" : Array de textes alt pour ${images.length} image(s). Descriptifs, incluant marque + type produit.

6. "seoScore" : Score SEO estimé après optimisation (0-100)

7. "suggestions" : Array de 3-5 suggestions d'amélioration supplémentaires

Réponds UNIQUEMENT avec le JSON valide, sans markdown ni commentaires.`;

  const raw = await callClaude(prompt, 4000);

  try {
    const result = parseJsonResponse(raw) as Record<string, unknown>;
    return {
      optimizedTitle: (result.optimizedTitle as string) || product.name,
      metaDescription: (result.metaDescription as string) || product.shortDescription,
      seoDescription: (result.seoDescription as string) || product.description,
      suggestedTags: (result.suggestedTags as string[]) || [],
      imageAlts: (result.imageAlts as string[]) || [],
      seoScore: (result.seoScore as number) || 50,
      suggestions: (result.suggestions as string[]) || [],
    };
  } catch {
    throw new Error("Erreur de parsing de la réponse IA. Réessayez.");
  }
}

// ─── Blog Article Generation ────────────────────────────────

export async function generateBlogArticle(params: {
  topic: string;
  type: "guide" | "comparatif" | "tutoriel" | "tendances";
  relatedProducts?: { name: string; slug: string; brand: string }[];
  keywords?: string[];
}): Promise<BlogArticle> {
  const productMentions = params.relatedProducts?.length
    ? `\nPRODUITS À MENTIONNER (avec liens internes) :\n${params.relatedProducts
        .map((p) => `- ${p.name} (${p.brand}) → lien: /produit/${p.slug}`)
        .join("\n")}`
    : "";

  const keywordsList = params.keywords?.length
    ? `\nMOTS-CLÉS À INTÉGRER : ${params.keywords.join(", ")}`
    : "";

  const typeInstructions: Record<string, string> = {
    guide: "Guide d'achat complet avec critères de choix, comparaison, et recommandations.",
    comparatif: "Comparatif détaillé entre produits avec tableau récapitulatif, avantages/inconvénients.",
    tutoriel: "Tutoriel pratique étape par étape avec conseils de professionnel.",
    tendances: "Article sur les tendances actuelles du secteur barbier/coiffure.",
  };

  const prompt = `Tu es un rédacteur SEO expert en barbier et coiffure professionnelle. Génère un article de blog complet et optimisé pour le référencement Google France.

SUJET : ${params.topic}
TYPE D'ARTICLE : ${typeInstructions[params.type]}
${productMentions}
${keywordsList}

INSTRUCTIONS :
Génère un article au format JSON avec les champs suivants :

1. "title" : Titre H1 accrocheur et optimisé SEO (50-70 caractères)
2. "slug" : Slug URL en minuscules avec tirets
3. "excerpt" : Résumé/chapô de l'article (150-200 caractères)
4. "content" : Article complet en HTML (1500-2500 mots) avec :
   - Structure H2/H3 claire
   - Introduction engageante avec le mot-clé principal
   - Sections bien développées avec des <h2> et <h3>
   - Listes à puces pour les points clés
   - <strong> pour les mots-clés importants
   - Liens internes vers les produits mentionnés : <a href="/produit/slug">Nom du produit</a>
   - Conclusion avec appel à l'action
   - Ton professionnel mais accessible
5. "metaDescription" : Meta description (120-155 caractères)
6. "tags" : Array de 5-8 tags pertinents
7. "category" : Catégorie de l'article (guide, comparatif, tutoriel, tendances)
8. "readTime" : Temps de lecture estimé en minutes

Réponds UNIQUEMENT avec le JSON valide, sans markdown ni commentaires.`;

  const raw = await callClaude(prompt, 6000);

  try {
    const result = parseJsonResponse(raw) as Record<string, unknown>;
    return {
      title: (result.title as string) || params.topic,
      slug: (result.slug as string) || params.topic.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      excerpt: (result.excerpt as string) || "",
      content: (result.content as string) || "",
      metaDescription: (result.metaDescription as string) || "",
      tags: (result.tags as string[]) || [],
      category: (result.category as string) || params.type,
      readTime: (result.readTime as number) || 5,
    };
  } catch {
    throw new Error("Erreur de parsing de la réponse IA. Réessayez.");
  }
}
