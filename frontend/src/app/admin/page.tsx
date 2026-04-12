"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { getDashboardStats } from "@/lib/admin-api";
import type { DashboardStats } from "@/types";
import {
  Package,
  ShoppingCart,
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "En attente", color: "text-yellow-600 bg-yellow-50", icon: Clock },
  processing: { label: "En cours", color: "text-blue-600 bg-blue-50", icon: AlertCircle },
  shipped: { label: "Expédiée", color: "text-purple-600 bg-purple-50", icon: Truck },
  delivered: { label: "Livrée", color: "text-green-600 bg-green-50", icon: CheckCircle },
  cancelled: { label: "Annulée", color: "text-red-600 bg-red-50", icon: XCircle },
};
function formatPrice(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}
export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-20 mb-3" />
              <div className="h-8 bg-gray-100 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (!stats) {
    return (
      <div className="text-center py-20 text-gray-500">
        Impossible de charger les statistiques.
      </div>
    );
  }
  const kpis = [
    { label: "Produits actifs", value: stats.totalProducts, icon: Package, color: "text-primary bg-primary/10" },
    { label: "Commandes", value: stats.totalOrders, icon: ShoppingCart, color: "text-emerald-600 bg-emerald-50" },
    { label: "Clients", value: stats.totalCustomers, icon: Users, color: "text-violet-600 bg-violet-50" },
    { label: "Chiffre d'affaires", value: formatPrice(stats.totalRevenue), icon: DollarSign, color: "text-amber-600 bg-amber-50" },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading font-bold text-xl text-dark-800">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Vue d&apos;ensemble de votre boutique</p>
      </div>
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{kpi.label}</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${kpi.color}`}>
                <kpi.icon size={16} />
              </div>
            </div>
            <div className="font-heading font-bold text-2xl text-dark-800">{kpi.value}</div>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent orders */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-heading font-semibold text-sm text-dark-800">Commandes récentes</h2>
            <Link href="/admin/commandes" className="text-xs text-primary hover:underline">
              Tout voir →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {stats.recentOrders.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">Aucune commande</div>
            ) : (
              stats.recentOrders.map((order) => {
                const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                return (
                  <div key={order.id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cfg.color}`}>
                      <cfg.icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-dark-800 truncate">
                        Commande #{order.id.slice(-6)}
                      </div>
                      <div className="text-xs text-gray-400">{formatDate(order.createdAt)}</div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <span className="text-sm font-semibold text-dark-800 tabular-nums">
                      {formatPrice(order.total)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
        {/* Orders by status */}
        <div className="bg-white rounded-xl border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-heading font-semibold text-sm text-dark-800">Par statut</h2>
          </div>
          <div className="p-5 space-y-3">
            {stats.ordersByStatus.length === 0 ? (
              <div className="text-center text-sm text-gray-400 py-4">Aucune donnée</div>
            ) : (
              stats.ordersByStatus.map((s) => {
                const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.pending;
                const pct = stats.totalOrders > 0 ? Math.round((s.count / stats.totalOrders) * 100) : 0;
                return (
                  <div key={s.status}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <cfg.icon size={14} className={cfg.color.split(" ")[0]} />
                        <span className="text-sm text-dark-700">{cfg.label}</span>
                      </div>
                      <span className="text-sm font-medium text-dark-800">{s.count}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      {/* Quick actions */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Link
          href="/admin/produits"
          className="bg-white rounded-xl border border-gray-100 p-5 hover:border-primary/30 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
              <Package size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold text-dark-800">Gérer les produits</div>
              <div className="text-xs text-gray-400">Ajouter, modifier, supprimer</div>
            </div>
            <TrendingUp size={16} className="ml-auto text-gray-300 group-hover:text-primary transition-colors" />
          </div>
        </Link>
        <Link
          href="/admin/commandes"
          className="bg-white rounded-xl border border-gray-100 p-5 hover:border-primary/30 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <ShoppingCart size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold text-dark-800">Voir les commandes</div>
              <div className="text-xs text-gray-400">Suivi et gestion</div>
            </div>
            <TrendingUp size={16} className="ml-auto text-gray-300 group-hover:text-emerald-600 transition-colors" />
          </div>
        </Link>
        <Link
          href="/admin/clients"
          className="bg-white rounded-xl border border-gray-100 p-5 hover:border-primary/30 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-50 rounded-lg flex items-center justify-center text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors">
              <Users size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold text-dark-800">Gérer les clients</div>
              <div className="text-xs text-gray-400">Base de données clients</div>
            </div>
            <TrendingUp size={16} className="ml-auto text-gray-300 group-hover:text-violet-600 transition-colors" />
          </div>
        </Link>
      </div>
    </div>
  );
}
