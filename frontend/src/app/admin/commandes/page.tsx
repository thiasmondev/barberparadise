"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import AdminOrdersTabs from "@/components/admin/AdminOrdersTabs";
import { getAdminOrders } from "@/lib/admin-api";
import type { Order } from "@/types";

type OrdersSummary = {
  ordersToday: number;
  itemsOrdered: number;
  processedOrders: number;
  deliveredOrders: number;
};

const DEFAULT_SUMMARY: OrdersSummary = {
  ordersToday: 0,
  itemsOrdered: 0,
  processedOrders: 0,
  deliveredOrders: 0,
};

const PAYMENT_BADGES: Record<string, { label: string; className: string }> = {
  paid: { label: "Payée", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  processing: { label: "Payée", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  shipped: { label: "Payée", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  delivered: { label: "Payée", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  pending_payment: { label: "En attente", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  pending: { label: "En attente", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  cancelled: { label: "Remboursée", className: "bg-rose-50 text-rose-700 ring-rose-200" },
};

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

function customerName(order: Order) {
  const firstName = order.customer?.firstName || order.shippingAddress?.firstName || "";
  const lastName = order.customer?.lastName || order.shippingAddress?.lastName || "";
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || "Client invité";
}

function paymentBadge(order: Order) {
  return PAYMENT_BADGES[order.status] || PAYMENT_BADGES.pending;
}

function fulfillmentBadge(order: Order) {
  if (order.channel === "pos") {
    return { label: "Remise immédiate", className: "bg-violet-50 text-violet-700 ring-violet-200" };
  }
  const treated = ["processing", "shipped", "delivered"].includes(order.status);
  return treated
    ? { label: "Traité", className: "bg-sky-50 text-sky-700 ring-sky-200" }
    : { label: "Non traité", className: "bg-gray-100 text-gray-700 ring-gray-200" };
}

function channelBadge(order: Order) {
  if (order.channel === "pos") return { label: "Caisse POS", className: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200" };
  if (order.isB2B) return { label: "B2B", className: "bg-indigo-50 text-indigo-700 ring-indigo-200" };
  return { label: "Boutique web", className: "bg-gray-100 text-gray-700 ring-gray-200" };
}

function shippingMode(order: Order) {
  if (order.channel === "pos") return "Vente en caisse";
  const carrier = order.shipment?.carrier;
  if (carrier === "mondial_relay") return "Mondial Relay";
  if (carrier === "colissimo" || carrier === "colissimo_international") return "Colissimo";
  if (order.shipment?.relayPointId) return "Point de retrait";
  return order.shipping > 0 ? "Colissimo" : "Point de retrait";
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<OrdersSummary>(DEFAULT_SUMMARY);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOrders = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getAdminOrders({
        page,
        limit: 20,
        status: status || undefined,
        search: search.trim() || undefined,
        channel: channel || undefined,
      });
      setOrders(result.orders);
      setTotal(result.total);
      setPages(result.pages || 1);
      setSummary(result.summary || DEFAULT_SUMMARY);
    } catch (err: any) {
      setError(err.message || "Impossible de charger les commandes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [page, status, channel]);

  const kpis = useMemo(
    () => [
      { label: "Commandes aujourd'hui", value: summary.ordersToday },
      { label: "Articles commandés", value: summary.itemsOrdered },
      { label: "Commandes traitées", value: summary.processedOrders },
      { label: "Commandes livrées", value: summary.deliveredOrders },
    ],
    [summary]
  );

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    loadOrders();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 text-gray-900 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <p className="text-sm font-medium text-gray-500">Administration</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-950 sm:text-3xl">Commandes</h1>
          <p className="mt-2 text-sm text-gray-600">
            Suivez les ventes, les paiements et la préparation des commandes Barber Paradise.
          </p>
        </div>

        <AdminOrdersTabs />

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((item) => (
            <div key={item.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500">{item.label}</p>
              <p className="mt-3 text-3xl font-semibold text-gray-950">{item.value.toLocaleString("fr-FR")}</p>
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 p-4">
            <form onSubmit={handleSearch} className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Rechercher une commande, un client ou un email"
                  className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                >
                  <option value="">Tous les statuts</option>
                  <option value="pending">En attente</option>
                  <option value="pending_payment">Paiement en attente</option>
                  <option value="paid">Payée</option>
                  <option value="processing">Traitée</option>
                  <option value="shipped">Expédiée</option>
                  <option value="delivered">Livrée</option>
                  <option value="cancelled">Remboursée / annulée</option>
                </select>
                <select
                  value={channel}
                  onChange={(event) => {
                    setChannel(event.target.value);
                    setPage(1);
                  }}
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                >
                  <option value="">Tous les canaux</option>
                  <option value="online">Boutique web</option>
                  <option value="pos">Caisse POS</option>
                </select>
                <button className="rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800">
                  Filtrer
                </button>
              </div>
            </form>
          </div>

          {error && <div className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Commande</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Canal</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Paiement</th>
                  <th className="px-4 py-3">Traitement</th>
                  <th className="px-4 py-3 text-center">Articles</th>
                  <th className="px-4 py-3">Livraison</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                      <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Chargement des commandes...</span>
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-gray-500">Aucune commande trouvée.</td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const pay = paymentBadge(order);
                    const fulfillment = fulfillmentBadge(order);
                    const channelInfo = channelBadge(order);
                    const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
                    return (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-4 py-4 font-semibold text-gray-950">
                          <Link href={`/admin/commandes/${order.id}`} className="underline-offset-4 hover:underline">
                            {order.orderNumber}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-gray-600">{formatDate(order.createdAt)}</td>
                        <td className="px-4 py-4">
                          <div className="font-medium text-gray-900">{customerName(order)}</div>
                          <div className="text-xs text-gray-500">{order.customer?.email || order.customerEmail || order.email}</div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${channelInfo.className}`}>{channelInfo.label}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right font-medium text-gray-950">{formatPrice(order.total, order.currency)}</td>
                        <td className="whitespace-nowrap px-4 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${pay.className}`}>{pay.label}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${fulfillment.className}`}>{fulfillment.label}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-center text-gray-700">{itemCount}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-gray-600">{shippingMode(order)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-4 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
            <p>{total.toLocaleString("fr-FR")} commande{total > 1 ? "s" : ""} · page {page} sur {pages}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || loading}
                className="inline-flex items-center gap-1 rounded-xl border border-gray-300 px-3 py-2 font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Précédent
              </button>
              <button
                onClick={() => setPage((current) => Math.min(pages, current + 1))}
                disabled={page >= pages || loading}
                className="inline-flex items-center gap-1 rounded-xl border border-gray-300 px-3 py-2 font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Suivant <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
