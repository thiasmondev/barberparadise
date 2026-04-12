"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState, useCallback } from "react";
import { getAdminOrders, updateOrderStatus } from "@/lib/admin-api";
import type { Order } from "@/types";
import Link from "next/link";
import {
  ShoppingCart,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "En attente", color: "text-yellow-600 bg-yellow-50", icon: Clock },
  processing: { label: "En cours", color: "text-blue-600 bg-blue-50", icon: AlertCircle },
  shipped: { label: "Expédiée", color: "text-purple-600 bg-purple-50", icon: Truck },
  delivered: { label: "Livrée", color: "text-green-600 bg-green-50", icon: CheckCircle },
  cancelled: { label: "Annulée", color: "text-red-600 bg-red-50", icon: XCircle },
};
const STATUS_OPTIONS = [
  { value: "", label: "Tous les statuts" },
  { value: "pending", label: "En attente" },
  { value: "processing", label: "En cours" },
  { value: "shipped", label: "Expédiée" },
  { value: "delivered", label: "Livrée" },
  { value: "cancelled", label: "Annulée" },
];
function formatPrice(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminOrders({ page, status: statusFilter, limit: 20 });
      setOrders(data.orders);
      setTotal(data.total);
      setPages(data.pages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);
  useEffect(() => { load(); }, [load]);
  const handleStatusChange = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    try {
      await updateOrderStatus(orderId, newStatus);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-heading font-bold text-xl text-dark-800">Commandes</h1>
          <p className="text-sm text-gray-500">{total} commande{total !== 1 ? "s" : ""} au total</p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Commande</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">Client</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Date</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Total</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Statut</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3" colSpan={6}>
                      <div className="h-5 bg-gray-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    <ShoppingCart size={32} className="mx-auto mb-2 text-gray-300" />
                    Aucune commande
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                  return (
                    <tr key={order.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-dark-800">#{order.orderNumber || order.id.slice(-8)}</div>
                        <div className="text-xs text-gray-400">{order.items?.length || 0} article{(order.items?.length || 0) !== 1 ? "s" : ""}</div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="text-dark-700">
                          {order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : "—"}
                        </div>
                        <div className="text-xs text-gray-400">{order.email}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell text-xs">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-dark-800 tabular-nums">
                        {formatPrice(order.total)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                          disabled={updatingId === order.id}
                          className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${cfg.color} disabled:opacity-50`}
                        >
                          {Object.entries(STATUS_CONFIG).map(([val, c]) => (
                            <option key={val} value={val}>{c.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/commandes/${order.id}`}
                          className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg inline-flex"
                          title="Voir le détail"
                        >
                          <Eye size={14} />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Page {page} sur {pages}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="p-1.5 rounded-lg text-gray-400 hover:text-dark-800 hover:bg-gray-100 disabled:opacity-30">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setPage(Math.min(pages, page + 1))} disabled={page >= pages} className="p-1.5 rounded-lg text-gray-400 hover:text-dark-800 hover:bg-gray-100 disabled:opacity-30">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
