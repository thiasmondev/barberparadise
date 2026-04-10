"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { SlidersHorizontal, Grid3X3, List, ChevronLeft, ChevronRight } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { getProducts } from "@/lib/api";
import type { Product } from "@/types";

const SORT_OPTIONS = [
  { value: "newest", label: "Plus récents" },
  { value: "price_asc", label: "Prix croissant" },
  { value: "price_desc", label: "Prix décroissant" },
  { value: "name_asc", label: "A - Z" },
];

const CATEGORIES = [
  "Tous",
  "Tondeuses",
  "Ciseaux",
  "Rasoirs",
  "Soins cheveux",
  "Soins barbe",
  "Accessoires",
  "Mobilier",
  "Linge",
  "Hygiène",
];

export default function CatalogueContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const page = Number(searchParams.get("page")) || 1;
  const category = searchParams.get("category") || "";
  const search = searchParams.get("search") || "";
  const sort = searchParams.get("sort") || "newest";
  const promo = searchParams.get("promo") || "";

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
        filtered = filtered.filter(
          (p) => p.originalPrice && p.originalPrice > p.price
        );
      }
      setProducts(filtered);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [page, category, search, sort, promo]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const updateParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    if (key !== "page") params.delete("page");
    router.push(`/catalogue?${params.toString()}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="section-title">
          {search ? `Résultats pour "${search}"` : category || "Tous les produits"}
        </h1>
        <p className="text-gray-500 text-sm mt-2">
          {total} produit{total !== 1 ? "s" : ""} trouvé{total !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex gap-8">
        {/* Sidebar filters - Desktop */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-24 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-dark-800 mb-3 uppercase tracking-wider">
                Catégories
              </h3>
              <ul className="space-y-1.5">
                {CATEGORIES.map((cat) => {
                  const isActive =
                    cat === "Tous" ? !category : category === cat;
                  return (
                    <li key={cat}>
                      <button
                        onClick={() =>
                          updateParams("category", cat === "Tous" ? "" : cat)
                        }
                        className={`w-full text-left text-sm py-1.5 px-3 rounded-lg transition-colors ${
                          isActive
                            ? "bg-primary-50 text-primary font-medium"
                            : "text-dark-600 hover:bg-gray-50"
                        }`}
                      >
                        {cat}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-100">
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="lg:hidden flex items-center gap-2 text-sm font-medium text-dark-600"
            >
              <SlidersHorizontal size={16} />
              Filtres
            </button>
            <div className="flex items-center gap-3 ml-auto">
              <select
                value={sort}
                onChange={(e) => updateParams("sort", e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-dark-700 focus:outline-none focus:border-primary"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Mobile filters */}
          {filtersOpen && (
            <div className="lg:hidden mb-6 p-4 bg-gray-50 rounded-xl">
              <h3 className="text-sm font-semibold text-dark-800 mb-3">Catégories</h3>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => {
                  const isActive = cat === "Tous" ? !category : category === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => {
                        updateParams("category", cat === "Tous" ? "" : cat);
                        setFiltersOpen(false);
                      }}
                      className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                        isActive
                          ? "bg-primary text-white"
                          : "bg-white text-dark-600 border border-gray-200"
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Products grid */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-gray-100 rounded-xl aspect-square mb-3" />
                  <div className="h-3 bg-gray-100 rounded w-16 mb-2" />
                  <div className="h-4 bg-gray-100 rounded w-full mb-1" />
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-500 text-lg mb-4">Aucun produit trouvé</p>
              <button
                onClick={() => router.push("/catalogue")}
                className="btn-primary"
              >
                Voir tous les produits
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-10">
              <button
                onClick={() => updateParams("page", String(page - 1))}
                disabled={page <= 1}
                className="p-2 rounded-lg border border-gray-200 text-dark-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={18} />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    onClick={() => updateParams("page", String(p))}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                      p === page
                        ? "bg-primary text-white"
                        : "text-dark-600 hover:bg-gray-50"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              {totalPages > 7 && (
                <span className="text-gray-400">...</span>
              )}
              <button
                onClick={() => updateParams("page", String(page + 1))}
                disabled={page >= totalPages}
                className="p-2 rounded-lg border border-gray-200 text-dark-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
