"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createShippingRate,
  createShippingZone,
  deleteShippingRate,
  deleteShippingZone,
  getShippingZones,
  ShippingRate,
  ShippingZone,
  updateShippingRate,
  updateShippingZone,
} from "@/lib/admin-api";
import { Globe2, Pencil, Plus, Save, Trash2, Truck, X } from "lucide-react";

type ZoneForm = { id?: string; name: string; countries: string[] };
type RateForm = {
  id?: string;
  zoneId: string;
  name: string;
  minAmount: string;
  maxAmount: string;
  price: string;
  isFree: boolean;
  deliveryTime: string;
};

const EMPTY_ZONE: ZoneForm = { name: "", countries: [] };
const EMPTY_RATE: RateForm = {
  zoneId: "",
  name: "Standard",
  minAmount: "0",
  maxAmount: "",
  price: "0",
  isFree: false,
  deliveryTime: "2 à 4 jours ouvrés",
};

const COUNTRIES = [
  { code: "FR", label: "France" },
  { code: "BE", label: "Belgique" },
  { code: "LU", label: "Luxembourg" },
  { code: "CH", label: "Suisse" },
  { code: "DE", label: "Allemagne" },
  { code: "ES", label: "Espagne" },
  { code: "IT", label: "Italie" },
  { code: "NL", label: "Pays-Bas" },
  { code: "PT", label: "Portugal" },
  { code: "GP", label: "Guadeloupe" },
  { code: "MQ", label: "Martinique" },
  { code: "GF", label: "Guyane française" },
  { code: "RE", label: "La Réunion" },
  { code: "YT", label: "Mayotte" },
  { code: "PF", label: "Polynésie française" },
  { code: "NC", label: "Nouvelle-Calédonie" },
];

