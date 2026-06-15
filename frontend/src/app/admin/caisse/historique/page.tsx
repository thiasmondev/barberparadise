"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, RefreshCw, Search, ShoppingBag } from "lucide-react";
import { getPosHistory, type PosOrder } from "@/lib/admin-api";

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

function formatPrice(value: number) {
  return currency.format(Number.isFinite(value) ? value : 0);
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    paid: "Payée",
    pending_payment: "En attente",
    cancelled: "Annulée",
    refunded: "Remboursée",
  };
  return labels[status] || status;
}

function statusClass(status: string) {
  if (status === "paid") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (status === "pending_payment") return "bg-amber-50 text-amber-700 border-amber-100";
  if (status === "cancelled") return "bg-red-50 text-red-700 border-red-100";
  return "bg-gray-50 text-gray-700 border-gray-100";
}

function customerLabel(order: PosOrder) {
  if (!order.customer) return "Client comptoir";
  const name = `${order.customer.firstName || ""} ${order.customer.lastName || ""}`.trim();
  return name || order.customer.email;
}

export default function PosHistoryPage() {
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [period, setPeriod] = useState("today");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PosOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadHistory(nextPage = page) {
    setLoading(true);
    setError(null);
    try {
      const data = await getPosHistory({ page: nextPage, limit: 20, period, status, search });
      setOrders(data.orders);
      setPage(data.pagination.page);
      setTotalPages(data.pagination.totalPages || 1);
      setTotal(data.pagination.total);
      setSelected((current) => current || data.orders[0] || null);
    } catch (err: any) {
      setError(err.message || "Impossible de charger l’historique POS.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => loadHistory(1), 250);
    return () => window.clearTimeout(timer);
  }, [period, status, search]);

  const revenue = useMemo(() => orders.filter((order) => order.status === "paid").reduce((sum, order) => sum + (order.totalTTC || order.total || 0), 0), [orders]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link href="/admin/caisse" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-primary">
            <ArrowLeft size={16} /> Retour à la caisse
          </Link>
          <h1 className="mt-3 flex items-center gap-2 text-2xl font-black text-gray-950 sm:text-3xl">
            <ShoppingBag className="h-7 w-7 text-primary" /> Historique POS
          </h1>
          <p className="mt-2 text-sm text-gray-600">Consultez les ventes physiques, leurs statuts de paiement et le détail des lignes encaissées.</p>
        </div>
        <button type="button" onClick={() => loadHistory(page)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-gray-800">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Actualiser
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Ventes listées</p>
          <p className="mt-2 text-2xl font-black text-gray-950">{total}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">CA payé sur page</p>
          <p className="mt-2 text-2xl font-black text-gray-950">{formatPrice(revenue)}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Page</p>
          <p className="mt-2 text-2xl font-black text-gray-950">{page} / {totalPages}</p>
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.9fr]">
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="grid gap-3 border-b border-gray-100 p-4 lg:grid-cols-[1fr_160px_160px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Commande ou client" className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary" />
            </div>
            <select value={period} onChange={(event) => setPeriod(event.target.value)} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary">
              <option value="today">Aujourd’hui</option>
              <option value="week">7 jours</option>
              <option value="month">30 jours</option>
              <option value="all">Tout</option>
            </select>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary">
              <option value="">Tous statuts</option>
              <option value="paid">Payées</option>
              <option value="pending_payment">En attente</option>
              <option value="cancelled">Annulées</option>
            </select>
          </div>

          {error && <p className="m-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <div className="divide-y divide-gray-100">
              {orders.length === 0 && <p className="p-8 text-center text-sm text-gray-500">Aucune vente POS trouvée.</p>}
              {orders.map((order) => (
                <button key={order.id} type="button" onClick={() => setSelected(order)} className={`flex w-full flex-col gap-3 p-4 text-left hover:bg-gray-50 ${selected?.id === order.id ? "bg-primary/5" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-gray-950">{order.orderNumber}</p>
                      <p className="mt-1 text-xs text-gray-500">{dateFormatter.format(new Date(order.createdAt))} · {customerLabel(order)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-black text-gray-950">{formatPrice(order.totalTTC || order.total)}</p>
                      <span className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(order.status)}`}>{statusLabel(order.status)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">{order.items.length} ligne(s) · Terminal {order.terminalId || "—"}</p>
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between border-t border-gray-100 p-4">
            <button type="button" disabled={page <= 1 || loading} onClick={() => loadHistory(page - 1)} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 disabled:opacity-40"><ChevronLeft size={16} /> Précédent</button>
            <span className="text-sm font-semibold text-gray-500">Page {page} sur {totalPages}</span>
            <button type="button" disabled={page >= totalPages || loading} onClick={() => loadHistory(page + 1)} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 disabled:opacity-40">Suivant <ChevronRight size={16} /></button>
          </div>
        </div>

        <aside className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          {!selected ? (
            <p className="text-sm text-gray-500">Sélectionnez une vente pour afficher son détail.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Détail vente</p>
                <h2 className="mt-1 text-xl font-black text-gray-950">{selected.orderNumber}</h2>
                <p className="mt-1 text-sm text-gray-500">{dateFormatter.format(new Date(selected.createdAt))}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500">Client</p><p className="mt-1 text-sm font-bold text-gray-950">{customerLabel(selected)}</p></div>
                <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500">Paiement</p><p className="mt-1 text-sm font-bold text-gray-950">{selected.posPaymentStatus || selected.status}</p></div>
              </div>
              <div className="space-y-2">
                {selected.items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-3 rounded-xl border border-gray-100 p-3">
                    <div>
                      <p className="text-sm font-bold text-gray-950">{item.name}</p>
                      <p className="text-xs text-gray-500">Qté {item.quantity}{item.variantLabel ? ` · ${item.variantLabel}` : ""}{item.isCustomSale ? " · Vente rapide" : ""}</p>
                    </div>
                    <p className="text-sm font-black text-gray-950">{formatPrice(item.price * item.quantity - item.discountAmount)}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl bg-gray-950 p-4 text-white">
                <div className="space-y-1 text-sm text-gray-300">
                  <div className="flex justify-between"><span>Sous-total</span><span>{formatPrice(selected.subtotal)}</span></div>
                  <div className="flex justify-between"><span>Remise</span><span>- {formatPrice(selected.discountAmount || 0)}</span></div>
                  <div className="flex justify-between"><span>TVA</span><span>{formatPrice(selected.vatAmount || 0)}</span></div>
                </div>
                <div className="mt-3 flex justify-between text-xl font-black"><span>Total TTC</span><span>{formatPrice(selected.totalTTC || selected.total)}</span></div>
              </div>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
