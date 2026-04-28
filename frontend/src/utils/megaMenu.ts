export interface MegaMenuCategoryLike {
  slug: string;
  name?: string;
  parentSlug: string | null;
  order: number;
}

export function getMegaMenuChildren<T extends MegaMenuCategoryLike>(
  categories: T[],
  parentSlug: string | null,
): T[] {
  return categories
    .filter((category) => category.parentSlug === parentSlug)
    .sort((a, b) => a.order - b.order);
}

export function hasMegaMenuChildren<T extends MegaMenuCategoryLike>(
  categories: T[],
  parentSlug: string,
): boolean {
  return categories.some((category) => category.parentSlug === parentSlug);
}
