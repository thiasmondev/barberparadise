import { prisma } from "../utils/prisma";

export type IndyPspName = "Mollie" | "PayPal" | "Checkout.com";

export interface IndyReport {
  month: string;
  period: {
    start: string;
    end: string;
  };
  ventesParPSP: Array<{
    psp: IndyPspName;
    ventesRealisees: number;
    commissionsPrelevees: number;
    variationTotale: number;
  }>;
  ventesParPaysEtTVA: Array<{
    paysLivraison: string;
    tauxTVA: number;
    totalHT: number;
    montantTVA: number;
    totalTTC: number;
    nbCommandes: number;
  }>;
  remboursements: Array<{
    type: "remboursement" | "annulation";
    montantTTC: number;
    psp: IndyPspName;
    date: string;
  }>;
  csvRows: Array<{
    type: "Marchandise";
    pays_expedition: "France";
    pays_livraison: string;
    tva_pct: number;
    total_ttc: number;
    moyen_paiement: IndyPspName;
  }>;
  summary: {
    caHTTotal: number;
    tvaCollecteeTotal: number;
    caTTCTotal: number;
    nbCommandesTotal: number;
  };
}

type OrderForIndy = Awaited<ReturnType<typeof fetchOrdersForIndy>>[number];

const SALES_STATUSES = ["paid", "shipped"];
const REFUND_STATUSES = ["cancelled", "refunded"];
const PSP_ORDER: IndyPspName[] = ["Mollie", "PayPal", "Checkout.com"];
const EU_COUNTRIES = new Set([
  "AT", "AUTRICHE",
  "BE", "BELGIQUE", "BELGIUM",
  "BG", "BULGARIE", "BULGARIA",
  "CY", "CHYPRE", "CYPRUS",
  "CZ", "TCHEQUIE", "TCHÉQUIE", "CZECHIA", "CZECH REPUBLIC",
  "DE", "ALLEMAGNE", "GERMANY",
  "DK", "DANEMARK", "DENMARK",
  "EE", "ESTONIE", "ESTONIA",
  "ES", "ESPAGNE", "SPAIN",
  "FI", "FINLANDE", "FINLAND",
  "FR", "FRANCE",
  "GR", "GRECE", "GRÈCE", "GREECE",
  "HR", "CROATIE", "CROATIA",
  "HU", "HONGRIE", "HUNGARY",
  "IE", "IRLANDE", "IRELAND",
  "IT", "ITALIE", "ITALY",
  "LT", "LITUANIE", "LITHUANIA",
  "LU", "LUXEMBOURG",
  "LV", "LETTONIE", "LATVIA",
  "MT", "MALTE", "MALTA",
  "NL", "PAYS BAS", "PAYS-BAS", "NETHERLANDS", "HOLLANDE",
  "PL", "POLOGNE", "POLAND",
  "PT", "PORTUGAL",
  "RO", "ROUMANIE", "ROMANIA",
  "SE", "SUEDE", "SUÈDE", "SWEDEN",
  "SI", "SLOVENIE", "SLOVÉNIE", "SLOVENIA",
  "SK", "SLOVAQUIE", "SLOVAKIA",
]);

export function parseIndyMonth(month?: unknown): { month: string; start: Date; end: Date } {
  const raw = typeof month === "string" && month.trim() ? month.trim() : currentMonthKey();
  const match = raw.match(/^(\d{4})-(\d{2})$/);
  if (!match) throw new Error("Le paramètre month doit respecter le format YYYY-MM");
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) throw new Error("Mois Indy invalide");
  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0));
  return { month: raw, start, end };
}

export function previousMonthKey(reference = new Date()): string {
  return new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - 1, 1))
    .toISOString()
    .slice(0, 7);
}

