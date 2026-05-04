"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  Package,
  ShieldAlert,
  Truck,
} from "lucide-react";
import {
  getLogisticsOrder,
  shipLogisticsOrder,
  type LogisticsPreparationDetail,
} from "@/lib/admin-api";

const CARRIERS = [
  { value: "colissimo", label: "Colissimo domicile" },
  { value: "mondial_relay", label: "Mondial Relay point relais" },
  { value: "colissimo_international", label: "Colissimo international" },
] as const;

type CarrierValue = (typeof CARRIERS)[number]["value"];

function formatWeight(value: number | null | undefined) {
  if (value === null || value === undefined) return "À compléter";
  if (value >= 1000)
    return `${(value / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kg`;
  return `${value.toLocaleString("fr-FR")} g`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminLogisticsPreparationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<LogisticsPreparationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState({
    products: false,
    packing: false,
    label: false,
  });
  const [carrier, setCarrier] = useState<CarrierValue>("colissimo");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [packagingId, setPackagingId] = useState<string>("");

  const loadDetail = async () => {
    if (!params?.id) return;
    setLoading(true);
    setError("");
    try {
      const data = await getLogisticsOrder(params.id);
      setDetail(data);
      setPackagingId(
        data.recommendation.recommendedBox?.id
          ? String(data.recommendation.recommendedBox.id)
          : ""
      );
      if (data.shipment?.carrier)
        setCarrier(data.shipment.carrier as CarrierValue);
      if (data.shipment?.trackingNumber)
        setTrackingNumber(data.shipment.trackingNumber);
      if (data.shipment?.packagingId)
        setPackagingId(String(data.shipment.packagingId));
    } catch (err: any) {
      setError(err.message || "Erreur de chargement de la préparation");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [params?.id]);

  const selectedPackaging = useMemo(
    () =>
      detail?.packagings.find(box => String(box.id) === packagingId) || null,
    [detail?.packagings, packagingId]
  );
  const checklistReady =
    checked.products && checked.packing && checked.label && Boolean(carrier);
  const totalWeight =
    (detail?.recommendation.totalWeightG || 0) +
    (selectedPackaging?.selfWeightG || 0);

  const handleShip = async () => {
    if (!detail || !checklistReady) return;
    if (
      !confirm(
        `Marquer la commande ${detail.order.orderNumber} comme expédiée ?`
      )
    )
      return;
    setSaving(true);
    setError("");
    try {
      await shipLogisticsOrder(detail.order.id, {
        carrier,
        trackingNumber: trackingNumber.trim(),
        packagingId: packagingId ? Number(packagingId) : null,
      });
      router.push("/admin/logistique/commandes");
    } catch (err: any) {
      setError(err.message || "Erreur lors de la validation d’expédition");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-gray-400">
        <Loader2 className="animate-spin" size={18} /> Chargement de la
        préparation...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error || "Commande introuvable"}
      </div>
    );
  }

  const address = detail.order.shippingAddress;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/admin/logistique/commandes"
            className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-cyan-700 hover:text-cyan-800"
          >
            <ArrowLeft size={16} /> Retour aux commandes
          </Link>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-600 font-semibold">
            Panneau de préparation
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Package size={26} className="text-cyan-600" />{" "}
            {detail.order.orderNumber}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Commande du {formatDate(detail.order.createdAt)} — statut actuel :{" "}
            {detail.order.status}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 text-right shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-500">
            Poids colis estimé
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {formatWeight(totalWeight)}
          </div>
          {detail.recommendation.hasUnknownWeight && (
            <div className="mt-1 text-xs text-amber-700">
              Certains produits n’ont pas de poids renseigné.
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(340px,0.9fr)]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="font-bold text-gray-900">Articles à préparer</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {detail.items.map(item => (
                <div key={item.id} className="flex gap-4 p-5">
                  <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {item.name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Quantité : {item.quantity} · Poids unitaire :{" "}
                          {formatWeight(item.weightG)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {item.isFragile && <Badge tone="amber">Fragile</Badge>}
                        {item.isLiquid && <Badge tone="sky">Liquide</Badge>}
                        {item.isAerosol && <Badge tone="rose">Aérosol</Badge>}
                        {item.weightG === null && (
                          <Badge tone="amber">Poids manquant</Badge>
                        )}
                      </div>
                    </div>
                    {item.logisticNote && (
                      <p className="mt-2 rounded-lg bg-cyan-50 px-3 py-2 text-xs text-cyan-800">
                        Note logistique : {item.logisticNote}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-bold text-gray-900">
              Adresse d’expédition
            </h2>
            {address ? (
              <div className="flex gap-3 text-sm text-gray-700">
                <MapPin className="mt-0.5 text-cyan-600" size={18} />
                <div>
                  <div className="font-semibold text-gray-900">
                    {address.firstName} {address.lastName}
                  </div>
                  <div>{address.address}</div>
                  {address.extension && <div>{address.extension}</div>}
                  <div>
                    {address.postalCode} {address.city}
                  </div>
                  <div>{address.country}</div>
                  {address.phone && (
                    <div className="mt-1">Tél. {address.phone}</div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-amber-700">
                Aucune adresse d’expédition enregistrée.
              </p>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
              <Truck size={18} className="text-cyan-600" /> Expédition
            </h2>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">
                  Transporteur
                </span>
                <select
                  value={carrier}
                  onChange={e => setCarrier(e.target.value as CarrierValue)}
                  className="input"
                >
                  {CARRIERS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">
                  Numéro de suivi
                </span>
                <input
                  value={trackingNumber}
                  onChange={e => setTrackingNumber(e.target.value)}
                  placeholder="ex: 6A12345678901"
                  className="input"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500">
                  Carton / emballage
                </span>
                <select
                  value={packagingId}
                  onChange={e => setPackagingId(e.target.value)}
                  className="input"
                >
                  <option value="">Aucun emballage sélectionné</option>
                  {detail.packagings.map(box => (
                    <option key={box.id} value={box.id}>
                      {box.name} — {formatWeight(box.maxWeightG)} max · stock{" "}
                      {box.stock}
                    </option>
                  ))}
                </select>
              </label>
              {detail.recommendation.recommendedBox && (
                <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-3 text-xs text-cyan-800">
                  <strong>Carton recommandé :</strong>{" "}
                  {detail.recommendation.recommendedBox.name}, selon le volume
                  estimé de{" "}
                  {detail.recommendation.totalVolumeCm3.toLocaleString("fr-FR")}{" "}
                  cm³.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
              <CheckCircle2 size={18} className="text-cyan-600" /> Checklist
              préparation
            </h2>
            <div className="space-y-3">
              <CheckItem
                checked={checked.products}
                onChange={value => setChecked({ ...checked, products: value })}
                label="Produits vérifiés et quantités contrôlées"
              />
              <CheckItem
                checked={checked.packing}
                onChange={value => setChecked({ ...checked, packing: value })}
                label="Colis protégé, fermé et pesé"
              />
              <CheckItem
                checked={checked.label}
                onChange={value => setChecked({ ...checked, label: value })}
                label="Étiquette transporteur imprimée/collée"
              />
            </div>
            {(detail.recommendation.hasFragile ||
              detail.recommendation.hasLiquid ||
              detail.recommendation.hasAerosol) && (
              <div className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <ShieldAlert size={16} /> Vérifiez les protections et
                restrictions transporteur avant expédition.
              </div>
            )}
            <button
              onClick={handleShip}
              disabled={!checklistReady || saving}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="animate-spin" size={17} />
              ) : (
                <Mail size={17} />
              )}{" "}
              Marquer expédiée et envoyer l’email
            </button>
          </section>
        </aside>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border: 1px solid #e5e7eb;
          border-radius: 0.75rem;
          padding: 0.625rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus {
          border-color: #0891b2;
          box-shadow: 0 0 0 3px rgba(8, 145, 178, 0.12);
        }
      `}</style>
    </div>
  );
}

function CheckItem({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3 text-sm text-gray-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />{" "}
      {label}
    </label>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "amber" | "sky" | "rose";
}) {
  const classes =
    tone === "amber"
      ? "bg-amber-100 text-amber-700"
      : tone === "sky"
        ? "bg-sky-100 text-sky-700"
        : "bg-rose-100 text-rose-700";
  return (
    <span
      className={`rounded-full px-2 py-1 text-[11px] font-semibold ${classes}`}
    >
      {children}
    </span>
  );
}
