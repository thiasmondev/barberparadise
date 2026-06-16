import { Resend } from "resend";
import { BrevoClient } from "@getbrevo/brevo";
import { orderConfirmationEmail } from "../emails/orderConfirmation";
import { orderShippedEmail } from "../emails/orderShipped";
import { passwordResetEmail } from "../emails/passwordResetEmail";
import { welcomeEmail } from "../emails/welcomeEmail";
import { stockAlertEmail } from "../emails/stockAlert";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const brevo = process.env.BREVO_API_KEY ? new BrevoClient({ apiKey: process.env.BREVO_API_KEY }) : null;
const fromEmail = process.env.FROM_EMAIL || process.env.RESEND_FROM_EMAIL || process.env.BREVO_SENDER_EMAIL || "noreply@barberparadise.fr";
const fromName = process.env.FROM_NAME || process.env.BREVO_SENDER_NAME || "Barber Paradise";

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: string }>;
};

function getEmailProvidersStatus(): string {
  const providers: string[] = [];
  if (resend) providers.push("Resend");
  if (brevo) providers.push("Brevo");
  return providers.length ? providers.join(" puis ") : "aucun fournisseur configuré";
}

async function sendWithResend(params: SendEmailParams): Promise<{ sent: boolean; id?: string }> {
  if (!resend) return { sent: false };

  try {
    const response = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
      attachments: params.attachments,
    });

    if (response.error) {
      console.error("[email] Erreur Resend", response.error);
      return { sent: false };
    }

    return { sent: true, id: response.data?.id };
  } catch (error) {
    console.error("[email] Envoi Resend impossible", error);
    return { sent: false };
  }
}

async function sendWithBrevo(params: SendEmailParams): Promise<{ sent: boolean; id?: string }> {
  if (!brevo) return { sent: false };

  try {
    const response = await brevo.transactionalEmails.sendTransacEmail({
      sender: { name: fromName, email: fromEmail },
      to: [{ email: params.to }],
      subject: params.subject,
      htmlContent: params.html,
      attachment: params.attachments?.map((attachment) => ({
        name: attachment.filename,
        content: attachment.content,
      })),
      tags: ["barber-paradise", "transactional"],
    });
    const data = (response as any).data ?? response;
    const id = data?.messageId || data?.id;
    return { sent: true, id: id ? String(id) : undefined };
  } catch (error) {
    console.error("[email] Envoi Brevo impossible", error);
    return { sent: false };
  }
}

export async function sendEmail(params: SendEmailParams): Promise<{ sent: boolean; skipped?: boolean; id?: string; provider?: string }> {
  if (!resend && !brevo) {
    console.warn(`[email] Aucun fournisseur configuré, email non envoyé à ${params.to}: ${params.subject}`);
    return { sent: false, skipped: true };
  }

  const resendResult = await sendWithResend(params);
  if (resendResult.sent) return { ...resendResult, provider: "resend" };

  const brevoResult = await sendWithBrevo(params);
  if (brevoResult.sent) return { ...brevoResult, provider: "brevo" };

  console.error(`[email] Aucun envoi réussi pour ${params.to}: ${params.subject}. Fournisseurs disponibles: ${getEmailProvidersStatus()}`);
  return { sent: false };
}

export function formatPaymentMethod(method?: string | null): string {
  switch ((method || "").toLowerCase()) {
    case "card":
    case "stripe":
      return "Carte bancaire";
    case "paypal":
    case "paypal_4x":
      return "PayPal 4x sans frais";
    case "bank_transfer":
    case "bank-transfer":
    case "virement":
      return "Virement bancaire";
    case "b2b_deferred":
      return "Paiement différé B2B";
    default:
      return method || "Non renseignée";
  }
}

export function getCustomerName(customer?: { firstName?: string | null; lastName?: string | null } | null, fallbackEmail?: string | null): string {
  const fullName = `${customer?.firstName ?? ""} ${customer?.lastName ?? ""}`.trim();
  return fullName || fallbackEmail || "client";
}

export async function sendWelcomeEmail(params: { to: string; customerName: string; catalogueUrl?: string }) {
  return sendEmail({
    to: params.to,
    subject: "Bienvenue chez Barber Paradise",
    html: welcomeEmail({ customerName: params.customerName, catalogueUrl: params.catalogueUrl }),
  });
}

export async function sendPasswordResetEmail(params: { to: string; customerName: string; resetUrl: string; expiresInMinutes?: number }) {
  return sendEmail({
    to: params.to,
    subject: "Réinitialisation de votre mot de passe Barber Paradise",
    html: passwordResetEmail(params),
  });
}

export async function sendOrderConfirmationEmail(params: Parameters<typeof orderConfirmationEmail>[0] & { to: string; attachments?: Array<{ filename: string; content: string }> }) {
  return sendEmail({
    to: params.to,
    subject: `Confirmation de commande ${params.orderNumber}`,
    html: orderConfirmationEmail(params),
    attachments: params.attachments,
  });
}

export async function sendOrderShippedEmail(params: Parameters<typeof orderShippedEmail>[0] & { to: string }) {
  return sendEmail({
    to: params.to,
    subject: `Votre commande ${params.orderNumber} est en route`,
    html: orderShippedEmail(params),
  });
}

export async function sendStockAlertEmail(params: Parameters<typeof stockAlertEmail>[0] & { to: string }) {
  return sendEmail({
    to: params.to,
    subject: `Bonne nouvelle ! ${params.productName} est de retour en stock 🎉`,
    html: stockAlertEmail(params),
  });
}
