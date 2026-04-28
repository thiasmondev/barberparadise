type ChildCategory = {
  slug: string;
};

type FindChildrenByParentSlug = (parentSlug: string) => Promise<ChildCategory[]>;

export async function collectChildSlugs(
  parentSlug: string,
  findChildrenByParentSlug: FindChildrenByParentSlug,
  visited = new Set<string>(),
): Promise<string[]> {
  if (visited.has(parentSlug)) {
    return [];
  }

  visited.add(parentSlug);

  const children = await findChildrenByParentSlug(parentSlug);
  const slugs = [parentSlug];

  for (const child of children) {
    slugs.push(...(await collectChildSlugs(child.slug, findChildrenByParentSlug, visited)));
  }

  return [...new Set(slugs)];
}

export function buildCategorySlugFilter(slugs: string[]) {
  return [
    { category: { in: slugs, mode: "insensitive" as const } },
    { subcategory: { in: slugs, mode: "insensitive" as const } },
    { subsubcategory: { in: slugs, mode: "insensitive" as const } },
  ];
}
