import { emailLayout, escapeHtml } from "./utils";

export function passwordResetEmail(params: { customerName: string; resetUrl: string; expiresInMinutes?: number }): string {
  return emailLayout(`
    <tr>
      <td style="padding:40px 32px;text-align:center;">
        <h2 style="color:#E91E8C;margin:0 0 16px;">RÉINITIALISATION DU MOT DE PASSE</h2>
        <p style="color:#A0A0A0;line-height:1.6;margin:0 0 24px;">
          Bonjour ${escapeHtml(params.customerName)}, vous avez demandé à réinitialiser le mot de passe de votre compte Barber Paradise.
        </p>
        <a href="${escapeHtml(params.resetUrl)}" style="display:inline-block;background:#E91E8C;color:#FFFFFF;padding:14px 28px;border-radius:4px;text-decoration:none;font-weight:bold;letter-spacing:2px;">RÉINITIALISER MON MOT DE PASSE →</a>
        <p style="color:#A0A0A0;line-height:1.6;margin:24px 0 0;font-size:12px;">
          Ce lien expire dans ${params.expiresInMinutes ?? 30} minutes. Si vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer cet email.
        </p>
      </td>
    </tr>
  `);
}
