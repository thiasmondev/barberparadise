import { describe, expect, it } from "vitest";
import { isExactActiveHref } from "../frontend/src/utils/navigation";
import { buildCategorySlugFilter, collectChildSlugs } from "../backend/src/utils/categoryFilters";

describe("Header navigation active state", () => {
  it("matches only the exact pathname for links without query parameters", () => {
    expect(isExactActiveHref("/marques", new URLSearchParams(), "/marques")).toBe(true);
    expect(isExactActiveHref("/marques/niveau-2", new URLSearchParams(), "/marques")).toBe(false);
    expect(isExactActiveHref("/catalogue", new URLSearchParams(), "/marques")).toBe(false);
  });

  it("matches query-based navigation items without broad startsWith behavior", () => {
    expect(isExactActiveHref("/catalogue", new URLSearchParams("sort=newest"), "/catalogue?sort=newest")).toBe(true);
    expect(isExactActiveHref("/catalogue", new URLSearchParams("category=produit"), "/catalogue?sort=newest")).toBe(false);
    expect(isExactActiveHref("/nouveautes", new URLSearchParams(), "/catalogue?sort=newest")).toBe(false);
  });

  it("activates PRODUITS and MATÉRIEL only for their exact expected category query", () => {
    expect(isExactActiveHref("/catalogue", new URLSearchParams("category=produit"), "/catalogue?category=produit")).toBe(true);
    expect(isExactActiveHref("/catalogue", new URLSearchParams("category=materiel"), "/catalogue?category=produit")).toBe(false);
    expect(isExactActiveHref("/catalogue", new URLSearchParams("category=materiel"), "/catalogue?category=materiel")).toBe(true);
  });
});

describe("Products category recursive filtering", () => {
  it("collects children and grandchildren slugs recursively", async () => {
    const tree: Record<string, Array<{ slug: string }>> = {
      produit: [{ slug: "cheveux" }, { slug: "barbe" }],
      cheveux: [{ slug: "cires" }, { slug: "sprays" }],
      cires: [{ slug: "cire-brillante" }],
      "cire-brillante": [],
      sprays: [],
      barbe: [{ slug: "gel" }],
      gel: [],
    };

    const slugs = await collectChildSlugs("produit", async (parentSlug) => tree[parentSlug] ?? []);

    expect(slugs).toEqual([
      "produit",
      "cheveux",
      "cires",
      "cire-brillante",
      "sprays",
      "barbe",
      "gel",
    ]);
  });

  it("deduplicates cyclic category references to avoid infinite recursion", async () => {
    const tree: Record<string, Array<{ slug: string }>> = {
      materiel: [{ slug: "tondeuses" }],
      tondeuses: [{ slug: "materiel" }, { slug: "sabots" }],
      sabots: [],
    };

    const slugs = await collectChildSlugs("materiel", async (parentSlug) => tree[parentSlug] ?? []);

    expect(slugs).toEqual(["materiel", "tondeuses", "sabots"]);
  });

  it("builds a Prisma OR filter covering category, subcategory and subsubcategory", () => {
    const slugs = ["produit", "cheveux", "cires", "cire-brillante"];

    expect(buildCategorySlugFilter(slugs)).toEqual([
      { category: { in: slugs, mode: "insensitive" } },
      { subcategory: { in: slugs, mode: "insensitive" } },
      { subsubcategory: { in: slugs, mode: "insensitive" } },
    ]);
  });
});
