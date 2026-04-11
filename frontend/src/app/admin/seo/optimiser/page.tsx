"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  getSeoScores,
  bulkOptimizeSeo,
  type SeoScoredProduct,
} from "@/lib/admin-api";
import {
  Search,
  Zap,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  Filter,
  ArrowUpDown,
  Loader2,
  CheckCircle,
  XCircle,
  Sparkles,
} from "lucide-react";

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-emerald-100 text-emerald-700"
      : score >= 60
      ? "bg-blue-100 text-blue-700"
      : score >= 40
      ? "bg-amber-100 text-amber-700"
      : "bg-red-100 text-red-700";
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${color}`}>
      {score}/100
    </span>
  );
}

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-blue-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden w-16">
      <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function SeoOptimiserPage() {
  const searchParams = useSearchParams();
  const filterParam = searchParams.get("filter");

  const [products, setProducts] = useState<SeoScoredProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState("score_asc");
  const [maxScoreFilter, setMaxScoreFilter] = useState<string>(filterParam === "poor" ? "39" : "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [optimizing, setOptimizing] = useState(false);
  const [bulkResults, setBulkResults] = useState<any>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  const fetchProducts = () => {
    setLoading(true);
    const params: any = { page, limit: 20, sort };
    if (maxScoreFilter) params.maxScore = parseInt(maxScoreFilter);
    getSeoScores(params)
      .then((data) => {
        setProducts(data.products);
        setPages(data.pages);
        setTotal(data.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProducts();
  }, [page, sort, maxScoreFilter]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === products.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(products.map((p) => p.id)));
    }
  };

  const handleBulkOptimize = async (autoApply: boolean) => {
    if (selected.size === 0) return;
    setOptimizing(true);
    setBulkResults(null);
    try {
      const results = await bulkOptimizeSeo(Array.from(selected), autoApply);
      setBulkResults(results);
      if (autoApply) {
        fetchProducts();
        setSelected(new Set());
      }
    } catch (err: any) {
      setBulkResults({ error: err.message });
    } finally {
      setOptimizing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/seo" className="text-gray-400 hover:text-gray-600">
            <ChevronLeft size={20} />
          </Link>
          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-200">
            <Zap className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Optimisation SEO</h1>
            <p className="text-sm text-gray-500">{total} produits · Sélectionnez et optimisez avec l&apos;IA</p>
          </div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          <select
            value={maxScoreFilter}
            onChange={(e) => { setMaxScoreFilter(e.target.value); setPage(1); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700"
          >
            <option value="">Tous les scores</option>
            <option value="39">Faible (0-39)</option>
            <option value="59">Moyen (0-59)</option>
            <option value="79">Sous 80</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown size={16} className="text-gray-400" />
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value); setPage(1); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700"
          >
            <option value="score_asc">Score croissant</option>
            <option value="score_desc">Score décroissant</option>
            <option value="name">Nom A-Z</option>
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <span className="text-sm text-gray-500">{selected.size} sélectionné(s)</span>
              <button
                onClick={() => handleBulkOptimize(false)}
                disabled={optimizing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-100 text-violet-700 rounded-lg text-sm font-medium hover:bg-violet-200 transition-colors disabled:opacity-50"
              >
                {optimizing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Prévisualiser
              </button>
              <button
                onClick={() => handleBulkOptimize(true)}
                disabled={optimizing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors disabled:opacity-50"
              >
                {optimizing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                Appliquer auto
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bulk Results */}
      {bulkResults && !bulkResults.error && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-violet-50">
            <h3 className="font-semibold text-violet-900">
              Résultats de l&apos;optimisation — {bulkResults.success}/{bulkResults.total} réussis
              {bulkResults.autoApplied && " (appliqués automatiquement)"}
            </h3>
          </div>
          <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
            {bulkResults.results?.map((r: any) => (
              <div key={r.id} className="px-4 py-3 flex items-start gap-3">
                {r.success ? (
                  <CheckCircle size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                ) : (
                  <XCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{r.name}</p>
                  {r.success && r.optimization && !bulkResults.autoApplied && (
                    <div className="mt-2 space-y-1 text-xs text-gray-600">
                      <p><strong>Titre optimisé :</strong> {r.optimization.optimizedTitle}</p>
                      <p><strong>Meta :</strong> {r.optimization.metaDescription}</p>
                      <p><strong>Tags :</strong> {r.optimization.suggestedTags?.join(", ")}</p>
                      <p><strong>Score estimé :</strong> {r.optimization.seoScore}/100</p>
                    </div>
                  )}
                  {r.error && <p className="text-xs text-red-500 mt-1">{r.error}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {bulkResults?.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {bulkResults.error}
        </div>
      )}

      {/* Products Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-violet-500" />
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-4 py-3 w-10">
                    <button onClick={selectAll} className="text-gray-400 hover:text-gray-600">
                      {selected.size === products.length && products.length > 0 ? (
                        <CheckSquare size={18} className="text-violet-600" />
                      ) : (
                        <Square size={18} />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Produit</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Catégorie</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Score</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map((p) => (
                  <>
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <button onClick={() => toggleSelect(p.id)} className="text-gray-400 hover:text-gray-600">
                          {selected.has(p.id) ? (
                            <CheckSquare size={18} className="text-violet-600" />
                          ) : (
                            <Square size={18} />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900 truncate max-w-xs">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.brand}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-gray-500">{p.category}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ScoreBadge score={p.seoScore} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setExpandedProduct(expandedProduct === p.id ? null : p.id)}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            Détails
                          </button>
                          <Link
                            href={`/admin/seo/produit?id=${p.id}`}
                            className="text-xs text-violet-600 hover:text-violet-700 font-medium"
                          >
                            Optimiser →
                          </Link>
                        </div>
                      </td>
                    </tr>
                    {expandedProduct === p.id && (
                      <tr key={`${p.id}-details`}>
                        <td colSpan={5} className="px-4 py-3 bg-gray-50">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {p.seoDetails.map((d) => (
                              <div key={d.criterion} className="flex items-center gap-2">
                                <ScoreBar score={d.score} max={d.max} />
                                <div>
                                  <p className="text-xs font-medium text-gray-700">{d.criterion}</p>
                                  <p className="text-xs text-gray-400">{d.score}/{d.max}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-gray-500 mt-2 italic">{p.seoDetails.sort((a, b) => (a.score / a.max) - (b.score / b.max))[0]?.tip}</p>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Page {page} sur {pages} ({total} produits)
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setPage(Math.min(pages, page + 1))}
                  disabled={page >= pages}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
