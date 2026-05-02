import { emailLayout, escapeHtml, formatAddress, formatCurrency } from "./utils";

export function orderConfirmationEmail(params: {
  orderNumber: string;
  customerName: string;
  items: { name: string; quantity: number; price: number; image?: string | null }[];
  totalHT: number;
  vatAmount: number;
  totalTTC: number;
  shippingCost: number;
  shippingAddress: any;
  paymentMethod: string;
}): string {
  const itemsHtml = params.items.map(item => `
    <tr>
      <td style="padding:12px;border-bottom:1px solid #2A2A2A;color:#FFFFFF;">
        ${item.image ? `<img src="${escapeHtml(item.image)}" width="44" height="44" alt="" style="vertical-align:middle;border-radius:4px;margin-right:10px;object-fit:cover;">` : ""}
        ${escapeHtml(item.name)}
      </td>
      <td style="padding:12px;border-bottom:1px solid #2A2A2A;color:#FFFFFF;text-align:center;">${item.quantity}</td>
      <td style="padding:12px;border-bottom:1px solid #2A2A2A;color:#FFFFFF;text-align:right;">${formatCurrency(item.price * item.quantity)}</td>
    </tr>
  `).join("");

  return emailLayout(`
    <tr>
      <td style="padding:32px;text-align:center;">
        <h2 style="color:#E91E8C;margin:0 0 8px;font-size:20px;">COMMANDE CONFIRMÉE ✓</h2>
        <p style="color:#A0A0A0;margin:0;">Bonjour ${escapeHtml(params.customerName)}, votre commande a bien été reçue.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px 24px;">
        <table width="100%" style="background:#161616;border-radius:6px;">
          <tr>
            <td style="padding:16px;color:#A0A0A0;font-size:12px;letter-spacing:2px;">NUMÉRO DE COMMANDE</td>
            <td style="padding:16px;color:#FFFFFF;font-weight:bold;text-align:right;">${escapeHtml(params.orderNumber)}</td>
          </tr>
          <tr>
            <td style="padding:0 16px 16px;color:#A0A0A0;font-size:12px;letter-spacing:2px;">PAIEMENT</td>
            <td style="padding:0 16px 16px;color:#FFFFFF;text-align:right;">${escapeHtml(params.paymentMethod)}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px 24px;">
        <p style="color:#A0A0A0;font-size:12px;letter-spacing:2px;margin:0 0 12px;">RÉCAPITULATIF</p>
        <table width="100%" style="border-collapse:collapse;">${itemsHtml}</table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px 24px;">
        <table width="100%" style="background:#161616;border-radius:6px;padding:16px;">
          <tr><td style="padding:8px 16px;color:#A0A0A0;">Sous-total HT</td><td style="padding:8px 16px;color:#FFFFFF;text-align:right;">${formatCurrency(params.totalHT)}</td></tr>
          <tr><td style="padding:8px 16px;color:#A0A0A0;">TVA (20%)</td><td style="padding:8px 16px;color:#FFFFFF;text-align:right;">${formatCurrency(params.vatAmount)}</td></tr>
          <tr><td style="padding:8px 16px;color:#A0A0A0;">Livraison</td><td style="padding:8px 16px;color:#FFFFFF;text-align:right;">${params.shippingCost === 0 ? "Gratuite" : formatCurrency(params.shippingCost)}</td></tr>
          <tr style="border-top:1px solid #2A2A2A;"><td style="padding:12px 16px;color:#FFFFFF;font-weight:bold;font-size:16px;">TOTAL</td><td style="padding:12px 16px;color:#E91E8C;font-weight:bold;font-size:16px;text-align:right;">${formatCurrency(params.totalTTC)}</td></tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px 32px;">
        <p style="color:#A0A0A0;font-size:12px;letter-spacing:2px;margin:0 0 12px;">ADRESSE DE LIVRAISON</p>
        <p style="color:#FFFFFF;margin:0;line-height:1.6;">${formatAddress(params.shippingAddress)}</p>
      </td>
    </tr>
  `);
}