function currentMonthKey(reference = new Date()): string {
  return new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 7);
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeCountryForVat(country?: string | null): string {
  return (country || "France")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function getDeliveryCountry(order: OrderForIndy): string {
  return order.shippingAddress?.country?.trim() || "France";
}

function getOrderTotalTTC(order: OrderForIndy): number {
  const totalTTC = Number(order.totalTTC || 0);
  if (Number.isFinite(totalTTC) && totalTTC > 0) return money(totalTTC);
  const total = Number(order.total || 0);
  return money(Number.isFinite(total) ? total : 0);
}

function mapPsp(order: Pick<OrderForIndy, "paymentMethod" | "paymentProvider">): IndyPspName {
  const raw = `${order.paymentProvider || ""} ${order.paymentMethod || ""}`.toLowerCase();
  if (raw.includes("paypal")) return "PayPal";
  if (raw.includes("checkout") || raw.includes("card_international")) return "Checkout.com";
  return "Mollie";
}

function getVatRateForIndy(order: OrderForIndy): 0 | 20 {
  if (order.isB2B || Boolean(order.vatNumber?.trim())) return 0;
  return EU_COUNTRIES.has(normalizeCountryForVat(getDeliveryCountry(order))) ? 20 : 0;
}

async function fetchOrdersForIndy(start: Date, end: Date, statuses: string[]) {
  return prisma.order.findMany({
    where: {
      status: { in: statuses },
      createdAt: { gte: start, lt: end },
    },
    select: {
      id: true,
      status: true,
      paymentMethod: true,
      paymentProvider: true,
      total: true,
      totalTTC: true,
      isB2B: true,
      vatNumber: true,
      createdAt: true,
      shippingAddress: {
        select: {
          country: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function buildIndyReport(monthParam?: unknown): Promise<IndyReport> {
  const { month, start, end } = parseIndyMonth(monthParam);
  const [salesOrders, refundOrders] = await Promise.all([
    fetchOrdersForIndy(start, end, SALES_STATUSES),
    fetchOrdersForIndy(start, end, REFUND_STATUSES),
  ]);

  const pspMap = new Map<IndyPspName, { psp: IndyPspName; ventesRealisees: number; commissionsPrelevees: number; variationTotale: number }>();
  const countryVatMap = new Map<string, { paysLivraison: string; tauxTVA: number; totalHT: number; montantTVA: number; totalTTC: number; nbCommandes: number }>();
  const csvRowMap = new Map<string, { type: "Marchandise"; pays_expedition: "France"; pays_livraison: string; tva_pct: number; total_ttc: number; moyen_paiement: IndyPspName }>();

  for (const order of salesOrders) {
    const totalTTC = getOrderTotalTTC(order);
    const psp = mapPsp(order);
    const country = getDeliveryCountry(order);
    const tauxTVA = getVatRateForIndy(order);
    const totalHT = tauxTVA === 20 ? money(totalTTC / 1.2) : totalTTC;
    const montantTVA = money(totalTTC - totalHT);

    const pspLine = pspMap.get(psp) || { psp, ventesRealisees: 0, commissionsPrelevees: 0, variationTotale: 0 };
    pspLine.ventesRealisees = money(pspLine.ventesRealisees + totalTTC);
    pspLine.variationTotale = money(pspLine.ventesRealisees - pspLine.commissionsPrelevees);
    pspMap.set(psp, pspLine);

    const countryKey = `${country}::${tauxTVA}`;
    const countryLine = countryVatMap.get(countryKey) || { paysLivraison: country, tauxTVA, totalHT: 0, montantTVA: 0, totalTTC: 0, nbCommandes: 0 };
    countryLine.totalHT = money(countryLine.totalHT + totalHT);
    countryLine.montantTVA = money(countryLine.montantTVA + montantTVA);
    countryLine.totalTTC = money(countryLine.totalTTC + totalTTC);
    countryLine.nbCommandes += 1;
    countryVatMap.set(countryKey, countryLine);

    const csvKey = `${psp}::${country}::${tauxTVA}`;
    const csvLine = csvRowMap.get(csvKey) || { type: "Marchandise", pays_expedition: "France", pays_livraison: country, tva_pct: tauxTVA, total_ttc: 0, moyen_paiement: psp };
    csvLine.total_ttc = money(csvLine.total_ttc + totalTTC);
    csvRowMap.set(csvKey, csvLine);
  }

  const ventesParPaysEtTVA = [...countryVatMap.values()].sort((a, b) =>
    a.paysLivraison.localeCompare(b.paysLivraison, "fr") || b.tauxTVA - a.tauxTVA
  );
  const csvRows = [...csvRowMap.values()].sort((a, b) =>
    a.moyen_paiement.localeCompare(b.moyen_paiement, "fr") ||
    a.pays_livraison.localeCompare(b.pays_livraison, "fr") ||
    b.tva_pct - a.tva_pct
  );
  const ventesParPSP = [...pspMap.values()].sort((a, b) => PSP_ORDER.indexOf(a.psp) - PSP_ORDER.indexOf(b.psp));

  const remboursements = refundOrders.map(order => ({
    type: order.status === "refunded" ? "remboursement" as const : "annulation" as const,
    montantTTC: getOrderTotalTTC(order),
    psp: mapPsp(order),
    date: order.createdAt.toISOString().slice(0, 10),
  }));

  return {
    month,
    period: { start: start.toISOString(), end: end.toISOString() },
    ventesParPSP,
    ventesParPaysEtTVA,
    remboursements,
    csvRows,
    summary: {
      caHTTotal: money(ventesParPaysEtTVA.reduce((sum, line) => sum + line.totalHT, 0)),
      tvaCollecteeTotal: money(ventesParPaysEtTVA.reduce((sum, line) => sum + line.montantTVA, 0)),
      caTTCTotal: money(ventesParPaysEtTVA.reduce((sum, line) => sum + line.totalTTC, 0)),
      nbCommandesTotal: salesOrders.length,
    },
  };
}

function csvEscape(value: string | number): string {
  const text = typeof value === "number" ? value.toFixed(2).replace(/\.00$/, ".00") : value;
  if (/[,"\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function buildIndyCsv(report: IndyReport): string {
  const header = "type,pays_expedition,pays_livraison,tva_pct,total_ttc,moyen_paiement";
  const rows = report.csvRows.map(row => [
    row.type,
    row.pays_expedition,
    row.pays_livraison,
    String(row.tva_pct),
    row.total_ttc.toFixed(2),
    row.moyen_paiement,
  ].map(csvEscape).join(","));
  return [header, ...rows].join("\n") + "\n";
}

export function getIndyClosureLabel(month: string): string {
  const { start } = parseIndyMonth(month);
  const closeDate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 14));
  return closeDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function buildIndyEmailHtml(report: IndyReport, cfoAnalysis: string): string {
  const closureLabel = getIndyClosureLabel(report.month);
  const pspRows = report.ventesParPSP.map(line => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">${line.psp}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${line.ventesRealisees.toFixed(2)} €</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${line.commissionsPrelevees.toFixed(2)} €</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${line.variationTotale.toFixed(2)} €</td>
    </tr>`).join("") || `<tr><td colspan="4" style="padding:8px;">Aucune vente encaissée sur la période.</td></tr>`;

  return `
    <div style="font-family:Arial,sans-serif;color:#111;line-height:1.5;">
      <h1 style="margin:0 0 12px;">Bilan mensuel Indy — Barber Paradise — ${report.month}</h1>
      <p>Le CSV Indy du mois est joint à cet email.</p>
      <p style="font-weight:bold;color:#7f1d1d;">À clôturer avant le 14 ${closureLabel.replace(/^14\s+/i, "")} sur app.indy.fr.</p>
      <h2>Résumé</h2>
      <ul>
        <li>CA HT : <strong>${report.summary.caHTTotal.toFixed(2)} €</strong></li>
        <li>TVA collectée : <strong>${report.summary.tvaCollecteeTotal.toFixed(2)} €</strong></li>
        <li>CA TTC : <strong>${report.summary.caTTCTotal.toFixed(2)} €</strong></li>
        <li>Commandes encaissées : <strong>${report.summary.nbCommandesTotal}</strong></li>
      </ul>
      <h2>Détail PSP</h2>
      <table style="border-collapse:collapse;width:100%;max-width:760px;">
        <thead>
          <tr>
            <th style="padding:8px;border-bottom:2px solid #111;text-align:left;">Moyen de paiement</th>
            <th style="padding:8px;border-bottom:2px solid #111;text-align:right;">Ventes réalisées</th>
            <th style="padding:8px;border-bottom:2px solid #111;text-align:right;">Commissions</th>
            <th style="padding:8px;border-bottom:2px solid #111;text-align:right;">Variation totale</th>
          </tr>
        </thead>
        <tbody>${pspRows}</tbody>
      </table>
      <h2>Analyse CFO Claude</h2>
      <div style="white-space:pre-wrap;background:#f7f7f7;padding:12px;border-radius:8px;">${escapeHtml(cfoAnalysis || "Analyse CFO indisponible.")}</div>
    </div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
