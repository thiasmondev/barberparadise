"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Loader2, Search } from "lucide-react";
import AdminOrdersTabs from "@/components/admin/AdminOrdersTabs";
import { getAdminOrderInvoices, type AdminOrderInvoice } from "@/lib/admin-api";

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

export default function AdminOrderInvoicesPage() {
  const [invoices, setInvoices] = useState<AdminOrderInvoice[]>([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"" | "B2C" | "B2B">("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadInvoices = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getAdminOrderInvoices({ page, limit: 20, search: search.trim() || undefined, type });
      setInvoices(result.invoices);
      setTotal(result.total);
      setPages(result.pages || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les factures");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [page, type]);

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    loadInvoices();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 text-gray-900 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <p className="text-sm font-medium text-gray-500">Administration</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-950 sm:text-3xl">Factures commandes</h1>
          <p className="mt-2 text-sm text-gray-600">Retrouvez les factures B2C et B2B générées automatiquement après paiement.</p>
        </div>

        <AdminOrdersTabs />

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 p-4">
            <form onSubmit={handleSearch} className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Rechercher une facture, commande, client ou email"
                  className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={type}
                  onChange={(event) => {
                    setType(event.target.value as "" | "B2C" | "B2B");
                    setPage(1);
                  }}
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                >
                  <option value="">Toutes les factures</option>
                  <option value="B2C">B2C</option>
                  <option value="B2B">B2B</option>
                </select>
                <button className="rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800">Filtrer</button>
              </div>
            </form>
          </div>

          {error && <div className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Facture</th>
                  <th className="px-4 py-3">Commande</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Total TTC</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500"><span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Chargement des factures...</span></td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">Aucune facture générée.</td></tr>
                ) : invoices.map((invoice) => (
                  <tr key={`${invoice.type}-${invoice.id}`} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-4 font-semibold text-gray-950">{invoice.invoiceNumber || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-4"><Link href={`/admin/commandes/${invoice.id}`} className="font-medium text-gray-900 underline-offset-4 hover:underline">{invoice.orderNumber}</Link></td>
                    <td className="px-4 py-4"><div className="font-medium text-gray-900">{invoice.customerName}</div><div className="text-xs text-gray-500">{invoice.customerEmail}</div></td>
                    <td className="whitespace-nowrap px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${invoice.type === "B2B" ? "bg-indigo-50 text-indigo-700 ring-indigo-200" : "bg-gray-100 text-gray-700 ring-gray-200"}`}>{invoice.type}</span></td>
                    <td className="whitespace-nowrap px-4 py-4 text-gray-600">{formatDate(invoice.issuedAt)}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-right font-medium text-gray-950">{formatPrice(invoice.totalTTC, invoice.currency || "EUR")}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-right">
                      {invoice.invoiceUrl ? <a href={invoice.invoiceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-800 transition hover:border-gray-950"><Download className="h-4 w-4" /> Télécharger</a> : <span className="text-xs text-gray-400">Indisponible</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-gray-200 p-4 text-sm text-gray-600">
            <span>{total.toLocaleString("fr-FR")} facture(s)</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-gray-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50">Précédent</button>
              <span className="px-3 py-2">Page {page} / {pages}</span>
              <button disabled={page >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))} className="rounded-lg border border-gray-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50">Suivant</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
