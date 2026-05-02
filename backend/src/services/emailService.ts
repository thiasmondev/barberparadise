import { Resend } from "resend";
import { orderConfirmationEmail } from "../emails/orderConfirmation";
import { orderShippedEmail } from "../emails/orderShipped";
import { passwordResetEmail } from "../emails/passwordResetEmail";
import { welcomeEmail } from "../emails/welcomeEmail";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const fromEmail = process.env.FROM_EMAIL || "noreply@barberparadise.fr";

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail(params: SendEmailParams): Promise<{ sent: boolean; skipped?: boolean; id?: string }> {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY absente, email non envoyé à ${params.to}: ${params.subject}`);
    return { sent: false, skipped: true };
  }

  try {
    const response = await resend.emails.send({
      from: `Barber Paradise <${fromEmail}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    if (response.error) {
      console.error("[email] Erreur Resend", response.error);
      return { sent: false };
    }

    return { sent: true, id: response.data?.id };
  } catch (error) {
    console.error("[email] Envoi impossible", error);
    return { sent: false };
  }
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

export async function sendOrderConfirmationEmail(params: Parameters<typeof orderConfirmationEmail>[0] & { to: string }) {
  return sendEmail({
    to: params.to,
    subject: `Confirmation de commande ${params.orderNumber}`,
    html: orderConfirmationEmail(params),
  });
}

export async function sendOrderShippedEmail(params: Parameters<typeof orderShippedEmail>[0] & { to: string }) {
  return sendEmail({
    to: params.to,
    subject: `Votre commande ${params.orderNumber} est en route`,
    html: orderShippedEmail(params),
  });
}
