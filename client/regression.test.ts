import { describe, expect, it } from "vitest";
import { isExactActiveHref } from "../frontend/src/utils/navigation";
import { buildCategorySlugFilter, collectChildSlugs } from "../backend/src/utils/categoryFilters";
import { getMegaMenuChildren, hasMegaMenuChildren } from "../frontend/src/utils/megaMenu";

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

describe("Mega-menu category columns", () => {
  const categories = [
    { slug: "produit", name: "Produit", parentSlug: null, order: 1 },
    { slug: "cheveux", name: "Cheveux", parentSlug: "produit", order: 2 },
    { slug: "barbe", name: "Barbe", parentSlug: "produit", order: 1 },
    { slug: "cires", name: "Cires coiffantes", parentSlug: "cheveux", order: 2 },
    { slug: "sprays", name: "Sprays", parentSlug: "cheveux", order: 1 },
    { slug: "cire-mate", name: "Cire mate", parentSlug: "cires", order: 2 },
    { slug: "cire-brillante", name: "Cire brillante", parentSlug: "cires", order: 1 },
    { slug: "materiel", name: "Matériel", parentSlug: null, order: 2 },
    { slug: "tondeuses", name: "Tondeuses", parentSlug: "materiel", order: 1 },
    { slug: "tondeuse-finition", name: "Tondeuse de finition", parentSlug: "tondeuses", order: 1 },
    { slug: "lame-finition", name: "Lame de finition", parentSlug: "tondeuse-finition", order: 1 },
  ];

  it("builds ordered L1, L2 and L3 columns for products", () => {
    const colL1 = getMegaMenuChildren(categories, "produit");
    const colL2 = getMegaMenuChildren(categories, "cheveux");
    const colL3 = getMegaMenuChildren(categories, "cires");

    expect(colL1.map((category) => category.slug)).toEqual(["barbe", "cheveux"]);
    expect(colL2.map((category) => category.slug)).toEqual(["sprays", "cires"]);
    expect(colL3.map((category) => category.slug)).toEqual(["cire-brillante", "cire-mate"]);
  });

  it("detects whether the chevron should be shown for level 2 items", () => {
    expect(hasMegaMenuChildren(categories, "cires")).toBe(true);
    expect(hasMegaMenuChildren(categories, "sprays")).toBe(false);
    expect(getMegaMenuChildren(categories, "sprays")).toEqual([]);
  });

  it("builds ordered L1, L2 and L3 columns for equipment", () => {
    const colL1 = getMegaMenuChildren(categories, "materiel");
    const colL2 = getMegaMenuChildren(categories, "tondeuses");
    const colL3 = getMegaMenuChildren(categories, "tondeuse-finition");

    expect(colL1.map((category) => category.slug)).toEqual(["tondeuses"]);
    expect(colL2.map((category) => category.slug)).toEqual(["tondeuse-finition"]);
    expect(colL3.map((category) => category.slug)).toEqual(["lame-finition"]);
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
