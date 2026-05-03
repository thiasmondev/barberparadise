"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightIcon, SlidersHorizontal, X, ArrowRight } from "lucide-react";
import { getProducts, getCategories } from "@/lib/api";
import type { Product, Category } from "@/types";
import Link from "next/link";

const SORT_OPTIONS = [
  { value: "newest", label: "NOUVEAUTÉS" },
  { value: "price_asc", label: "PRIX CROISSANT" },
  { value: "price_desc", label: "PRIX DÉCROISSANT" },
  { value: "name_asc", label: "A — Z" },
];

const PRICE_RANGES = [
  { label: "Tous les prix", min: 0, max: 9999 },
  { label: "Moins de 20€", min: 0, max: 20 },
  { label: "20€ — 50€", min: 20, max: 50 },
  { label: "50€ — 100€", min: 50, max: 100 },
  { label: "Plus de 100€", min: 100, max: 9999 },
];

const EXCLUDED_CATEGORY_SLUGS = ["marque"];

function formatPrice(price: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(price);
}

function parseImages(images: unknown): string[] {
  if (!images) return [];
  if (Array.isArray(images)) return images as string[];
  if (typeof images === "string") {
    try { return JSON.parse(images); } catch { return [images]; }
  }
  return [];
}

/** Retourne tous les slugs ancêtres d'un slug donné dans la liste de catégories */
function getAncestorSlugs(slug: string, cats: Category[]): string[] {
  const ancestors: string[] = [];
  let current = cats.find((c) => c.slug === slug);
  while (current?.parentSlug) {
    ancestors.push(current.parentSlug);
    current = cats.find((c) => c.slug === current!.parentSlug);
  }
  return ancestors;
}

