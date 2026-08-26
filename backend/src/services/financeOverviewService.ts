import { prisma } from "../utils/prisma";
import {
  getSalesPaymentAllocations,
  SALES_DASHBOARD_STATUSES,
  SALES_PAYMENT_CATEGORIES,
  type SalesPaymentCategory,
} from "./salesDashboardService";

export interface FinanceOverview {
  month: string;
  period: { start: string; end: string };
  ventesParMoyenPaiement: Array<{
    moyenPaiement: SalesPaymentCategory;
    ventesRealisees: number;
  }>;
  ventesParPaysEtTVA: Array<{
    paysLivraison: string;
    tauxTVA: number;
    totalHT: number;
    montantTVA: number;
    totalTTC: number;
    nbCommandes: number;
  }>;
  summary: {
    caHTTotal: number;
    tvaCollecteeTotal: number;
    caTTCTotal: number;
    nbCommandesTotal: number;
  };
}

type FinanceOrder = {
  id: string;
  paymentMethod: string | null;
  paymentProvider: string | null;
  channel: string | null;
  posPaymentBreakdown: unknown;
  total: number | null;
  totalTTC: number | null;
  totalHT: number | null;
  vatAmount: number | null;
  vatRate: number | null;
  shippingAddress: { country: string | null } | null;
};

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function parseFinanceMonth(month?: unknown): { month: string; start: Date; end: Date } {
  const raw = typeof month === "string" && month.trim()
    ? month.trim()
    : new Date().toISOString().slice(0, 7);
  const match = raw.match(/^(\d{4})-(\d{2})$/);
  if (!match) throw new Error("Le paramètre month doit respecter le format YYYY-MM");
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) throw new Error("Mois Finance invalide");
  return {
    month: raw,
    start: new Date(Date.UTC(year, monthIndex, 1)),
    end: new Date(Date.UTC(year, monthIndex + 1, 1)),
  };
}

function totalTTC(order: FinanceOrder): number {
  const ttc = Number(order.totalTTC || 0);
  if (Number.isFinite(ttc) && ttc > 0) return money(ttc);
  return money(Number(order.total || 0));
}

function getFinanceTotals(order: FinanceOrder): { ttc: number; ht: number; tva: number } {
  const ttc = totalTTC(order);
  const storedHT = Number(order.totalHT);
  const storedTVA = Number(order.vatAmount);
  let ht = Number.isFinite(storedHT) && storedHT >= 0
    ? money(storedHT)
    : Number.isFinite(storedTVA) && storedTVA >= 0
      ? money(Math.max(0, ttc - storedTVA))
      : money(ttc / (1 + Math.max(0, Number(order.vatRate || 0)) / 100));
  let tva = Number.isFinite(storedTVA) && storedTVA >= 0
    ? money(storedTVA)
    : money(Math.max(0, ttc - ht));

  // Sur des commandes historiques, totalHT/vatAmount excluent les frais de livraison
  // alors que totalTTC les inclut. Ventiler le reliquat au taux de la commande rend
  // le bilan réconcilié sans réécrire les données de vente existantes.
  const unallocatedTTC = money(Math.max(0, ttc - ht - tva));
  if (unallocatedTTC > 0.01) {
    const rate = Math.max(0, Number(order.vatRate || 0));
    const unallocatedHT = rate > 0 ? money(unallocatedTTC / (1 + rate / 100)) : unallocatedTTC;
    ht = money(ht + unallocatedHT);
    tva = money(tva + unallocatedTTC - unallocatedHT);
  }

  return { ttc, ht, tva };
}

/** Agrégation pure réutilisable dans les tests ; chaque commande compte une seule fois dans les KPI. */
export function aggregateFinanceOverview(month: string, start: Date, end: Date, orders: FinanceOrder[]): FinanceOverview {
  const paymentMap = new Map<SalesPaymentCategory, number>();
  const countryVatMap = new Map<string, {
    paysLivraison: string;
    tauxTVA: number;
    totalHT: number;
    montantTVA: number;
    totalTTC: number;
    nbCommandes: number;
  }>();

  for (const order of orders) {
    const { ttc, ht, tva } = getFinanceTotals(order);
    for (const allocation of getSalesPaymentAllocations(order)) {
      paymentMap.set(allocation.category, money((paymentMap.get(allocation.category) || 0) + allocation.amount));
    }

    const country = order.shippingAddress?.country?.trim() || "France";
    const vatRate = Number(order.vatRate || 0);
    const key = `${country}::${vatRate}`;
    const current = countryVatMap.get(key) || { paysLivraison: country, tauxTVA: vatRate, totalHT: 0, montantTVA: 0, totalTTC: 0, nbCommandes: 0 };
    current.totalHT = money(current.totalHT + ht);
    current.montantTVA = money(current.montantTVA + tva);
    current.totalTTC = money(current.totalTTC + ttc);
    current.nbCommandes += 1;
    countryVatMap.set(key, current);
  }

  const ventesParMoyenPaiement = SALES_PAYMENT_CATEGORIES
    .map((moyenPaiement) => ({ moyenPaiement, ventesRealisees: money(paymentMap.get(moyenPaiement) || 0) }))
    .filter((line) => line.ventesRealisees > 0);
  const ventesParPaysEtTVA = [...countryVatMap.values()].sort((a, b) =>
    a.paysLivraison.localeCompare(b.paysLivraison, "fr") || b.tauxTVA - a.tauxTVA,
  );
  const caHTTotal = money(ventesParPaysEtTVA.reduce((sum, line) => sum + line.totalHT, 0));
  const tvaCollecteeTotal = money(ventesParPaysEtTVA.reduce((sum, line) => sum + line.montantTVA, 0));
  const caTTCTotal = money(ventesParPaysEtTVA.reduce((sum, line) => sum + line.totalTTC, 0));
  const ventilatedTotal = money(ventesParMoyenPaiement.reduce((sum, line) => sum + line.ventesRealisees, 0));
  if (Math.abs(ventilatedTotal - caTTCTotal) > 0.01) {
    throw new Error("La ventilation des moyens de paiement ne correspond pas au CA TTC Finance.");
  }

  return {
    month,
    period: { start: start.toISOString(), end: end.toISOString() },
    ventesParMoyenPaiement,
    ventesParPaysEtTVA,
    summary: { caHTTotal, tvaCollecteeTotal, caTTCTotal, nbCommandesTotal: orders.length },
  };
}

export async function buildFinanceOverview(monthParam?: unknown): Promise<FinanceOverview> {
  const { month, start, end } = parseFinanceMonth(monthParam);
  const orders = await prisma.order.findMany({
    where: {
      status: { in: [...SALES_DASHBOARD_STATUSES] },
      createdAt: { gte: start, lt: end },
    },
    select: {
      id: true,
      paymentMethod: true,
      paymentProvider: true,
      channel: true,
      posPaymentBreakdown: true,
      total: true,
      totalTTC: true,
      totalHT: true,
      vatAmount: true,
      vatRate: true,
      shippingAddress: { select: { country: true } },
    },
  });
  return aggregateFinanceOverview(month, start, end, orders);
}
