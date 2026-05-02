"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getSeoDashboard, type SeoDashboardData } from "@/lib/admin-api";
import {
  Search,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  FileText,
  Zap,
  ArrowRight,
  Target,
  BookOpen,
  Plus,
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
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {score}/100
    </span>
  );
}
function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#3b82f6" : score >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>{score}</span>
        <span className="text-xs text-gray-500">/ 100</span>
      </div>
    </div>
  );
}
export default function SeoDashboardPage() {
  const [data, setData] = useState<SeoDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    getSeoDashboard()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Search className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agent SEO</h1>
            <p className="text-sm text-gray-500">Chargement...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
        <p className="font-medium">Erreur</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }
  if (!data) return null;
  const { distribution } = data;
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-200">
            <Search className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agent SEO</h1>
            <p className="text-sm text-gray-500">Optimisez vos fiches produits pour Google</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/admin/seo/produit"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Plus size={16} />
            Créer un produit
          </Link>
          <Link
            href="/admin/seo/optimiser"
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors shadow-sm"
          >
            <Zap size={16} />
            Optimiser en masse
          </Link>
          <Link
            href="/admin/seo/blog"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <FileText size={16} />
            Générer un article
          </Link>
        </div>
      </div>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <BarChart3 size={16} />
            Score moyen
          </div>
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-gray-900">{data.averageScore}</span>
            <span className="text-gray-400">/100</span>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Target size={16} />
            Produits analysés
          </div>
          <span className="text-3xl font-bold text-gray-900">{data.totalProducts}</span>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <CheckCircle size={16} className="text-emerald-500" />
            Bien optimisés
          </div>
          <span className="text-3xl font-bold text-emerald-600">{distribution.excellent + distribution.good}</span>
          <span className="text-sm text-gray-400 ml-1">/ {data.totalProducts}</span>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <BookOpen size={16} />
            Articles blog
          </div>
          <span className="text-3xl font-bold text-gray-900">{data.blogStats.total}</span>
          <span className="text-sm text-gray-400 ml-1">({data.blogStats.published} publiés)</span>
        </div>
      </div>
      {/* Score Distribution + Score Ring */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col items-center justify-center">
          <p className="text-sm font-medium text-gray-500 mb-4">Score SEO Global</p>
          <ScoreRing score={data.averageScore} size={140} />
          <p className="text-xs text-gray-400 mt-3">
            {data.averageScore >= 80 ? "Excellent" : data.averageScore >= 60 ? "Bon" : data.averageScore >= 40 ? "À améliorer" : "Critique"}
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 lg:col-span-2">
          <h2 className="font-semibold text-gray-900 mb-4">Répartition des scores</h2>
          <div className="space-y-3">
            {[
              { label: "Excellent (80-100)", count: distribution.excellent, color: "bg-emerald-500", total: data.totalProducts },
              { label: "Bon (60-79)", count: distribution.good, color: "bg-blue-500", total: data.totalProducts },
              { label: "Moyen (40-59)", count: distribution.average, color: "bg-amber-500", total: data.totalProducts },
              { label: "Faible (0-39)", count: distribution.poor, color: "bg-red-500", total: data.totalProducts },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{item.label}</span>
                  <span className="font-medium text-gray-900">
                    {item.count} <span className="text-gray-400">({item.total > 0 ? Math.round((item.count / item.total) * 100) : 0}%)</span>
                  </span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.color} rounded-full transition-all duration-700`}
                    style={{ width: `${item.total > 0 ? (item.count / item.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Priority Products */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" />
            <h2 className="font-semibold text-gray-900">Produits prioritaires à optimiser</h2>
          </div>
          <Link href="/admin/seo/optimiser" className="text-sm text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1">
            Voir tout <ArrowRight size={14} />
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {data.priorityProducts.slice(0, 10).map((p) => (
            <div key={p.id} className="px-5 py-3 flex items-center gap-4 hover:bg-gray-50 transition-colors">
              <ScoreBadge score={p.score} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                <p className="text-xs text-gray-400">{p.brand} · {p.category}</p>
              </div>
              <p className="text-xs text-gray-500 max-w-xs truncate hidden md:block">{p.mainIssue}</p>
              <Link
                href={`/admin/seo/produit?id=${p.id}`}
                className="text-xs text-violet-600 hover:text-violet-700 font-medium whitespace-nowrap"
              >
                Optimiser →
              </Link>
            </div>
          ))}
        </div>
      </div>
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/admin/seo/produit"
          className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-5 text-white hover:from-emerald-600 hover:to-teal-700 transition-all group"
        >
          <Plus size={24} className="mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="font-semibold mb-1">Créer depuis une URL</h3>
          <p className="text-sm text-emerald-100">Collez une fiche produit de marque pour générer un brouillon optimisé SEO/GEO.</p>
        </Link>
        <Link
          href="/admin/seo/blog"
          className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl p-5 text-white hover:from-blue-600 hover:to-cyan-700 transition-all group"
        >
          <FileText size={24} className="mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="font-semibold mb-1">Générateur d&apos;articles</h3>
          <p className="text-sm text-blue-200">Créez des articles de blog SEO liés à vos produits.</p>
        </Link>
        <Link
          href="/admin/seo/optimiser?filter=poor"
          className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-5 text-white hover:from-amber-600 hover:to-orange-700 transition-all group"
        >
          <TrendingUp size={24} className="mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="font-semibold mb-1">Produits critiques</h3>
          <p className="text-sm text-amber-200">{distribution.poor} produits avec un score SEO faible nécessitent une attention urgente.</p>
        </Link>
      </div>
    </div>
  );
}
