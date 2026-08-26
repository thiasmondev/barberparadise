import { parseImages } from "@/lib/utils";

export type ProductImageSource = {
  images?: string | string[] | null;
  image?: string | null;
};

export type VariantImageSource = {
  image?: string | null;
};

function nonEmptyUrl(value: string | null | undefined): string | null {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || null;
}

/**
 * Résout l’image à montrer lorsqu’une variante est choisie.
 * Une image de variante prévaut toujours ; l’image principale du produit reste le fallback.
 */
export function getVariantImage(
  product: ProductImageSource | null | undefined,
  variant?: VariantImageSource | null,
): string {
  const variantImage = nonEmptyUrl(variant?.image);
  if (variantImage) return variantImage;

  const images = product?.images == null ? [] : parseImages(product.images);
  return nonEmptyUrl(images[0]) || nonEmptyUrl(product?.image) || "";
}

/**
 * Retourne la galerie produit, avec l’image de variante sélectionnée en première position.
 */
export function getVariantImages(
  product: ProductImageSource | null | undefined,
  variant?: VariantImageSource | null,
): string[] {
  const productImages = product?.images == null ? [] : parseImages(product.images).filter(Boolean);
  const primary = getVariantImage(product, variant);
  if (!primary) return productImages;
  return [primary, ...productImages.filter((image) => image !== primary)];
}

export function hasVariantImage(variant?: VariantImageSource | null): boolean {
  return Boolean(nonEmptyUrl(variant?.image));
}
