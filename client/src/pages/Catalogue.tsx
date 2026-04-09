// ============================================================
// BARBER PARADISE — Page Catalogue (API dynamique)
// Couleurs: Primary #4EAADB | Secondary #252525
// ============================================================
import { useState, useMemo, useEffect } from "react";
import { useSearch } from "wouter";
import { SlidersHorizontal, X, ChevronDown, Grid3X3, List, Loader2, AlertCircle } from "lucide-react";
import { useProducts, type ProductFilters } from "@/hooks/useApi";
import { categories, brands } from "@/lib/data";
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
  { label: "Plus de 200€", min: 200, max: 9999 },
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
  const [page, setPage] = useState(1);

  // Construire les filtres API
  const apiFilters: ProductFilters = useMemo(() => {
    const f: ProductFilters = { page, limit: 24, sort: sortBy };
    if (queryParam) f.search = queryParam;
    if (filterParam === "new") f.isNew = true;
    if (filterParam === "promo") f.isPromo = true;
    if (selectedCategories.length === 1) f.category = selectedCategories[0];
    if (selectedSubcategories.length === 1) f.subcategory = selectedSubcategories[0];
    if (selectedBrands.length === 1) f.brand = selectedBrands[0];
    if (selectedPriceRange) {
      f.minPrice = selectedPriceRange.min;
      f.maxPrice = selectedPriceRange.max;
    }
    return f;
  }, [page, sortBy, queryParam, filterParam, selectedCategories, selectedSubcategories, selectedBrands, selectedPriceRange]);

  const { products: apiProducts, total, pages, loading, error } = useProducts(apiFilters);

  // Réinitialiser la page lors d'un changement de filtre
  useEffect(() => { setPage(1); }, [queryParam, filterParam, sortBy, selectedCategories, selectedSubcategories, selectedBrands, selectedPriceRange]);

  const toggleFilter = (arr: string[], setArr: (v: string[]) => void, val: string) => {
    setArr(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
    setPage(1);
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setSelectedSubcategories([]);
    setSelectedBrands([]);
    setSelectedPriceRange(null);
    setPage(1);
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
          <p className="text-gray-400 text-sm mt-1">
            {loading ? "Chargement..." : `${total} produit${total !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      <div className="container py-8">
        <div className="flex gap-8">
          {/* Sidebar filtres */}
          <aside className={`${filtersOpen ? "block" : "hidden"} lg:block w-64 flex-shrink-0`}>
            <div className="bg-white rounded-lg border border-gray-200 p-4 sticky top-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-secondary">Filtres</h2>
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="text-xs text-primary hover:underline">
                    Tout effacer
                  </button>
                )}
              </div>

              {/* Catégories */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-secondary mb-2 uppercase tracking-wide">Catégories</h3>
                {["Matériel", "Produits"].map((cat) => (
                  <label key={cat} className="flex items-center gap-2 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat.toLowerCase())}
                      onChange={() => toggleFilter(selectedCategories, setSelectedCategories, cat.toLowerCase())}
                      className="accent-primary"
                    />
                    <span className="text-sm text-gray-700">{cat}</span>
                  </label>
                ))}
              </div>

              {/* Prix */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-secondary mb-2 uppercase tracking-wide">Prix</h3>
                {priceRanges.map((range) => (
                  <label key={range.label} className="flex items-center gap-2 py-1 cursor-pointer">
                    <input
                      type="radio"
                      name="price"
                      checked={selectedPriceRange?.min === range.min && selectedPriceRange?.max === range.max}
                      onChange={() => setSelectedPriceRange({ min: range.min, max: range.max })}
                      className="accent-primary"
                    />
                    <span className="text-sm text-gray-700">{range.label}</span>
                  </label>
                ))}
                {selectedPriceRange && (
                  <button onClick={() => setSelectedPriceRange(null)} className="text-xs text-primary mt-1 hover:underline">
                    Effacer
                  </button>
                )}
              </div>

              {/* Marques */}
              <div>
                <h3 className="text-sm font-semibold text-secondary mb-2 uppercase tracking-wide">Marques</h3>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {brands.slice(0, 20).map((brand) => (
                    <label key={brand.id} className="flex items-center gap-2 py-0.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedBrands.includes(brand.id)}
                        onChange={() => toggleFilter(selectedBrands, setSelectedBrands, brand.id)}
                        className="accent-primary"
                      />
                      <span className="text-sm text-gray-700">{brand.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Contenu principal */}
          <div className="flex-1 min-w-0">
            {/* Barre d'outils */}
            <div className="flex items-center justify-between mb-6 gap-4">
              <button
                onClick={() => setFiltersOpen(!filtersOpen)}
                className="lg:hidden flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium"
              >
                <SlidersHorizontal size={16} />
                Filtres
                {hasActiveFilters && (
                  <span className="bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {selectedCategories.length + selectedSubcategories.length + selectedBrands.length + (selectedPriceRange ? 1 : 0)}
                  </span>
                )}
              </button>

              <div className="flex items-center gap-3 ml-auto">
                <select
                  value={sortBy}
                  onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {sortOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-2 ${viewMode === "grid" ? "bg-secondary text-white" : "bg-white text-gray-600"}`}
                  >
                    <Grid3X3 size={16} />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-2 ${viewMode === "list" ? "bg-secondary text-white" : "bg-white text-gray-600"}`}
                  >
                    <List size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Filtres actifs */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedCategories.map((c) => (
                  <span key={c} className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-3 py-1 rounded-full">
                    {c}
                    <button onClick={() => toggleFilter(selectedCategories, setSelectedCategories, c)}><X size={12} /></button>
                  </span>
                ))}
                {selectedBrands.map((b) => (
                  <span key={b} className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-3 py-1 rounded-full">
                    {brands.find(br => br.id === b)?.name || b}
                    <button onClick={() => toggleFilter(selectedBrands, setSelectedBrands, b)}><X size={12} /></button>
                  </span>
                ))}
                {selectedPriceRange && (
                  <span className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-3 py-1 rounded-full">
                    {priceRanges.find(r => r.min === selectedPriceRange.min)?.label}
                    <button onClick={() => setSelectedPriceRange(null)}><X size={12} /></button>
                  </span>
                )}
              </div>
            )}

            {/* États de chargement / erreur */}
            {loading && (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="animate-spin text-primary" size={40} />
              </div>
            )}

            {error && !loading && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <AlertCircle className="text-red-400 mb-3" size={40} />
                <p className="text-gray-600 mb-2">Impossible de charger les produits</p>
                <p className="text-sm text-gray-400">{error}</p>
              </div>
            )}

            {/* Grille de produits */}
            {!loading && !error && (
              <>
                {apiProducts.length === 0 ? (
                  <div className="text-center py-24">
                    <p className="text-gray-500 text-lg">Aucun produit trouvé</p>
                    <button onClick={clearFilters} className="mt-4 text-primary hover:underline text-sm">
                      Effacer les filtres
                    </button>
                  </div>
                ) : (
                  <div className={`grid gap-4 ${viewMode === "grid" ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-4" : "grid-cols-1"}`}>
                    {apiProducts.map((product) => (
                      <ProductCard key={product.id} product={product as any} listView={viewMode === "list"} />
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {pages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-10">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
                    >
                      Précédent
                    </button>
                    {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                      const p = page <= 3 ? i + 1 : page - 2 + i;
                      if (p < 1 || p > pages) return null;
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`w-10 h-10 rounded-lg text-sm font-medium ${p === page ? "bg-primary text-white" : "border border-gray-300 hover:bg-gray-50"}`}
                        >
                          {p}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setPage(p => Math.min(pages, p + 1))}
                      disabled={page === pages}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
                    >
                      Suivant
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
