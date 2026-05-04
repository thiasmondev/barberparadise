"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Download,
  Mail,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import {
  downloadIndyCsv,
  getIndyReport,
  IndyReport,
  sendIndyReportEmail,
} from "@/lib/admin-api";

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
}

function formatMonth(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  if (!year || !monthIndex) return month;
  return new Date(year, monthIndex - 1, 1).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}

export default function AdminFinancePage() {
  const [month, setMonth] = useState(currentMonthKey);
  const [report, setReport] = useState<IndyReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const closureReminder = useMemo(() => {
    const [year, monthIndex] = month.split("-").map(Number);
    if (!year || !monthIndex) return "avant le 14 du mois suivant";
    const closeDate = new Date(year, monthIndex, 14);
    return closeDate.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [month]);

  const loadReport = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await getIndyReport(month);
      setReport(data);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Impossible de charger le rapport Indy");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const handleDownloadCsv = async () => {
    setIsDownloading(true);
    setError(null);
    setSuccess(null);
    try {
      const blob = await downloadIndyCsv(month);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `barberparadise-indy-${month}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setSuccess("CSV Indy téléchargé avec succès.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Téléchargement CSV impossible");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSendEmail = async () => {
    setIsSending(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await sendIndyReportEmail(month);
      setSuccess(
        result.skipped
          ? `Email préparé mais non envoyé : configuration Resend absente. Destinataire prévu : ${result.to}.`
          : `Email Indy envoyé à ${result.to}. Analyse CFO générée.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi email impossible");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
            Agent Finance
          </p>
          <h1 className="mt-2 font-heading text-3xl font-bold text-dark-900">
            Export Indy
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-600">
            Prépare le bilan mensuel commerçant pour Indy : CA HT, TVA collectée,
            CA TTC, ventilation par PSP, pays de livraison et taux TVA. Le CSV
            respecte l’ordre de colonnes attendu pour l’import comptable.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Rappel clôture :</strong> saisir et contrôler le mois dans Indy
          avant le <strong>{closureReminder}</strong> sur app.indy.fr.
        </div>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-100 p-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-dark-900">Bilan mensuel Indy</h2>
            <p className="mt-1 text-sm text-gray-500">
              Période chargée : {formatMonth(month)}. Les commandes `paid` et
              `shipped` alimentent les ventes ; les statuts `cancelled` et
              `refunded` sont listés séparément.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="text-sm font-medium text-gray-700">
              Mois
              <input
                type="month"
                value={month}
                onChange={event => setMonth(event.target.value)}
                className="mt-1 block rounded-xl border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <button
              type="button"
              onClick={loadReport}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
            >
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
              Actualiser
            </button>
            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled={!report || isDownloading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-dark-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-dark-800 disabled:opacity-60"
            >
              <Download size={16} />
              Télécharger CSV
            </button>
            <button
              type="button"
              onClick={handleSendEmail}
              disabled={!report || isSending}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
            >
              <Mail size={16} />
              Envoyer par email
            </button>
          </div>
        </div>

        {error && (
          <div className="m-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="m-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
            {success}
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-4 p-5 md:grid-cols-4">
            {[0, 1, 2, 3].map(item => (
              <div key={item} className="h-28 animate-pulse rounded-2xl bg-gray-100" />
            ))}
          </div>
        ) : report ? (
          <div className="space-y-6 p-5">
            <div className="grid gap-4 md:grid-cols-4">
              <MetricCard label="CA HT" value={formatCurrency(report.summary.caHTTotal)} />
              <MetricCard label="TVA collectée" value={formatCurrency(report.summary.tvaCollecteeTotal)} />
              <MetricCard label="CA TTC" value={formatCurrency(report.summary.caTTCTotal)} />
              <MetricCard label="Commandes" value={String(report.summary.nbCommandesTotal)} />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <DataTable
                title="Détail PSP"
                headers={["PSP", "Ventes", "Commissions", "Variation"]}
                rows={report.ventesParPSP.map(line => [
                  line.psp,
                  formatCurrency(line.ventesRealisees),
                  formatCurrency(line.commissionsPrelevees),
                  formatCurrency(line.variationTotale),
                ])}
                empty="Aucune vente PSP sur ce mois."
              />
              <DataTable
                title="Détail pays / TVA"
                headers={["Pays", "TVA", "HT", "TVA collectée", "TTC", "Cmdes"]}
                rows={report.ventesParPaysEtTVA.map(line => [
                  line.paysLivraison,
                  `${line.tauxTVA} %`,
                  formatCurrency(line.totalHT),
                  formatCurrency(line.montantTVA),
                  formatCurrency(line.totalTTC),
                  String(line.nbCommandes),
                ])}
                empty="Aucune ligne pays/TVA sur ce mois."
              />
            </div>

            <DataTable
              title="Lignes CSV prêtes pour Indy"
              headers={["type", "pays_expedition", "pays_livraison", "tva_pct", "total_ttc", "moyen_paiement"]}
              rows={report.csvRows.map(row => [
                row.type,
                row.pays_expedition,
                row.pays_livraison,
                `${row.tva_pct}`,
                row.total_ttc.toFixed(2),
                row.moyen_paiement,
              ])}
              empty="Aucune ligne CSV à exporter."
            />
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-gray-500">
            Aucun rapport chargé.
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <TrendingUp size={16} className="text-primary" />
      </div>
      <p className="mt-3 text-2xl font-bold text-dark-900">{value}</p>
    </div>
  );
}

function DataTable({
  title,
  headers,
  rows,
  empty,
}: {
  title: string;
  headers: string[];
  rows: string[][];
  empty: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-4 py-3">
        <h3 className="font-semibold text-dark-900">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
            <tr>
              {headers.map(header => (
                <th key={header} className="px-4 py-3">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700">
            {rows.length > 0 ? (
              rows.map((row, rowIndex) => (
                <tr key={`${title}-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${title}-${rowIndex}-${cellIndex}`} className="whitespace-nowrap px-4 py-3">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={headers.length} className="px-4 py-8 text-center text-gray-500">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
