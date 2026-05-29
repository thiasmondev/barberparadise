"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import AdminOrdersTabs from "@/components/admin/AdminOrdersTabs";
import {
  getAdminShipmentLabels,
  getAdminToken,
  getLogisticsLabelUrl,
  type AdminShipmentLabelItem,
} from "@/lib/admin-api";
import { Download, FileDown, PackageCheck } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  generated: "Générée",
  printed: "Imprimée",
  shipped: "Expédiée",
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
  if (label.shippedAt) return "Expédiée";
  return STATUS_LABELS[label.labelStatus || ""] || "Générée";
}

export default function AdminShipmentLabelsPage() {
  const [labels, setLabels] = useState<AdminShipmentLabelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    try {
      const response = await fetch(getLogisticsLabelUrl(label.orderId), {
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
                  <th className="px-4 py-3 text-right font-medium text-gray-500">PDF</th>
                </tr>
              </thead>
              <tbody>
                {labels.map((label) => (
                  <tr key={label.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-dark-800">{label.orderNumber}</td>
                    <td className="px-4 py-3 text-gray-600 uppercase">{label.carrier}</td>
                    <td className="px-4 py-3 text-gray-600">{label.trackingNumber || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        <PackageCheck size={13} />
                        {normalizeStatus(label)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(label.labelGeneratedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => downloadLabel(label)}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-dark-700 transition-colors hover:border-primary hover:text-primary"
                      >
                        <Download size={15} />
                        Télécharger
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
