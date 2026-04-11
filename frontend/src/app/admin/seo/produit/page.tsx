"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  analyzeSeoProduct,
  optimizeSeoProduct,
  applySeoOptimization,
  type SeoOptimization,
} from "@/lib/admin-api";
import type { Product } from "@/types";
import {
  ChevronLeft,
  Sparkles,
  Loader2,
  CheckCircle,
  Eye,
  Save,
  RotateCcw,
  AlertCircle,
  Image as ImageIcon,
} from "lucide-react";

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#3b82f6" : score >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="6" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className="absolute text-lg font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

export default function SeoProductPage() {
  const searchParams = useSearchParams();
  const productId = searchParams.get("id");

  const [product, setProduct] = useState<Product | null>(null);
  const [score, setScore] = useState(0);
  const [details, setDetails] = useState<{ criterion: string; score: number; max: number; tip: string }[]>([]);
  const [optimization, setOptimization] = useState<SeoOptimization | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState("");
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    analyzeSeoProduct(productId)
      .then((data) => {
        setProduct(data.product);
        setScore(data.score);
        setDetails(data.details);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [productId]);

  const handleOptimize = async () => {
    if (!productId) return;
    setOptimizing(true);
    setError("");
    try {
      const data = await optimizeSeoProduct(productId);
      setOptimization(data.optimization);
      setPreviewMode(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setOptimizing(false);
    }
  };

  const handleApply = async () => {
    if (!productId || !optimization) return;
    setApplying(true);
    try {
      await applySeoOptimization(productId, {
        optimizedTitle: optimization.optimizedTitle,
        metaDescription: optimization.metaDescription,
        seoDescription: optimization.seoDescription,
        suggestedTags: optimization.suggestedTags,
      });
      setApplied(true);
      // Refresh analysis
      const data = await analyzeSeoProduct(productId);
      setProduct(data.product);
      setScore(data.score);
      setDetails(data.details);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setApplying(false);
    }
  };

  if (!productId) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-700">
        <p>Aucun produit sélectionné. <Link href="/admin/seo/optimiser" className="underline">Retour à la liste</Link></p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-violet-500" />
      </div>
    );
  }

  if (error && !product) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
        <p className="font-medium">Erreur</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/seo/optimiser" className="text-gray-400 hover:text-gray-600">
          <ChevronLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 truncate">{product?.name}</h1>
          <p className="text-sm text-gray-500">{(product as any)?.brand} · {(product as any)?.category}</p>
        </div>
        <ScoreRing score={score} />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {applied && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-700 text-sm flex items-center gap-2">
          <CheckCircle size={16} />
          Optimisations appliquées avec succès !
        </div>
      )}

      {/* Current Analysis */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Analyse SEO actuelle</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {details.map((d) => {
            const pct = d.max > 0 ? (d.score / d.max) * 100 : 0;
            const color = pct >= 80 ? "text-emerald-600" : pct >= 60 ? "text-blue-600" : pct >= 40 ? "text-amber-600" : "text-red-600";
            const bgColor = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-blue-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
            return (
              <div key={d.criterion} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">{d.criterion}</span>
                  <span className={`text-sm font-bold ${color}`}>{d.score}/{d.max}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                  <div className={`h-full ${bgColor} rounded-full`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-gray-500">{d.tip}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Optimize Button */}
      {!optimization && (
        <div className="flex justify-center">
          <button
            onClick={handleOptimize}
            disabled={optimizing}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-medium hover:from-violet-700 hover:to-purple-700 transition-all shadow-lg shadow-violet-200 disabled:opacity-50"
          >
            {optimizing ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Analyse IA en cours...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                Générer l&apos;optimisation IA
              </>
            )}
          </button>
        </div>
      )}

      {/* Optimization Preview */}
      {optimization && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Sparkles size={20} className="text-violet-500" />
              Suggestions de l&apos;IA
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewMode(!previewMode)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                <Eye size={14} />
                {previewMode ? "Masquer" : "Prévisualiser"}
              </button>
              <button
                onClick={() => { setOptimization(null); setApplied(false); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                <RotateCcw size={14} />
                Régénérer
              </button>
              <button
                onClick={handleApply}
                disabled={applying || applied}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {applying ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {applied ? "Appliqué ✓" : "Appliquer"}
              </button>
            </div>
          </div>

          {previewMode && (
            <div className="space-y-4">
              {/* Title */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded">TITRE</span>
                  <span className="text-xs text-gray-400">{optimization.optimizedTitle.length} car.</span>
                </div>
                <p className="text-sm text-gray-400 line-through mb-1">{product?.name}</p>
                <p className="text-base font-medium text-gray-900">{optimization.optimizedTitle}</p>
              </div>

              {/* Meta Description */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">META DESCRIPTION</span>
                  <span className="text-xs text-gray-400">{optimization.metaDescription.length} car.</span>
                </div>
                <p className="text-sm text-gray-400 line-through mb-1">{product?.shortDescription}</p>
                <p className="text-sm text-gray-700">{optimization.metaDescription}</p>
                {/* Google Preview */}
                <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-400 mb-1">Aperçu Google :</p>
                  <p className="text-blue-700 text-base font-medium hover:underline cursor-pointer">{optimization.optimizedTitle}</p>
                  <p className="text-xs text-emerald-700">barberparadise.fr › produit › {(product as any)?.slug}</p>
                  <p className="text-sm text-gray-600 mt-0.5">{optimization.metaDescription}</p>
                </div>
              </div>

              {/* Tags */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">TAGS / MOTS-CLÉS</span>
                <div className="flex flex-wrap gap-2 mt-3">
                  {optimization.suggestedTags.map((tag) => (
                    <span key={tag} className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Image Alts */}
              {optimization.imageAlts.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <ImageIcon size={16} className="text-gray-400" />
                    <span className="text-xs font-semibold text-gray-600">TEXTES ALT DES IMAGES</span>
                  </div>
                  <div className="space-y-2">
                    {optimization.imageAlts.map((alt, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-xs text-gray-400 mt-0.5">Image {i + 1}:</span>
                        <span className="text-sm text-gray-700">{alt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Description Preview */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">DESCRIPTION SEO</span>
                <div
                  className="mt-3 prose prose-sm max-w-none text-gray-700"
                  dangerouslySetInnerHTML={{ __html: optimization.seoDescription }}
                />
              </div>

              {/* Suggestions */}
              {optimization.suggestions.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">SUGGESTIONS SUPPLÉMENTAIRES</span>
                  <ul className="mt-3 space-y-2">
                    {optimization.suggestions.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-violet-500 mt-0.5">•</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Estimated Score */}
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex items-center gap-4">
                <ScoreRing score={optimization.seoScore} size={60} />
                <div>
                  <p className="font-medium text-violet-900">Score SEO estimé après optimisation</p>
                  <p className="text-sm text-violet-600">
                    Gain estimé : +{Math.max(0, optimization.seoScore - score)} points
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
