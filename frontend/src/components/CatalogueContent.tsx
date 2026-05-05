"use client";

import { useEffect, useMemo, useState, useCallback, type CSSProperties } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightIcon, SlidersHorizontal, X, ArrowRight } from "lucide-react";
import { getProducts, getCategories, getBrands } from "@/lib/api";
import type { Product, Category, Brand } from "@/types";
import Link from "next/link";

const SORT_OPTIONS = [
  { value: "newest", label: "NOUVEAUTÉS" },
  { value: "price_asc", label: "PRIX CROISSANT" },
  { value: "price_desc", label: "PRIX DÉCROISSANT" },
  { value: "name_asc", label: "A — Z" },
];
const EXCLUDED_CATEGORY_SLUGS = ["marque"];
const DEFAULT_MIN_PRICE = 0;
const DEFAULT_MAX_PRICE = 500;

function formatPrice(price: number) { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(price); }
function parseImages(images: unknown): string[] { if (!images) return []; if (Array.isArray(images)) return images as string[]; if (typeof images === "string") { try { return JSON.parse(images); } catch { return [images]; } } return []; }
function getAncestorSlugs(slug: string, cats: Category[]): string[] { const ancestors: string[] = []; let current = cats.find((c) => c.slug === slug); while (current?.parentSlug) { ancestors.push(current.parentSlug); current = cats.find((c) => c.slug === current!.parentSlug); } return ancestors; }

