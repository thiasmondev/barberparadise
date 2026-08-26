import { prisma } from "../utils/prisma";
import { getPosSplitAllocations, type PosRealPaymentMethod } from "../utils/posPaymentBreakdown";

// processing est affiché comme « Traitée » dans l’administration : paiement confirmé et traitement opérationnel engagé.
export const SALES_DASHBOARD_STATUSES = ["processing", "paid", "shipped", "delivered"] as const;

export const SALES_PAYMENT_CATEGORIES = [
  "Carte bancaire",
  "PayPal",
  "Pay by Bank",
  "Indy",
  "Espèces",
  "Virement",
  "Paiement manuel / autre",
] as const;

export type SalesPaymentCategory = typeof SALES_PAYMENT_CATEGORIES[number];
export type SalesDashboardPeriod = "current_month" | "current_year" | "custom";

export function isSalesPaymentCategory(value: unknown): value is SalesPaymentCategory {
  return typeof value === "string" && (SALES_PAYMENT_CATEGORIES as readonly string[]).includes(value);
}

type SalesOrder = {
  id: string;
  paymentMethod: string | null;
  paymentProvider: string | null;
  channel: string | null;
  posPaymentBreakdown: unknown;
  total: number | null;
  totalTTC: number | null;
};

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getOrderTotalTTC(order: SalesOrder): number {
  const totalTTC = Number(order.totalTTC || 0);
  if (Number.isFinite(totalTTC) && totalTTC > 0) return money(totalTTC);
  const total = Number(order.total || 0);
  return money(Number.isFinite(total) ? total : 0);
}

function parseDateOnly(value: unknown, field: string): Date {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${field} doit respecter le format YYYY-MM-DD`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`${field} est invalide`);
  return date;
}

function displayDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * La borne de fin est exclusive ; le dernier jour fourni par l’admin reste donc inclus.
 */
export function resolveSalesDashboardPeriod(params: {
  period?: unknown;
  startDate?: unknown;
  endDate?: unknown;
}, referenceDate = new Date()): { period: SalesDashboardPeriod; start: Date; end: Date; label: string } {
  const period = params.period === "current_year" || params.period === "custom"
    ? params.period
    : "current_month";

  if (period === "custom") {
    const start = parseDateOnly(params.startDate, "startDate");
    const endInclusive = parseDateOnly(params.endDate, "endDate");
    if (endInclusive < start) throw new Error("La date de fin doit être postérieure ou égale à la date de début");
    const end = new Date(endInclusive);
    end.setUTCDate(end.getUTCDate() + 1);
    return { period, start, end, label: `Du ${displayDate(start)} au ${displayDate(endInclusive)}` };
  }

  const year = referenceDate.getUTCFullYear();
  if (period === "current_year") {
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));
    return { period, start, end, label: `Du 1er janvier au 31 décembre ${year}` };
  }

  const month = referenceDate.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  return {
    period,
    start,
    end,
    label: start.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }),
  };
}

function mapPosMethod(method: PosRealPaymentMethod): SalesPaymentCategory {
  switch (method) {
    case "indy":
      return "Indy";
    case "mollie_manual":
      return "Carte bancaire";
    case "cash":
      return "Espèces";
    case "virement":
      return "Virement";
  }
}

function mapOrderPayment(order: Pick<SalesOrder, "paymentMethod" | "paymentProvider" | "channel">): SalesPaymentCategory {
  const method = (order.paymentMethod || "").trim().toLowerCase();
  const provider = (order.paymentProvider || "").trim().toLowerCase();
  const raw = `${provider} ${method}`;

  if (method === "cash") return "Espèces";
  if (method === "virement" || method === "bank_transfer") return "Virement";
  if (method === "indy" || provider === "indy") return "Indy";
  if (method === "paybybank" || method === "pay_by_bank" || raw.includes("pay by bank")) return "Pay by Bank";
  if (raw.includes("paypal")) return "PayPal";
  if (["card", "mollie_manual", "apple_pay", "google_pay"].includes(method) || raw.includes("mollie") || raw.includes("card")) return "Carte bancaire";
  if (method === "sepa") return "Virement";

  return "Paiement manuel / autre";
}

/**
 * Ventile toute commande DIVISER avec la même validation que les rapports Finance.
 * Aucune catégorie « Split » n’est produite et une ventilation invalide est refusée.
 */
export function getSalesPaymentAllocations(order: SalesOrder): Array<{ category: SalesPaymentCategory; amount: number }> {
  if ((order.paymentMethod || "").toLowerCase() === "split") {
    const allocations = getPosSplitAllocations(order);
    if (!allocations) {
      throw new Error(`La vente ${order.id} est marquée DIVISER sans ventilation de paiement valide.`);
    }
    return allocations.map((allocation) => ({ category: mapPosMethod(allocation.method), amount: allocation.amount }));
  }

  return [{ category: mapOrderPayment(order), amount: getOrderTotalTTC(order) }];
}

/**
 * Sélectionne les commandes contribuant à une catégorie et expose leur seule part
 * pertinente. Une commande DIVISER peut donc apparaître dans plusieurs vues, sans
 * jamais afficher son total complet à la place de la part réellement encaissée.
 */
export function getOrdersForSalesPaymentCategory<T extends SalesOrder>(orders: T[], category: SalesPaymentCategory) {
  return orders.map((order) => {
    const amount = money(getSalesPaymentAllocations(order)
      .filter((allocation) => allocation.category === category)
      .reduce((sum, allocation) => sum + allocation.amount, 0));
    return { order, amount };
  }).filter((entry) => entry.amount > 0);
}

export async function buildSalesDashboardStats(params: {
  period?: unknown;
  startDate?: unknown;
  endDate?: unknown;
}) {
  const range = resolveSalesDashboardPeriod(params);
  const orders = await prisma.order.findMany({
    where: {
      status: { in: [...SALES_DASHBOARD_STATUSES] },
      createdAt: { gte: range.start, lt: range.end },
    },
    select: {
      id: true,
      paymentMethod: true,
      paymentProvider: true,
      channel: true,
      posPaymentBreakdown: true,
      total: true,
      totalTTC: true,
    },
  });

  const paymentMap = new Map<SalesPaymentCategory, number>();
  for (const order of orders) {
    for (const allocation of getSalesPaymentAllocations(order)) {
      paymentMap.set(allocation.category, money((paymentMap.get(allocation.category) || 0) + allocation.amount));
    }
  }

  const totalRevenue = money(orders.reduce((sum, order) => sum + getOrderTotalTTC(order), 0));
  const paymentBreakdown = SALES_PAYMENT_CATEGORIES
    .map((category) => ({ category, amount: money(paymentMap.get(category) || 0) }))
    .filter((line) => line.amount > 0)
    .map((line) => ({
      ...line,
      percentage: totalRevenue > 0 ? money((line.amount / totalRevenue) * 100) : 0,
    }));

  const allocatedTotal = money(paymentBreakdown.reduce((sum, line) => sum + line.amount, 0));
  if (Math.abs(allocatedTotal - totalRevenue) > 0.01) {
    throw new Error("La ventilation des moyens de paiement ne correspond pas au chiffre d’affaires de la période.");
  }

  return {
    period: range.period,
    startDate: range.start.toISOString().slice(0, 10),
    endDate: new Date(range.end.getTime() - 1).toISOString().slice(0, 10),
    label: range.label,
    totalRevenue,
    orderCount: orders.length,
    paymentBreakdown,
  };
}
