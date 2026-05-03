export interface ShippingOption {
  id: string;
  label: string;
  price: number;
  carrier: string;
  days: string;
  isFree: boolean;
}

export const FREE_SHIPPING_THRESHOLD = 49;
export const PRO_FREE_SHIPPING_THRESHOLD = 500;

export function getFreeShippingThreshold(isPro: boolean = false): number {
  return isPro ? PRO_FREE_SHIPPING_THRESHOLD : FREE_SHIPPING_THRESHOLD;
}

const EU_COUNTRIES = [
  "FR",
  "BE",
  "NL",
  "DE",
  "IT",
  "ES",
  "PT",
  "AT",
  "LU",
  "IE",
  "GR",
  "FI",
  "SE",
  "DK",
  "PL",
  "CZ",
  "HU",
  "RO",
  "SK",
  "SI",
  "HR",
  "BG",
  "LT",
  "LV",
  "EE",
  "CY",
  "MT",
  "CH",
  "NO",
  "IS",
  "LI",
];

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateFreeShippingRemaining(orderTotal: number, isPro: boolean = false): number {
  const freeThreshold = getFreeShippingThreshold(isPro);
  return roundMoney(Math.max(0, freeThreshold - orderTotal));
}

export function calculateShippingOptions(country: string | undefined, orderTotal: number, isPro: boolean = false): ShippingOption[] {
  const safeTotal = Number.isFinite(orderTotal) ? Math.max(0, orderTotal) : 0;
  const freeThreshold = getFreeShippingThreshold(isPro);
  const isFree = safeTotal >= freeThreshold;
  const c = (country || "FR").toUpperCase();

  if (c === "FR") {
    return [
      {
        id: "colissimo_fr",
        label: "Colissimo — Livraison à domicile",
        price: isFree ? 0 : 5.9,
        carrier: "Colissimo",
        days: "2-3 jours ouvrés",
        isFree,
      },
      {
        id: "mondial_relay_fr",
        label: "Mondial Relay — Point relais",
        price: isFree ? 0 : 3.99,
        carrier: "Mondial Relay",
        days: "3-5 jours ouvrés",
        isFree,
      },
    ];
  }

  if (c === "BE" || c === "LU") {
    return [
      {
        id: "colissimo_be",
        label: "Colissimo — Livraison à domicile",
        price: isFree ? 0 : 7.9,
        carrier: "Colissimo",
        days: "3-4 jours ouvrés",
        isFree,
      },
      {
        id: "mondial_relay_be",
        label: "Mondial Relay — Point relais",
        price: isFree ? 0 : 4.99,
        carrier: "Mondial Relay",
        days: "4-6 jours ouvrés",
        isFree,
      },
    ];
  }

  if (c === "CH") {
    return [
      {
        id: "colissimo_ch",
        label: "Colissimo — Livraison à domicile",
        price: isFree ? 0 : 14.9,
        carrier: "Colissimo",
        days: "4-6 jours ouvrés",
        isFree,
      },
    ];
  }

  if (EU_COUNTRIES.includes(c)) {
    return [
      {
        id: "colissimo_eu",
        label: "Colissimo — Livraison Europe",
        price: isFree ? 0 : 12.9,
        carrier: "Colissimo",
        days: "4-7 jours ouvrés",
        isFree,
      },
    ];
  }

  return [
    {
      id: "colissimo_world",
      label: "Colissimo — Livraison internationale",
      price: 19.9,
      carrier: "Colissimo",
      days: "7-14 jours ouvrés",
      isFree: false,
    },
  ];
}
