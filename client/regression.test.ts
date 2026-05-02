import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isExactActiveHref } from "../frontend/src/utils/navigation";
import { buildCategorySlugFilter, collectChildSlugs } from "../backend/src/utils/categoryFilters";
import { calculateFreeShippingRemaining, calculateShippingOptions } from "../backend/src/services/shippingCalculator";
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

  it("activates the dedicated Nouveautés route without relying on catalogue query sorting", () => {
    expect(isExactActiveHref("/nouveautes", new URLSearchParams(), "/nouveautes")).toBe(true);
    expect(isExactActiveHref("/nouveautes", new URLSearchParams("sort=newest"), "/nouveautes")).toBe(false);
    expect(isExactActiveHref("/catalogue", new URLSearchParams("sort=newest"), "/nouveautes")).toBe(false);
  });

  it("activates PRODUITS and MATÉRIEL only for their exact expected category query", () => {
    expect(isExactActiveHref("/catalogue", new URLSearchParams("category=produit"), "/catalogue?category=produit")).toBe(true);
    expect(isExactActiveHref("/catalogue", new URLSearchParams("category=materiel"), "/catalogue?category=produit")).toBe(false);
    expect(isExactActiveHref("/catalogue", new URLSearchParams("category=materiel"), "/catalogue?category=materiel")).toBe(true);
  });
});

describe("Nouveautés storefront regressions", () => {
  const repoRoot = resolve(__dirname, "..");

  it("keeps the homepage free of the manually inserted parasite category menu", () => {
    const homeSource = readFileSync(resolve(repoRoot, "frontend/src/app/page.tsx"), "utf8");

    expect(homeSource).not.toContain("PRODUIT / MATÉRIEL / MARQUES / TOUT VOIR");
    expect(homeSource).not.toContain("Tout voir →");
  });

  it("keeps the header Nouveautés links pointed to the dedicated route", () => {
    const headerSource = readFileSync(resolve(repoRoot, "frontend/src/components/Header.tsx"), "utf8");

    expect(headerSource.match(/label: "NOUVEAUTÉS", href: "\/nouveautes"/g)).toHaveLength(2);
    expect(headerSource).not.toContain('label: "NOUVEAUTÉS", href: "/catalogue?sort=newest"');
  });

  it("loads /nouveautes with isNew=true and updated_desc ordering", () => {
    const nouveautesSource = readFileSync(resolve(repoRoot, "frontend/src/app/nouveautes/page.tsx"), "utf8");
    const productsRouteSource = readFileSync(resolve(repoRoot, "backend/src/routes/products.ts"), "utf8");

    expect(nouveautesSource).toContain("isNew: true");
    expect(nouveautesSource).toContain('sort: "updated_desc"');
    expect(productsRouteSource).toContain('if (isNew === "true") where.isNew = true');
    expect(productsRouteSource).toContain('sort === "updated_desc"');
    expect(productsRouteSource).toContain('updatedAt: "desc"');
  });

  it("persists the Nouveautés toggle through the admin product PATCH contract", () => {
    const adminPageSource = readFileSync(resolve(repoRoot, "frontend/src/app/admin/seo/produit/page.tsx"), "utf8");
    const adminRouteSource = readFileSync(resolve(repoRoot, "backend/src/routes/admin.ts"), "utf8");

    expect(adminPageSource).toContain("Mettre en avant dans Nouveautés");
    expect(adminPageSource).toContain("role=\"switch\"");
    expect(adminPageSource).toContain("updateProduct(productId, { isNew: next })");
    expect(adminRouteSource).toContain("isNew: isNew !== undefined ? Boolean(isNew) : undefined");
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

describe("Dynamic shipping calculator", () => {
  it("returns free French delivery options once the threshold is reached", () => {
    const options = calculateShippingOptions("FR", 49);

    expect(options).toHaveLength(2);
    expect(options.map((option) => option.price)).toEqual([0, 0]);
    expect(options.every((option) => option.isFree)).toBe(true);
    expect(calculateFreeShippingRemaining(49)).toBe(0);
  });

  it("keeps the cheapest France estimate below the free-shipping threshold", () => {
    const options = calculateShippingOptions("FR", 24.5);

    expect(options[0]).toMatchObject({ id: "colissimo_fr", price: 5.9, isFree: false });
    expect(options[1]).toMatchObject({ id: "mondial_relay_fr", price: 3.99, isFree: false });
    expect(calculateFreeShippingRemaining(24.5)).toBe(24.5);
  });

  it("applies country-specific options for Belgium, Europe and international destinations", () => {
    expect(calculateShippingOptions("BE", 20).map((option) => option.id)).toEqual([
      "colissimo_be",
      "mondial_relay_be",
    ]);
    expect(calculateShippingOptions("DE", 20)[0]).toMatchObject({ id: "colissimo_eu", price: 12.9 });
    expect(calculateShippingOptions("US", 120)[0]).toMatchObject({
      id: "colissimo_world",
      price: 19.9,
      isFree: false,
    });
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
