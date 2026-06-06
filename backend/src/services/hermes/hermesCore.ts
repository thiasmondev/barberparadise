import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";
import type { Response } from "express";

const prisma = new PrismaClient();

export type HermesModule = "content" | "campaigns" | "images" | "analytics" | null | undefined;

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

  return `Tu es Hermes, l'agent marketing IA de Barber Paradise (barberparadise.fr).
Barber Paradise vend des cosmétiques hommes et du matériel de barbier professionnel : tondeuses, ciseaux, produits barbe et cheveux.
Tu sers à la fois des clients B2C et des barbiers professionnels B2B en Europe.

Tu es un directeur marketing expert, créatif et orienté résultats. Tu t'exprimes en français, de manière professionnelle mais accessible.
Tu connais l'univers barbershop, les tendances, les marques professionnelles et les attentes e-commerce.

Quand on te demande de créer du contenu, tu proposes du contenu prêt à publier, optimisé SEO.
Quand on te demande une analyse, tu es précis, structuré et data-driven.
Quand on te demande une campagne, tu proposes un plan complet avec cible, objet, contenu, timing et KPIs attendus.

Tu peux utiliser ces commandes spéciales dans tes réponses, que l'interface affichera comme brouillons :
- [DRAFT:blog] ... [/DRAFT] pour créer un brouillon d'article de blog
- [DRAFT:social] ... [/DRAFT] pour créer un brouillon de post social
- [DRAFT:email] ... [/DRAFT] pour créer un brouillon d'email ou campagne
- [DRAFT:product] ... [/DRAFT] pour créer un brouillon de fiche produit

Réponds toujours en français.${moduleHint}`;
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
  return `Hermes est prêt, mais la clé DEEPSEEK_API_KEY n'est pas encore configurée côté serveur.\n\nMessage reçu : "${userMessage}"\n\nDès que la clé sera ajoutée dans Render, je pourrai répondre en streaming avec le modèle DeepSeek ${module ? `pour le module ${module}` : "pour le workspace marketing"}.`;
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

  try {
    if (!client) {
      fullResponse = fallbackResponse(userMessage, module);
      sendSse(res, { type: "chunk", content: fullResponse });
    } else {
      const stream = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: buildSystemPrompt(module) },
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
    await prisma.hermesMessage.create({
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

    if (!conversation.title && conversation.messages.length === 0) {
      generateTitle(conversation.id, userMessage).catch(console.error);
    }

    await prisma.hermesConversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    sendSse(res, { type: "done", conversationId: conversation.id, model, durationMs });
  } catch (error) {
    console.error("[HermesCore] Erreur streaming:", error);
    sendSse(res, { type: "error", message: "Erreur interne Hermes pendant la génération." });
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

  if (client) {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: buildSystemPrompt(module) },
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
  await prisma.hermesMessage.create({
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

  if (!conversation.title && conversation.messages.length === 0) {
    generateTitle(conversation.id, userMessage).catch(console.error);
  }

  await prisma.hermesConversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() },
  });

  return { conversationId: conversation.id, response: fullResponse, model, durationMs };
}

export const hermesCore = { chat, chatSync, buildSystemPrompt };
