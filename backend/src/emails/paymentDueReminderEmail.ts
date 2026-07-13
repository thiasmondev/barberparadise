import { emailLayout, escapeHtml, formatCurrency } from "./utils";

export type PaymentDueReminderStage = 1 | 2 | 3;

type PaymentDueReminderItem = { name: string; quantity: number; price: number };

function getStageConfig(stage: PaymentDueReminderStage, dueDate: Date): { title: string; subtitle: string; urgencyColor: string } {
  const dueDateLabel = dueDate.toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  switch (stage) {
    case 1:
      return {
        title: "RAPPEL : VOTRE COMMANDE ATTEND VOTRE PAIEMENT",
        subtitle: `Votre commande est en attente de paiement. La date d'échéance est fixée au <strong>${escapeHtml(dueDateLabel)}</strong>.`,
        urgencyColor: "#E91E8C",
      };
    case 2:
      return {
        title: "ÉCHÉANCE DE PAIEMENT AUJOURD'HUI",
        subtitle: `La date d'échéance de votre commande est <strong>aujourd'hui, ${escapeHtml(dueDateLabel)}</strong>. Finalisez votre paiement pour ne pas retarder votre livraison.`,
        urgencyColor: "#F59E0B",
      };
    case 3:
      return {
        title: "PAIEMENT EN RETARD — ACTION REQUISE",
        subtitle: `La date d'échéance de votre commande (${escapeHtml(dueDateLabel)}) est dépassée. Veuillez régulariser votre paiement dans les plus brefs délais ou contacter notre équipe.`,
        urgencyColor: "#EF4444",
      };
  }
}

export function getPaymentDueReminderSubject(stage: PaymentDueReminderStage, orderNumber: string): string {
  switch (stage) {
    case 1:
      return `Rappel : votre commande ${orderNumber} attend votre paiement`;
    case 2:
      return `Échéance aujourd'hui — Commande ${orderNumber} en attente de paiement`;
    case 3:
      return `Paiement en retard — Commande ${orderNumber} — Action requise`;
  }
}

export function paymentDueReminderEmail(params: {
  customerName: string;
  orderNumber: string;
  resumeUrl: string;
  expiresAt: Date;
  dueDate: Date;
  stage: PaymentDueReminderStage;
  items: PaymentDueReminderItem[];
  total: number;
}) {
  const { title, subtitle, urgencyColor } = getStageConfig(params.stage, params.dueDate);

  const rows = params.items
    .map(
      (item) => `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #2A2A2A;color:#FFFFFF;">${escapeHtml(item.name)}</td>
          <td style="padding:12px;border-bottom:1px solid #2A2A2A;color:#FFFFFF;text-align:center;">${item.quantity}</td>
          <td style="padding:12px;border-bottom:1px solid #2A2A2A;color:#FFFFFF;text-align:right;">${formatCurrency(item.price)}</td>
        </tr>`
    )
    .join("");

  const expiresAtLabel = `${params.expiresAt.toLocaleDateString("fr-FR")} à ${params.expiresAt.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;

  return emailLayout(`
    <tr>
      <td style="padding:32px;text-align:center;">
        <h2 style="color:${urgencyColor};margin:0 0 8px;font-size:20px;">${title}</h2>
        <p style="color:#A0A0A0;margin:0;line-height:1.6;">Bonjour ${escapeHtml(params.customerName)},</p>
        <p style="color:#A0A0A0;margin:8px 0 0;line-height:1.6;">${subtitle}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px 28px;text-align:center;">
        <a href="${escapeHtml(params.resumeUrl)}" style="display:inline-block;background:${urgencyColor};color:#FFFFFF;padding:14px 28px;border-radius:4px;text-decoration:none;font-weight:bold;letter-spacing:1.5px;">FINALISER MON PAIEMENT →</a>
        <p style="color:#A0A0A0;line-height:1.6;margin:18px 0 0;font-size:12px;">
          Ce lien personnel expire le ${escapeHtml(expiresAtLabel)}. Si vous avez une question, répondez simplement à cet email.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px 32px;">
        <table width="100%" style="background:#161616;border-radius:6px;border-collapse:collapse;">
          <tr>
            <td colspan="3" style="padding:16px;color:#A0A0A0;font-size:12px;letter-spacing:2px;">RÉCAPITULATIF ${escapeHtml(params.orderNumber)}</td>
          </tr>
          <tr>
            <th style="padding:12px;color:#A0A0A0;text-align:left;border-bottom:1px solid #2A2A2A;">Article</th>
            <th style="padding:12px;color:#A0A0A0;text-align:center;border-bottom:1px solid #2A2A2A;">Qté</th>
            <th style="padding:12px;color:#A0A0A0;text-align:right;border-bottom:1px solid #2A2A2A;">Prix</th>
          </tr>
          ${rows}
          <tr>
            <td colspan="2" style="padding:16px;color:#FFFFFF;font-weight:bold;text-align:right;">Total</td>
            <td style="padding:16px;color:${urgencyColor};font-weight:bold;text-align:right;">${formatCurrency(params.total)}</td>
          </tr>
        </table>
      </td>
    </tr>
  `);
}