export default function CatalogueContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [priceRange, setPriceRange] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  // Accordion : ensemble des slugs ouverts
  const [openSlugs, setOpenSlugs] = useState<Set<string>>(new Set());

  const page = Number(searchParams.get("page")) || 1;
  const category = searchParams.get("category") || "";
  const search = searchParams.get("search") || "";
  const sort = searchParams.get("sort") || "newest";
  const promo = searchParams.get("promo") || "";

  // Charger toutes les catégories depuis l'API
  useEffect(() => {
    getCategories()
      .then((cats) => {
        const filtered = cats.filter((c) => !EXCLUDED_CATEGORY_SLUGS.includes(c.slug));
        filtered.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setCategories(filtered);
        // Si une catégorie est active, ouvrir automatiquement ses ancêtres
        if (category) {
          const ancestors = getAncestorSlugs(category, filtered);
          // Aussi ouvrir le parent direct de la catégorie active
          const active = filtered.find((c) => c.slug === category);
          if (active?.parentSlug) ancestors.push(active.parentSlug);
          setOpenSlugs(new Set([...ancestors, category]));
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Quand la catégorie URL change, ouvrir les ancêtres
  useEffect(() => {
    if (category && categories.length > 0) {
      const ancestors = getAncestorSlugs(category, categories);
      const active = categories.find((c) => c.slug === category);
      if (active?.parentSlug) ancestors.push(active.parentSlug);
      setOpenSlugs(new Set([...ancestors, category]));
    }
  }, [category, categories]);

  const toggleSlug = (slug: string) => {
    setOpenSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getProducts({
        page,
        limit: 20,
        category: category || undefined,
        search: search || undefined,
        sort,
      });
      let filtered = data.products;
      if (promo === "true") {
        filtered = filtered.filter((p) => p.originalPrice && p.originalPrice > p.price);
      }
      const range = PRICE_RANGES[priceRange];
      if (priceRange > 0) {
        filtered = filtered.filter((p) => p.price >= range.min && p.price <= range.max);
      }
      setProducts(filtered);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      setProducts([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, category, search, sort, promo, priceRange]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const updateParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== "page") params.delete("page");
    router.push(`/catalogue?${params.toString()}`);
  };

  // Titre dynamique
  const getTitle = () => {
    if (search) return `"${search}"`;
    if (!category) return "CATALOGUE";
    const found = categories.find((c) => c.slug === category);
    if (found) return found.name.toUpperCase();
    return category.replace(/-/g, " ").toUpperCase();
  };

  const title = getTitle();

  // Rendu récursif d'un nœud de catégorie
  const renderCatNode = (cat: Category, depth: number = 0) => {
    const children = categories.filter((c) => c.parentSlug === cat.slug);
    const hasChildren = children.length > 0;
    const isOpen = openSlugs.has(cat.slug);
    const isActive = category === cat.slug;

    const indent = depth === 0 ? "" : depth === 1 ? "ml-3 pl-3 border-l border-white/10" : "ml-3 pl-2 border-l border-white/5";

    return (
      <div key={cat.slug} className={depth > 0 ? indent : ""}>
        <div className="flex items-center justify-between">
          <button
            onClick={() => { updateParams("category", cat.slug); setFiltersOpen(false); }}
            className={`text-left transition-colors flex-1 ${
              depth === 0
                ? `text-sm font-semibold py-0.5 ${isActive ? "text-[#ff4a8d]" : "text-gray-300 hover:text-white"}`
                : depth === 1
                ? `text-xs py-0.5 ${isActive ? "text-[#ff4a8d] font-bold" : "text-gray-400 hover:text-white"}`
                : `text-[11px] py-0.5 ${isActive ? "text-[#ff4a8d] font-bold" : "text-gray-500 hover:text-gray-300"}`
            }`}
          >
            {depth === 2 ? `↳ ${cat.name}` : cat.name}
          </button>
          {hasChildren && (
            <button
              onClick={() => toggleSlug(cat.slug)}
              className="p-1 text-gray-500 hover:text-white transition-colors flex-shrink-0"
              aria-label={isOpen ? "Fermer" : "Ouvrir"}
            >
              {isOpen
                ? <ChevronDown size={12} />
                : <ChevronRightIcon size={12} />
              }
            </button>
          )}
        </div>
        {hasChildren && isOpen && (
          <div className="mt-1 mb-1 flex flex-col gap-1">
            {children.map((child) => renderCatNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-[#131313] min-h-screen text-[#e5e2e1]">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-12 flex flex-col md:flex-row gap-12">

        {/* Sidebar Filters */}
        <aside className={`
          fixed inset-0 z-50 bg-[#131313] p-8 overflow-y-auto transition-transform duration-300 md:relative md:inset-auto md:z-auto md:bg-transparent md:p-0 md:w-64 md:flex-shrink-0 md:translate-x-0
          ${filtersOpen ? "translate-x-0" : "-translate-x-full"}
        `}>
          <div className="flex items-center justify-between mb-10 md:hidden">
            <h2 className="text-xl font-black tracking-tighter uppercase">FILTRES</h2>
            <button onClick={() => setFiltersOpen(false)}>
              <X size={24} />
            </button>
          </div>

          <div className="space-y-10">
            {/* Catégories */}
            <div>
              <h3 className="text-[10px] font-black tracking-[0.3em] text-gray-500 uppercase mb-6">CATÉGORIE</h3>
              <div className="flex flex-col gap-2">
                {/* Tous les produits */}
                <button
                  onClick={() => { updateParams("category", ""); setFiltersOpen(false); }}
                  className={`text-left text-sm transition-colors ${
                    !category ? "text-[#ff4a8d] font-bold" : "text-gray-400 hover:text-white"
                  }`}
                >
                  Tous les produits
                </button>
                {/* Catégories racines cliquables : produit et materiel, avec leurs enfants en retrait */}
                {categories
                  .filter((c) => !c.parentSlug && !EXCLUDED_CATEGORY_SLUGS.includes(c.slug))
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  .map((root) => renderCatNode(root, 0))}
              </div>
            </div>

            {/* Prix */}
            <div>
              <h3 className="text-[10px] font-black tracking-[0.3em] text-gray-500 uppercase mb-6">PRIX</h3>
              <div className="flex flex-col gap-3">
                {PRICE_RANGES.map((range, i) => (
                  <button
                    key={i}
                    onClick={() => setPriceRange(i)}
                    className={`text-left text-sm transition-colors ${
                      priceRange === i
                        ? "text-[#ff4a8d] font-bold"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tri */}
            <div>
              <h3 className="text-[10px] font-black tracking-[0.3em] text-gray-500 uppercase mb-6">TRIER PAR</h3>
              <div className="flex flex-col gap-3">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateParams("sort", opt.value)}
                    className={`text-left text-sm transition-colors ${
                      sort === opt.value
                        ? "text-[#ff4a8d] font-bold"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Promo */}
            <div>
              <h3 className="text-[10px] font-black tracking-[0.3em] text-gray-500 uppercase mb-6">OFFRES</h3>
              <button
                onClick={() => updateParams("promo", promo === "true" ? "" : "true")}
                className={`text-sm transition-colors ${
                  promo === "true" ? "text-[#ff4a8d] font-bold" : "text-gray-400 hover:text-white"
                }`}
              >
                Promotions uniquement
              </button>
            </div>
          </div>
        </aside>

        {/* Overlay mobile */}
        {filtersOpen && (
          <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setFiltersOpen(false)} />
        )}

        {/* Product Grid */}
        <div className="flex-grow">
          {/* Header */}
          <div className="flex justify-between items-end mb-10">
            <div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase italic mb-2">{title}</h1>
              <p className="text-gray-500 text-xs uppercase tracking-widest">
                {loading ? "Chargement..." : `${total} produit${total !== 1 ? "s" : ""}`}
              </p>
            </div>
            <button
              onClick={() => setFiltersOpen(true)}
              className="md:hidden flex items-center gap-2 text-xs font-black tracking-widest uppercase text-white border border-white/10 px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <SlidersHorizontal size={14} />
              FILTRES
            </button>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-[#1c1b1b] aspect-[4/5] animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-32 border border-white/5">
              <p className="text-gray-500 uppercase tracking-widest text-xs mb-8">Aucun produit trouvé</p>
              <button
                onClick={() => router.push("/catalogue")}
                className="bg-[#ff4a8d] text-white px-8 py-4 text-xs font-black tracking-widest uppercase hover:bg-[#ff1f70] transition-colors"
              >
                VOIR TOUT
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map((product, index) => {
                const images = parseImages(product.images);
                const img = images[0] || "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&q=80";
                const isHighlight = index === 0;
                const publicPrice = typeof product.pricePublic === "number" ? product.pricePublic : product.price;
                const proPrice = typeof product.priceProEur === "number" ? product.priceProEur : null;
                const showsProPrice = Boolean(product.isPro && proPrice !== null);
                const displayedPrice = showsProPrice ? proPrice! : product.price;
                return (
                  <Link
                    key={product.id}
                    href={`/produit/${product.slug}`}
                    className={`group relative bg-[#1c1b1b] overflow-hidden flex flex-col ${isHighlight ? "sm:col-span-2 row-span-2" : ""}`}
                  >
                    <div className={`relative overflow-hidden bg-[#2a2a2a] ${isHighlight ? "aspect-square" : "aspect-[4/5]"}`}>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10 opacity-60 group-hover:opacity-90 transition-opacity" />
                      <img
                        src={img}
                        alt={product.name}
                        className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                      />
                      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
                        {showsProPrice && (
                          <span className="bg-amber-400 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-black">PRIX PRO</span>
                        )}
                        {product.originalPrice && product.originalPrice > publicPrice && (
                          <span className="bg-[#ff4a8d] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">PROMO</span>
                        )}
                      </div>
                    </div>
                    <div className={`p-4 flex flex-col justify-between flex-grow ${isHighlight ? "p-6" : ""}`}>
                      <div>
                        <h3 className={`font-black tracking-tight mb-1 group-hover:text-[#ffb1c4] transition-colors ${isHighlight ? "text-xl" : "text-sm"}`}>
                          {product.name}
                        </h3>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">{product.brand}</p>
                      </div>
                      <div className="flex justify-between items-end mt-4 gap-3">
                        <div>
                          {showsProPrice && (
                            <span className="mb-1 inline-flex bg-amber-400/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-300">Prix pro HT</span>
                          )}
                          <span className={`block font-black ${isHighlight ? "text-xl" : "text-base"} text-white`}>
                            {formatPrice(displayedPrice)}{showsProPrice ? " HT" : ""}
                          </span>
                          {showsProPrice && (
                            <span className="block text-[11px] text-gray-500 line-through">Public {formatPrice(publicPrice)} TTC</span>
                          )}
                        </div>
                        <ArrowRight size={14} className="text-gray-500 group-hover:text-[#ff4a8d] transition-colors shrink-0" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-16">
              <button
                onClick={() => updateParams("page", String(page - 1))}
                disabled={page <= 1}
                className="w-10 h-10 border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    onClick={() => updateParams("page", String(p))}
                    className={`w-10 h-10 text-xs font-black tracking-widest transition-colors ${
                      p === page
                        ? "bg-[#ff4a8d] text-white"
                        : "border border-white/10 text-gray-400 hover:bg-white/5"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              {totalPages > 7 && <span className="text-gray-600 text-xs">...</span>}
              <button
                onClick={() => updateParams("page", String(page + 1))}
                disabled={page >= totalPages}
                className="w-10 h-10 border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
