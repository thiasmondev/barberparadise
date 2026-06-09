import { emailLayout, escapeHtml, formatCurrency } from "./utils";

type StockAlertEmailParams = {
  productName: string;
  productPrice: number;
  productImage?: string | null;
  productUrl: string;
};

export function stockAlertEmail(params: StockAlertEmailParams): string {
  const imageHtml = params.productImage
    ? `<tr><td style="padding:0 32px 24px;text-align:center;"><img src="${escapeHtml(params.productImage)}" alt="${escapeHtml(params.productName)}" style="display:block;width:100%;max-width:320px;margin:0 auto;border-radius:10px;background:#FFFFFF;object-fit:contain;" /></td></tr>`
    : "";

  return emailLayout(`
    <tr>
      <td style="padding:32px 32px 16px;text-align:center;">
        <h2 style="color:#FFFFFF;margin:0;font-size:26px;line-height:1.25;">Bonne nouvelle !</h2>
        <p style="color:#E91E8C;margin:12px 0 0;font-size:14px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;">Votre article est de retour</p>
      </td>
    </tr>
    ${imageHtml}
    <tr>
      <td style="padding:0 32px 8px;text-align:center;">
        <h3 style="color:#FFFFFF;margin:0;font-size:20px;line-height:1.35;">${escapeHtml(params.productName)}</h3>
        <p style="color:#FFFFFF;margin:12px 0 0;font-size:22px;font-weight:bold;">${formatCurrency(params.productPrice)}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 32px 8px;">
        <p style="color:#D7D7D7;margin:0;font-size:15px;line-height:1.7;text-align:center;">
          Vous aviez demandé à être prévenu. Cet article est de nouveau disponible sur Barber Paradise. Attention, les stocks sont limités !
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:26px 32px 36px;text-align:center;">
        <a href="${escapeHtml(params.productUrl)}" style="display:inline-block;background:#E91E8C;color:#FFFFFF;text-decoration:none;padding:15px 26px;border-radius:999px;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:1.5px;">Commander maintenant →</a>
      </td>
    </tr>
  `);
}
