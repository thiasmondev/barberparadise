"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CreditCard, Loader2, PieChart, ReceiptText } from "lucide-react";
import { getSalesDashboardStats } from "@/lib/admin-api";
import type { SalesDashboardPeriod, SalesDashboardStats } from "@/types";

const COLORS = ["#0f056b", "#fd2786", "#18a999", "#f59e0b", "#7c3aed", "#2563eb", "#64748b"];
const CIRCUMFERENCE = 2 * Math.PI * 46;

function formatPrice(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function firstDayOfCurrentMonth() {
  const date = new Date();
  return dateInputValue(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)));
}

type ChartLine = SalesDashboardStats["paymentBreakdown"][number] & { color: string; ratio: number };

export default function SalesStatistics() {
  const router = useRouter();
  const [period, setPeriod] = useState<SalesDashboardPeriod>("current_month");
  const [startDate, setStartDate] = useState(firstDayOfCurrentMonth);
  const [endDate, setEndDate] = useState(() => dateInputValue(new Date()));
  const [stats, setStats] = useState<SalesDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const nextStats = await getSalesDashboardStats({
        period,
        ...(period === "custom" ? { startDate, endDate } : {}),
      });
      setStats(nextStats);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Impossible de charger les statistiques de vente");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [period, startDate, endDate]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const lines = useMemo<ChartLine[]>(() => {
    const total = stats?.totalRevenue || 0;
    return (stats?.paymentBreakdown || []).map((line, index) => ({
      ...line,
      color: COLORS[index % COLORS.length],
      ratio: total > 0 ? line.amount / total : 0,
    }));
  }, [stats]);

  const hoveredLine = lines.find((line) => line.category === hoveredCategory) || null;
  const openOrdersForCategory = (category: string) => {
    if (!stats) return;
    const params = new URLSearchParams({
      paymentCategory: category,
      startDate: stats.startDate,
      endDate: stats.endDate,
    });
    router.push(`/admin/commandes?${params.toString()}`);
  };
  let dashOffset = 0;

  return (
    <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-gray-100 px-5 py-4 sm:px-6 sm:py-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0f056b]/10 text-[#0f056b]">
              <PieChart size={16} />
            </div>
            <h2 className="font-heading text-base font-bold text-dark-800">Statistiques de vente</h2>
          </div>
          <p className="mt-1 text-xs text-gray-500">Chiffre d’affaires TTC réellement encaissé par moyen de paiement</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="text-xs font-medium text-gray-600">
            Période
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value as SalesDashboardPeriod)}
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-dark-800 outline-none transition focus:border-[#0f056b] sm:w-48"
            >
              <option value="current_month">Mois en cours</option>
              <option value="current_year">Année en cours</option>
              <option value="custom">Plage personnalisée</option>
            </select>
          </label>
          {period === "custom" && (
            <>
              <label className="text-xs font-medium text-gray-600">
                Du
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-[#0f056b]" />
              </label>
              <label className="text-xs font-medium text-gray-600">
                Au
                <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-[#0f056b]" />
              </label>
            </>
          )}
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-gray-500"><Loader2 size={18} className="animate-spin text-[#fd2786]" /> Chargement des ventes…</div>
        ) : error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : stats ? (
          <>
            <div className="mb-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-[#0f056b] p-4 text-white">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-white/70"><ReceiptText size={14} /> Chiffre d’affaires TTC</div>
                <p className="mt-2 font-heading text-2xl font-bold tabular-nums">{formatPrice(stats.totalRevenue)}</p>
                <p className="mt-1 text-xs text-white/70 capitalize">{stats.label}</p>
              </div>
              <div className="rounded-xl border border-[#fd2786]/20 bg-[#fd2786]/5 p-4 text-[#0f056b]">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[#0f056b]/65"><CalendarDays size={14} /> Commandes encaissées</div>
                <p className="mt-2 font-heading text-2xl font-bold tabular-nums">{stats.orderCount}</p>
                <p className="mt-1 text-xs text-[#0f056b]/65">Du {new Date(`${stats.startDate}T00:00:00`).toLocaleDateString("fr-FR")} au {new Date(`${stats.endDate}T00:00:00`).toLocaleDateString("fr-FR")}</p>
              </div>
            </div>

            {lines.length === 0 ? (
              <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 text-center text-sm text-gray-400"><CreditCard size={24} className="mb-2" />Aucune commande encaissée sur cette période.</div>
            ) : (
              <div className="grid items-center gap-6 lg:grid-cols-[minmax(260px,0.85fr)_minmax(300px,1.15fr)]">
                <div className="flex min-h-64 items-center justify-center">
                  <div className="relative h-60 w-60">
                    <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" role="img" aria-label="Répartition du chiffre d’affaires par moyen de paiement">
                      {lines.map((line) => {
                        const dashLength = Math.max(0, line.ratio * CIRCUMFERENCE - 1.25);
                        const circle = (
                          <circle
                            key={line.category}
                            cx="60"
                            cy="60"
                            r="46"
                            fill="none"
                            stroke={line.color}
                            strokeWidth={hoveredCategory === line.category ? 16 : 14}
                            strokeLinecap="butt"
                            strokeDasharray={`${dashLength} ${CIRCUMFERENCE - dashLength}`}
                            strokeDashoffset={-dashOffset}
                            className="cursor-pointer transition-all duration-150"
                            onMouseEnter={() => setHoveredCategory(line.category)}
                            onMouseLeave={() => setHoveredCategory(null)}
                          >
                            <title>{`${line.category} : ${formatPrice(line.amount)} (${line.percentage.toFixed(1)} %)`}</title>
                          </circle>
                        );
                        dashOffset += line.ratio * CIRCUMFERENCE;
                        return circle;
                      })}
                    </svg>
                    <div className="pointer-events-none absolute inset-10 flex flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
                      <span className="max-w-28 text-[11px] font-medium leading-tight text-gray-500">{hoveredLine?.category || "Total CA"}</span>
                      <span className="mt-1 text-sm font-bold tabular-nums text-[#0f056b]">{formatPrice(hoveredLine?.amount ?? stats.totalRevenue)}</span>
                      <span className="mt-0.5 text-[10px] font-semibold text-[#fd2786]">{hoveredLine ? `${hoveredLine.percentage.toFixed(1)} %` : "100 %"}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {lines.map((line) => (
                    <button
                      key={line.category}
                      type="button"
                      onMouseEnter={() => setHoveredCategory(line.category)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      onFocus={() => setHoveredCategory(line.category)}
                      onBlur={() => setHoveredCategory(null)}
                      onClick={() => openOrdersForCategory(line.category)}
                      aria-label={`Voir les commandes ${line.category} pour ${stats?.label || "la période sélectionnée"}`}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${hoveredCategory === line.category ? "border-[#fd2786]/40 bg-[#fd2786]/5" : "border-gray-100 hover:border-[#0f056b]/20 hover:bg-gray-50"}`}
                    >
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: line.color }} />
                      <span className="min-w-0 flex-1 text-sm font-medium text-dark-800">{line.category}</span>
                      <span className="text-right"><span className="block text-sm font-semibold tabular-nums text-dark-800">{formatPrice(line.amount)}</span><span className="block text-[11px] text-gray-500">{line.percentage.toFixed(1)} %</span></span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
}
