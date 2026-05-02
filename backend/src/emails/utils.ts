export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatCurrency(value: number | null | undefined): string {
  const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
  return `${amount.toFixed(2)} €`;
}

export function formatAddress(address: {
  firstName?: string | null;
  lastName?: string | null;
  address?: string | null;
  extension?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
} | null | undefined): string {
  if (!address) return "Adresse non renseignée";
  const lines = [
    `${address.firstName ?? ""} ${address.lastName ?? ""}`.trim(),
    address.address,
    address.extension,
    `${address.postalCode ?? ""} ${address.city ?? ""}`.trim(),
    address.country,
  ].filter(Boolean);
  return lines.map(escapeHtml).join("<br>");
}

export function emailLayout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#111111;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="background:#111111;padding:32px;text-align:center;border-bottom:2px solid #E91E8C;">
            <h1 style="color:#FFFFFF;margin:0;font-size:24px;letter-spacing:4px;">BARBER PARADISE</h1>
          </td>
        </tr>
        ${content}
        <tr>
          <td style="background:#161616;padding:24px;text-align:center;border-top:1px solid #2A2A2A;">
            <p style="color:#A0A0A0;margin:0;font-size:12px;">
              Des questions ? Contactez-nous à <a href="mailto:contact@barberparadise.fr" style="color:#E91E8C;">contact@barberparadise.fr</a>
            </p>
            <p style="color:#A0A0A0;margin:8px 0 0;font-size:11px;">
              Barber Paradise — 31 Rue de Pont-à-Mousson, 57950 Montigny-lès-Metz
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
