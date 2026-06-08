import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";
import type { Response } from "express";
import contentEngine from "./modules/contentEngine";
import imageGenerator from "./modules/imageGenerator";
import analyticsModule from "./modules/analytics";

const prisma = new PrismaClient();

export type HermesModule = "content" | "campaigns" | "images" | "carousel" | "analytics" | null | undefined;

interface ChatBaseInput {
  conversationId?: string | null;
  userMessage: string;
  module?: HermesModule;
  usePro?: boolean;
  channel?: string;
}

interface ChatStreamInput extends ChatBaseInput {
  res: Response;
}

const modelFast = process.env.DEEPSEEK_MODEL_FAST || "deepseek-chat";
const modelPro = process.env.DEEPSEEK_MODEL_PRO || "deepseek-reasoner";
const deepseekBaseUrl = process.env.DEEPSEEK_API_BASE || "https://api.deepseek.com";

const client = process.env.DEEPSEEK_API_KEY
  ? new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: deepseekBaseUrl,
    })
  : null;

function buildSystemPrompt(module?: HermesModule): string {
  const moduleHint = module
    ? `\nModule actif : ${module}. Adapte tes recommandations à ce contexte métier.`
    : "";

  return `Tu es Buzz, l'agent marketing IA de Barber Paradise (barberparadise.fr).
Barber Paradise vend des cosmétiques hommes et du matériel de barbier professionnel : tondeuses, ciseaux, produits barbe et cheveux.
Tu sers à la fois des clients B2C et des barbiers professionnels B2B en Europe.

Tu es un directeur marketing expert, créatif et orienté résultats. Tu t'exprimes en français, de manière professionnelle mais accessible.
Tu connais l'univers barbershop, les tendances, les marques professionnelles et les attentes e-commerce.

Quand on te demande de créer du contenu, tu proposes du contenu prêt à publier, optimisé SEO.
Quand on te demande une analyse, tu es précis, structuré et data-driven.
Quand on te demande une campagne, tu proposes un plan complet avec cible, objet, contenu, timing et KPIs attendus.
Quand le module actif est carousel, tu proposes des carrousels prêts à intégrer sur la page d'accueil : titre court, sous-titre, CTA, URL cible, visuel desktop, visuel mobile, ordre recommandé, dates de diffusion et objectif business.

Tu peux utiliser ces commandes spéciales dans tes réponses, que l'interface affichera comme brouillons :
- [DRAFT:blog] ... [/DRAFT] pour créer un brouillon d'article de blog
- [DRAFT:social] ... [/DRAFT] pour créer un brouillon de post social
- [DRAFT:email] ... [/DRAFT] pour créer un brouillon d'email ou campagne
- [DRAFT:product] ... [/DRAFT] pour créer un brouillon de fiche produit

Tu peux aussi demander une génération visuelle avec ces blocs :
- [IMAGE:product] ... [/IMAGE] pour une image produit e-commerce
- [IMAGE:social] ... [/IMAGE] pour un visuel social media
- [IMAGE:banner] ... [/IMAGE] pour une bannière marketing
- [IMAGE:email] ... [/IMAGE] pour un visuel de campagne email
- [IMAGE:other] ... [/IMAGE] pour un autre visuel

Les prompts d'image doivent être précis, professionnels, en français ou anglais selon le rendu souhaité, et inclure le style, la lumière, le cadrage, les objets, les couleurs et le contexte Barber Paradise.

Réponds toujours en français.${moduleHint}`;
}

async function buildAnalyticsContext(module?: HermesModule): Promise<string | null> {
  if (module !== "analytics" && module !== "content" && module !== "campaigns" && module !== "carousel") return null;

  try {
    return await analyticsModule.getContextSummary();
  } catch (error) {
    console.error("[HermesCore] Contexte analytics indisponible:", error);
    return null;
  }
}

function sendSse(res: Response, payload: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function resolveConversation(conversationId?: string | null, channel = "workspace") {
  if (conversationId) {
    const existing = await prisma.hermesConversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: "asc" }, take: 50 } },
    });
    if (existing) return existing;
  }

  return prisma.hermesConversation.create({
    data: { channel },
    include: { messages: true },
  });
}

function fallbackResponse(userMessage: string, module?: HermesModule): string {
  return `Buzz est prêt, mais la clé DEEPSEEK_API_KEY n'est pas encore configurée côté serveur.\n\nMessage reçu : "${userMessage}"\n\nDès que la clé sera ajoutée dans Render, je pourrai répondre en streaming avec le modèle DeepSeek ${module ? `pour le module ${module}` : "pour le workspace marketing"}.`;
}

async function generateTitle(conversationId: string, userMessage: string): Promise<void> {
  const cleaned = userMessage.replace(/\s+/g, " ").trim();
  const title = cleaned.length > 58 ? `${cleaned.slice(0, 55)}...` : cleaned || "Nouvelle conversation";
  await prisma.hermesConversation.update({ where: { id: conversationId }, data: { title } });
}

