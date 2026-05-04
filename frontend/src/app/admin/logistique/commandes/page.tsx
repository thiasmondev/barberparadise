"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Loader2,
  PackageCheck,
  RefreshCcw,
  Scale,
  Truck,
} from "lucide-react";
import {
  getLogisticsOrders,
  type LogisticsOrderListItem,
} from "@/lib/admin-api";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPrice(value: number, currency = "EUR") {
  return value.toLocaleString("fr-FR", { style: "currency", currency });
}

function formatWeight(value: number | null) {
  if (value === null) return "À compléter";
  if (value >= 1000)
    return `${(value / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kg`;
  return `${value.toLocaleString("fr-FR")} g`;
}

export default function AdminLogisticsOrdersPage() {
  const [orders, setOrders] = useState<LogisticsOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOrders = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getLogisticsOrders();
      setOrders(data.orders);
    } catch (err: any) {
      setError(err.message || "Erreur de chargement des commandes à expédier");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const totals = useMemo(() => {
    const known = orders.filter(order => !order.hasUnknownWeight).length;
    const items = orders.reduce((sum, order) => sum + order.itemCount, 0);
    return { known, items };
  }, [orders]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-600 font-semibold">
            Agent Logistique
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Truck size={26} className="text-cyan-600" /> Commandes à expédier
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Commandes payées non encore expédiées, avec poids estimé et accès au
            panneau de préparation.
          </p>
        </div>
        <button
          onClick={loadOrders}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-white px-4 py-2.5 text-sm font-semibold text-cyan-700 shadow-sm hover:bg-cyan-50"
        >
          <RefreshCcw size={17} /> Actualiser
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={<PackageCheck size={20} />}
          label="À préparer"
          value={orders.length.toString()}
        />
        <StatCard
          icon={<ClipboardList size={20} />}
          label="Articles à emballer"
          value={totals.items.toString()}
        />
        <StatCard
          icon={<Scale size={20} />}
          label="Poids complets"
          value={`${totals.known}/${orders.length}`}
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
            <Loader2 className="animate-spin" size={18} /> Chargement des
            commandes...
          </div>
        ) : orders.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <Truck size={42} className="mx-auto mb-3 text-gray-300" />
            <h2 className="font-semibold text-gray-900">
              Aucune commande à expédier
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Les commandes payées apparaîtront ici avant passage en expédition.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Commande</th>
                  <th className="px-4 py-3 text-left">Client</th>
                  <th className="px-4 py-3 text-left">Articles</th>
                  <th className="px-4 py-3 text-left">Poids estimé</th>
                  <th className="px-4 py-3 text-left">Total</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map(order => (
                  <tr key={order.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">
                        {order.orderNumber}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(order.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{order.customerName}</div>
                      <div className="text-xs text-gray-500">
                        {order.customerEmail}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {order.itemCount}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${order.hasUnknownWeight ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}
                      >
                        {formatWeight(order.estimatedWeightG)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {formatPrice(order.total, order.currency || "EUR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/logistique/commandes/${order.id}`}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-700"
                      >
                        Préparer
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <Link
          href="/admin/logistique/emballages"
          className="text-sm font-medium text-cyan-700 hover:text-cyan-800"
        >
          Gérer les emballages →
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-cyan-50 p-2 text-cyan-700">{icon}</div>
        <div>
          <div className="text-2xl font-bold text-gray-900">{value}</div>
          <div className="text-xs uppercase tracking-wide text-gray-500">
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}