export default function CatalogueContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterPanelTop, setFilterPanelTop] = useState(80);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandSearch, setBrandSearch] = useState("");
  const [openSlugs, setOpenSlugs] = useState<Set<string>>(new Set());

  const page = Number(searchParams.get("page")) || 1;
  const category = searchParams.get("category") || "";
  const search = searchParams.get("search") || "";
  const sort = searchParams.get("sort") || "newest";
  const promo = searchParams.get("promo") || "";
  const selectedBrands = searchParams.get("brand")?.split(",").map((v) => v.trim()).filter(Boolean) || [];
  const minPrice = Number(searchParams.get("minPrice") || DEFAULT_MIN_PRICE);
  const maxPrice = Number(searchParams.get("maxPrice") || DEFAULT_MAX_PRICE);
  const inStockOnly = searchParams.get("inStock") === "true";
  const isNewOnly = searchParams.get("isNew") === "true";

  useEffect(() => {
    const updateFilterPanelTop = () => {
      const header = document.querySelector("header");
      const nextTop = header instanceof HTMLElement ? Math.ceil(header.getBoundingClientRect().height) : 80;
      setFilterPanelTop(nextTop);
    };
    updateFilterPanelTop();
    window.addEventListener("resize", updateFilterPanelTop);
    window.visualViewport?.addEventListener("resize", updateFilterPanelTop);
    return () => {
      window.removeEventListener("resize", updateFilterPanelTop);
      window.visualViewport?.removeEventListener("resize", updateFilterPanelTop);
    };
  }, []);
  useEffect(() => {
    getCategories().then((cats) => { const filtered = cats.filter((c) => !EXCLUDED_CATEGORY_SLUGS.includes(c.slug)); filtered.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)); setCategories(filtered); if (category) { const ancestors = getAncestorSlugs(category, filtered); const active = filtered.find((c) => c.slug === category); if (active?.parentSlug) ancestors.push(active.parentSlug); setOpenSlugs(new Set([...ancestors, category])); } }).catch(() => {});
    getBrands().then((items) => setBrands(items.filter((b) => (b.productCount || 0) > 0).sort((a, b) => a.name.localeCompare(b.name, "fr")))).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (category && categories.length > 0) { const ancestors = getAncestorSlugs(category, categories); const active = categories.find((c) => c.slug === category); if (active?.parentSlug) ancestors.push(active.parentSlug); setOpenSlugs(new Set([...ancestors, category])); } }, [category, categories]);
  const toggleSlug = (slug: string) => setOpenSlugs((prev) => { const next = new Set(prev); next.has(slug) ? next.delete(slug) : next.add(slug); return next; });

  const updateParams = (key: string, value: string) => { const params = new URLSearchParams(searchParams.toString()); if (value) params.set(key, value); else params.delete(key); if (key !== "page") params.delete("page"); router.push(`/catalogue?${params.toString()}`); };
  const setBrand = (brandName: string, checked: boolean) => { const next = new Set(selectedBrands); checked ? next.add(brandName) : next.delete(brandName); updateParams("brand", Array.from(next).join(",")); };
  const clearFilters = () => router.push(search ? `/catalogue?search=${encodeURIComponent(search)}` : "/catalogue");
  const clearPriceFilter = () => { const params = new URLSearchParams(searchParams.toString()); params.delete("minPrice"); params.delete("maxPrice"); params.delete("page"); router.push(`/catalogue?${params.toString()}`); };
  const updatePrice = (key: "minPrice" | "maxPrice", rawValue: string) => { const value = Number(rawValue); const params = new URLSearchParams(searchParams.toString()); const nextMin = key === "minPrice" ? Math.min(value, maxPrice) : minPrice; const nextMax = key === "maxPrice" ? Math.max(value, minPrice) : maxPrice; if (nextMin !== DEFAULT_MIN_PRICE) params.set("minPrice", String(nextMin)); else params.delete("minPrice"); if (nextMax !== DEFAULT_MAX_PRICE) params.set("maxPrice", String(nextMax)); else params.delete("maxPrice"); params.delete("page"); router.push(`/catalogue?${params.toString()}`); };

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getProducts({ page, limit: 20, category: category || undefined, search: search || undefined, sort, brand: selectedBrands.join(",") || undefined, minPrice: minPrice !== DEFAULT_MIN_PRICE ? minPrice : undefined, maxPrice: maxPrice !== DEFAULT_MAX_PRICE ? maxPrice : undefined, inStock: inStockOnly || undefined, isNew: isNewOnly || undefined });
      let filtered = data.products;
      if (promo === "true") filtered = filtered.filter((p) => p.originalPrice && p.originalPrice > p.price);
      setProducts(filtered); setTotal(data.total); setTotalPages(data.totalPages);
    } catch { setProducts([]); setTotal(0); setTotalPages(1); }
    finally { setLoading(false); }
  }, [page, category, search, sort, promo, selectedBrands.join(","), minPrice, maxPrice, inStockOnly, isNewOnly]);
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const filteredBrands = useMemo(() => brands.filter((b) => b.name.toLowerCase().includes(brandSearch.toLowerCase())), [brands, brandSearch]);
  const activeBadges = [
    ...selectedBrands.map((brand) => ({ key: `brand-${brand}`, label: `Marque: ${brand}`, remove: () => setBrand(brand, false) })),
    ...(minPrice !== DEFAULT_MIN_PRICE || maxPrice !== DEFAULT_MAX_PRICE ? [{ key: "price", label: `Prix: ${minPrice}-${maxPrice}€`, remove: clearPriceFilter }] : []),
    ...(inStockOnly ? [{ key: "stock", label: "En stock", remove: () => updateParams("inStock", "") }] : []),
    ...(isNewOnly ? [{ key: "new", label: "Nouveautés", remove: () => updateParams("isNew", "") }] : []),
    ...(promo === "true" ? [{ key: "promo", label: "Promotions", remove: () => updateParams("promo", "") }] : []),
  ];

  const getTitle = () => { if (search) return `"${search}"`; if (!category) return "CATALOGUE"; const found = categories.find((c) => c.slug === category); return found ? found.name.toUpperCase() : category.replace(/-/g, " ").toUpperCase(); };
  const renderCatNode = (cat: Category, depth = 0) => { const children = categories.filter((c) => c.parentSlug === cat.slug); const isOpen = openSlugs.has(cat.slug); const isActive = category === cat.slug; const indent = depth === 0 ? "" : depth === 1 ? "ml-3 pl-3 border-l border-white/10" : "ml-3 pl-2 border-l border-white/5"; return <div key={cat.slug} className={depth > 0 ? indent : ""}><div className="flex items-center justify-between"><button onClick={() => { updateParams("category", cat.slug); setFiltersOpen(false); }} className={`text-left transition-colors flex-1 ${depth === 0 ? `text-sm font-semibold py-0.5 ${isActive ? "text-[#ff4a8d]" : "text-gray-300 hover:text-white"}` : depth === 1 ? `text-xs py-0.5 ${isActive ? "text-[#ff4a8d] font-bold" : "text-gray-400 hover:text-white"}` : `text-[11px] py-0.5 ${isActive ? "text-[#ff4a8d] font-bold" : "text-gray-500 hover:text-gray-300"}`}`}>{depth === 2 ? `↳ ${cat.name}` : cat.name}</button>{children.length > 0 && <button onClick={() => toggleSlug(cat.slug)} className="p-1 text-gray-500 hover:text-white">{isOpen ? <ChevronDown size={12}/> : <ChevronRightIcon size={12}/>}</button>}</div>{children.length > 0 && isOpen && <div className="mt-1 mb-1 flex flex-col gap-1">{children.map((child) => renderCatNode(child, depth + 1))}</div>}</div>; };

  const FilterPanel = () => <div className="space-y-10 pb-24 md:pb-0">
    <div><h3 className="text-[10px] font-black tracking-[0.3em] text-gray-500 uppercase mb-6">CATÉGORIE</h3><div className="flex flex-col gap-2"><button onClick={() => { updateParams("category", ""); setFiltersOpen(false); }} className={`text-left text-sm ${!category ? "text-[#ff4a8d] font-bold" : "text-gray-400 hover:text-white"}`}>Tous les produits</button>{categories.filter((c) => !c.parentSlug && !EXCLUDED_CATEGORY_SLUGS.includes(c.slug)).map((root) => renderCatNode(root, 0))}</div></div>
    <div><h3 className="text-[10px] font-black tracking-[0.3em] text-gray-500 uppercase mb-6">PRIX</h3><div className="space-y-4"><div className="flex items-center justify-between text-xs font-bold text-white"><span>{minPrice}€</span><span>{maxPrice}€</span></div><input type="range" min={DEFAULT_MIN_PRICE} max={DEFAULT_MAX_PRICE} step="5" value={minPrice} onChange={(e) => updatePrice("minPrice", e.target.value)} className="w-full accent-[#ff4a8d]"/><input type="range" min={DEFAULT_MIN_PRICE} max={DEFAULT_MAX_PRICE} step="5" value={maxPrice} onChange={(e) => updatePrice("maxPrice", e.target.value)} className="w-full accent-[#ff4a8d]"/></div></div>
    <div><h3 className="text-[10px] font-black tracking-[0.3em] text-gray-500 uppercase mb-4">MARQUE</h3><input value={brandSearch} onChange={(e) => setBrandSearch(e.target.value)} placeholder="Filtrer les marques" className="mb-4 w-full border border-white/10 bg-black px-3 py-2 text-xs text-white outline-none focus:border-[#ff4a8d]"/><div className="max-h-72 space-y-2 overflow-y-auto pr-1">{filteredBrands.map((brand) => <label key={brand.id} className="flex cursor-pointer items-center justify-between gap-3 text-sm text-gray-400 hover:text-white"><span className="flex items-center gap-2"><input type="checkbox" checked={selectedBrands.includes(brand.name)} onChange={(e) => setBrand(brand.name, e.target.checked)} className="accent-[#ff4a8d]"/>{brand.name}</span><span className="text-[10px] text-gray-600">{brand.productCount || 0}</span></label>)}</div></div>
    <div><h3 className="text-[10px] font-black tracking-[0.3em] text-gray-500 uppercase mb-5">DISPONIBILITÉ</h3><label className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"><input type="checkbox" checked={inStockOnly} onChange={(e) => updateParams("inStock", e.target.checked ? "true" : "")} className="accent-[#ff4a8d]"/> En stock uniquement</label></div>
    <div><h3 className="text-[10px] font-black tracking-[0.3em] text-gray-500 uppercase mb-5">NOUVEAUTÉS</h3><label className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"><input type="checkbox" checked={isNewOnly} onChange={(e) => updateParams("isNew", e.target.checked ? "true" : "")} className="accent-[#ff4a8d]"/> Nouveautés uniquement</label></div>
    <div><h3 className="text-[10px] font-black tracking-[0.3em] text-gray-500 uppercase mb-6">TRIER PAR</h3><div className="flex flex-col gap-3">{SORT_OPTIONS.map((opt) => <button key={opt.value} onClick={() => updateParams("sort", opt.value)} className={`text-left text-sm ${sort === opt.value ? "text-[#ff4a8d] font-bold" : "text-gray-400 hover:text-white"}`}>{opt.label}</button>)}</div></div>
    <button onClick={clearFilters} className="w-full border border-white/10 px-4 py-3 text-xs font-black uppercase tracking-widest text-white hover:border-[#ff4a8d] hover:text-[#ff4a8d]">Effacer les filtres</button>
  </div>;

  return <div className="bg-[#131313] min-h-screen text-[#e5e2e1]"><div className="max-w-[1440px] mx-auto px-4 md:px-8 py-12 flex flex-col md:flex-row gap-12"><aside
  className={`fixed left-0 right-0 top-[var(--catalogue-filter-top)] z-50 h-[calc(100vh_-_var(--catalogue-filter-top))] overflow-hidden bg-[#131313] transition-transform duration-300 md:relative md:inset-auto md:z-auto md:h-auto md:w-72 md:flex-shrink-0 md:translate-x-0 md:bg-transparent md:overflow-visible ${filtersOpen ? "translate-x-0" : "-translate-x-full"}`}
  style={{ "--catalogue-filter-top": `${filterPanelTop}px` } as CSSProperties}
>
<div className="flex h-full flex-col overflow-hidden md:block md:h-auto md:overflow-visible">
<div className="flex shrink-0 items-center justify-between px-8 pb-5 pt-8 md:hidden">
<h2 className="text-xl font-black tracking-tighter uppercase">FILTRES</h2>
<button onClick={() => setFiltersOpen(false)} className="flex h-10 w-10 items-center justify-center text-white" aria-label="Fermer les filtres">
<X size={24}/>
</button>
</div>
<div className="flex-1 overflow-y-auto px-8 pb-24 md:overflow-visible md:p-0">
<FilterPanel />
</div>
</div>
</aside>{filtersOpen && <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setFiltersOpen(false)} />}<div className="flex-grow"><div className="flex justify-between items-end mb-6"><div><h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase italic mb-2">{getTitle()}</h1><p className="text-gray-500 text-xs uppercase tracking-widest">{loading ? "Chargement..." : `${total} produit${total !== 1 ? "s" : ""}`}</p></div><button onClick={() => setFiltersOpen(true)} className="md:hidden flex items-center gap-2 text-xs font-black tracking-widest uppercase text-white border border-white/10 px-4 py-3 hover:bg-white/5"><SlidersHorizontal size={14}/> FILTRER</button><button onClick={() => setFiltersOpen(true)} className="fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 bg-[#ff4a8d] px-6 py-4 text-xs font-black uppercase tracking-widest text-white shadow-2xl shadow-black/40 md:hidden"><SlidersHorizontal size={14}/> Filtrer</button></div>{activeBadges.length > 0 && <div className="mb-8 flex flex-wrap gap-2">{activeBadges.map((badge) => <button key={badge.key} onClick={badge.remove} className="inline-flex items-center gap-2 border border-[#ff4a8d]/40 bg-[#ff4a8d]/10 px-3 py-1.5 text-xs font-bold text-pink-100">{badge.label} <X size={12}/></button>)}</div>}{loading ? <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="bg-[#1c1b1b] aspect-[4/5] animate-pulse" />)}</div> : products.length === 0 ? <div className="text-center py-32 border border-white/5"><p className="text-gray-500 uppercase tracking-widest text-xs mb-8">Aucun produit trouvé</p><button onClick={clearFilters} className="bg-[#ff4a8d] text-white px-8 py-4 text-xs font-black tracking-widest uppercase hover:bg-[#ff1f70]">EFFACER LES FILTRES</button></div> : <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">{products.map((product, index) => { const images = parseImages(product.images); const img = images[0] || "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&q=80"; const isHighlight = index === 0; const publicPrice = typeof product.pricePublic === "number" ? product.pricePublic : product.price; const proPrice = typeof product.priceProEur === "number" ? product.priceProEur : null; const showsProPrice = Boolean(product.isPro && proPrice !== null); const displayedPrice = showsProPrice ? proPrice! : product.price; return <Link key={product.id} href={`/produit/${product.slug}`} className={`group relative bg-[#1c1b1b] overflow-hidden flex flex-col ${isHighlight ? "sm:col-span-2 row-span-2" : ""}`}><div className={`relative overflow-hidden bg-[#2a2a2a] ${isHighlight ? "aspect-square" : "aspect-[4/5]"}`}><div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10 opacity-60 group-hover:opacity-90 transition-opacity"/><img src={img} alt={product.name} className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"/><div className="absolute top-4 left-4 z-20 flex flex-col gap-2">{showsProPrice && <span className="bg-blue-600 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">PRIX PRO</span>}{product.isNew && <span className="bg-emerald-600 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">NOUVEAU</span>}{product.originalPrice && product.originalPrice > publicPrice && <span className="bg-[#ff4a8d] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">PROMO</span>}</div></div><div className={`p-4 flex flex-col justify-between flex-grow ${isHighlight ? "p-6" : ""}`}><div><h3 className={`font-black tracking-tight mb-1 group-hover:text-[#ffb1c4] transition-colors ${isHighlight ? "text-xl" : "text-sm"}`}>{product.name}</h3><p className="text-[10px] text-gray-500 uppercase tracking-widest">{product.brand}</p></div><div className="flex justify-between items-end mt-4 gap-3"><div>{showsProPrice && <span className="mb-1 inline-flex px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-blue-400">Prix pro HT</span>}<span className={`block font-black ${isHighlight ? "text-xl" : "text-base"} text-white`}>{formatPrice(displayedPrice)}{showsProPrice ? " HT" : ""}</span>{showsProPrice && <span className="block text-[11px] text-gray-500 line-through">Public {formatPrice(publicPrice)} TTC</span>}</div><ArrowRight size={14} className="text-gray-500 group-hover:text-[#ff4a8d] transition-colors shrink-0"/></div></div></Link>; })}</div>}{totalPages > 1 && <div className="flex items-center justify-center gap-3 mt-16"><button onClick={() => updateParams("page", String(page - 1))} disabled={page <= 1} className="w-10 h-10 border border-white/10 flex items-center justify-center hover:bg-white/5 disabled:opacity-20"><ChevronLeft size={16}/></button>{Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => <button key={p} onClick={() => updateParams("page", String(p))} className={`w-10 h-10 text-xs font-black tracking-widest ${p === page ? "bg-[#ff4a8d] text-white" : "border border-white/10 text-gray-400 hover:bg-white/5"}`}>{p}</button>)}{totalPages > 7 && <span className="text-gray-600 text-xs">...</span>}<button onClick={() => updateParams("page", String(page + 1))} disabled={page >= totalPages} className="w-10 h-10 border border-white/10 flex items-center justify-center hover:bg-white/5 disabled:opacity-20"><ChevronRight size={16}/></button></div>}</div></div><button onClick={() => setFiltersOpen(true)} className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full bg-[#ff4a8d] px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-2xl md:hidden"><SlidersHorizontal size={14} className="mr-2 inline"/> Filtrer</button></div>;
}
