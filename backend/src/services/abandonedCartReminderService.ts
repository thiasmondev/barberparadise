import crypto from "crypto";
import cron from "node-cron";
import { prisma } from "../utils/prisma";
import { sendAbandonedCartReminderEmail } from "./emailService";
import type { AbandonedCartReminderItem, AbandonedCartReminderStage } from "../emails/abandonedCartReminderEmail";

const RESTORE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const STAGE_ONE_DELAY_MS = 60 * 60 * 1000;
const STAGE_TWO_DELAY_MS = 24 * 60 * 60 * 1000;
const STAGE_THREE_DELAY_MS = 72 * 60 * 60 * 1000;

type ReminderTokenPurpose = "restore" | "unsubscribe";

type ReminderTokenPayload = {
  sid: string;
  purpose: ReminderTokenPurpose;
  exp: number;
};

let scheduled = false;

function getFrontendUrl(): string {
  return (process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "https://barberparadise.fr").replace(/\/$/, "");
}

function getTokenSecret(): string {
  return process.env.ABANDONED_CART_TOKEN_SECRET || process.env.JWT_SECRET || process.env.SESSION_SECRET || "barber-paradise-abandoned-cart-dev-secret";
}

function base64urlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64urlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getTokenSecret()).update(value).digest("base64url");
}

export function createAbandonedCartToken(sessionId: string, purpose: ReminderTokenPurpose, ttlMs = RESTORE_TOKEN_TTL_MS): string {
  const payload: ReminderTokenPayload = {
    sid: sessionId,
    purpose,
    exp: Date.now() + ttlMs,
  };
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyAbandonedCartToken(token: string, purpose: ReminderTokenPurpose): ReminderTokenPayload | null {
  const [encodedPayload, signature] = String(token || "").split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = sign(encodedPayload);
  const given = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;

  try {
    const payload = JSON.parse(base64urlDecode(encodedPayload)) as ReminderTokenPayload;
    if (!payload || payload.purpose !== purpose || typeof payload.sid !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function buildAbandonedCartRestoreUrl(sessionId: string): string {
  const token = createAbandonedCartToken(sessionId, "restore");
  return `${getFrontendUrl()}/panier/restore?token=${encodeURIComponent(token)}`;
}

export function buildAbandonedCartUnsubscribeUrl(sessionId: string): string {
  const token = createAbandonedCartToken(sessionId, "unsubscribe");
  return `${getFrontendUrl()}/panier/restore?unsubscribe=${encodeURIComponent(token)}`;
}

export function normalizeAbandonedCartItems(items: unknown): AbandonedCartReminderItem[] {
  if (!Array.isArray(items)) return [];

  const normalized: AbandonedCartReminderItem[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const source = item as Record<string, unknown>;
    const name = typeof source.name === "string" ? source.name : "Produit Barber Paradise";
    const quantity = Number.isFinite(Number(source.quantity)) ? Math.max(1, Math.floor(Number(source.quantity))) : 1;
    const price = Number.isFinite(Number(source.price)) ? Number(source.price) : 0;
    const image = typeof source.image === "string" ? source.image : typeof source.imageUrl === "string" ? source.imageUrl : undefined;
    normalized.push({ name, quantity, price, image });
  }
  return normalized;
}

export function getNextReminderStage(cart: { reminderStage: number; lastSeenAt: Date }, now = new Date()): AbandonedCartReminderStage | null {
  const ageMs = now.getTime() - cart.lastSeenAt.getTime();
  if (cart.reminderStage === 0 && ageMs >= STAGE_ONE_DELAY_MS) return 1;
  if (cart.reminderStage === 1 && ageMs >= STAGE_TWO_DELAY_MS) return 2;
  if (cart.reminderStage === 2 && ageMs >= STAGE_THREE_DELAY_MS) return 3;
  return null;
}

async function markConvertedIfOrderExists(cart: { id: string; email: string | null; convertedAt: Date | null; createdAt: Date }): Promise<boolean> {
  if (cart.convertedAt) return true;
  if (!cart.email) return false;

  const order = await prisma.order.findFirst({
    where: {
      OR: [{ email: cart.email }, { customerEmail: cart.email }],
      status: { not: "draft" },
      createdAt: { gte: cart.createdAt },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, createdAt: true },
  });

  if (!order) return false;

  await prisma.abandonedCartSession.update({
    where: { id: cart.id },
    data: { convertedOrderId: order.id, convertedAt: order.createdAt, itemCount: 0 },
  });
  console.log(`[abandoned-cart-reminders] Session ${cart.id} marquée convertie via commande ${order.id}.`);
  return true;
}

export async function runAbandonedCartReminderJob(now = new Date()): Promise<{ checked: number; sent: number; failed: number; converted: number }> {
  const carts = await prisma.abandonedCartSession.findMany({
    where: {
      convertedAt: null,
      unsubscribed: false,
      itemCount: { gt: 0 },
      email: { not: null },
      reminderStage: { lt: 3 },
    },
    orderBy: { lastSeenAt: "asc" },
    take: 100,
  });

  let sent = 0;
  let failed = 0;
  let converted = 0;

  for (const cart of carts) {
    const wasConverted = await markConvertedIfOrderExists(cart);
    if (wasConverted) {
      converted += 1;
      continue;
    }

    const stage = getNextReminderStage(cart, now);
    if (!stage || !cart.email) continue;

    const items = normalizeAbandonedCartItems(cart.items);
    if (items.length === 0) continue;

    const restoreUrl = buildAbandonedCartRestoreUrl(cart.id);
    const unsubscribeUrl = buildAbandonedCartUnsubscribeUrl(cart.id);
    const result = await sendAbandonedCartReminderEmail({
      to: cart.email,
      stage,
      restoreUrl,
      unsubscribeUrl,
      items,
      total: cart.total,
    });

    if (result.sent) {
      await prisma.abandonedCartSession.update({
        where: { id: cart.id },
        data: { reminderStage: stage, lastReminderAt: now },
      });
      sent += 1;
      console.log(`[abandoned-cart-reminders] Email ${stage} envoyé à ${cart.email} pour la session ${cart.id} via Resend (${result.id || "sans id"}).`);
    } else {
      failed += 1;
      console.error(`[abandoned-cart-reminders] Échec email ${stage} à ${cart.email} pour la session ${cart.id}.`);
    }
  }

  console.log(`[abandoned-cart-reminders] Job terminé: ${carts.length} vérifié(s), ${sent} envoyé(s), ${failed} échec(s), ${converted} converti(s).`);
  return { checked: carts.length, sent, failed, converted };
}

export function scheduleAbandonedCartReminderJob(): void {
  if (scheduled) return;

  cron.schedule("0 * * * *", async () => {
    try {
      await runAbandonedCartReminderJob();
    } catch (error) {
      console.error("[abandoned-cart-reminders] Erreur job horaire:", error);
    }
  }, { timezone: process.env.TZ || "Europe/Paris" });

  scheduled = true;
  console.log("[abandoned-cart-reminders] Relance automatique planifiée toutes les heures.");
}
