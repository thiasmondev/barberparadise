import { escapeHtml, formatCurrency } from "./utils";

export type AbandonedCartReminderStage = 1 | 2 | 3;

export type AbandonedCartReminderItem = {
  name: string;
  quantity: number;
  price: number;
  image?: string | null;
  variantId?: string | null;
  variantLabel?: string | null;
};

const NAVY = "#0f056b";
const ROSE = "#fd2786";
const DARK_NAVY = "#08033d";
const LIGHT_BG = "#f7f5ff";

function getStageCopy(stage: AbandonedCartReminderStage): { preheader: string; title: string; intro: string; note: string; subject: string } {
  if (stage === 1) {
    return {
      subject: "Vous avez oublié quelque chose ?",
      preheader: "Votre panier Barber Paradise vous attend encore.",
      title: "Vous avez oublié quelque chose ?",
      intro: "Votre sélection Barber Paradise est toujours disponible. Vous pouvez reprendre votre panier, le modifier librement puis finaliser votre commande en quelques instants.",
      note: "Aucune remise automatique n’a été ajoutée : ce message sert uniquement à vous permettre de retrouver votre panier plus facilement.",
    };
  }

  if (stage === 2) {
    return {
      subject: "Votre panier Barber Paradise vous attend encore",
      preheader: "Un petit rappel avant que votre sélection ne change.",
      title: "Votre sélection est toujours de côté",
      intro: "Certains produits Barber Paradise sont très demandés et les stocks peuvent évoluer rapidement. Si votre panier vous intéresse toujours, vous pouvez le retrouver, l’ajuster et passer commande dès maintenant.",
      note: "Les quantités disponibles seront confirmées au moment du paiement.",
    };
  }

  return {
    subject: "Dernier rappel pour votre panier Barber Paradise",
    preheader: "Votre panier ne sera pas conservé indéfiniment.",
    title: "Dernier rappel pour votre panier",
    intro: "Votre panier ne sera pas conservé indéfiniment. Si vous souhaitez garder cette sélection, ouvrez votre panier, modifiez-le si besoin puis finalisez votre commande.",
    note: "Après ce rappel, nous ne relancerons plus automatiquement cette session de panier.",
  };
}

function renderItems(items: AbandonedCartReminderItem[]): string {
  return items
    .map((item) => {
      const image = item.image
        ? `<img src="${escapeHtml(item.image)}" width="64" height="64" alt="" style="display:block;width:64px;height:64px;border-radius:12px;object-fit:cover;border:1px solid rgba(15,5,107,0.12);">`
        : `<div style="width:64px;height:64px;border-radius:12px;background:${LIGHT_BG};border:1px solid rgba(15,5,107,0.12);"></div>`;
      return `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid rgba(15,5,107,0.10);width:78px;">${image}</td>
          <td style="padding:14px 12px;border-bottom:1px solid rgba(15,5,107,0.10);">
            <p style="margin:0;color:${NAVY};font-family:'Fractul Variable',Arial,sans-serif;font-size:15px;line-height:1.35;font-weight:700;">${escapeHtml(item.name)}</p>
            ${item.variantLabel ? `<p style="margin:5px 0 0;color:#6f6a8e;font-family:'Fractul Variable',Arial,sans-serif;font-size:13px;line-height:1.35;">Variante : ${escapeHtml(item.variantLabel)}</p>` : ""}
            <p style="margin:5px 0 0;color:#6f6a8e;font-family:'Fractul Variable',Arial,sans-serif;font-size:13px;line-height:1.35;">Quantité : ${escapeHtml(item.quantity)}</p>
          </td>
          <td style="padding:14px 0;border-bottom:1px solid rgba(15,5,107,0.10);text-align:right;color:${NAVY};font-family:'Fractul Variable',Arial,sans-serif;font-size:15px;font-weight:700;white-space:nowrap;">${formatCurrency(item.price * item.quantity)}</td>
        </tr>`;
    })
    .join("");
}

export function getAbandonedCartReminderSubject(stage: AbandonedCartReminderStage): string {
  return getStageCopy(stage).subject;
}

