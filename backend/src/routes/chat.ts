import { Router, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../utils/prisma";

export const chatRouter = Router();

const BARBARA_MODEL = "claude-haiku-4-5-20251001";
const MAX_MESSAGES_PER_HOUR = 20;
const WINDOW_MS = 60 * 60 * 1000;
const MAX_HISTORY_MESSAGES = 12;
const MAX_CATALOG_PRODUCTS = 45;

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

type ChatRole = "user" | "assistant";

type IncomingMessage = {
  role: ChatRole;
  content: string;
};

type CatalogProduct = {
  name: string;
  slug: string;
  brand: string;
  category: string;
  price: number;
  priceProEur: number | null;
  inStock: boolean;
};

const sessionWindows = new Map<string, number[]>();

function cleanupRateLimitWindow(sessionId: string): number[] {
  const now = Date.now();
  const recent = (sessionWindows.get(sessionId) || []).filter((timestamp) => now - timestamp < WINDOW_MS);
  sessionWindows.set(sessionId, recent);
  return recent;
}

function isValidMessage(value: unknown): value is IncomingMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<IncomingMessage>;
  return (
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    message.content.trim().length > 0
  );
}

function normalizeMessages(messages: unknown): IncomingMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(isValidMessage)
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 1200),
    }));
}

function extractSearchTerms(messages: IncomingMessage[]): string[] {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content || "";
  return lastUserMessage
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9+]+/)
    .filter((term) => term.length >= 3)
    .slice(0, 8);
}

