export function parseImages(imagesStr: string): string[] {
  try {
    const parsed = JSON.parse(imagesStr);
    if (Array.isArray(parsed)) return parsed;
    return [imagesStr];
  } catch {
    if (imagesStr && imagesStr.trim()) return [imagesStr];
    return [];
  }
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(price);
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export function getDiscount(price: number, originalPrice: number | null): number | null {
  if (!originalPrice || originalPrice <= price) return null;
  return Math.round(((originalPrice - price) / originalPrice) * 100);
}
