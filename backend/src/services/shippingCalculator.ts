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
}

export const FALLBACK_FREE_SHIPPING_THRESHOLD = 49;
export const PRO_FREE_SHIPPING_THRESHOLD = 500;

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

export async function calculateShippingOptions(country: string | undefined, orderTotal: number, isPro: boolean = false): Promise<ShippingOption[]> {
  const safeTotal = Number.isFinite(orderTotal) ? Math.max(0, orderTotal) : 0;
  const c = (country || "FR").toUpperCase();
  const zones = await listShippingZones();
  const zone = zones.find((candidate) => candidate.countries.map((item) => item.toUpperCase()).includes(c));

  if (!zone) return [];

  const eligibleRates = zone.rates.filter((rate) => rateMatchesAmount(rate, safeTotal));
  const proFreeShipping = isPro && safeTotal >= PRO_FREE_SHIPPING_THRESHOLD;

  return eligibleRates.map((rate) => ({
    id: rate.id,
    label: rate.name,
    price: proFreeShipping || rate.isFree ? 0 : roundMoney(rate.price),
    carrier: zone.name,
    days: rate.deliveryTime || "Délai indicatif non renseigné",
    isFree: proFreeShipping || rate.isFree || roundMoney(rate.price) === 0,
    zoneId: zone.id,
    zoneName: zone.name,
    minAmount: rate.minAmount,
    maxAmount: rate.maxAmount,
  }));
}

export async function calculateFreeShippingRemaining(country: string | undefined, orderTotal: number, isPro: boolean = false): Promise<number> {
  const safeTotal = Number.isFinite(orderTotal) ? Math.max(0, orderTotal) : 0;
  if (isPro) return roundMoney(Math.max(0, PRO_FREE_SHIPPING_THRESHOLD - safeTotal));

  const c = (country || "FR").toUpperCase();
  const zones = await listShippingZones();
  const zone = zones.find((candidate) => candidate.countries.map((item) => item.toUpperCase()).includes(c));
  const freeRate = zone?.rates
    .filter((rate) => rate.isFree || roundMoney(rate.price) === 0)
    .sort((a, b) => a.minAmount - b.minAmount)[0];

  if (!freeRate) return 0;
  return roundMoney(Math.max(0, freeRate.minAmount - safeTotal));
}

export async function getFreeShippingThresholdForCountry(country: string | undefined, isPro: boolean = false): Promise<number | null> {
  if (isPro) return PRO_FREE_SHIPPING_THRESHOLD;
  const c = (country || "FR").toUpperCase();
  const zones = await listShippingZones();
  const zone = zones.find((candidate) => candidate.countries.map((item) => item.toUpperCase()).includes(c));
  const freeRate = zone?.rates
    .filter((rate) => rate.isFree || roundMoney(rate.price) === 0)
    .sort((a, b) => a.minAmount - b.minAmount)[0];
  return freeRate?.minAmount ?? null;
}
