/**
 * search-utils.ts — Utilitaires de recherche partagés côté frontend
 *
 * Centralise la logique de recherche par mots-clés indépendants (AND logique)
 * pour éviter les divergences entre les différentes pages admin.
 *
 * Principe :
 *   - La requête est découpée en mots-clés individuels.
 *   - Chaque mot-clé doit être présent dans au moins un des champs fournis (OR entre champs).
 *   - Tous les mots-clés doivent matcher (AND entre mots-clés).
 *   - Insensible à la casse et à l'ordre des mots.
 *
 * Exemple : "lame style craft" → ["lame", "style", "craft"]
 *   → "lame" dans name ✓  ET "style" dans brand ✓  ET "craft" dans brand ✓  → match
 */

/**
 * Vérifie si un objet correspond à une requête de recherche.
 *
 * @param query   La chaîne saisie par l'utilisateur (peut contenir plusieurs mots).
 * @param fields  Les valeurs des champs à inspecter (null/undefined ignorés).
 * @returns       true si tous les mots-clés sont trouvés dans au moins un champ.
 */
export function matchesKeywords(query: string, fields: (string | null | undefined)[]): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true; // Pas de filtre → tout passe

  const keywords = normalized.split(/\s+/).filter((w) => w.length >= 1);
  if (keywords.length === 0) return true;

  const normalizedFields = fields
    .filter((f): f is string => typeof f === "string" && f.length > 0)
    .map((f) => f.toLowerCase());

  // AND logique : chaque mot-clé doit matcher au moins un champ
  return keywords.every((kw) => normalizedFields.some((field) => field.includes(kw)));
}
