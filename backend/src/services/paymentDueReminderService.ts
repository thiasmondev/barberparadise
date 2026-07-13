/**
 * Service de relances automatiques pour les commandes/brouillons avec une date d'échéance de paiement.
 *
 * Logique des 3 relances (délais configurables en haut de fichier) :
 *   Stage 1 — Rappel préventif : envoyé DAYS_BEFORE_DUE_STAGE1 jours avant l'échéance
 *   Stage 2 — Jour J          : envoyé le jour de l'échéance (ou le lendemain si manqué)
 *   Stage 3 — Retard          : envoyé DAYS_AFTER_DUE_STAGE3 jours après l'échéance si toujours impayé
 *
 * Contraintes :
 *   - Aucune annulation automatique, quel que soit le retard
 *   - paidAmount / statut principal jamais modifiés ici
 *   - Chaque relance est tracée dans les notes internes de la commande
 */

import cron from "node-cron";
import crypto from "crypto";
import { prisma } from "../utils/prisma";
import { getFrontendUrl } from "../utils/frontendUrl";
import { sendPaymentDueReminderEmail } from "./emailService";
import type { PaymentDueReminderStage } from "../emails/paymentDueReminderEmail";

// ─── HELPERS TOKEN (dupliqués ici pour éviter une dépendance circulaire avec admin.ts) ──────────
const DRAFT_SHARE_EXPIRY_DAYS = 7;

function hashDraftShareToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getDraftShareExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + DRAFT_SHARE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

function createDraftShareRawToken(orderId: string, expiresAt: Date): string {
  const payload = `${orderId}.${expiresAt.getTime()}`;
  const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || "barber-paradise-draft-share";
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}
// ─────────────────────────────────────────────────────────────────────────────────────────────

// ─── DÉLAIS CONFIGURABLES ─────────────────────────────────────────────────────
/** Nombre de jours AVANT l'échéance pour envoyer la relance préventive (stage 1) */
const DAYS_BEFORE_DUE_STAGE1 = 3;
/** Nombre de jours APRÈS l'échéance pour envoyer la relance de retard (stage 3) */
const DAYS_AFTER_DUE_STAGE3 = 3;
// ─────────────────────────────────────────────────────────────────────────────

let scheduled = false;

function buildResumeUrl(orderId: string, now: Date): { resumeUrl: string; tokenHash: string; expiresAt: Date } {
  const existingExpiresAt: Date | null = null; // Le service n'a pas accès au token existant sans requête supplémentaire
  const expiresAt = existingExpiresAt || getDraftShareExpiresAt(now);
  const rawToken = createDraftShareRawToken(orderId, expiresAt);
  const tokenHash = hashDraftShareToken(rawToken);
  const resumeUrl = `${getFrontendUrl()}/commande?draftToken=${encodeURIComponent(rawToken)}`;
  return { resumeUrl, tokenHash, expiresAt };
}