export function abandonedCartReminderEmail(params: {
  stage: AbandonedCartReminderStage;
  customerEmail: string;
  restoreUrl: string;
  unsubscribeUrl: string;
  items: AbandonedCartReminderItem[];
  total: number;
}): string {
  const copy = getStageCopy(params.stage);
  const itemsHtml = renderItems(params.items);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light only">
  <title>${escapeHtml(copy.subject)}</title>
  <style>
    @font-face { font-family: 'Molto'; src: url('https://barberparadise.fr/fonts/Molto.woff2') format('woff2'); font-weight: 700; font-style: normal; }
    @font-face { font-family: 'Fractul Variable'; src: url('https://barberparadise.fr/fonts/Fractul-Variable.woff2') format('woff2'); font-weight: 400 800; font-style: normal; }
    @media only screen and (max-width: 620px) {
      .bp-container { width: 100% !important; border-radius: 0 !important; }
      .bp-padding { padding-left: 22px !important; padding-right: 22px !important; }
      .bp-title { font-size: 27px !important; }
      .bp-cta { display:block !important; width:100% !important; box-sizing:border-box !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${LIGHT_BG};font-family:'Fractul Variable',Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(copy.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${LIGHT_BG};padding:34px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="bp-container" style="width:100%;max-width:600px;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid rgba(15,5,107,0.10);box-shadow:0 18px 45px rgba(15,5,107,0.12);">
          <tr>
            <td style="background:${NAVY};padding:30px 30px 26px;text-align:center;">
              <p style="margin:0;color:#ffffff;font-family:'Molto',Arial,sans-serif;font-size:24px;letter-spacing:3px;line-height:1;">BARBER PARADISE</p>
              <p style="margin:10px 0 0;color:#f1ecff;font-family:'Fractul Variable',Arial,sans-serif;font-size:13px;letter-spacing:1px;text-transform:uppercase;">Panier sauvegardé</p>
            </td>
          </tr>
          <tr>
            <td class="bp-padding" style="padding:34px 34px 16px;text-align:center;">
              <h1 class="bp-title" style="margin:0;color:${NAVY};font-family:'Molto',Arial,sans-serif;font-size:34px;line-height:1.08;letter-spacing:-0.5px;">${escapeHtml(copy.title)}</h1>
              <p style="margin:18px 0 0;color:#4d4772;font-family:'Fractul Variable',Arial,sans-serif;font-size:16px;line-height:1.65;">${escapeHtml(copy.intro)}</p>
            </td>
          </tr>
          <tr>
            <td class="bp-padding" style="padding:10px 34px 6px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${itemsHtml}</table>
            </td>
          </tr>
          <tr>
            <td class="bp-padding" style="padding:8px 34px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${LIGHT_BG};border-radius:18px;">
                <tr>
                  <td style="padding:18px 20px;color:${NAVY};font-family:'Fractul Variable',Arial,sans-serif;font-size:15px;font-weight:700;">Montant du panier</td>
                  <td style="padding:18px 20px;text-align:right;color:${ROSE};font-family:'Molto',Arial,sans-serif;font-size:22px;white-space:nowrap;">${formatCurrency(params.total)}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="bp-padding" style="padding:0 34px 32px;text-align:center;">
              <a class="bp-cta" href="${escapeHtml(params.restoreUrl)}" style="display:inline-block;background:${ROSE};color:#ffffff;text-decoration:none;border-radius:999px;padding:16px 28px;font-family:'Fractul Variable',Arial,sans-serif;font-size:15px;font-weight:800;letter-spacing:0.3px;">Reprendre mon panier</a>
              <p style="margin:18px 0 0;color:#6f6a8e;font-family:'Fractul Variable',Arial,sans-serif;font-size:13px;line-height:1.55;">${escapeHtml(copy.note)}</p>
            </td>
          </tr>
          <tr>
            <td style="background:${DARK_NAVY};padding:24px 30px;text-align:center;">
              <p style="margin:0;color:#ded9ff;font-family:'Fractul Variable',Arial,sans-serif;font-size:12px;line-height:1.6;">Ce message transactionnel concerne uniquement votre panier Barber Paradise associé à ${escapeHtml(params.customerEmail)}.</p>
              <p style="margin:10px 0 0;color:#ded9ff;font-family:'Fractul Variable',Arial,sans-serif;font-size:12px;line-height:1.6;">Vous pouvez <a href="${escapeHtml(params.unsubscribeUrl)}" style="color:${ROSE};text-decoration:underline;">ne plus recevoir de relance pour ce panier</a>. Cette action n’affecte pas vos autres communications Barber Paradise.</p>
              <p style="margin:10px 0 0;color:#b8b0ef;font-family:'Fractul Variable',Arial,sans-serif;font-size:11px;line-height:1.5;">Barber Paradise — 31 Rue de Pont-à-Mousson, 57950 Montigny-lès-Metz</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