function euro(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

function amountRange(rate: ShippingRate) {
  const min = euro(rate.minAmount);
  if (rate.maxAmount === null || rate.maxAmount === undefined) return `À partir de ${min}`;
  return `${min} → ${euro(rate.maxAmount)}`;
}

function zoneToForm(zone: ShippingZone): ZoneForm {
  return { id: zone.id, name: zone.name, countries: zone.countries };
}

function rateToForm(rate: ShippingRate): RateForm {
  return {
    id: rate.id,
    zoneId: rate.zoneId,
    name: rate.name,
    minAmount: String(rate.minAmount),
    maxAmount: rate.maxAmount === null ? "" : String(rate.maxAmount),
    price: String(rate.price),
    isFree: rate.isFree,
    deliveryTime: rate.deliveryTime || "",
  };
}

export default function ShippingSettingsPage() {
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [zoneForm, setZoneForm] = useState<ZoneForm | null>(null);
  const [rateForm, setRateForm] = useState<RateForm | null>(null);

  const selectedCountries = useMemo(() => new Set(zoneForm?.countries || []), [zoneForm]);

  const loadZones = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getShippingZones();
      setZones(data.zones);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur chargement zones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadZones();
  }, []);

  const saveZone = async () => {
    if (!zoneForm) return;
    if (!zoneForm.name.trim() || zoneForm.countries.length === 0) {
      setError("Le nom de la zone et au moins un pays sont requis.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      if (zoneForm.id) await updateShippingZone(zoneForm.id, { name: zoneForm.name, countries: zoneForm.countries });
      else await createShippingZone({ name: zoneForm.name, countries: zoneForm.countries });
      setSuccess("Zone enregistrée.");
      setZoneForm(null);
      await loadZones();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur enregistrement zone");
    } finally {
      setSaving(false);
    }
  };

  const saveRate = async () => {
    if (!rateForm) return;
    if (!rateForm.name.trim()) {
      setError("Le nom du tarif est requis.");
      return;
    }
    const payload = {
      name: rateForm.name,
      minAmount: Number(rateForm.minAmount || 0),
      maxAmount: rateForm.maxAmount === "" ? null : Number(rateForm.maxAmount),
      price: rateForm.isFree ? 0 : Number(rateForm.price || 0),
      isFree: rateForm.isFree,
      deliveryTime: rateForm.deliveryTime,
    };
    try {
      setSaving(true);
      setError("");
      if (rateForm.id) await updateShippingRate(rateForm.id, payload);
      else await createShippingRate(rateForm.zoneId, payload);
      setSuccess("Tarif enregistré.");
      setRateForm(null);
      await loadZones();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur enregistrement tarif");
    } finally {
      setSaving(false);
    }
  };

  const toggleCountry = (code: string) => {
    if (!zoneForm) return;
    const next = selectedCountries.has(code)
      ? zoneForm.countries.filter((item) => item !== code)
      : [...zoneForm.countries, code];
    setZoneForm({ ...zoneForm, countries: next });
  };

  const removeZone = async (zone: ShippingZone) => {
    if (!confirm(`Supprimer la zone « ${zone.name} » et ses tarifs ?`)) return;
    await deleteShippingZone(zone.id);
    await loadZones();
  };

  const removeRate = async (rate: ShippingRate) => {
    if (!confirm(`Supprimer le tarif « ${rate.name} » ?`)) return;
    await deleteShippingRate(rate.id);
    await loadZones();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Paramètres</p>
          <h1 className="mt-1 font-heading text-3xl font-bold text-dark-900">Expédition et livraison</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-600">
            Configurez les zones d’expédition et les tarifs appliqués au checkout selon le pays de livraison et la tranche de montant de commande.
          </p>
        </div>
        <button
          onClick={() => setZoneForm(EMPTY_ZONE)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-dark-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-dark-800"
        >
          <Plus size={18} /> Ajouter une zone
        </button>
      </div>

      {(error || success) && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {error || success}
        </div>
      )}

      <section className="rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-dark-900">Zones d’expédition</h2>
            <p className="text-sm text-gray-500">Chaque zone regroupe des pays et ses propres conditions tarifaires.</p>
          </div>
          <Truck className="text-gray-300" size={24} />
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-gray-500">Chargement des zones…</div>
        ) : zones.length === 0 ? (
          <div className="p-10 text-center">
            <Globe2 className="mx-auto mb-3 text-gray-300" size={34} />
            <p className="font-medium text-dark-900">Aucune zone configurée</p>
            <p className="mt-1 text-sm text-gray-500">Ajoutez une première zone pour activer les tarifs au checkout.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {zones.map((zone) => (
              <article key={zone.id} className="p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-dark-900">{zone.name}</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {zone.countries.map((code) => (
                        <span key={code} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                          {COUNTRIES.find((country) => country.code === code)?.label || code}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setRateForm({ ...EMPTY_RATE, zoneId: zone.id })} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-dark-800 hover:bg-gray-50">
                      Ajouter un tarif
                    </button>
                    <button onClick={() => setZoneForm(zoneToForm(zone))} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-dark-800 hover:bg-gray-50">
                      <Pencil size={15} /> Modifier
                    </button>
                    <button onClick={() => removeZone(zone)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
                      <Trash2 size={15} /> Supprimer
                    </button>
                  </div>
                </div>

                <div className="mt-5 overflow-hidden rounded-2xl border border-gray-100">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Nom du tarif</th>
                        <th className="px-4 py-3">Condition</th>
                        <th className="px-4 py-3">Prix</th>
                        <th className="px-4 py-3">Délai indicatif</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {zone.rates.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">Aucun tarif configuré pour cette zone.</td></tr>
                      ) : zone.rates.map((rate) => (
                        <tr key={rate.id}>
                          <td className="px-4 py-3 font-semibold text-dark-900">{rate.name}</td>
                          <td className="px-4 py-3 text-gray-600">{amountRange(rate)}</td>
                          <td className="px-4 py-3 font-semibold text-dark-900">{rate.isFree ? "Gratuit" : euro(rate.price)}</td>
                          <td className="px-4 py-3 text-gray-600">{rate.deliveryTime || "—"}</td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => setRateForm(rateToForm(rate))} className="mr-2 text-sm font-semibold text-dark-700 hover:text-primary">Éditer</button>
                            <button onClick={() => removeRate(rate)} className="text-sm font-semibold text-red-600 hover:text-red-700">Supprimer</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {zoneForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <h2 className="text-xl font-bold text-dark-900">{zoneForm.id ? "Modifier la zone" : "Ajouter une zone"}</h2>
              <button onClick={() => setZoneForm(null)} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X size={20} /></button>
            </div>
            <div className="space-y-5 p-6">
              <label className="block">
                <span className="text-sm font-semibold text-dark-800">Nom de la zone</span>
                <input value={zoneForm.name} onChange={(event) => setZoneForm({ ...zoneForm, name: event.target.value })} placeholder="France, Belgique, DOM-TOM…" className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-primary" />
              </label>
              <div>
                <p className="text-sm font-semibold text-dark-800">Pays inclus</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {COUNTRIES.map((country) => (
                    <label key={country.code} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${selectedCountries.has(country.code) ? "border-primary bg-primary/5 text-primary" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
                      <input type="checkbox" checked={selectedCountries.has(country.code)} onChange={() => toggleCountry(country.code)} className="rounded border-gray-300 text-primary focus:ring-primary" />
                      {country.label} <span className="text-xs text-gray-400">{country.code}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
              <button onClick={() => setZoneForm(null)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700">Annuler</button>
              <button onClick={saveZone} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-dark-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"><Save size={16} /> Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {rateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <h2 className="text-xl font-bold text-dark-900">{rateForm.id ? "Modifier le tarif" : "Ajouter un tarif"}</h2>
              <button onClick={() => setRateForm(null)} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X size={20} /></button>
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className="text-sm font-semibold text-dark-800">Nom du tarif</span><input value={rateForm.name} onChange={(e) => setRateForm({ ...rateForm, name: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-primary" /></label>
              <label><span className="text-sm font-semibold text-dark-800">Montant minimum (€)</span><input type="number" min="0" step="0.01" value={rateForm.minAmount} onChange={(e) => setRateForm({ ...rateForm, minAmount: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-primary" /></label>
              <label><span className="text-sm font-semibold text-dark-800">Montant maximum (€)</span><input type="number" min="0" step="0.01" value={rateForm.maxAmount} onChange={(e) => setRateForm({ ...rateForm, maxAmount: e.target.value })} placeholder="Vide = aucun maximum" className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-primary" /></label>
              <label className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 sm:col-span-2"><input type="checkbox" checked={rateForm.isFree} onChange={(e) => setRateForm({ ...rateForm, isFree: e.target.checked, price: e.target.checked ? "0" : rateForm.price })} className="rounded border-gray-300 text-primary focus:ring-primary" /><span className="text-sm font-semibold text-dark-800">Ce tarif est gratuit</span></label>
              <label><span className="text-sm font-semibold text-dark-800">Prix (€)</span><input type="number" min="0" step="0.01" disabled={rateForm.isFree} value={rateForm.price} onChange={(e) => setRateForm({ ...rateForm, price: e.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-primary disabled:bg-gray-100" /></label>
              <label><span className="text-sm font-semibold text-dark-800">Délai indicatif</span><input value={rateForm.deliveryTime} onChange={(e) => setRateForm({ ...rateForm, deliveryTime: e.target.value })} placeholder="2 à 4 jours ouvrés" className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-primary" /></label>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
              <button onClick={() => setRateForm(null)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700">Annuler</button>
              <button onClick={saveRate} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-dark-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"><Save size={16} /> Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
