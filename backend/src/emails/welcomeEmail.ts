import { emailLayout, escapeHtml } from "./utils";

export function welcomeEmail(params: { customerName: string; catalogueUrl?: string }): string {
  const catalogueUrl = params.catalogueUrl || "https://barberparadise.fr/catalogue";
  return emailLayout(`
    <tr>
      <td style="padding:40px 32px;text-align:center;">
        <h2 style="color:#E91E8C;margin:0 0 16px;">BIENVENUE ${escapeHtml(params.customerName.toUpperCase())} 👋</h2>
        <p style="color:#A0A0A0;line-height:1.6;margin:0 0 24px;">
          Votre compte Barber Paradise a été créé avec succès.<br>
          Accédez aux meilleures marques barber professionnelles.
        </p>
        <a href="${escapeHtml(catalogueUrl)}" style="display:inline-block;background:#E91E8C;color:#FFFFFF;padding:14px 28px;border-radius:4px;text-decoration:none;font-weight:bold;letter-spacing:2px;">DÉCOUVRIR LE CATALOGUE →</a>
      </td>
    </tr>
  `);
}
