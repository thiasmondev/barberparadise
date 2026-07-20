/**
 * searchUtils.ts — Utilitaires de recherche produit partagés côté backend
 *
 * Centralise la logique de recherche par mots-clés indépendants (AND logique)
 * pour éviter les divergences entre les routes /api/products et /api/admin/products.
 */

/**
 * Normalise un texte pour la recherche : supprime les accents, met en minuscules,
 * remplace les caractères non alphanumériques par des espaces.
 */
export function normalizeSearchText(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildSearchTermVariants(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const variants = new Set<string>([trimmed]);
  const apostropheChars = /['''`´]/g;
  const normalizedApostrophe = trimmed.replace(apostropheChars, "'");
  variants.add(normalizedApostrophe);
  variants.add(normalizedApostrophe.replace(/'/g, "\u2019"));
  variants.add(normalizedApostrophe.replace(/'/g, "\u2018"));
  return Array.from(variants).filter(Boolean);
}

/**
 * Construit les conditions Prisma pour un mot-clé unique sur tous les champs pertinents.
 */
export function buildSingleKeywordConditions(
  keyword: string,
  includeDescription = false
): object[] {
  const terms = buildSearchTermVariants(keyword);
  return terms.flatMap((term) => [
    { name: { contains: term, mode: "insensitive" as const } },
    ...(includeDescription
      ? [{ description: { contains: term, mode: "insensitive" as const } }]
      : []),
    { brand: { contains: term, mode: "insensitive" as const } },
    { slug: { contains: term, mode: "insensitive" as const } },
    { category: { contains: term, mode: "insensitive" as const } },
    { tags: { contains: term, mode: "insensitive" as const } },
    { variants: { some: { name: { contains: term, mode: "insensitive" as const } } } },
    { variants: { some: { sku: { contains: term, mode: "insensitive" as const } } } },
    { variants: { some: { color: { contains: term, mode: "insensitive" as const } } } },
    { variants: { some: { size: { contains: term, mode: "insensitive" as const } } } },
  ]);
}

/**
 * Construit les conditions Prisma pour une requête multi-mots (AND logique).
 *
 * Retourne un tableau utilisable dans `where.OR` (Prisma) :
 *   - 1 mot  → tableau de conditions OR classiques
 *   - N mots → [{ AND: [{ OR: [...] }, { OR: [...] }, ...] }]
 *
 * Usage dans une route :
 *   const conds = buildProductSearchConditions(search, false);
 *   if (conds.length === 1 && "AND" in conds[0]) {
 *     where.AND = (conds[0] as any).AND;
 *   } else {
 *     where.OR = conds;
 *   }
 */
export function buildProductSearchConditions(
  query: string,
  includeDescription = false
): object[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];

  const keywords = normalized.split(/\s+/).filter((w) => w.length >= 1);
  if (keywords.length === 0) return [];

  if (keywords.length === 1) {
    return buildSingleKeywordConditions(keywords[0], includeDescription);
  }

  const andConditions: object[] = keywords.map((keyword) => ({
    OR: buildSingleKeywordConditions(keyword, includeDescription),
  }));
  return [{ AND: andConditions }];
}

/**
 * Applique buildProductSearchConditions sur un objet `where` Prisma existant.
 * Modifie `where` en place et retourne-le.
 */
export function applyProductSearch(
  where: Record<string, unknown>,
  search: string | undefined,
  includeDescription = false
): Record<string, unknown> {
  if (!search?.trim()) return where;

  const conds = buildProductSearchConditions(search, includeDescription);
  if (conds.length === 0) return where;

  if (conds.length === 1 && "AND" in (conds[0] as object)) {
    // Multi-mots : AND logique
    const existingAnd = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
    where.AND = [...existingAnd, ...(conds[0] as { AND: object[] }).AND];
  } else {
    // Mot unique : OR classique
    where.OR = conds;
  }
  return where;
}
