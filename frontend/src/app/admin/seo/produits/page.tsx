"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, Loader2, Search, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { getSeoScores, type SeoScoredProduct } from "@/lib/admin-api";

function getSeoStatus(score: number) {
  if (score >= 80) return { label: "Optimisé", className: "bg-emerald-100 text-emerald-700 border-emerald-200" };
  if (score >= 60) return { label: "Correct", className: "bg-blue-100 text-blue-700 border-blue-200" };
  if (score >= 40) return { label: "À améliorer", className: "bg-amber-100 text-amber-700 border-amber-200" };
  return { label: "Prioritaire", className: "bg-red-100 text-red-700 border-red-200" };
}

export default function SeoProductsPage() {
  const [products, setProducts] = useState<SeoScoredProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "optimized" | "correct" | "warning" | "priority">("all");

  useEffect(() => {
    getSeoScores({ limit: 500, sort: "score_asc" })
      .then((data) => setProducts(data.products || []))
      .catch((err) => setError(err.message || "Impossible de charger les statuts SEO."))
      .finally(() => setLoading(false));
  }, []);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch = !query || [product.name, product.brand, product.category, product.subcategory]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query));
      const matchesStatus = status === "all"
        || (status === "optimized" && product.seoScore >= 80)
        || (status === "correct" && product.seoScore >= 60 && product.seoScore < 80)
        || (status === "warning" && product.seoScore >= 40 && product.seoScore < 60)
        || (status === "priority" && product.seoScore < 40);
      return matchesSearch && matchesStatus;
    });
  }, [products, search, status]);

  const averageScore = products.length > 0
    ? Math.round(products.reduce((sum, product) => sum + product.seoScore, 0) / products.length)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-200">
            <ShieldCheck className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Page produit SEO</h1>
            <p className="text-sm text-gray-500">Liste de tous les produits avec leur statut d’optimisation SEO.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/seo" className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
            <ChevronLeft size={16} />
            Retour agent SEO
          </Link>
          <Link href="/admin/seo/produit" className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700">
            <Search size={16} />
            Rechercher ou créer
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Produits suivis</p>
          <p className="mt-1 text-3xl font-black text-gray-900">{products.length}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Score moyen</p>
          <p className="mt-1 text-3xl font-black text-emerald-600">{averageScore}<span className="text-base text-gray-400">/100</span></p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Résultats affichés</p>
          <p className="mt-1 text-3xl font-black text-gray-900">{filteredProducts.length}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher par nom, marque ou catégorie..."
              className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={16} className="text-gray-400" />
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="all">Tous les statuts</option>
              <option value="optimized">Optimisé ≥ 80</option>
              <option value="correct">Correct 60–79</option>
              <option value="warning">À améliorer 40–59</option>
              <option value="priority">Prioritaire &lt; 40</option>
            </select>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm font-medium text-gray-500">
            <Loader2 size={18} className="animate-spin" />
            Chargement des statuts SEO...
          </div>
        )}

        {error && !loading && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        {!loading && !error && (
          <div className="mt-5 overflow-hidden rounded-xl border border-gray-100">
            <div className="hidden grid-cols-[1.7fr_1fr_0.8fr_0.9fr_0.7fr] gap-4 bg-gray-50 px-4 py-3 text-xs font-black uppercase tracking-wide text-gray-500 md:grid">
              <span>Produit</span>
              <span>Catégorie</span>
              <span>Score</span>
              <span>Statut SEO</span>
              <span className="text-right">Action</span>
            </div>
            <div className="divide-y divide-gray-100">
              {filteredProducts.map((product) => {
                const seoStatus = getSeoStatus(product.seoScore);
                const mainIssue = product.seoDetails?.find((detail) => detail.score < detail.max)?.tip;
                return (
                  <div key={product.id} className="grid gap-3 px-4 py-4 md:grid-cols-[1.7fr_1fr_0.8fr_0.9fr_0.7fr] md:items-center">
                    <div>
                      <p className="font-semibold text-gray-900">{product.name}</p>
                      <p className="mt-1 text-xs text-gray-500">{product.brand || "Sans marque"}</p>
                      {mainIssue && <p className="mt-1 text-xs text-amber-600">{mainIssue}</p>}
                    </div>
                    <div className="text-sm text-gray-600">
                      <p>{product.category || "Sans catégorie"}</p>
                      <p className="text-xs text-gray-400">{product.subcategory || "Sans sous-catégorie"}</p>
                    </div>
                    <div className="text-sm font-black text-gray-900">{product.seoScore}<span className="text-xs text-gray-400">/100</span></div>
                    <div>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${seoStatus.className}`}>{seoStatus.label}</span>
                    </div>
                    <div className="flex justify-start md:justify-end">
                      <Link href={`/admin/seo/produit?id=${product.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-black">
                        Ouvrir
                        <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>
                );
              })}
              {filteredProducts.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-gray-500">Aucun produit ne correspond à ces critères.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
