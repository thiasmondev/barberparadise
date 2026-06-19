import { sendResendEmailOnly, formatPaymentMethod } from "./emailService";
import { OFFICIAL_FRONTEND_URL } from "../utils/frontendUrl";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderItem = {
  name: string;
  quantity: number;
};

type AdminNotificationPayload = {
  orderId: string;
  orderNumber: string;
  createdAt: Date;
  customerName: string;
  customerEmail: string;
  isB2B: boolean;
  items: OrderItem[];
  totalTTC: number;
  paymentMethod: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(date);
}

// ─── Email admin ──────────────────────────────────────────────────────────────

function buildAdminEmailHtml(payload: AdminNotificationPayload): string {
  const adminUrl = `${OFFICIAL_FRONTEND_URL}/admin/commandes/${payload.orderId}`;
  const customerType = payload.isB2B ? "B2B (professionnel)" : "B2C (particulier)";
  const paymentLabel = formatPaymentMethod(payload.paymentMethod);

  const itemsRows = payload.items
    .map(
      (item) =>
        `<tr>
          <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;">${item.name}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">${item.quantity}</td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Nouvelle commande ${payload.orderNumber}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#1a1a1a;padding:24px 32px;">
            <p style="margin:0;color:#ffffff;font-size:20px;font-weight:bold;">🛒 Nouvelle commande</p>
            <p style="margin:4px 0 0;color:#aaaaaa;font-size:14px;">${payload.orderNumber}</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <!-- Infos commande -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="width:50%;vertical-align:top;">
                  <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;">Commande</p>
                  <p style="margin:0;font-size:16px;font-weight:bold;color:#1a1a1a;">${payload.orderNumber}</p>
                </td>
                <td style="width:50%;vertical-align:top;text-align:right;">
                  <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;">Date</p>
                  <p style="margin:0;font-size:14px;color:#1a1a1a;">${formatDateTime(payload.createdAt)}</p>
                </td>
              </tr>
            </table>

            <!-- Client -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:6px;padding:16px;margin-bottom:24px;">
              <tr>
                <td>
                  <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:#888;font-weight:bold;">Client</p>
                  <p style="margin:0;font-size:15px;font-weight:bold;color:#1a1a1a;">${payload.customerName}</p>
                  <p style="margin:2px 0 0;font-size:14px;color:#555;">${payload.customerEmail}</p>
                  <p style="margin:6px 0 0;display:inline-block;background:${payload.isB2B ? "#dbeafe" : "#dcfce7"};color:${payload.isB2B ? "#1d4ed8" : "#166534"};font-size:12px;font-weight:bold;padding:2px 8px;border-radius:4px;">${customerType}</p>
                </td>
              </tr>
            </table>

            <!-- Articles -->
            <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:#888;font-weight:bold;">Articles</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f0f0f0;border-radius:6px;overflow:hidden;margin-bottom:24px;">
              <tr style="background:#f9f9f9;">
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#888;font-weight:bold;text-transform:uppercase;">Produit</th>
                <th style="padding:8px 12px;text-align:center;font-size:12px;color:#888;font-weight:bold;text-transform:uppercase;">Qté</th>
              </tr>
              ${itemsRows}
            </table>

            <!-- Montant & paiement -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td style="width:50%;vertical-align:top;">
                  <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;">Mode de paiement</p>
                  <p style="margin:0;font-size:14px;color:#1a1a1a;">${paymentLabel}</p>
                </td>
                <td style="width:50%;vertical-align:top;text-align:right;">
                  <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#888;">Total TTC</p>
                  <p style="margin:0;font-size:22px;font-weight:bold;color:#1a1a1a;">${formatPrice(payload.totalTTC)}</p>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <div style="text-align:center;">
              <a href="${adminUrl}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:14px 32px;border-radius:6px;">Voir la commande dans l'admin →</a>
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:12px;color:#aaa;text-align:center;">Notification interne Barber Paradise — Ne pas répondre à cet email</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendAdminEmailNotification(payload: AdminNotificationPayload): Promise<void> {
  const to = process.env.ADMIN_NOTIFICATION_EMAIL || "barberparadiseoff@gmail.com";
  const totalFormatted = formatPrice(payload.totalTTC);
  const subject = `🛒 Nouvelle commande ${payload.orderNumber} — ${totalFormatted}`;

  const result = await sendResendEmailOnly({
    to,
    subject,
    html: buildAdminEmailHtml(payload),
  });

  if (result.sent) {
    console.log(`[admin-notif] Email envoyé à ${to} pour ${payload.orderNumber} (id: ${result.id})`);
  } else {
    console.warn(`[admin-notif] Email non envoyé pour ${payload.orderNumber} (skipped: ${result.skipped})`);
  }
}

// ─── Telegram admin ───────────────────────────────────────────────────────────

async function sendAdminTelegramNotification(payload: AdminNotificationPayload): Promise<void> {
  // Priorité : variables dédiées ADMIN_TELEGRAM_*, fallback sur les variables Hermes
  const botToken =
    process.env.ADMIN_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  const chatId =
    process.env.ADMIN_TELEGRAM_CHAT_ID || process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn("[admin-notif] Telegram non configuré (ADMIN_TELEGRAM_BOT_TOKEN / ADMIN_TELEGRAM_CHAT_ID manquants).");
    return;
  }

  const adminUrl = `${OFFICIAL_FRONTEND_URL}/admin/commandes/${payload.orderId}`;
  const customerType = payload.isB2B ? "B2B" : "B2C";
  const paymentLabel = formatPaymentMethod(payload.paymentMethod);
  const totalFormatted = formatPrice(payload.totalTTC);

  const itemLines = payload.items
    .map((item) => `  - ${item.name} × ${item.quantity}`)
    .join("\n");

  const message = [
    `🛒 <b>Nouvelle commande !</b>`,
    ``,
    `📦 <b>${payload.orderNumber}</b>`,
    `👤 ${payload.customerName} (${payload.customerEmail})`,
    `🏷️ ${customerType}`,
    `💰 <b>${totalFormatted}</b> TTC`,
    `💳 ${paymentLabel}`,
    ``,
    `<b>Articles :</b>`,
    itemLines,
    ``,
    `🔗 <a href="${adminUrl}">${adminUrl}</a>`,
  ].join("\n");

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[admin-notif] Erreur Telegram HTTP ${response.status}:`, errorText.slice(0, 200));
  } else {
    console.log(`[admin-notif] Telegram envoyé pour ${payload.orderNumber}`);
  }
}

// ─── Export principal ─────────────────────────────────────────────────────────

/**
 * Notifie l'admin (email + Telegram) d'une nouvelle commande en ligne payée.
 * Non bloquant : les erreurs sont loggées mais ne propagent pas d'exception.
 * À appeler uniquement pour channel !== "pos" et changed === true.
 */
export async function notifyAdminNewOrder(payload: AdminNotificationPayload): Promise<void> {
  // Email — try/catch indépendant
  try {
    await sendAdminEmailNotification(payload);
  } catch (error) {
    console.error("[admin-notif] Erreur envoi email admin:", error instanceof Error ? error.message : error);
  }

  // Telegram — try/catch indépendant
  try {
    await sendAdminTelegramNotification(payload);
  } catch (error) {
    console.error("[admin-notif] Erreur envoi Telegram admin:", error instanceof Error ? error.message : error);
  }
}
