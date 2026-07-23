"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Banknote, BarChart3, CreditCard, Loader2, RefreshCw, ShoppingBag, TrendingUp } from "lucide-react";
import { getPosStats, type PosStats } from "@/lib/admin-api";

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

function formatPrice(value: number) {
  return currency.format(Number.isFinite(value) ? value : 0);
}

function periodLabel(period: string) {
  if (period === "today") return "Aujourd’hui";
  if (period === "week") return "7 derniers jours";
  if (period === "month") return "30 derniers jours";
  return period;
}

export default function PosStatsPage() {
  const [period, setPeriod] = useState("today");
  const [stats, setStats] = useState<PosStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadStats() {
    setLoading(true);
    setError(null);
    try {
      const data = await getPosStats(period);
      setStats(data);
    } catch (err: any) {
      setError(err.message || "Impossible de charger les statistiques POS.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStats();
  }, [period]);

  const maxRevenue = useMemo(() => Math.max(...(stats?.topProducts.map((product) => product.revenue) || [1]), 1), [stats]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link href="/admin/caisse" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-primary">
            <ArrowLeft size={16} /> Retour à la caisse
          </Link>
          <h1 className="mt-3 flex items-center gap-2 text-2xl font-black text-gray-950 sm:text-3xl">
            <BarChart3 className="h-7 w-7 text-primary" /> Statistiques POS
          </h1>
          <p className="mt-2 text-sm text-gray-600">Analysez le chiffre d’affaires physique, le panier moyen et les produits les plus vendus au comptoir.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={period} onChange={(event) => setPeriod(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary">
            <option value="today">Aujourd’hui</option>
            <option value="week">7 jours</option>
            <option value="month">30 jours</option>
          </select>
          <button type="button" onClick={loadStats} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-gray-800">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Actualiser
          </button>
        </div>
      </div>

      {error && <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      {loading ? (
        <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-gray-100 bg-white"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : stats ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Chiffre d’affaires</p>
              <p className="mt-3 text-3xl font-black text-gray-950">{formatPrice(stats.revenue)}</p>
              <p className="mt-2 text-sm text-gray-500">Période : {periodLabel(stats.period)}</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Ventes payées</p>
              <p className="mt-3 text-3xl font-black text-gray-950">{stats.salesCount}</p>
              <p className="mt-2 text-sm text-gray-500">Depuis le {dateFormatter.format(new Date(stats.start))}</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Panier moyen</p>
              <p className="mt-3 text-3xl font-black text-gray-950">{formatPrice(stats.averageOrder)}</p>
              <p className="mt-2 text-sm text-gray-500">Calculé sur les ventes payées.</p>
            </div>
          </div>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-black text-gray-950"><CreditCard size={16} /> Carte · Indy</h2>
              <p className="mt-3 text-2xl font-black text-gray-950">{formatPrice(stats.paymentBreakdown?.indy?.revenue ?? 0)}</p>
              <p className="mt-2 text-sm text-gray-500">{stats.paymentBreakdown?.indy?.count ?? 0} vente(s) via Indy.</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-black text-gray-950"><CreditCard size={16} /> Carte · Mollie</h2>
              <p className="mt-3 text-2xl font-black text-gray-950">{formatPrice(stats.paymentBreakdown?.mollie_manual?.revenue ?? 0)}</p>
              <p className="mt-2 text-sm text-gray-500">{stats.paymentBreakdown?.mollie_manual?.count ?? 0} vente(s) via Mollie.</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-black text-gray-950"><Banknote size={16} /> Espèces</h2>
              <p className="mt-3 text-2xl font-black text-gray-950">{formatPrice(stats.paymentBreakdown?.cash?.revenue ?? 0)}</p>
              <p className="mt-2 text-sm text-gray-500">{stats.paymentBreakdown?.cash?.count ?? 0} vente(s) en espèces.</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-black text-gray-950"><Banknote size={16} /> Virement</h2>
              <p className="mt-3 text-2xl font-black text-gray-950">{formatPrice(stats.paymentBreakdown?.virement?.revenue ?? 0)}</p>
              <p className="mt-2 text-sm text-gray-500">{stats.paymentBreakdown?.virement?.count ?? 0} vente(s) par virement.</p>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-black text-gray-950"><TrendingUp size={18} /> Top produits POS</h2>
                  <p className="mt-1 text-sm text-gray-500">Classement par quantité vendue sur la période.</p>
                </div>
              </div>
              <div className="space-y-4">
                {stats.topProducts.length === 0 && <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">Aucune vente payée sur cette période.</p>}
                {stats.topProducts.map((product, index) => (
                  <div key={`${product.name}-${index}`} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-gray-950">{index + 1}. {product.name}</p>
                        <p className="text-xs text-gray-500">{product.quantity} unité(s) vendue(s)</p>
                      </div>
                      <p className="text-sm font-black text-gray-950">{formatPrice(product.revenue)}</p>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(6, (product.revenue / maxRevenue) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <aside className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-black text-gray-950"><ShoppingBag size={18} /> Dernière vente</h2>
              {!stats.latestOrder ? (
                <p className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-500">Aucune dernière vente disponible.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-xl font-black text-gray-950">{stats.latestOrder.orderNumber}</p>
                    <p className="mt-1 text-sm text-gray-500">{dateFormatter.format(new Date(stats.latestOrder.createdAt))} · {stats.latestOrder.paymentMethod === "cash" ? "Espèces" : stats.latestOrder.paymentMethod === "virement" ? "Virement" : stats.latestOrder.paymentMethod === "split" ? "Divisé" : stats.latestOrder.paymentMethod === "mollie_manual" ? "Mollie" : "Indy"}</p>
                  </div>
                  <div className="rounded-2xl bg-gray-950 p-4 text-white">
                    <p className="text-sm text-gray-300">Total encaissé</p>
                    <p className="mt-2 text-3xl font-black">{formatPrice(stats.latestOrder.totalTTC || stats.latestOrder.total)}</p>
                  </div>
                  <div className="space-y-2">
                    {stats.latestOrder.items.slice(0, 5).map((item) => (
                      <div key={item.id} className="flex justify-between gap-3 rounded-xl border border-gray-100 p-3">
                        <div>
                          <p className="text-sm font-bold text-gray-950">{item.name}</p>
                          <p className="text-xs text-gray-500">Qté {item.quantity}</p>
                        </div>
                        <p className="text-sm font-black text-gray-950">{formatPrice(item.price * item.quantity - item.discountAmount)}</p>
                      </div>
                    ))}
                  </div>
                  <Link href="/admin/caisse/historique" className="inline-flex w-full items-center justify-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-800 hover:border-primary/40 hover:text-primary">
                    Voir l’historique complet
                  </Link>
                </div>
              )}
            </aside>
          </section>
        </>
      ) : null}
    </div>
  );
}
