import { prisma } from "../utils/prisma";

export interface ShippingOption {
  id: string;
  label: string;
  price: number;
  carrier: string;
  days: string;
  isFree: boolean;
  zoneId?: string;
  zoneName?: string;
  minAmount?: number;
  maxAmount?: number | null;
  freeThreshold?: number | null;
}

export const FALLBACK_FREE_SHIPPING_THRESHOLD = 49;
export const PRO_FREE_SHIPPING_THRESHOLD = 500;

const FRANCE_PRO_SHIPPING_RATES = [
  { id: "b2b-colissimo-pro", label: "Colissimo Pro", carrier: "Colissimo Pro", price: 12.99, days: "2 à 4 jours ouvrés" },
  { id: "b2b-mondial-relay-pro", label: "Mondial Relay Pro", carrier: "Mondial Relay Pro", price: 6.99, days: "3 à 5 jours ouvrés" },
];

const DEFAULT_SHIPPING_ZONES = [
  {
    name: "France",
    countries: ["FR"],
    rates: [
      { name: "Standard", minAmount: 0, maxAmount: 49, price: 5.99, isFree: false, deliveryTime: "2 à 4 jours ouvrés" },
      { name: "Standard +49€", minAmount: 49, maxAmount: null, price: 0, isFree: true, deliveryTime: "2 à 4 jours ouvrés" },
    ],
  },
  {
    name: "Belgique",
    countries: ["BE"],
    rates: [
      { name: "Standard International", minAmount: 0, maxAmount: null, price: 11.99, isFree: false, deliveryTime: "3 à 6 jours ouvrés" },
    ],
  },
  {
    name: "DOM-TOM",
    countries: ["GP", "MQ", "GF", "RE", "YT", "PM", "BL", "MF", "WF", "PF", "NC", "TF"],
    rates: [
      { name: "Envoi", minAmount: 0, maxAmount: null, price: 49, isFree: false, deliveryTime: "7 à 14 jours ouvrés" },
    ],
  },
];

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Les DOM-TOM ont le code pays "FR" dans les formulaires standard,
 * mais leur code postal commence par 97x ou 98x.
 * Cette fonction résout le vrai code ISO du territoire à partir du CP
 * afin d'appliquer le bon tarif d'expédition (zone DOM-TOM).
 *
 * Préfixes traités :
 *   971 = Guadeloupe (GP)
 *   972 = Martinique (MQ)
 *   973 = Guyane (GF)
 *   974 = La Réunion (RE)
 *   975 = Saint-Pierre-et-Miquelon (PM)
 *   976 = Mayotte (YT)
 *   984 = Wallis-et-Futuna (WF)
 *   986 = Wallis-et-Futuna (WF)
 *   987 = Polynésie française (PF)
 *   988 = Nouvelle-Calédonie (NC)
 */
export function resolveCountryFromPostalCode(country: string, postalCode?: string | null): string {
  const c = (country || "FR").toUpperCase();
  if (c !== "FR" || !postalCode) return c;
  const cp = postalCode.trim().replace(/\s/g, "");
  if (cp.startsWith("971")) return "GP";
  if (cp.startsWith("972")) return "MQ";
  if (cp.startsWith("973")) return "GF";
  if (cp.startsWith("974")) return "RE";
  if (cp.startsWith("975")) return "PM";
  if (cp.startsWith("976")) return "YT";
  if (cp.startsWith("984") || cp.startsWith("986")) return "WF";
  if (cp.startsWith("987")) return "PF";
  if (cp.startsWith("988")) return "NC";
  return c;
}

export function getFreeShippingThreshold(isPro: boolean = false): number {
  return isPro ? PRO_FREE_SHIPPING_THRESHOLD : FALLBACK_FREE_SHIPPING_THRESHOLD;
}

export async function ensureDefaultShippingZones() {
  const existingCount = await prisma.shippingZone.count();
  if (existingCount > 0) return;

  await prisma.$transaction(
    DEFAULT_SHIPPING_ZONES.map((zone) =>
      prisma.shippingZone.create({
        data: {
          name: zone.name,
          countries: zone.countries,
          rates: { create: zone.rates },
        },
      }),
    ),
  );
}

export async function listShippingZones() {
  await ensureDefaultShippingZones();
  return prisma.shippingZone.findMany({
    include: { rates: { orderBy: [{ minAmount: "asc" }, { price: "asc" }, { name: "asc" }] } },
    orderBy: { name: "asc" },
  });
}

function rateMatchesAmount(rate: { minAmount: number; maxAmount: number | null }, amount: number): boolean {
  const min = Number.isFinite(rate.minAmount) ? rate.minAmount : 0;
  const aboveMin = amount >= min;
  const belowMax = rate.maxAmount === null || rate.maxAmount === undefined ? true : amount < rate.maxAmount;
  return aboveMin && belowMax;
}

function isFreeRate(rate: { price: number; isFree: boolean }): boolean {
  return rate.isFree || roundMoney(rate.price) === 0;
}