function scoreProduct(product: CatalogProduct, terms: string[]): number {
  if (terms.length === 0) return 0;
  const haystack = `${product.name} ${product.brand} ${product.category} ${product.slug}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return terms.reduce((score, term) => {
    if (haystack.includes(term)) return score + 1;
    return score;
  }, 0);
}

function formatPrice(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "non renseigné";
  return `${value.toFixed(2).replace(".", ",")} €`;
}

async function buildCatalogContext(messages: IncomingMessage[]): Promise<string> {
  const products = await prisma.product.findMany({
    where: { status: "active" },
    select: {
      name: true,
      slug: true,
      brand: true,
      category: true,
      price: true,
      priceProEur: true,
      inStock: true,
    },
    orderBy: [{ inStock: "desc" }, { updatedAt: "desc" }],
    take: 180,
  });

  const catalogProducts = products as CatalogProduct[];
  const terms = extractSearchTerms(messages);
  const scored = catalogProducts
    .map((product) => ({ product, score: scoreProduct(product, terms) }))
    .sort((a, b) => b.score - a.score);
  const selected = scored
    .filter((item) => item.score > 0)
    .slice(0, MAX_CATALOG_PRODUCTS)
    .map((item) => item.product);
  const fallback = catalogProducts
    .filter((product) => !selected.some((selectedProduct) => selectedProduct.slug === product.slug))
    .slice(0, Math.max(0, MAX_CATALOG_PRODUCTS - selected.length));
  const contextProducts = [...selected, ...fallback];

  if (contextProducts.length === 0) {
    return "Aucun produit actif n'est disponible dans le contexte catalogue au moment de la demande.";
  }

  return contextProducts
    .map((product) => {
      const proPrice = product.priceProEur ? ` | prix pro HT: ${formatPrice(product.priceProEur)}` : "";
      const stock = product.inStock ? "en stock" : "hors stock";
      return `- ${product.name} | marque: ${product.brand} | catégorie: ${product.category} | prix public: ${formatPrice(product.price)}${proPrice} | slug: /produit/${product.slug} | ${stock}`;
    })
    .join("\n");
}

function buildSystemPrompt(catalogContext: string): string {
  return `Tu es Barbara, l'assistante virtuelle experte de Barber Paradise (barberparadise.fr), une boutique en ligne spécialisée dans le matériel professionnel pour barbiers et coiffeurs.

Tu as un ton expert, chaleureux et professionnel. Tu vouvoies les clients.
Tu connais les produits du catalogue Barber Paradise à partir du CatalogContext fourni ci-dessous.
Tu peux répondre aux questions sur : les produits, les marques, la livraison (gratuite dès 49€ B2C, 500€ HT B2B), les paiements (Mollie, PayPal), les comptes pro, les retours.
Si tu ne sais pas répondre, tu invites le client à contacter le support par email.
Tu réponds toujours en français, de manière concise (3-4 phrases maximum).
Tu n'inventes jamais de produits ou de prix : tu te bases uniquement sur le catalogue fourni. Si le produit demandé n'est pas dans le contexte, propose de vérifier le catalogue ou de contacter le support.

CatalogContext :
${catalogContext}`;
}

function fallbackReply(messages: IncomingMessage[]): string {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content.toLowerCase() || "";
  if (lastUserMessage.includes("livraison")) {
    return "La livraison est offerte dès 49 € pour les clients particuliers et dès 500 € HT pour les comptes professionnels. Les options exactes s’affichent au moment du panier selon votre adresse et les produits commandés. Si vous avez une contrainte précise, contactez le support Barber Paradise.";
  }
  if (lastUserMessage.includes("pro")) {
    return "Pour devenir client professionnel, vous pouvez créer un compte pro depuis l’espace dédié du site Barber Paradise. Une fois votre compte validé, vous accédez aux conditions et tarifs professionnels disponibles. Si besoin, le support peut vous accompagner dans l’ouverture du compte.";
  }
  if (lastUserMessage.includes("marque")) {
    return "Barber Paradise propose une sélection de marques professionnelles pour barbiers et coiffeurs. Pour une réponse fiable sur une marque précise, consultez le catalogue ou indiquez-moi le nom recherché. Si la marque n’apparaît pas, le support pourra confirmer sa disponibilité.";
  }
  return "Je peux vous aider à choisir un produit, comprendre la livraison, les paiements, les comptes pro ou les retours. Pour une réponse totalement fiable sur un produit précis, indiquez-moi son nom ou sa marque. Si l’information n’est pas disponible dans le catalogue, je vous inviterai à contacter le support Barber Paradise.";
}

chatRouter.post("/barbara", async (req: Request, res: Response): Promise<void> => {
  try {
    const { messages, sessionId } = req.body as { messages?: unknown; sessionId?: unknown };
    const normalizedSessionId = typeof sessionId === "string" ? sessionId.trim().slice(0, 120) : "";
    const normalizedMessages = normalizeMessages(messages);
    const lastMessage = [...normalizedMessages].reverse().find((message) => message.role === "user");

    if (!normalizedSessionId) {
      res.status(400).json({ error: "Session invalide." });
      return;
    }

    if (!lastMessage || lastMessage.content.trim().length < 2) {
      res.status(400).json({ error: "Votre message est trop court." });
      return;
    }

    const window = cleanupRateLimitWindow(normalizedSessionId);
    if (window.length >= MAX_MESSAGES_PER_HOUR) {
      res.status(429).json({ error: "Vous avez atteint la limite de messages. Réessayez dans une heure." });
      return;
    }
    window.push(Date.now());
    sessionWindows.set(normalizedSessionId, window);

    if (!anthropic) {
      res.json({ reply: fallbackReply(normalizedMessages) });
      return;
    }

    const catalogContext = await buildCatalogContext(normalizedMessages);
    const response = await anthropic.messages.create({
      model: BARBARA_MODEL,
      max_tokens: 500,
      temperature: 0.35,
      system: buildSystemPrompt(catalogContext),
      messages: normalizedMessages.map((message) => ({ role: message.role, content: message.content })),
    });

    const reply = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { type: "text"; text: string }).text)
      .join("\n")
      .trim();

    res.json({ reply: reply || fallbackReply(normalizedMessages) });
  } catch (error) {
    console.error("[Barbara] Erreur de génération:", error);
    res.status(500).json({ error: "Barbara est momentanément indisponible. Réessayez dans quelques instants." });
  }
});
