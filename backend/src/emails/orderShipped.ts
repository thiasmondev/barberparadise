import { emailLayout, escapeHtml } from "./utils";

export function orderShippedEmail(params: {
  orderNumber: string;
  customerName: string;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  carrier?: string | null;
  estimatedDelivery?: string | null;
}): string {
  return emailLayout(`
    <tr>
      <td style="padding:32px;text-align:center;">
        <h2 style="color:#E91E8C;margin:0 0 8px;">VOTRE COMMANDE EST EN ROUTE 🚚</h2>
        <p style="color:#A0A0A0;">Bonjour ${escapeHtml(params.customerName)}, votre commande ${escapeHtml(params.orderNumber)} a été expédiée.</p>
      </td>
    </tr>
    ${params.trackingNumber ? `
    <tr>
      <td style="padding:0 32px 32px;text-align:center;">
        <table width="100%" style="background:#161616;border-radius:6px;">
          <tr><td style="padding:16px;color:#A0A0A0;font-size:12px;letter-spacing:2px;">TRANSPORTEUR</td><td style="padding:16px;color:#FFFFFF;text-align:right;">${escapeHtml(params.carrier || "Colissimo")}</td></tr>
          <tr><td style="padding:0 16px 16px;color:#A0A0A0;font-size:12px;letter-spacing:2px;">NUMÉRO DE SUIVI</td><td style="padding:0 16px 16px;color:#FFFFFF;text-align:right;">${escapeHtml(params.trackingNumber)}</td></tr>
          ${params.estimatedDelivery ? `<tr><td style="padding:0 16px 16px;color:#A0A0A0;font-size:12px;letter-spacing:2px;">LIVRAISON ESTIMÉE</td><td style="padding:0 16px 16px;color:#FFFFFF;text-align:right;">${escapeHtml(params.estimatedDelivery)}</td></tr>` : ""}
        </table>
        ${params.trackingUrl ? `<a href="${escapeHtml(params.trackingUrl)}" style="display:inline-block;margin-top:16px;background:#E91E8C;color:#FFFFFF;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:bold;letter-spacing:2px;">SUIVRE MA COMMANDE →</a>` : ""}
      </td>
    </tr>` : `
    <tr>
      <td style="padding:0 32px 32px;text-align:center;">
        <p style="color:#A0A0A0;margin:0;">Vous recevrez les informations de suivi dès qu’elles seront disponibles.</p>
      </td>
    </tr>`}
  `);
}
