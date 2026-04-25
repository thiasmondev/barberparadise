// ============================================================
// BARBER PARADISE — Agent SEO + GEO (Anthropic Claude Sonnet 4)
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
  slug?: string;
  inStock?: boolean;
  variants?: { name: string; price?: number; inStock?: boolean }[];
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

export interface GeoOptimization {
  schemaJsonLd: string;           // JSON-LD Product schema complet
  faqItems: { question: string; answer: string }[];  // 5 Q&R FAQ
  geoScore: number;               // Score GEO 0-100
  geoDetails: { criterion: string; score: number; max: number; tip: string }[];
  directAnswerIntro: string;      // 150 mots "réponse directe" pour les LLM
  geoSuggestions: string[];       // Conseils spécifiques GEO
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

export interface LlmsTxtData {
  content: string;  // Contenu complet du fichier llms.txt
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

// ─── GEO Score Calculator ───────────────────────────────────

export function calculateGeoScore(product: ProductData): {
  score: number;
  details: { criterion: string; score: number; max: number; tip: string }[];
} {
  const details: { criterion: string; score: number; max: number; tip: string }[] = [];
  const plainDesc = stripHtml(product.description);

  // 1. Réponse directe dans les 150 premiers mots (25 pts)
  const first150 = plainDesc.substring(0, 600);
  const hasBrand = first150.toLowerCase().includes(product.brand.toLowerCase());
  const hasCategory = first150.toLowerCase().includes(product.category.toLowerCase());
  const hasNumbers = /\d+/.test(first150); // chiffres = données factuelles
  let directScore = 0;
  if (hasBrand) directScore += 8;
  if (hasCategory) directScore += 8;
  if (hasNumbers) directScore += 9;
  details.push({
    criterion: "Réponse directe (150 premiers mots)",
    score: directScore,
    max: 25,
    tip: directScore < 20
      ? "Les 150 premiers mots doivent mentionner la marque, le type de produit et des données chiffrées (poids, autonomie, etc.)."
      : "Bonne introduction factuelle.",
  });

  // 2. Données factuelles (chiffres, specs) (20 pts)
  const specPatterns = [/\d+\s*(mm|cm|ml|g|kg|w|v|hz|rpm|tr\/min|h|min|ans?)/gi, /\d+\s*%/gi];
  let specCount = 0;
  for (const pattern of specPatterns) {
    const matches = plainDesc.match(pattern);
    if (matches) specCount += matches.length;
  }
  let factScore = 0;
  if (specCount >= 5) factScore = 20;
  else if (specCount >= 3) factScore = 14;
  else if (specCount >= 1) factScore = 8;
  details.push({
    criterion: "Données factuelles et chiffrées",
    score: factScore,
    max: 20,
    tip: specCount < 3
      ? "Ajoutez des données techniques précises : poids, autonomie, dimensions, puissance, etc."
      : "Bonne densité de données factuelles.",
  });

  // 3. FAQ présente (20 pts)
  const hasFaq = /<faq|foire aux questions|questions fréquentes/i.test(product.description);
  const faqScore = hasFaq ? 20 : 0;
  details.push({
    criterion: "Section FAQ produit",
    score: faqScore,
    max: 20,
    tip: !hasFaq
      ? "Ajoutez une section FAQ avec 5 questions/réponses. Les IA adorent extraire les FAQ."
      : "Section FAQ présente.",
  });

  // 4. Sections comparatives (15 pts)
  const hasIdealPour = /idéal pour|convient pour|recommandé pour|parfait pour/i.test(plainDesc);
  const hasAvantages = /avantage|bénéfice|point fort|pourquoi choisir/i.test(plainDesc);
  let compScore = 0;
  if (hasIdealPour) compScore += 8;
  if (hasAvantages) compScore += 7;
  details.push({
    criterion: "Contenu comparatif (Idéal pour, Avantages)",
    score: compScore,
    max: 15,
    tip: compScore < 10
      ? "Ajoutez des sections 'Idéal pour' et 'Avantages' pour aider les IA à recommander ce produit."
      : "Bon contenu comparatif.",
  });

  // 5. Marque et autorité (20 pts)
  const hasBrandMention = (plainDesc.match(new RegExp(product.brand, "gi")) || []).length >= 2;
  const hasPro = /professionnel|barbier|coiffeur|salon/i.test(plainDesc);
  let authScore = 0;
  if (hasBrandMention) authScore += 10;
  if (hasPro) authScore += 10;
  details.push({
    criterion: "Autorité et contexte professionnel",
    score: authScore,
    max: 20,
    tip: authScore < 15
      ? "Mentionnez la marque plusieurs fois et précisez l'usage professionnel (barbier, salon, etc.)."
      : "Bonne autorité de marque.",
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

  const textBlock = message.content.find((block) => block.type === "text");
  return textBlock && textBlock.type === "text" ? textBlock.text : "{}";
}

function parseJsonResponse(raw: string): Record<string, unknown> {
  let jsonStr = raw.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();
  const objMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (objMatch) jsonStr = objMatch[0];
  return JSON.parse(jsonStr);
}

// ─── AI SEO Optimization (améliorée avec GEO) ───────────────

export async function optimizeProduct(product: ProductData): Promise<SeoOptimization> {
  const plainDesc = stripHtml(product.description);
  let images: string[] = [];
  try { images = JSON.parse(product.images); } catch { images = []; }

  const prompt = `Tu es un expert SEO & GEO (Generative Engine Optimization) spécialisé dans le e-commerce de produits de barbier et coiffure professionnelle. Tu dois optimiser la fiche produit suivante pour le référencement Google France ET pour être cité par les LLM (ChatGPT, Claude, Perplexity).

PRODUIT ACTUEL :
- Nom : ${product.name}
- Marque : ${product.brand}
- Catégorie : ${product.category} > ${product.subcategory}
- Prix : ${product.price}€${product.originalPrice ? ` (ancien prix : ${product.originalPrice}€)` : ""}
- Description actuelle : ${plainDesc.substring(0, 1500)}
- Nombre d'images : ${images.length}

INSTRUCTIONS CRITIQUES :
1. Les 150 premiers mots de la description doivent répondre DIRECTEMENT à "Qu'est-ce que ce produit et à qui s'adresse-t-il ?" avec des FAITS PRÉCIS (poids, autonomie, type de lame, RPM, etc.). Pas de marketing vague.
2. Inclure une section "Idéal pour" avec des cas d'usage concrets (ex: "Idéal pour les dégradés à blanc, les fondus intensifs...").
3. Utiliser des données chiffrées réelles ou plausibles basées sur le type de produit.
4. NE PAS inventer de caractéristiques techniques non mentionnées dans la description originale.

Génère une optimisation SEO complète au format JSON :

1. "optimizedTitle" : Titre optimisé SEO (50-70 caractères). Inclure la marque, le type de produit, et un mot-clé fort.

2. "metaDescription" : Meta description (120-155 caractères). Accroche commerciale + mot-clé principal + appel à l'action.

3. "seoDescription" : Description longue optimisée en HTML (600-1200 mots). Structure OBLIGATOIRE :
   - Paragraphe d'introduction factuel (150 mots max, réponse directe, données chiffrées)
   - <h2>Caractéristiques techniques</h2> avec <ul><li> pour les specs
   - <h2>Idéal pour</h2> avec cas d'usage concrets pour les barbiers/coiffeurs
   - <h2>Avantages</h2> avec les points forts du produit
   - <h2>Spécifications</h2> avec tableau ou liste technique
   - <strong> pour les mots-clés importants
   - Vocabulaire professionnel barbier/coiffure

4. "suggestedTags" : Array de 8-12 tags/mots-clés pertinents en français

5. "imageAlts" : Array de textes alt pour ${images.length} image(s). Descriptifs avec marque + type produit.

6. "seoScore" : Score SEO estimé après optimisation (0-100)

7. "suggestions" : Array de 3-5 suggestions d'amélioration supplémentaires

Réponds UNIQUEMENT avec le JSON valide, sans markdown ni commentaires.`;

  const raw = await callClaude(prompt, 5000);

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

// ─── AI GEO Optimization (Schema.org + FAQ + Score GEO) ─────

export async function optimizeProductGeo(product: ProductData): Promise<GeoOptimization> {
  const plainDesc = stripHtml(product.description);
  let images: string[] = [];
  try { images = JSON.parse(product.images); } catch { images = []; }
  let tags: string[] = [];
  try { tags = JSON.parse(product.tags); } catch { tags = []; }

  const imageUrl = images[0] || "";
  const availability = product.inStock !== false ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
  const productUrl = product.slug ? `https://barberparadise.fr/produit/${product.slug}` : "https://barberparadise.fr";

  const prompt = `Tu es un expert GEO (Generative Engine Optimization) pour le e-commerce. Tu dois générer les données structurées et le contenu optimisé pour que ce produit soit cité par ChatGPT, Claude, Perplexity et Google AI Overviews.

PRODUIT :
- Nom : ${product.name}
- Marque : ${product.brand}
- Catégorie : ${product.category} > ${product.subcategory}
- Prix : ${product.price}€
- Description : ${plainDesc.substring(0, 1200)}
- Tags : ${tags.join(", ")}
- URL produit : ${productUrl}
- Image principale : ${imageUrl}
- En stock : ${product.inStock !== false ? "Oui" : "Non"}

Génère un JSON avec ces champs :

1. "schemaJsonLd" : Le JSON-LD Schema.org complet pour ce produit (type Product). Inclure OBLIGATOIREMENT :
   - @context, @type: "Product"
   - name, description (texte court factuel, 150 mots max)
   - brand (@type: "Brand", name)
   - image (array d'URLs)
   - offers (@type: "Offer", price, priceCurrency: "EUR", availability, url)
   - category
   - keywords (array des tags)
   - Si pertinent : weight, material, color
   Retourner le JSON-LD comme STRING (pas d'objet imbriqué, juste la string du JSON-LD).

2. "faqItems" : Array de 5 objets {question, answer} avec des vraies questions que se posent les barbiers/coiffeurs sur ce produit. Les réponses doivent être factuelles, courtes (2-4 phrases), et basées UNIQUEMENT sur les informations disponibles dans la description. NE PAS inventer de caractéristiques.

3. "geoScore" : Score GEO estimé (0-100) basé sur la richesse factuelle du contenu actuel

4. "geoDetails" : Array de 4 objets {criterion, score, max, tip} évaluant :
   - "Richesse factuelle" (max 25)
   - "Contenu extractible par IA" (max 25)
   - "Autorité de marque" (max 25)
   - "Structure FAQ" (max 25)

5. "directAnswerIntro" : Un paragraphe de 100-150 mots qui répond directement à "Qu'est-ce que ${product.name} et à qui s'adresse-t-il ?". Factuel, précis, avec données chiffrées si disponibles. C'est le texte que les LLM vont citer.

6. "geoSuggestions" : Array de 3-4 conseils spécifiques pour améliorer la visibilité GEO de ce produit

Réponds UNIQUEMENT avec le JSON valide, sans markdown ni commentaires.`;

  const raw = await callClaude(prompt, 5000);

  try {
    const result = parseJsonResponse(raw) as Record<string, unknown>;

    // Calculer le score GEO automatique
    const autoGeo = calculateGeoScore(product);

    return {
      schemaJsonLd: (result.schemaJsonLd as string) || "{}",
      faqItems: (result.faqItems as { question: string; answer: string }[]) || [],
      geoScore: (result.geoScore as number) || autoGeo.score,
      geoDetails: (result.geoDetails as { criterion: string; score: number; max: number; tip: string }[]) || autoGeo.details,
      directAnswerIntro: (result.directAnswerIntro as string) || "",
      geoSuggestions: (result.geoSuggestions as string[]) || [],
    };
  } catch {
    throw new Error("Erreur de parsing de la réponse GEO. Réessayez.");
  }
}

// ─── Génération du fichier llms.txt ─────────────────────────

export async function generateLlmsTxt(siteData: {
  categories: { name: string; slug: string; productCount: number }[];
  topProducts: { name: string; brand: string; category: string; price: number; slug: string }[];
  totalProducts: number;
  siteUrl: string;
}): Promise<LlmsTxtData> {
  const categoriesList = siteData.categories
    .map((c) => `- ${c.name} (${c.productCount} produits) : ${siteData.siteUrl}/categorie/${c.slug}`)
    .join("\n");

  const productsList = siteData.topProducts
    .slice(0, 20)
    .map((p) => `- ${p.name} (${p.brand}) — ${p.price}€ : ${siteData.siteUrl}/produit/${p.slug}`)
    .join("\n");

  const prompt = `Tu es un expert en GEO (Generative Engine Optimization). Génère le contenu d'un fichier llms.txt pour le site e-commerce Barber Paradise.

Le fichier llms.txt est un standard émergent (comme robots.txt) qui aide les LLM (ChatGPT, Claude, Perplexity) à comprendre et indexer un site web.

DONNÉES DU SITE :
- URL : ${siteData.siteUrl}
- Nombre total de produits : ${siteData.totalProducts}
- Catégories principales :
${categoriesList}

- Produits phares :
${productsList}

INSTRUCTIONS :
Génère le contenu complet du fichier llms.txt en Markdown. Il doit contenir :

1. Un titre H1 : # Barber Paradise
2. Une description courte et factuelle de l'entreprise (2-3 phrases)
3. ## À propos — Description détaillée (qui nous sommes, notre spécialité, notre clientèle cible)
4. ## Catalogue — Résumé structuré des catégories avec URLs
5. ## Produits phares — Liste des 10-15 produits les plus importants avec prix et URLs
6. ## Politique commerciale — Livraison, retours, garanties (en termes généraux)
7. ## Contact — Email et informations de contact génériques
8. ## Sitemap — Liens vers les pages principales

Le ton doit être factuel, informatif, sans marketing. C'est un document technique pour les IA.

Réponds avec le contenu du fichier llms.txt directement (pas de JSON, juste le texte Markdown).`;

  const content = await callClaude(prompt, 3000);

  return { content };
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
    guide: "Guide d'achat complet avec critères de choix, comparaison, et recommandations. Optimisé pour être cité par les LLM quand quelqu'un demande 'comment choisir...'.",
    comparatif: "Comparatif détaillé entre produits avec tableau récapitulatif, avantages/inconvénients. Optimisé pour être cité par les LLM quand quelqu'un demande 'quelle est la différence entre...'.",
    tutoriel: "Tutoriel pratique étape par étape avec conseils de professionnel. Optimisé pour être cité par les LLM quand quelqu'un demande 'comment faire...'.",
    tendances: "Article sur les tendances actuelles du secteur barbier/coiffure. Optimisé pour être cité par les LLM quand quelqu'un demande 'quelles sont les tendances...'.",
  };

  const prompt = `Tu es un rédacteur SEO & GEO expert en barbier et coiffure professionnelle. Génère un article de blog optimisé pour Google France ET pour être cité par les LLM (ChatGPT, Claude, Perplexity).

SUJET : ${params.topic}
TYPE D'ARTICLE : ${typeInstructions[params.type]}
${productMentions}
${keywordsList}

INSTRUCTIONS GEO CRITIQUES :
- Commence chaque section par une réponse directe à la question implicite
- Inclure des données chiffrées et des faits vérifiables
- Ajouter une section FAQ en fin d'article avec 5 questions/réponses
- Structurer avec des H2/H3 clairs qui correspondent à des requêtes réelles

Génère un article au format JSON :

1. "title" : Titre H1 accrocheur et optimisé SEO (50-70 caractères)
2. "slug" : Slug URL en minuscules avec tirets
3. "excerpt" : Résumé/chapô de l'article (150-200 caractères)
4. "content" : Article complet en HTML (1500-2500 mots) avec :
   - Structure H2/H3 claire
   - Introduction engageante avec le mot-clé principal et réponse directe
   - Sections bien développées avec des <h2> et <h3>
   - Listes à puces pour les points clés
   - <strong> pour les mots-clés importants
   - Liens internes vers les produits : <a href="/produit/slug">Nom du produit</a>
   - Section <h2>Questions fréquentes</h2> avec 5 Q&R en fin d'article
   - Conclusion avec appel à l'action
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

// ─── Types enrichis GEO ──────────────────────────────────────

export interface GeoEnrichedContent {
  voiceSnippet: string;           // Réponse vocale 30-40 mots (Google Assistant, Siri)
  eeaatContent: string;           // Bloc E-E-A-T : expérience, expertise, autorité, confiance
  longTailQuestions: { question: string; answer: string; intent: string }[];  // 8 questions longue traîne
  competitorComparison: {         // Tableau comparatif vs concurrents
    feature: string;
    ourProduct: string;
    competitor1: string;
    competitor2: string;
  }[];
  useCases: { profile: string; useCase: string; benefit: string }[];  // Cas d'usage par profil
  buyingGuideSnippet: string;     // Extrait guide d'achat (pour être cité dans les guides)
  entityKeywords: string[];       // Entités nommées pour le Knowledge Graph Google
}

export interface GeoAuditResult {
  globalScore: number;
  totalProducts: number;
  productsWithSchema: number;
  productsWithFaq: number;
  productsWithDirectAnswer: number;
  productsWithVoiceSnippet: number;
  llmsTxtExists: boolean;
  checks: {
    id: string;
    label: string;
    status: "ok" | "warning" | "error";
    detail: string;
    priority: "haute" | "moyenne" | "basse";
  }[];
  topOpportunities: { productId: string; productName: string; geoScore: number; missingElements: string[] }[];
}

// ─── GEO Enrichi : Snippet vocal + E-E-A-T + Longue traîne ──

export async function generateGeoEnrichedContent(product: ProductData): Promise<GeoEnrichedContent> {
  const plainDesc = stripHtml(product.description);
  let tags: string[] = [];
  try { tags = JSON.parse(product.tags); } catch { tags = []; }

  const prompt = `Tu es un expert GEO (Generative Engine Optimization) spécialisé dans le matériel de barbier et coiffure professionnelle. Génère du contenu enrichi pour que ce produit soit cité par les LLM et les assistants vocaux.

PRODUIT :
- Nom : ${product.name}
- Marque : ${product.brand}
- Catégorie : ${product.category} > ${product.subcategory}
- Prix : ${product.price}€
- Description : ${plainDesc.substring(0, 1000)}
- Tags : ${tags.join(", ")}

Génère un JSON avec ces champs :

1. "voiceSnippet" : Réponse vocale de 30-40 mots maximum. Doit répondre directement à "C'est quoi ${product.name} ?" comme si un assistant vocal (Google, Siri, Alexa) le lisait à voix haute. Factuel, concis, naturel à l'oral.

2. "eeaatContent" : Bloc HTML court (150-200 mots) démontrant l'E-E-A-T (Expérience, Expertise, Autorité, Confiance) pour ce produit. Mentionner : l'usage professionnel, les certifications ou standards du secteur, pourquoi Barber Paradise est une source fiable pour ce type de produit. Format HTML avec <p> et <strong>.

3. "longTailQuestions" : Array de 8 objets {question, answer, intent} avec des questions longue traîne que tapent les barbiers/coiffeurs sur Google. Chaque question doit être différente des FAQ classiques. Intent = "informationnelle" | "commerciale" | "navigationnelle" | "transactionnelle". Les réponses doivent être basées UNIQUEMENT sur les informations disponibles.

4. "competitorComparison" : Array de 4-6 objets {feature, ourProduct, competitor1, competitor2} comparant ce produit à 2 concurrents génériques du même segment (ex: "Modèle concurrent A", "Modèle concurrent B"). Utiliser uniquement des caractéristiques objectives (prix, poids, autonomie, garantie, etc.) basées sur les informations disponibles. Ne pas inventer de specs précises non mentionnées.

5. "useCases" : Array de 4 objets {profile, useCase, benefit}. Profils typiques : "Barbier débutant", "Barbier professionnel confirmé", "Coiffeur en salon", "Usage à domicile". Pour chaque profil, décrire un cas d'usage concret et le bénéfice principal.

6. "buyingGuideSnippet" : Paragraphe de 80-100 mots qui pourrait figurer dans un guide d'achat. Commence par "Pour les barbiers qui cherchent..." ou "Si vous hésitez entre...". Factuel, comparatif, avec des critères de choix clairs.

7. "entityKeywords" : Array de 10-15 entités nommées (marques, technologies, certifications, termes techniques) liées à ce produit pour renforcer le Knowledge Graph Google. Ex: ["Andis", "GTX-Z", "moteur rotatif", "lame zéro gap", ...].

Réponds UNIQUEMENT avec le JSON valide, sans markdown ni commentaires.`;

  const raw = await callClaude(prompt, 4000);

  try {
    const result = parseJsonResponse(raw) as Record<string, unknown>;
    return {
      voiceSnippet: (result.voiceSnippet as string) || "",
      eeaatContent: (result.eeaatContent as string) || "",
      longTailQuestions: (result.longTailQuestions as { question: string; answer: string; intent: string }[]) || [],
      competitorComparison: (result.competitorComparison as { feature: string; ourProduct: string; competitor1: string; competitor2: string }[]) || [],
      useCases: (result.useCases as { profile: string; useCase: string; benefit: string }[]) || [],
      buyingGuideSnippet: (result.buyingGuideSnippet as string) || "",
      entityKeywords: (result.entityKeywords as string[]) || [],
    };
  } catch {
    throw new Error("Erreur de parsing du contenu GEO enrichi. Réessayez.");
  }
}

// ─── Audit GEO global du site ────────────────────────────────

export async function runGeoAudit(products: ProductData[]): Promise<GeoAuditResult> {
  let productsWithSchema = 0;
  let productsWithFaq = 0;
  let productsWithDirectAnswer = 0;
  let productsWithVoiceSnippet = 0;
  let totalGeoScore = 0;

  const topOpportunities: { productId: string; productName: string; geoScore: number; missingElements: string[] }[] = [];

  for (const p of products) {
    const { score } = calculateGeoScore(p);
    totalGeoScore += score;

    let features: Record<string, unknown> = {};
    try { features = JSON.parse(p.features || "{}"); } catch { /* */ }

    const hasSchema = !!features.schemaJsonLd;
    const hasFaq = !!(features.faqItems && Array.isArray(features.faqItems) && (features.faqItems as unknown[]).length > 0);
    const hasDirectAnswer = !!features.directAnswerIntro;
    const hasVoiceSnippet = !!features.voiceSnippet;

    if (hasSchema) productsWithSchema++;
    if (hasFaq) productsWithFaq++;
    if (hasDirectAnswer) productsWithDirectAnswer++;
    if (hasVoiceSnippet) productsWithVoiceSnippet++;

    if (score < 60) {
      const missing: string[] = [];
      if (!hasSchema) missing.push("Schema.org");
      if (!hasFaq) missing.push("FAQ");
      if (!hasDirectAnswer) missing.push("Introduction directe");
      if (!hasVoiceSnippet) missing.push("Snippet vocal");
      topOpportunities.push({ productId: p.id, productName: p.name, geoScore: score, missingElements: missing });
    }
  }

  const globalScore = products.length > 0 ? Math.round(totalGeoScore / products.length) : 0;
  const schemaRate = products.length > 0 ? Math.round((productsWithSchema / products.length) * 100) : 0;
  const faqRate = products.length > 0 ? Math.round((productsWithFaq / products.length) * 100) : 0;

  const checks: GeoAuditResult["checks"] = [
    {
      id: "schema_coverage",
      label: "Couverture Schema.org",
      status: schemaRate >= 80 ? "ok" : schemaRate >= 40 ? "warning" : "error",
      detail: `${productsWithSchema}/${products.length} produits ont un Schema.org (${schemaRate}%)`,
      priority: "haute",
    },
    {
      id: "faq_coverage",
      label: "Couverture FAQ produits",
      status: faqRate >= 70 ? "ok" : faqRate >= 30 ? "warning" : "error",
      detail: `${productsWithFaq}/${products.length} produits ont une FAQ (${faqRate}%)`,
      priority: "haute",
    },
    {
      id: "direct_answer",
      label: "Introductions directes (LLM-ready)",
      status: productsWithDirectAnswer >= products.length * 0.5 ? "ok" : productsWithDirectAnswer > 0 ? "warning" : "error",
      detail: `${productsWithDirectAnswer}/${products.length} produits ont une introduction directe`,
      priority: "haute",
    },
    {
      id: "voice_snippets",
      label: "Snippets vocaux (Siri, Google Assistant)",
      status: productsWithVoiceSnippet >= products.length * 0.5 ? "ok" : productsWithVoiceSnippet > 0 ? "warning" : "error",
      detail: `${productsWithVoiceSnippet}/${products.length} produits ont un snippet vocal`,
      priority: "moyenne",
    },
    {
      id: "global_geo_score",
      label: "Score GEO moyen",
      status: globalScore >= 70 ? "ok" : globalScore >= 50 ? "warning" : "error",
      detail: `Score GEO moyen : ${globalScore}/100`,
      priority: "haute",
    },
  ];

  return {
    globalScore,
    totalProducts: products.length,
    productsWithSchema,
    productsWithFaq,
    productsWithDirectAnswer,
    productsWithVoiceSnippet,
    llmsTxtExists: false, // sera vérifié côté route
    checks,
    topOpportunities: topOpportunities.sort((a, b) => a.geoScore - b.geoScore).slice(0, 10),
  };
}

// ─── Générateur de contenu catégorie GEO ────────────────────

export async function generateCategoryGeoContent(params: {
  categoryName: string;
  categorySlug: string;
  productCount: number;
  topProducts: { name: string; brand: string; price: number }[];
}): Promise<{ heroText: string; buyingCriteria: string[]; faqCategory: { question: string; answer: string }[]; entityKeywords: string[] }> {
  const productList = params.topProducts
    .slice(0, 8)
    .map((p) => `- ${p.name} (${p.brand}) — ${p.price}€`)
    .join("\n");

  const prompt = `Tu es un expert GEO pour le e-commerce de barbier professionnel. Génère du contenu optimisé pour la page catégorie "${params.categoryName}" de Barber Paradise.

DONNÉES :
- Catégorie : ${params.categoryName}
- Nombre de produits : ${params.productCount}
- Produits phares :
${productList}

Génère un JSON avec :

1. "heroText" : Paragraphe d'introduction de 100-120 mots pour la page catégorie. Répond directement à "Quels sont les meilleurs ${params.categoryName} pour barbier ?". Factuel, avec des données chiffrées (fourchette de prix, marques phares, critères clés).

2. "buyingCriteria" : Array de 5-7 critères de choix importants pour cette catégorie (ex: "Puissance du moteur", "Autonomie de la batterie", "Type de lame"). Chaque critère = string courte.

3. "faqCategory" : Array de 5 objets {question, answer} avec des questions fréquentes sur cette catégorie de produits. Questions que tapent les barbiers sur Google.

4. "entityKeywords" : Array de 10 entités/termes techniques importants pour cette catégorie (marques, technologies, termes professionnels).

Réponds UNIQUEMENT avec le JSON valide, sans markdown ni commentaires.`;

  const raw = await callClaude(prompt, 2500);

  try {
    const result = parseJsonResponse(raw) as Record<string, unknown>;
    return {
      heroText: (result.heroText as string) || "",
      buyingCriteria: (result.buyingCriteria as string[]) || [],
      faqCategory: (result.faqCategory as { question: string; answer: string }[]) || [],
      entityKeywords: (result.entityKeywords as string[]) || [],
    };
  } catch {
    throw new Error("Erreur de parsing du contenu GEO catégorie. Réessayez.");
  }
}

// ─── Génération Alt Texts SEO pour les images ───────────────
export async function generateImageAlts(product: {
  id: string;
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  images: string;
}): Promise<string[]> {
  let images: string[] = [];
  try { images = JSON.parse(product.images); } catch { images = []; }
  if (images.length === 0) return [];

  const systemPrompt = `Tu es un expert SEO e-commerce spécialisé dans les produits barber et coiffure.
Pour chaque produit, génère un alt text optimisé en français qui :
1. Commence par la marque et le nom exact du produit
2. Inclut le type de produit (tondeuse, ciseau, cire, huile...)
3. Inclut le contexte d'usage (barber, coiffeur, professionnel, homme)
4. Inclut 1-2 mots-clés de longue traîne pertinents
5. Fait entre 80 et 125 caractères
6. Est naturel et lisible, pas une liste de mots-clés

Format : [Marque] [Nom Produit] [Type] - [Adjectifs usage]
Exemple : "JRL FF2020C Tondeuse Professionnelle Sans Fil - Clipper Barber Fade Précision"

Retourne UNIQUEMENT l'alt text, sans guillemets, sans explication.
Pour le title, génère : [Nom produit] [Marque] — Barber Paradise simplement.

Mots-clés prioritaires du secteur (intègre-les naturellement quand pertinent) :
tondeuse barber, clipper professionnel, ciseaux coiffeur, cire cheveux homme, matériel barbier, huile barbe, produit coiffant`;

  const prompt = `Produit à traiter :
- Nom : ${product.name}
- Marque : ${product.brand}
- Catégorie : ${product.category}${product.subcategory ? ` > ${product.subcategory}` : ""}
- Nombre d'images : ${images.length}

Génère exactement ${images.length} alt text(s) SEO optimisé(s) pour ce produit.
Pour les images secondaires (2, 3...), varie légèrement la formulation (ex: "vue de profil", "détail", "packaging").

Réponds UNIQUEMENT avec un JSON valide : { "alts": ["alt1", "alt2", ...] }

SYSTEM PROMPT à respecter impérativement :
${systemPrompt}`;

  const raw = await callClaude(prompt, 1000);
  try {
    const result = parseJsonResponse(raw) as Record<string, unknown>;
    const alts = (result.alts as string[]) || [];
    // S'assurer qu'on a le bon nombre d'alts
    while (alts.length < images.length) {
      alts.push(`${product.brand} ${product.name} - Produit Professionnel Barber`);
    }
    return alts.slice(0, images.length);
  } catch {
    // Fallback : générer des alts basiques
    return images.map((_, i) =>
      i === 0
        ? `${product.brand} ${product.name} - Produit Professionnel Barber`
        : `${product.brand} ${product.name} vue ${i + 1} - Barber Paradise`
    );
  }
}
