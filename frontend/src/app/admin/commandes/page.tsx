"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Loader2, Search, Trash2 } from "lucide-react";
import AdminOrdersTabs from "@/components/admin/AdminOrdersTabs";
import { getAdminOrders, deleteAdminOrder } from "@/lib/admin-api";
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

// ─── Couleurs de fond de ligne par statut ─────────────────────────────────────
// "active"   = commandes à traiter (paid, processing, pending) → fond blanc
// "done"     = commandes terminées (shipped, delivered) ou POS → fond noir
// "muted"    = commandes annulées/remboursées → fond gris clair
type RowVariant = "active" | "done" | "muted";

function getRowVariant(order: Order): RowVariant {
  const { status, channel } = order;
  if (status === "cancelled") return "muted";
  if (channel === "pos" || status === "shipped" || status === "delivered") return "done";
  return "active";
}

// Classes Tailwind pour chaque variante (fond + texte + hover)
const ROW_VARIANT_CLASSES: Record<RowVariant, { row: string; text: string; subtext: string; badge: string }> = {
  active: {
    row: "bg-white hover:bg-gray-50",
    text: "text-gray-950",
    subtext: "text-gray-500",
    badge: "",
  },
  done: {
    row: "bg-[#1a1a1a] hover:bg-[#222]",
    text: "text-white",
    subtext: "text-gray-400",
    badge: "opacity-90",
  },
  muted: {
    row: "bg-[#f0f0f0] hover:bg-[#e8e8e8]",
    text: "text-gray-500",
    subtext: "text-gray-400",
    badge: "opacity-70",
  },
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

function paymentMethodLabel(method?: string | null, provider?: string | null): string {
  const m = (method || "").toLowerCase();
  const p = (provider || "").toLowerCase();
  if (m === "cash" || m === "especes" || m === "espèces") return "Espèces";
  if (m === "manual") return "Encaissement manuel";
  if (m === "paypal" || p === "paypal") return "PayPal";
  if (m === "paybybank") return "Paiement bancaire instantané";
  if (["pay_by_bank", "banktransfer", "bank_transfer", "bank-transfer", "virement"].includes(m)) return "Virement bancaire";
  if (["creditcard", "credit_card", "card", "carte", "ideal", "bancontact"].includes(m)) return "Carte bancaire";
  if (m === "applepay" || m === "apple_pay") return "Apple Pay";
  if (m === "googlepay" || m === "google_pay") return "Google Pay";
  if (!m && !p) return "—";
  return method || provider || "—";
}

function shippingMode(order: Order) {
  if (order.channel === "pos") return "Vente en caisse";
  const carrier = order.shipment?.carrier;
  if (carrier === "mondial_relay") return "Mondial Relay";
  if (carrier === "colissimo_international") return "Colissimo International";
  if (carrier === "colissimo") return "Colissimo";
  if (carrier === "livraison_standard") return "Livraison standard";
  if (order.shipment?.relayPointId) return "Point de retrait";
  if (!carrier) return order.shipping > 0 ? "Colissimo" : "Point de retrait";
  return carrier;
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

  // ─── Sélection multiple ───────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const allVisibleIds = useMemo(() => orders.map((o) => o.id), [orders]);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allVisibleIds));
    }
  }, [allSelected, allVisibleIds]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

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
      // Réinitialiser la sélection à chaque rechargement
      setSelected(new Set());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Impossible de charger les commandes";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleBulkDelete = async () => {
    const count = selected.size;
    const confirmed = window.confirm(
      `Supprimer ${count} commande${count > 1 ? "s" : ""} ? Cette action est définitive.`
    );
    if (!confirmed) return;

    setDeleting(true);
    let failCount = 0;
    for (const id of Array.from(selected)) {
      try {
        await deleteAdminOrder(id);
      } catch {
        failCount++;
      }
    }
    setDeleting(false);

    if (failCount > 0) {
      setError(`${failCount} commande${failCount > 1 ? "s" : ""} n'ont pas pu être supprimée${failCount > 1 ? "s" : ""}.`);
    }

    await loadOrders();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 text-gray-900 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
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
          <div className="border-b border-gray-200 p-3 sm:p-4">
            <form onSubmit={handleSearch} className="flex flex-col gap-2.5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Commande, client, email…"
                  className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                  className="flex-1 min-w-[130px] rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
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
                  className="flex-1 min-w-[130px] rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                >
                  <option value="">Tous les canaux</option>
                  <option value="online">Boutique web</option>
                  <option value="pos">Caisse POS</option>
                </select>
                <button className="rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 whitespace-nowrap">
                  Filtrer
                </button>
              </div>
            </form>
          </div>

          {/* Barre d'actions de sélection — visible uniquement quand au moins une commande est sélectionnée */}
          {someSelected && (
            <div className="flex items-center justify-between gap-3 border-b border-rose-200 bg-rose-50 px-4 py-3">
              <span className="text-sm font-medium text-rose-800">
                {selected.size} commande{selected.size > 1 ? "s" : ""} sélectionnée{selected.size > 1 ? "s" : ""}
              </span>
              <button
                onClick={handleBulkDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Supprimer la sélection
              </button>
            </div>
          )}

          {error && <div className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

          {/* Vue tableau — masquée sur mobile */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-[700px] w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Tout sélectionner"
                      className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-gray-950"
                    />
                  </th>
                  <th className="px-4 py-3">Commande</th>
                  <th className="px-4 py-3 hidden md:table-cell">Date</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Canal</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Paiement</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Traitement</th>
                  <th className="px-4 py-3 text-center hidden md:table-cell">Art.</th>
                  <th className="px-4 py-3 hidden xl:table-cell">Livraison</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                      <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Chargement...</span>
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-gray-500">Aucune commande trouvée.</td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const pay = paymentBadge(order);
                    const fulfillment = fulfillmentBadge(order);
                    const channelInfo = channelBadge(order);
                    const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
                    const variant = getRowVariant(order);
                    const vc = ROW_VARIANT_CLASSES[variant];
                    const isChecked = selected.has(order.id);
                    return (
                      <tr
                        key={order.id}
                        className={`transition-colors ${vc.row} ${isChecked ? "ring-2 ring-inset ring-rose-400" : ""}`}
                      >
                        <td className="px-4 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleOne(order.id)}
                            aria-label={`Sélectionner la commande ${order.orderNumber}`}
                            className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-gray-950"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className={`whitespace-nowrap px-4 py-3 font-semibold ${vc.text}`}>
                          <Link href={`/admin/commandes/${order.id}`} className="underline-offset-4 hover:underline">
                            {order.orderNumber}
                          </Link>
                        </td>
                        <td className={`whitespace-nowrap px-4 py-3 hidden md:table-cell ${vc.subtext}`}>{formatDate(order.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className={`font-medium ${vc.text}`}>{customerName(order)}</div>
                          <div className={`text-xs hidden md:block ${vc.subtext}`}>{order.customer?.email || order.customerEmail || order.email}</div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 hidden lg:table-cell">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${channelInfo.className} ${vc.badge}`}>{channelInfo.label}</span>
                        </td>
                        <td className={`whitespace-nowrap px-4 py-3 text-right font-medium ${vc.text}`}>{formatPrice(order.total, order.currency)}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${pay.className} ${vc.badge}`}>{pay.label}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 hidden lg:table-cell">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${fulfillment.className} ${vc.badge}`}>{fulfillment.label}</span>
                        </td>
                        <td className={`whitespace-nowrap px-4 py-3 text-center hidden md:table-cell ${vc.subtext}`}>{itemCount}</td>
                        <td className={`whitespace-nowrap px-4 py-3 hidden xl:table-cell ${vc.subtext}`}>{shippingMode(order)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Vue cartes — visible uniquement sur mobile */}
          <div className="sm:hidden divide-y divide-gray-100">
            {loading ? (
              <div className="py-12 text-center text-gray-500">
                <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Chargement...</span>
              </div>
            ) : orders.length === 0 ? (
              <div className="py-12 text-center text-gray-500">Aucune commande trouvée.</div>
            ) : (
              orders.map((order) => {
                const pay = paymentBadge(order);
                const fulfillment = fulfillmentBadge(order);
                const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
                const variant = getRowVariant(order);
                const vc = ROW_VARIANT_CLASSES[variant];
                const isChecked = selected.has(order.id);
                return (
                  <div
                    key={order.id}
                    className={`flex items-start gap-3 px-4 py-3.5 transition-colors ${vc.row} ${isChecked ? "ring-2 ring-inset ring-rose-400" : ""}`}
                  >
                    {/* Checkbox mobile */}
                    <div className="flex items-center pt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOne(order.id)}
                        aria-label={`Sélectionner la commande ${order.orderNumber}`}
                        className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-gray-950"
                      />
                    </div>
                    <Link href={`/admin/commandes/${order.id}`} className="flex flex-1 min-w-0 items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`font-semibold text-sm ${vc.text}`}>{order.orderNumber}</span>
                          <span className={`font-semibold text-sm tabular-nums ${vc.text}`}>{formatPrice(order.total, order.currency)}</span>
                        </div>
                        <div className={`text-sm truncate ${vc.text}`}>{customerName(order)}</div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${pay.className} ${vc.badge}`}>{pay.label}</span>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${fulfillment.className} ${vc.badge}`}>{fulfillment.label}</span>
                          <span className={`text-xs ${vc.subtext}`}>{itemCount} art. · {formatDate(order.createdAt)}</span>
                        </div>
                      </div>
                      <ChevronRight className={`h-4 w-4 shrink-0 mt-1 ${vc.subtext}`} />
                    </Link>
                  </div>
                );
              })
            )}
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
