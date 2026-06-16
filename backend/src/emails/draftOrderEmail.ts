import { emailLayout, escapeHtml, formatCurrency } from "./utils";

type DraftOrderEmailItem = { name: string; quantity: number; price: number };

export function draftOrderEmail(params: {
  customerName: string;
  orderNumber: string;
  resumeUrl: string;
  expiresAt: Date;
  items: DraftOrderEmailItem[];
  total: number;
}) {
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
        <h2 style="color:#E91E8C;margin:0 0 8px;font-size:20px;">VOTRE COMMANDE EST PRÊTE</h2>
        <p style="color:#A0A0A0;margin:0;line-height:1.6;">Bonjour ${escapeHtml(params.customerName)}, votre commande préparée par l’équipe Barber Paradise est disponible en ligne.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px 28px;text-align:center;">
        <p style="color:#A0A0A0;line-height:1.6;margin:0 0 24px;">
          Vous pouvez la vérifier, modifier les quantités, ajouter ou supprimer des articles, puis finaliser votre paiement en toute sécurité.
        </p>
        <a href="${escapeHtml(params.resumeUrl)}" style="display:inline-block;background:#E91E8C;color:#FFFFFF;padding:14px 28px;border-radius:4px;text-decoration:none;font-weight:bold;letter-spacing:1.5px;">FINALISER OU MODIFIER MA COMMANDE →</a>
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
            <td colspan="2" style="padding:16px;color:#FFFFFF;font-weight:bold;text-align:right;">Total estimé</td>
            <td style="padding:16px;color:#E91E8C;font-weight:bold;text-align:right;">${formatCurrency(params.total)}</td>
          </tr>
        </table>
      </td>
    </tr>
  `);
}