export async function chat({ conversationId, userMessage, module, usePro = false, channel = "workspace", res }: ChatStreamInput): Promise<void> {
  const startTime = Date.now();
  const model = usePro ? modelPro : modelFast;
  const conversation = await resolveConversation(conversationId, channel);

  await prisma.hermesMessage.create({
    data: { conversationId: conversation.id, role: "user", content: userMessage },
  });

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const previousMessages = conversation.messages.map((message) => ({
    role: message.role as "user" | "assistant" | "system",
    content: message.content,
  }));

  let fullResponse = "";
  let tokensInput: number | undefined;
  let tokensOutput: number | undefined;
  const analyticsContext = await buildAnalyticsContext(module);

  try {
    if (!client) {
      fullResponse = fallbackResponse(userMessage, module);
      sendSse(res, { type: "chunk", content: fullResponse });
    } else {
      const stream = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: buildSystemPrompt(module) },
          ...(analyticsContext ? [{ role: "system" as const, content: analyticsContext }] : []),
          ...previousMessages,
          { role: "user", content: userMessage },
        ],
        max_tokens: 4096,
        temperature: 0.7,
        stream: true,
        stream_options: { include_usage: true },
      });

      for await (const part of stream) {
        const content = part.choices[0]?.delta?.content || "";
        if (content) {
          fullResponse += content;
          sendSse(res, { type: "chunk", content });
        }
        if (part.usage) {
          tokensInput = part.usage.prompt_tokens;
          tokensOutput = part.usage.completion_tokens;
        }
      }
    }

    const durationMs = Date.now() - startTime;
    const assistantMessage = await prisma.hermesMessage.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: fullResponse,
        module: module || null,
        model,
        tokensInput,
        tokensOutput,
        durationMs,
      },
    });

    const drafts = await contentEngine.extractAndSaveDrafts(
      fullResponse,
      conversation.id,
      assistantMessage.id
    );
    const images = await imageGenerator.extractAndGenerateImages(
      fullResponse,
      conversation.id,
      assistantMessage.id
    );

    if (!conversation.title && conversation.messages.length === 0) {
      generateTitle(conversation.id, userMessage).catch(console.error);
    }

    await prisma.hermesConversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    sendSse(res, { type: "done", conversationId: conversation.id, model, durationMs, drafts, images });
  } catch (error) {
    console.error("[HermesCore] Erreur streaming:", error);
    sendSse(res, { type: "error", message: "Erreur interne Buzz pendant la génération." });
  } finally {
    res.end();
  }
}

export async function chatSync({ conversationId, userMessage, module, usePro = false, channel = "workspace" }: ChatBaseInput) {
  const startTime = Date.now();
  const model = usePro ? modelPro : modelFast;
  const conversation = await resolveConversation(conversationId, channel);

  await prisma.hermesMessage.create({
    data: { conversationId: conversation.id, role: "user", content: userMessage },
  });

  const previousMessages = conversation.messages.map((message) => ({
    role: message.role as "user" | "assistant" | "system",
    content: message.content,
  }));

  let fullResponse = fallbackResponse(userMessage, module);
  let tokensInput: number | undefined;
  let tokensOutput: number | undefined;
  const analyticsContext = await buildAnalyticsContext(module);

  if (client) {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: buildSystemPrompt(module) },
        ...(analyticsContext ? [{ role: "system" as const, content: analyticsContext }] : []),
        ...previousMessages,
        { role: "user", content: userMessage },
      ],
      max_tokens: 4096,
      temperature: 0.7,
    });

    fullResponse = response.choices[0]?.message?.content || "";
    tokensInput = response.usage?.prompt_tokens;
    tokensOutput = response.usage?.completion_tokens;
  }

  const durationMs = Date.now() - startTime;
  const assistantMessage = await prisma.hermesMessage.create({
    data: {
      conversationId: conversation.id,
      role: "assistant",
      content: fullResponse,
      module: module || null,
      model,
      tokensInput,
      tokensOutput,
      durationMs,
    },
  });

  const drafts = await contentEngine.extractAndSaveDrafts(
    fullResponse,
    conversation.id,
    assistantMessage.id
  );
  const images = await imageGenerator.extractAndGenerateImages(
    fullResponse,
    conversation.id,
    assistantMessage.id
  );

  if (!conversation.title && conversation.messages.length === 0) {
    generateTitle(conversation.id, userMessage).catch(console.error);
  }

  await prisma.hermesConversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() },
  });

  return { conversationId: conversation.id, response: fullResponse, model, durationMs, drafts, images };
}

export const hermesCore = { chat, chatSync, buildSystemPrompt };
