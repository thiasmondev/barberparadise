"use client";

export const dynamic = "force-dynamic";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { API_URL } from "@/lib/api";
import {
  AdminProPriceProduct,
  getAdminProPricesByBrand,
  getAdminToken,
  saveAdminProPricesByBrand,
} from "@/lib/admin-api";
import type { Brand } from "@/types";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Download,
  Loader2,
  Save,
  Upload,
} from "lucide-react";

interface PriceDraft {
  productId: string;
  value: string;
}

interface ImportResult {
  updated: number;
  errors?: string[];
}

const formatPrice = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
};

const parseDraftPrice = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : NaN;
};

export default function AdminProPricesPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<number | null>(null);
  const [products, setProducts] = useState<AdminProPriceProduct[]>([]);
  const [drafts, setDrafts] = useState<Record<string, PriceDraft>>({});
  const [bulkDiscount, setBulkDiscount] = useState("30");
  const [isLoadingBrands, setIsLoadingBrands] = useState(true);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedBrandIndex = useMemo(
    () => brands.findIndex((brand) => brand.id === selectedBrandId),
    [brands, selectedBrandId]
  );

  const selectedBrand = selectedBrandIndex >= 0 ? brands[selectedBrandIndex] : null;

  const stats = useMemo(() => {
    const configured = products.filter((product) => {
      const parsed = parseDraftPrice(drafts[product.id]?.value ?? "");
      return parsed !== null && !Number.isNaN(parsed);
    }).length;
    return { total: products.length, configured };
  }, [drafts, products]);

  useEffect(() => {
    const loadBrands = async () => {
      setIsLoadingBrands(true);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/api/brands`, { cache: "no-store" });
        if (!response.ok) throw new Error("Impossible de charger les marques");
        const data = (await response.json()) as Brand[];
        const sortedBrands = data.filter((brand) => brand.productCount > 0).sort((a, b) => a.name.localeCompare(b.name, "fr"));
        setBrands(sortedBrands);
        setSelectedBrandId((current) => current ?? sortedBrands[0]?.id ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur de chargement des marques");
      } finally {
        setIsLoadingBrands(false);
      }
    };
    loadBrands();
  }, []);

  useEffect(() => {
    if (!selectedBrandId) return;
    const loadProducts = async () => {
      setIsLoadingProducts(true);
      setError(null);
      setSuccess(null);
      try {
        const data = await getAdminProPricesByBrand(selectedBrandId);
        setProducts(data.products);
        setDrafts(Object.fromEntries(data.products.map((product) => [
          product.id,
          { productId: product.id, value: product.priceProEur === null || product.priceProEur === undefined ? "" : String(product.priceProEur) },
        ])));
      } catch (err) {
        setProducts([]);
        setDrafts({});
        setError(err instanceof Error ? err.message : "Erreur de chargement des produits");
      } finally {
        setIsLoadingProducts(false);
      }
    };
    loadProducts();
  }, [selectedBrandId]);

  const updateDraft = (productId: string, value: string) => {
    setDrafts((current) => ({ ...current, [productId]: { productId, value } }));
  };

  const getDiscount = (product: AdminProPriceProduct) => {
    const parsed = parseDraftPrice(drafts[product.id]?.value ?? "");
    if (parsed === null || Number.isNaN(parsed) || product.price <= 0) return null;
    return Math.max(0, Math.round((1 - parsed / product.price) * 1000) / 10);
  };

  const applyBulkDiscount = () => {
    const discount = Number(bulkDiscount.replace(",", "."));
    if (!Number.isFinite(discount) || discount < 0 || discount >= 100) {
      setError("Le pourcentage doit être compris entre 0 et 99,99 %.");
      return;
    }
    setError(null);
    setSuccess(null);
    setDrafts(Object.fromEntries(products.map((product) => {
      const proPrice = Math.round(product.price * (1 - discount / 100) * 100) / 100;
      return [product.id, { productId: product.id, value: proPrice.toFixed(2) }];
    })));
  };

  const saveBrandPrices = async () => {
    if (!selectedBrandId || !selectedBrand) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const prices = products.map((product) => {
        const priceProEur = parseDraftPrice(drafts[product.id]?.value ?? "");
        if (Number.isNaN(priceProEur)) throw new Error(`Prix invalide pour ${product.name}`);
        if (priceProEur !== null && priceProEur >= product.price) throw new Error(`Le prix pro HT de ${product.name} doit être inférieur au prix public TTC.`);
        return { productId: product.id, priceProEur };
      });
      const result = await saveAdminProPricesByBrand(selectedBrandId, prices);
      setSuccess(`${result.updated} prix sauvegardé${result.updated > 1 ? "s" : ""} pour ${selectedBrand.name}.`);
      const data = await getAdminProPricesByBrand(selectedBrandId);
      setProducts(data.products);
      setDrafts(Object.fromEntries(data.products.map((product) => [
        product.id,
        { productId: product.id, value: product.priceProEur === null || product.priceProEur === undefined ? "" : String(product.priceProEur) },
      ])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de sauvegarde");
    } finally {
      setIsSaving(false);
    }
  };

  const goToBrand = (direction: "previous" | "next") => {
    if (selectedBrandIndex < 0) return;
    const nextIndex = direction === "previous" ? selectedBrandIndex - 1 : selectedBrandIndex + 1;
    if (nextIndex >= 0 && nextIndex < brands.length) setSelectedBrandId(brands[nextIndex].id);
  };

  const downloadAllCsv = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const token = getAdminToken();
      if (!token) throw new Error("Session admin expirée");
      const response = await fetch(`${API_URL}/api/admin/pro/prices/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Erreur export CSV");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "barberparadise-prix-pro.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setSuccess("Export CSV généré.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur export CSV");
    } finally {
      setIsExporting(false);
    }
  };

  const importCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setError(null);
    setSuccess(null);
    try {
      const token = getAdminToken();
      if (!token) throw new Error("Session admin expirée");
      const formData = new FormData();
      formData.append("csv", file);
      const response = await fetch(`${API_URL}/api/admin/pro/prices/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = (await response.json().catch(() => ({}))) as ImportResult & { error?: string };
      if (!response.ok) {
        const detail = data.errors?.length ? ` ${data.errors.slice(0, 5).join(" | ")}` : "";
        throw new Error((data.error || "Erreur import CSV") + detail);
      }
      setSuccess(`${data.updated} prix professionnel${data.updated > 1 ? "s" : ""} importé${data.updated > 1 ? "s" : ""}.`);
      if (selectedBrandId) {
        const refreshed = await getAdminProPricesByBrand(selectedBrandId);
        setProducts(refreshed.products);
        setDrafts(Object.fromEntries(refreshed.products.map((product) => [
          product.id,
          { productId: product.id, value: product.priceProEur === null || product.priceProEur === undefined ? "" : String(product.priceProEur) },
        ])));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur import CSV");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Section Pro</p>
          <h1 className="mt-2 font-heading text-3xl font-bold text-dark-900">Prix professionnels par marque</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-600">
            Sélectionnez une marque, ajustez les prix professionnels HT produit par produit, appliquez une remise globale ou importez un fichier CSV complet.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadAllCsv}
            disabled={isExporting}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-dark-900 shadow-sm transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Télécharger tout en CSV
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="inline-flex items-center gap-2 rounded-xl bg-dark-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-dark-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importer CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}
      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {success}
        </div>
      )}

      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label className="block">
            <span className="text-sm font-semibold text-gray-700">Marque</span>
            <select
              value={selectedBrandId ?? ""}
              disabled={isLoadingBrands}
              onChange={(event) => setSelectedBrandId(Number(event.target.value))}
              className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-dark-900 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            >
              {isLoadingBrands ? <option>Chargement des marques…</option> : null}
              {!isLoadingBrands && brands.map((brand) => (
                <option key={brand.id} value={brand.id}>{brand.name} — {brand.productCount} produits</option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => goToBrand("previous")}
              disabled={selectedBrandIndex <= 0 || isLoadingProducts}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-dark-900 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Marque précédente
            </button>
            <button
              type="button"
              onClick={() => goToBrand("next")}
              disabled={selectedBrandIndex < 0 || selectedBrandIndex >= brands.length - 1 || isLoadingProducts}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-dark-900 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Marque suivante
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-100 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="font-heading text-xl font-bold text-dark-900">{selectedBrand?.name || "Aucune marque sélectionnée"}</h2>
            <p className="mt-1 text-sm text-gray-500">{stats.configured}/{stats.total} produits configurés avec un prix pro HT.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center rounded-2xl border border-gray-200 bg-gray-50 p-1">
              <input
                type="number"
                min="0"
                max="99"
                step="0.1"
                value={bulkDiscount}
                onChange={(event) => setBulkDiscount(event.target.value)}
                className="w-24 rounded-xl border-0 bg-white px-3 py-2 text-sm font-semibold text-dark-900 outline-none"
              />
              <button
                type="button"
                onClick={applyBulkDiscount}
                disabled={products.length === 0 || isLoadingProducts}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Appliquer {bulkDiscount || "0"}% à tous
              </button>
            </div>
            <button
              type="button"
              onClick={saveBrandPrices}
              disabled={!selectedBrandId || products.length === 0 || isSaving || isLoadingProducts}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-dark-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-dark-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Sauvegarder {selectedBrand?.name || "la marque"}
            </button>
          </div>
        </div>

        {isLoadingProducts ? (
          <div className="flex min-h-64 items-center justify-center text-gray-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Chargement des produits…
          </div>
        ) : products.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-500">Aucun produit trouvé pour cette marque.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-5 py-4">Produit</th>
                  <th className="px-5 py-4">Prix public TTC</th>
                  <th className="px-5 py-4">Prix pro HT</th>
                  <th className="px-5 py-4">Remise calculée</th>
                  <th className="px-5 py-4">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((product) => {
                  const draft = drafts[product.id]?.value ?? "";
                  const parsed = parseDraftPrice(draft);
                  const invalid = Number.isNaN(parsed) || (parsed !== null && parsed >= product.price);
                  const discount = getDiscount(product);
                  return (
                    <tr key={product.id} className="hover:bg-gray-50/80">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-dark-900">{product.name}</div>
                        <div className="mt-1 text-xs text-gray-500">{product.slug}</div>
                      </td>
                      <td className="px-5 py-4 font-semibold text-dark-900">{formatPrice(product.price)}</td>
                      <td className="px-5 py-4">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft}
                          onChange={(event) => updateDraft(product.id, event.target.value)}
                          className={`w-36 rounded-xl border px-3 py-2 text-sm font-semibold outline-none transition focus:ring-4 ${
                            invalid ? "border-red-300 bg-red-50 text-red-900 focus:ring-red-100" : "border-gray-200 bg-white text-dark-900 focus:border-primary focus:ring-primary/10"
                          }`}
                          placeholder="Ex. 12.90"
                        />
                      </td>
                      <td className="px-5 py-4">
                        {discount === null || invalid ? (
                          <span className="text-gray-400">—</span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">-{discount}%</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${product.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                          {product.status === "active" ? "ACTIF" : product.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
        <p className="font-semibold text-dark-900">Format CSV accepté</p>
        <p className="mt-1">
          Utilisez l’export comme modèle. Les colonnes reconnues sont notamment <code>productId</code> et <code>prix_pro_ht</code>. Laissez le prix pro vide pour supprimer le tarif professionnel d’un produit.
        </p>
      </section>
    </div>
  );
}
