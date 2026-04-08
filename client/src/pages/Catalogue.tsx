// ============================================================
// BARBER PARADISE — Page Catalogue
// Couleurs: Primary #4EAADB | Secondary #252525
// ============================================================

import { useState, useMemo } from "react";
import { useSearch } from "wouter";
import { SlidersHorizontal, X, ChevronDown, Grid3X3, List } from "lucide-react";
import { products, categories } from "@/lib/data";
import ProductCard from "@/components/products/ProductCard";

const sortOptions = [
  { value: "featured", label: "Recommandés" },
  { value: "price-asc", label: "Prix croissant" },
  { value: "price-desc", label: "Prix décroissant" },
  { value: "rating", label: "Mieux notés" },
  { value: "newest", label: "Nouveautés" },
];

const priceRanges = [
  { label: "Moins de 20€", min: 0, max: 20 },
  { label: "20€ - 50€", min: 20, max: 50 },
  { label: "50€ - 100€", min: 50, max: 100 },
  { label: "100€ - 200€", min: 100, max: 200 },
  { label: "Plus de 200€", min: 200, max: Infinity },
];

export default function Catalogue() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const categoryParam = params.get("category") || "";
  const subcategoryParam = params.get("subcategory") || "";
  const brandParam = params.get("brand") || "";
  const filterParam = params.get("filter") || "";
  const queryParam = params.get("q") || "";

  const [sortBy, setSortBy] = useState("featured");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(categoryParam ? [categoryParam] : []);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>(subcategoryParam ? [subcategoryParam] : []);
  const [selectedBrands, setSelectedBrands] = useState<string[]>(brandParam ? [brandParam] : []);
  const [selectedPriceRange, setSelectedPriceRange] = useState<{ min: number; max: number } | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const allBrands = useMemo(() => Array.from(new Set(products.map((p) => p.brand))).sort(), []);

  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (queryParam) {
      const q = queryParam.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some((t) => t.includes(q))
      );
    }

    if (filterParam === "new") result = result.filter((p) => p.isNew);
    if (filterParam === "promo") result = result.filter((p) => p.isPromo);

    if (selectedCategories.length > 0) {
      result = result.filter((p) => selectedCategories.includes(p.category));
    }
    if (selectedSubcategories.length > 0) {
      result = result.filter((p) => selectedSubcategories.includes(p.subcategory));
    }
    if (selectedBrands.length > 0) {
      result = result.filter((p) =>
        selectedBrands.some((b) => p.brand.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").includes(b.toLowerCase()))
      );
    }
    if (selectedPriceRange) {
      result = result.filter(
        (p) => p.price >= selectedPriceRange.min && p.price <= selectedPriceRange.max
      );
    }

    switch (sortBy) {
      case "price-asc": result.sort((a, b) => a.price - b.price); break;
      case "price-desc": result.sort((a, b) => b.price - a.price); break;
      case "rating": result.sort((a, b) => b.rating - a.rating); break;
      case "newest": result.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0)); break;
    }

    return result;
  }, [queryParam, filterParam, selectedCategories, selectedSubcategories, selectedBrands, selectedPriceRange, sortBy]);

  const toggleFilter = (arr: string[], setArr: (v: string[]) => void, val: string) => {
    setArr(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setSelectedSubcategories([]);
    setSelectedBrands([]);
    setSelectedPriceRange(null);
  };

  const hasActiveFilters =
    selectedCategories.length > 0 ||
    selectedSubcategories.length > 0 ||
    selectedBrands.length > 0 ||
    selectedPriceRange !== null;

  const pageTitle = queryParam
    ? `Résultats pour "${queryParam}"`
    : filterParam === "new"
    ? "Nouveautés"
    : filterParam === "promo"
    ? "Promotions"
    : categoryParam
    ? categories.find((c) => c.id === categoryParam)?.name || "Catalogue"
    : "Tous les produits";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="bg-secondary text-white py-8">
        <div className="container">
          <h1 className="text-3xl md:text-4xl font-black uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            {pageTitle}
          </h1>
          <p className="text-gray-400 text-sm mt-1">{filteredProducts.length} produit{filteredProducts.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="container py-8">
        <div className="flex gap-8">
          {/* ── SIDEBAR FILTRES ─────────────────────────── */}
          <aside className={`
            fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl overflow-y-auto transform transition-transform lg:relative lg:inset-auto lg:w-64 lg:shadow-none lg:transform-none lg:flex-shrink-0
            ${filtersOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          `}>
            {/* Mobile close */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 lg:hidden">
              <span className="font-bold uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Filtres</span>
              <button onClick={() => setFiltersOpen(false)}><X size={20} /></button>
            </div>

            <div className="p-4 space-y-6">
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="w-full text-sm text-red-600 font-semibold hover:underline flex items-center gap-1"
                >
                  <X size={14} /> Effacer tous les filtres
                </button>
              )}

              {/* Catégories */}
              <div>
                <h3 className="font-black uppercase text-sm tracking-wider mb-3 text-gray-800" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  Catégories
                </h3>
                <div className="space-y-2">
                  {categories.map((cat) => (
                    <label key={cat.id} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(cat.id)}
                        onChange={() => toggleFilter(selectedCategories, setSelectedCategories, cat.id)}
                        className="w-4 h-4 accent-primary"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-primary transition-colors">{cat.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Prix */}
              <div>
                <h3 className="font-black uppercase text-sm tracking-wider mb-3 text-gray-800" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  Prix
                </h3>
                <div className="space-y-2">
                  {priceRanges.map((range) => (
                    <label key={range.label} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="price"
                        checked={selectedPriceRange?.min === range.min && selectedPriceRange?.max === range.max}
                        onChange={() => setSelectedPriceRange(range)}
                        className="w-4 h-4 accent-primary"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-primary transition-colors">{range.label}</span>
                    </label>
                  ))}
                  {selectedPriceRange && (
                    <button
                      onClick={() => setSelectedPriceRange(null)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Effacer
                    </button>
                  )}
                </div>
              </div>

              {/* Marques */}
              <div>
                <h3 className="font-black uppercase text-sm tracking-wider mb-3 text-gray-800" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  Marques
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {allBrands.map((brand) => (
                    <label key={brand} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={selectedBrands.some((b) => brand.toLowerCase().includes(b.toLowerCase()))}
                        onChange={() => {
                          const slug = brand.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
                          toggleFilter(selectedBrands, setSelectedBrands, slug);
                        }}
                        className="w-4 h-4 accent-primary"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-primary transition-colors">{brand}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Disponibilité */}
              <div>
                <h3 className="font-black uppercase text-sm tracking-wider mb-3 text-gray-800" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  Disponibilité
                </h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-primary" />
                  <span className="text-sm text-gray-700">En stock uniquement</span>
                </label>
              </div>
            </div>
          </aside>

          {/* Overlay mobile */}
          {filtersOpen && (
            <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setFiltersOpen(false)} />
          )}

          {/* ── PRODUITS ────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4 mb-6 bg-white border border-gray-200 px-4 py-3">
              <button
                onClick={() => setFiltersOpen(true)}
                className="lg:hidden flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-primary"
              >
                <SlidersHorizontal size={16} />
                Filtres {hasActiveFilters && <span className="bg-primary text-white text-xs px-1.5 py-0.5 rounded-full">{selectedCategories.length + selectedSubcategories.length + selectedBrands.length + (selectedPriceRange ? 1 : 0)}</span>}
              </button>

              <span className="text-sm text-gray-500 hidden lg:block">
                {filteredProducts.length} résultat{filteredProducts.length !== 1 ? "s" : ""}
              </span>

              <div className="flex items-center gap-3 ml-auto">
                {/* View mode */}
                <div className="hidden sm:flex border border-gray-200">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-2 transition-colors ${viewMode === "grid" ? "bg-primary text-white" : "text-gray-500 hover:text-primary"}`}
                  >
                    <Grid3X3 size={16} />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-2 transition-colors ${viewMode === "list" ? "bg-primary text-white" : "text-gray-500 hover:text-primary"}`}
                  >
                    <List size={16} />
                  </button>
                </div>

                {/* Sort */}
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="appearance-none border border-gray-200 px-4 py-2 pr-8 text-sm focus:outline-none focus:border-primary bg-white cursor-pointer"
                  >
                    {sortOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Active filters */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedCategories.map((c) => (
                  <span key={c} className="flex items-center gap-1 bg-primary/10 text-primary text-xs font-semibold px-3 py-1">
                    {categories.find((cat) => cat.id === c)?.name || c}
                    <button onClick={() => toggleFilter(selectedCategories, setSelectedCategories, c)}><X size={12} /></button>
                  </span>
                ))}
                {selectedBrands.map((b) => (
                  <span key={b} className="flex items-center gap-1 bg-primary/10 text-primary text-xs font-semibold px-3 py-1">
                    {b}
                    <button onClick={() => toggleFilter(selectedBrands, setSelectedBrands, b)}><X size={12} /></button>
                  </span>
                ))}
                {selectedPriceRange && (
                  <span className="flex items-center gap-1 bg-primary/10 text-primary text-xs font-semibold px-3 py-1">
                    {priceRanges.find((r) => r.min === selectedPriceRange.min)?.label}
                    <button onClick={() => setSelectedPriceRange(null)}><X size={12} /></button>
                  </span>
                )}
              </div>
            )}

            {/* Grid */}
            {filteredProducts.length === 0 ? (
              <div className="text-center py-20 bg-white border border-gray-200">
                <p className="text-2xl font-black text-gray-300 mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>AUCUN PRODUIT TROUVÉ</p>
                <p className="text-gray-500 text-sm mb-4">Essayez de modifier vos filtres</p>
                <button onClick={clearFilters} className="btn-primary">Effacer les filtres</button>
              </div>
            ) : (
              <div className={viewMode === "grid"
                ? "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4"
                : "space-y-3"
              }>
                {filteredProducts.map((product) =>
                  viewMode === "grid" ? (
                    <ProductCard key={product.id} product={product} />
                  ) : (
                    <div key={product.id} className="product-card flex gap-4 p-4">
                      <img src={product.images[0]} alt={product.name} className="w-24 h-24 object-cover flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-primary font-semibold uppercase">{product.brand}</p>
                        <h3 className="font-semibold text-gray-800 mt-0.5" style={{ fontFamily: "'Barlow', sans-serif", textTransform: "none" }}>{product.name}</h3>
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{product.shortDescription}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="font-black text-secondary" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{product.price.toFixed(2)} €</span>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