function formatDateFr(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getStageLabel(stage: PaymentDueReminderStage): string {
  switch (stage) {
    case 1: return `J-${DAYS_BEFORE_DUE_STAGE1} avant échéance`;
    case 2: return "Jour J (échéance)";
    case 3: return `J+${DAYS_AFTER_DUE_STAGE3} après échéance`;
  }
}

/**
 * Détermine le prochain stage de relance à envoyer pour une commande donnée.
 * Retourne null si aucune relance n'est due.
 */
export function getNextPaymentReminderStage(
  order: { paymentDueDate: Date; paymentReminderStage: number },
  now = new Date()
): PaymentDueReminderStage | null {
  const dueMs = order.paymentDueDate.getTime();
  const nowMs = now.getTime();
  const msPerDay = 24 * 60 * 60 * 1000;

  // Stage 1 : J-DAYS_BEFORE_DUE_STAGE1 avant l'échéance (ou plus tôt si déjà passé)
  if (order.paymentReminderStage < 1 && nowMs >= dueMs - DAYS_BEFORE_DUE_STAGE1 * msPerDay) {
    return 1;
  }
  // Stage 2 : Jour J (ou lendemain si manqué)
  if (order.paymentReminderStage < 2 && nowMs >= dueMs) {
    return 2;
  }
  // Stage 3 : J+DAYS_AFTER_DUE_STAGE3 après l'échéance
  if (order.paymentReminderStage < 3 && nowMs >= dueMs + DAYS_AFTER_DUE_STAGE3 * msPerDay) {
    return 3;
  }
  return null;
}

/**
 * Job principal : vérifie toutes les commandes/brouillons en attente avec une échéance définie
 * et envoie les relances dues.
 */
export async function runPaymentDueReminderJob(now = new Date()): Promise<{
  checked: number;
  sent: number;
  failed: number;
  skipped: number;
}> {
  // Sélectionner les commandes éligibles :
  // - statut draft ou pending_payment ou pending (commandes en attente de paiement)
  // - paymentDueDate défini
  // - paymentReminderStage < 3 (pas encore toutes les relances envoyées)
  const orders = await prisma.order.findMany({
    where: {
      status: { in: ["draft", "pending", "pending_payment"] },
      paymentDueDate: { not: null },
      paymentReminderStage: { lt: 3 },
    },
    include: { items: true, customer: true },
    orderBy: { paymentDueDate: "asc" },
    take: 200,
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const order of orders) {
    if (!order.paymentDueDate) continue;

    const stage = getNextPaymentReminderStage(
      { paymentDueDate: order.paymentDueDate, paymentReminderStage: order.paymentReminderStage },
      now
    );
    if (!stage) {
      skipped += 1;
      continue;
    }

    const email = (order.email || order.customerEmail || order.customer?.email || "").trim();
    if (!email || !email.includes("@")) {
      console.warn(`[payment-due-reminders] Commande ${order.orderNumber} sans email — relance ignorée.`);
      skipped += 1;
      continue;
    }

    // Générer un nouveau rawToken (le hash stocké ne peut jamais être envoyé au client)
    const { resumeUrl, tokenHash, expiresAt } = buildResumeUrl(order.id, now);
    // Mettre à jour le token de partage en base avant l'envoi
    await prisma.order.update({
      where: { id: order.id },
      data: { draftShareTokenHash: tokenHash, draftShareExpiresAt: expiresAt, draftShareConvertedAt: null },
    });

    const customerName = [order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(" ") || email;

    const result = await sendPaymentDueReminderEmail({
      to: email,
      customerName,
      orderNumber: order.orderNumber,
      resumeUrl,
      expiresAt,
      dueDate: order.paymentDueDate,
      stage,
      items: order.items.map((item) => ({ name: item.name, quantity: item.quantity, price: item.price })),
      total: order.totalTTC || order.total,
    });

    if (result.sent || result.skipped) {
      const stageLabel = getStageLabel(stage);
      const dueDateLabel = formatDateFr(order.paymentDueDate);
      const noteEntry = `[Relance paiement envoyée — ${stageLabel} — Échéance : ${dueDateLabel} — ${now.toLocaleDateString("fr-FR")} ${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}]`;

      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentReminderStage: stage,
          lastPaymentReminderAt: now,
          notes: order.notes ? `${order.notes}\n${noteEntry}` : noteEntry,
        },
      });

      sent += 1;
      console.log(`[payment-due-reminders] Relance stage ${stage} envoyée à ${email} pour commande ${order.orderNumber}.`);
    } else {
      failed += 1;
      console.error(`[payment-due-reminders] Échec relance stage ${stage} à ${email} pour commande ${order.orderNumber}.`);
    }
  }

  console.log(
    `[payment-due-reminders] Job terminé : ${orders.length} vérifiée(s), ${sent} envoyée(s), ${failed} échec(s), ${skipped} ignorée(s).`
  );
  return { checked: orders.length, sent, failed, skipped };
}

/**
 * Planifie le job de relance une fois par jour à 9h00 (heure de Paris).
 *
 * IMPORTANT — Fiabilité sur Render :
 * Ce scheduler est in-process (node-cron). Si le service Render redémarre entre 8h55 et 9h05,
 * l'exécution de ce jour est silencieusement manquée (node-cron ne rattrape pas les échéances passées).
 *
 * RECOMMANDATION : utiliser un déclencheur externe fiable :
 *   - VPS Hermès (cron existant) : curl -X POST https://[backend]/api/cron/payment-due-reminders -H "Authorization: Bearer $CRON_SECRET"
 *   - Render Cron Jobs (si disponible sur le plan) : même URL
 *
 * Pour désactiver le scheduler in-process et ne dépendre que du déclencheur externe :
 *   Définir DISABLE_INTERNAL_CRON=true dans les variables d'environnement Render.
 */
export function schedulePaymentDueReminderJob(): void {
  if (scheduled) return;

  if (process.env.DISABLE_INTERNAL_CRON === "true") {
    console.log("[payment-due-reminders] Scheduler in-process désactivé (DISABLE_INTERNAL_CRON=true). Déclenchement externe attendu via POST /api/cron/payment-due-reminders.");
    scheduled = true;
    return;
  }

  cron.schedule(
    "0 9 * * *",
    async () => {
      try {
        await runPaymentDueReminderJob();
      } catch (error) {
        console.error("[payment-due-reminders] Erreur job quotidien :", error);
      }
    },
    { timezone: process.env.TZ || "Europe/Paris" }
  );
  scheduled = true;
  console.log("[payment-due-reminders] Relances automatiques planifiées tous les jours à 9h00 (Europe/Paris). Pour un déclenchement externe fiable, définir DISABLE_INTERNAL_CRON=true.");
}
