"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import AdminOrdersTabs from "@/components/admin/AdminOrdersTabs";
import {
  cancelShipmentLabel,
  getAdminShipmentLabels,
  getAdminToken,
  getShipmentLabelPdfUrl,
  type AdminShipmentLabelItem,
} from "@/lib/admin-api";
import { Download, FileDown, Loader2, PackageCheck, XCircle } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  generated: "Générée",
  printed: "Imprimée",
  shipped: "Expédiée",
  cancelled: "Annulée",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function normalizeStatus(label: AdminShipmentLabelItem) {
  if (label.labelStatus === "cancelled") return "Annulée";
  if (label.shippedAt) return "Expédiée";
  return STATUS_LABELS[label.labelStatus || ""] || "Générée";
}

function statusBadgeClass(label: AdminShipmentLabelItem) {
  if (label.labelStatus === "cancelled") return "bg-rose-50 text-rose-700 ring-rose-200";
  if (label.shippedAt || label.labelStatus === "shipped") return "bg-sky-50 text-sky-700 ring-sky-200";
  return "bg-primary/10 text-primary ring-primary/20";
}

export default function AdminShipmentLabelsPage() {
  const [labels, setLabels] = useState<AdminShipmentLabelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cancelTarget, setCancelTarget] = useState<AdminShipmentLabelItem | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadLabels = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAdminShipmentLabels();
      setLabels(data.labels);
    } catch (err: any) {
      setError(err.message || "Erreur lors du chargement des étiquettes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLabels();
  }, [loadLabels]);

  const downloadLabel = async (label: AdminShipmentLabelItem) => {
    const token = getAdminToken();
    if (!token) {
      setError("Session admin introuvable");
      return;
    }
    setError("");
    setNotice("");
    try {
      const response = await fetch(getShipmentLabelPdfUrl(label.id), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Erreur téléchargement étiquette");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `etiquette-${label.orderNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || "Erreur téléchargement étiquette");
    }
  };

  const requestCancelLabel = (label: AdminShipmentLabelItem) => {
    setError("");
    setNotice("");
    setCancelTarget(label);
  };

  const confirmCancelLabel = async () => {
    if (!cancelTarget) return;
    setCancellingId(cancelTarget.id);
    setError("");
    setNotice("");
    try {
      const result = await cancelShipmentLabel(cancelTarget.id);
      setLabels((currentLabels) =>
        currentLabels.map((label) =>
          label.id === cancelTarget.id
            ? {
                ...label,
                labelStatus: result.shipment.labelStatus || "cancelled",
                shippedAt: result.shipment.shippedAt || null,
                trackingNumber: result.shipment.trackingNumber || label.trackingNumber,
              }
            : label,
        ),
      );
      setNotice(result.message || "L’étiquette a été annulée. Le remboursement sera crédité sous 48h.");
      setCancelTarget(null);
    } catch (err: any) {
      setError(err.message || "Impossible d’annuler l’étiquette");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading font-bold text-xl text-dark-800">Commandes</h1>
        <p className="text-sm text-gray-500">Étiquettes d’expédition générées</p>
      </div>
      <AdminOrdersTabs />

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Chargement des étiquettes...</div>
        ) : labels.length === 0 ? (
          <div className="px-4 py-16 text-center text-gray-400">
            <FileDown size={36} className="mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-dark-700">Aucune étiquette générée</p>
            <p className="mt-1 text-sm text-gray-500">Les étiquettes achetées auprès des transporteurs apparaîtront ici.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Commande</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Transporteur</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Suivi</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Statut</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {labels.map((label) => {
                  const isCancelled = label.labelStatus === "cancelled";
                  const isCancelling = cancellingId === label.id;
                  return (
                    <tr key={label.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-dark-800">{label.orderNumber}</td>
                      <td className="px-4 py-3 text-gray-600 uppercase">{label.carrier}</td>
                      <td className="px-4 py-3 text-gray-600">{label.trackingNumber || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusBadgeClass(label)}`}>
                          <PackageCheck size={13} />
                          {normalizeStatus(label)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(label.labelGeneratedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => downloadLabel(label)}
                            disabled={isCancelled}
                            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-dark-700 transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Download size={15} />
                            Télécharger
                          </button>
                          {!isCancelled && (
                            <button
                              type="button"
                              onClick={() => requestCancelLabel(label)}
                              disabled={isCancelling}
                              className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isCancelling ? <Loader2 className="animate-spin" size={15} /> : <XCircle size={15} />}
                              Annuler
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="font-heading text-lg font-bold text-dark-800">Annuler l’étiquette</h2>
              <p className="mt-1 text-sm text-gray-500">Commande {cancelTarget.orderNumber}</p>
            </div>
            <div className="px-5 py-5">
              <p className="text-sm leading-6 text-gray-700">
                Confirmer l'annulation de cette étiquette ? Le remboursement sera crédité sous 48h.
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                disabled={cancellingId === cancelTarget.id}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-white disabled:opacity-50"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={confirmCancelLabel}
                disabled={cancellingId === cancelTarget.id}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {cancellingId === cancelTarget.id && <Loader2 className="animate-spin" size={16} />}
                Confirmer l’annulation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