function hasReachedRateFreeThreshold(rate: { freeThreshold?: number | null }, amount: number): boolean {
  return typeof rate.freeThreshold === "number" && Number.isFinite(rate.freeThreshold) && amount >= rate.freeThreshold;
}

function resolveProPaidRates<T extends { minAmount: number; maxAmount: number | null; price: number; isFree: boolean }>(rates: T[], amountHT: number): T[] {
  const paidRates = rates.filter((rate) => !isFreeRate(rate));
  const matchingPaidRates = paidRates.filter((rate) => rateMatchesAmount(rate, amountHT));
  if (matchingPaidRates.length > 0) return matchingPaidRates;

  const closestLowerPaidRate = paidRates
    .filter((rate) => rate.minAmount <= amountHT)
    .sort((a, b) => b.minAmount - a.minAmount || a.price - b.price)[0];
  if (closestLowerPaidRate) return [closestLowerPaidRate];

  return paidRates.sort((a, b) => a.minAmount - b.minAmount || a.price - b.price).slice(0, 1);
}

export async function calculateShippingOptions(country: string | undefined, orderTotal: number, isPro: boolean = false, postalCode?: string | null): Promise<ShippingOption[]> {
  const safeTotal = Number.isFinite(orderTotal) ? Math.max(0, orderTotal) : 0;
  const c = resolveCountryFromPostalCode(country || "FR", postalCode);
  const zones = await listShippingZones();
  const zone = zones.find((candidate) => candidate.countries.map((item) => item.toUpperCase()).includes(c));

  if (!zone) return [];

  const proFreeShipping = isPro && safeTotal >= PRO_FREE_SHIPPING_THRESHOLD;

  if (isPro && c === "FR") {
    return FRANCE_PRO_SHIPPING_RATES.map((rate) => ({
      id: rate.id,
      label: rate.label,
      price: proFreeShipping ? 0 : rate.price,
      carrier: rate.carrier,
      days: rate.days,
      isFree: proFreeShipping,
      zoneId: zone.id,
      zoneName: zone.name,
      minAmount: 0,
      maxAmount: null,
      freeThreshold: PRO_FREE_SHIPPING_THRESHOLD,
    }));
  }

  const eligibleRates = proFreeShipping
    ? zone.rates.filter((rate) => rateMatchesAmount(rate, safeTotal))
    : isPro
      ? resolveProPaidRates(zone.rates, safeTotal)
      : zone.rates.filter((rate) => rateMatchesAmount(rate, safeTotal));

  return eligibleRates.map((rate) => {
    const isRateFree = proFreeShipping || (!isPro && (isFreeRate(rate) || hasReachedRateFreeThreshold(rate, safeTotal)));
    return {
      id: rate.id,
      label: rate.name,
      price: isRateFree ? 0 : roundMoney(rate.price),
      carrier: rate.carrier || zone.name,
      days: rate.deliveryTime || "Délai indicatif non renseigné",
      isFree: isRateFree,
      zoneId: zone.id,
      zoneName: zone.name,
      minAmount: rate.minAmount,
      maxAmount: rate.maxAmount,
      freeThreshold: rate.freeThreshold ?? null,
    };
  });
}

export async function calculateFreeShippingRemaining(country: string | undefined, orderTotal: number, isPro: boolean = false, postalCode?: string | null): Promise<number> {
  const safeTotal = Number.isFinite(orderTotal) ? Math.max(0, orderTotal) : 0;
  if (isPro) return roundMoney(Math.max(0, PRO_FREE_SHIPPING_THRESHOLD - safeTotal));

  const c = resolveCountryFromPostalCode(country || "FR", postalCode);
  const zones = await listShippingZones();
  const zone = zones.find((candidate) => candidate.countries.map((item) => item.toUpperCase()).includes(c));
  const freeThreshold = zone?.rates
    .map((rate) => (typeof rate.freeThreshold === "number" && Number.isFinite(rate.freeThreshold) ? rate.freeThreshold : isFreeRate(rate) ? rate.minAmount : null))
    .filter((threshold): threshold is number => threshold !== null)
    .sort((a, b) => a - b)[0];

  if (freeThreshold === undefined) return 0;
  return roundMoney(Math.max(0, freeThreshold - safeTotal));
}

export async function getFreeShippingThresholdForCountry(country: string | undefined, isPro: boolean = false, postalCode?: string | null): Promise<number | null> {
  if (isPro) return PRO_FREE_SHIPPING_THRESHOLD;
  const c = resolveCountryFromPostalCode(country || "FR", postalCode);
  const zones = await listShippingZones();
  const zone = zones.find((candidate) => candidate.countries.map((item) => item.toUpperCase()).includes(c));
  const freeThreshold = zone?.rates
    .map((rate) => (typeof rate.freeThreshold === "number" && Number.isFinite(rate.freeThreshold) ? rate.freeThreshold : isFreeRate(rate) ? rate.minAmount : null))
    .filter((threshold): threshold is number => threshold !== null)
    .sort((a, b) => a - b)[0];
  return freeThreshold ?? null;
}
