"use client";
export const dynamic = "force-dynamic";

import { ChangeEvent, Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Boxes,
  CheckCircle2,
  FileText,
  Loader2,
  Package,
  RefreshCw,
  Save,
  Search,
  Upload,
  X,
} from "lucide-react";
import {
  applyStockInvoiceAdjustments,
  getStockBrands,
  getStockProducts,
  importStockInvoicePdf,
  updateStockProduct,
  updateStockVariant,
  type StockBrandSummary,
  type StockImportProposal,
  type StockImportResult,
  type StockProductRow,
  type StockVariantRow,
} from "@/lib/admin-api";

const STATUSES = [
  { value: "", label: "Tous" },
  { value: "active", label: "Actif" },
  { value: "draft", label: "Brouillon" },
  { value: "archived", label: "Archivé" },
  { value: "inactive", label: "Inactif" },
];

function formatPrice(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

function parseImages(images: StockProductRow["images"]): string[] {
  if (Array.isArray(images)) return images;
  try {
    return JSON.parse(String(images || "[]"));
  } catch {
    return [];
  }
}

function productDraft(product: StockProductRow) {
  return {
    price: String((product as any).pricePublic ?? product.price ?? ""),
    priceProEur: product.priceProEur != null ? String(product.priceProEur) : "",
    stockCount: String(product.stockCount ?? 0),
    inStock: Boolean(product.inStock),
    status: String(product.status || "active"),
  };
}

function variantDraft(variant: StockVariantRow) {
  return {
    priceProEur: variant.priceProEur != null ? String(variant.priceProEur) : "",
    stock: String(variant.stock ?? 0),
    inStock: Boolean(variant.inStock),
  };
}

export default function AdminStockPage() {
  const [brands, setBrands] = useState<StockBrandSummary[]>([]);
  const [selectedBrandKey, setSelectedBrandKey] = useState<string>("");
  const [products, setProducts] = useState<StockProductRow[]>([]);
  const [productForms, setProductForms] = useState<Record<string, ReturnType<typeof productDraft>>>({});
  const [variantForms, setVariantForms] = useState<Record<string, ReturnType<typeof variantDraft>>>({});
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [applyingImport, setApplyingImport] = useState(false);
  const [importResult, setImportResult] = useState<StockImportResult | null>(null);
  const [selectedProposalKeys, setSelectedProposalKeys] = useState<Set<string>>(new Set());

  const selectedBrand = useMemo(
    () => brands.find(brand => (brand.brandId != null ? `id:${brand.brandId}` : `name:${brand.brand}`) === selectedBrandKey) ?? null,
    [brands, selectedBrandKey]
  );

  const loadBrands = useCallback(async () => {
    setLoadingBrands(true);
    try {
      const data = await getStockBrands();
      setBrands(data.brands);
      setSelectedBrandKey(current => current || (data.brands[0] ? (data.brands[0].brandId != null ? `id:${data.brands[0].brandId}` : `name:${data.brands[0].brand}`) : ""));
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Erreur chargement marques" });
    } finally {
      setLoadingBrands(false);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    if (!selectedBrand) {
      setProducts([]);
      return;
    }
    setLoadingProducts(true);
    try {
      const data = await getStockProducts({
        brandId: selectedBrand.brandId,
        brand: selectedBrand.brandId == null ? selectedBrand.brand : undefined,
        search,
        status,
      });
      setProducts(data.products);
      setProductForms(Object.fromEntries(data.products.map(product => [product.id, productDraft(product)])));
      setVariantForms(Object.fromEntries(data.products.flatMap(product => (product.variants || []).map(variant => [variant.id, variantDraft(variant)]))));
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Erreur chargement stock" });
    } finally {
      setLoadingProducts(false);
    }
  }, [selectedBrand, search, status]);

  useEffect(() => { loadBrands(); }, [loadBrands]);
  useEffect(() => { loadProducts(); }, [loadProducts]);

  const totals = useMemo(() => {
    const stock = products.reduce((sum, product) => sum + Number(productForms[product.id]?.stockCount ?? product.stockCount ?? 0), 0);
    const variants = products.reduce((sum, product) => sum + (product.variants?.length || 0), 0);
    const ruptures = products.filter(product => !productForms[product.id]?.inStock).length;
    return { stock, variants, ruptures };
  }, [products, productForms]);

  const saveProduct = async (product: StockProductRow) => {
    const draft = productForms[product.id];
    if (!draft) return;
    setSavingId(product.id);
    setFeedback(null);
    try {
      const updated = await updateStockProduct(product.id, {
        price: Number(draft.price),
        priceProEur: draft.priceProEur === "" ? null : Number(draft.priceProEur),
        stockCount: Number(draft.stockCount),
        inStock: draft.inStock,
        status: draft.status,
      } as any);
      setProducts(current => current.map(item => (item.id === product.id ? { ...item, ...updated } : item)));
      setProductForms(current => ({ ...current, [product.id]: productDraft({ ...product, ...updated }) }));
      setFeedback({ type: "success", message: `Stock mis à jour pour ${product.name}` });
      loadBrands();
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Erreur sauvegarde produit" });
    } finally {
      setSavingId(null);
    }
  };

  const saveVariant = async (variant: StockVariantRow) => {
    const draft = variantForms[variant.id];
    if (!draft) return;
    setSavingId(variant.id);
    setFeedback(null);
    try {
      const updated = await updateStockVariant(variant.id, {
        stock: Number(draft.stock),
        inStock: draft.inStock,
        priceProEur: draft.priceProEur === "" ? null : Number(draft.priceProEur),
      });
      setProducts(current => current.map(product => ({
        ...product,
        variants: product.variants?.map(item => (item.id === variant.id ? { ...item, ...updated } : item)),
      })));
      setVariantForms(current => ({ ...current, [variant.id]: variantDraft(updated) }));
      setFeedback({ type: "success", message: `Variante ${variant.name} mise à jour` });
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Erreur sauvegarde variante" });
    } finally {
      setSavingId(null);
    }
  };

  const proposalKey = (proposal: StockImportProposal, index: number) => `${proposal.productId || "none"}:${proposal.variantId || "product"}:${proposal.extractedName}:${index}`;

  const handleImportPdf = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    setFeedback(null);
    try {
      const result = await importStockInvoicePdf(file);
      setImportResult(result);
      setSelectedProposalKeys(new Set(result.proposals.map((proposal, index) => proposal.productId ? proposalKey(proposal, index) : "").filter(Boolean)));
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Erreur import PDF" });
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const applyImport = async () => {
    if (!importResult) return;
    const adjustments = importResult.proposals
      .map((proposal, index) => ({ proposal, key: proposalKey(proposal, index) }))
      .filter(item => selectedProposalKeys.has(item.key) && item.proposal.productId)
      .map(item => ({ productId: item.proposal.productId, variantId: item.proposal.variantId, quantity: item.proposal.quantity }));
    if (adjustments.length === 0) {
      setFeedback({ type: "error", message: "Aucune ligne reconnue sélectionnée" });
      return;
    }
    setApplyingImport(true);
    try {
      const result = await applyStockInvoiceAdjustments(adjustments, "increment");
      setFeedback({ type: result.errors.length ? "error" : "success", message: `${result.updated} ajustement(s) appliqué(s). ${result.errors.join(" ")}`.trim() });
      setShowImport(false);
      setImportResult(null);
      loadProducts();
      loadBrands();
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Erreur application import" });
    } finally {
      setApplyingImport(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-primary font-semibold">Gestion opérationnelle</p>
          <h1 className="font-heading font-bold text-2xl text-dark-900">Stock par marque</h1>
          <p className="mt-1 text-sm text-gray-500 max-w-3xl">
            Ajuste depuis le backend le prix, le prix pro, le stock et le statut des produits. Une facture fournisseur PDF peut préremplir automatiquement les entrées de stock à valider.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowImport(true)} className="btn-primary">
            <Upload size={16} /> Ajouter une facture PDF
          </button>
          <Link href="/admin/produits" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-dark-800 hover:bg-gray-50">
            <Package size={16} /> Gestion produits complète
          </Link>
        </div>
      </div>

      {feedback && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${feedback.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {feedback.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {feedback.message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard label="Produits marque" value={products.length} />
        <StatCard label="Stock total affiché" value={totals.stock} />
        <StatCard label="Variantes" value={totals.variants} />
        <StatCard label="Ruptures" value={totals.ruptures} tone={totals.ruptures > 0 ? "warning" : "default"} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-5">
        <aside className="bg-white rounded-2xl border border-gray-100 overflow-hidden h-fit">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-dark-800">Marques</h2>
              <p className="text-xs text-gray-400">{brands.length} groupes stock</p>
            </div>
            <button onClick={loadBrands} className="p-2 text-gray-400 hover:text-primary" title="Rafraîchir">
              <RefreshCw size={15} />
            </button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto p-2 space-y-1">
            {loadingBrands ? (
              Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-12 bg-gray-50 rounded-xl animate-pulse" />)
            ) : brands.length === 0 ? (
              <div className="px-3 py-8 text-sm text-gray-400 text-center">Aucune marque</div>
            ) : (
              brands.map(brand => {
                const key = brand.brandId != null ? `id:${brand.brandId}` : `name:${brand.brand}`;
                const active = key === selectedBrandKey;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedBrandKey(key)}
                    className={`w-full text-left rounded-xl px-3 py-2.5 transition-colors ${active ? "bg-primary/10 text-primary" : "hover:bg-gray-50 text-dark-800"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{brand.brand}</span>
                      <span className="text-xs tabular-nums">{brand.totalStockCount}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-gray-400">{brand.productCount} produits · {brand.outOfStockCount} rupture(s)</div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col lg:flex-row gap-3 lg:items-center">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Rechercher dans la marque sélectionnée..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <select value={status} onChange={event => setStatus(event.target.value)} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary">
              {STATUSES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-dark-800">{selectedBrand?.brand || "Sélectionne une marque"}</h2>
                <p className="text-xs text-gray-400">Ajustements manuels sauvegardés produit par produit.</p>
              </div>
              {loadingProducts && <Loader2 size={18} className="animate-spin text-primary" />}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[980px]">
                <thead className="bg-gray-50/80 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Produit</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-500">Prix TTC</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-500">Prix pro HT</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-500">Stock</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-500">Disponibilité</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-500">Statut</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loadingProducts ? (
                    Array.from({ length: 5 }).map((_, index) => <StockSkeletonRow key={index} />)
                  ) : products.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400"><Boxes size={32} className="mx-auto mb-2 text-gray-300" />Aucun produit trouvé</td></tr>
                  ) : (
                    products.map(product => {
                      const form = productForms[product.id] || productDraft(product);
                      const image = parseImages(product.images)[0];
                      return (
                        <FragmentRows
                          key={product.id}
                          product={product}
                          image={image}
                          form={form}
                          savingId={savingId}
                          variantForms={variantForms}
                          setProductForms={setProductForms}
                          setVariantForms={setVariantForms}
                          saveProduct={saveProduct}
                          saveVariant={saveVariant}
                        />
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {showImport && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowImport(false)}>
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col" onClick={event => event.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-heading font-bold text-lg text-dark-900">Import facture fournisseur PDF</h2>
                <p className="text-sm text-gray-500">Les lignes reconnues incrémentent le stock après validation manuelle.</p>
              </div>
              <button onClick={() => setShowImport(false)} className="p-2 text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4">
              <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-200 rounded-2xl px-6 py-8 text-center hover:border-primary hover:bg-primary/5 cursor-pointer transition-colors">
                {importing ? <Loader2 size={28} className="animate-spin text-primary" /> : <FileText size={28} className="text-primary" />}
                <div>
                  <div className="font-semibold text-dark-800">Dépose ou sélectionne une facture PDF</div>
                  <div className="text-sm text-gray-500">PDF texte, maximum 15 Mo. L’IA de l’agent SEO est utilisée si disponible, sinon une extraction heuristique prend le relais.</div>
                </div>
                <input type="file" accept="application/pdf" className="hidden" onChange={handleImportPdf} disabled={importing} />
              </label>

              {importResult && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <p className="text-sm text-gray-600"><strong>{importResult.fileName}</strong> · {importResult.matchedCount}/{importResult.total} ligne(s) reconnue(s) · mode {importResult.extractionMode}</p>
                    <button onClick={applyImport} disabled={applyingImport} className="btn-primary disabled:opacity-50">
                      {applyingImport ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Appliquer les lignes sélectionnées
                    </button>
                  </div>
                  <div className="border border-gray-100 rounded-xl overflow-x-auto">
                    <table className="w-full text-sm min-w-[860px]">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          <th className="px-3 py-2 text-center">OK</th>
                          <th className="px-3 py-2 text-left">Ligne facture</th>
                          <th className="px-3 py-2 text-left">Produit associé</th>
                          <th className="px-3 py-2 text-center">Qté</th>
                          <th className="px-3 py-2 text-center">Stock après</th>
                          <th className="px-3 py-2 text-center">Confiance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {importResult.proposals.map((proposal, index) => {
                          const key = proposalKey(proposal, index);
                          const selectable = Boolean(proposal.productId);
                          return (
                            <tr key={key} className={selectable ? "" : "bg-amber-50/40"}>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="checkbox"
                                  disabled={!selectable}
                                  checked={selectedProposalKeys.has(key)}
                                  onChange={event => setSelectedProposalKeys(current => {
                                    const next = new Set(current);
                                    if (event.target.checked) next.add(key);
                                    else next.delete(key);
                                    return next;
                                  })}
                                />
                              </td>
                              <td className="px-3 py-2 max-w-[320px]"><div className="truncate" title={proposal.lineText}>{proposal.lineText}</div></td>
                              <td className="px-3 py-2">
                                {proposal.productName ? (
                                  <div><div className="font-medium text-dark-800">{proposal.productName}</div>{proposal.variantName && <div className="text-xs text-gray-400">Variante : {proposal.variantName}</div>}</div>
                                ) : <span className="text-amber-700">Non reconnu</span>}
                              </td>
                              <td className="px-3 py-2 text-center font-semibold tabular-nums">+{proposal.quantity}</td>
                              <td className="px-3 py-2 text-center tabular-nums">{proposal.currentStock ?? "—"} → {proposal.newStock ?? "—"}</td>
                              <td className="px-3 py-2 text-center">{Math.round(proposal.confidence * 100)}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "warning" }) {
  return (
    <div className={`rounded-2xl border p-4 ${tone === "warning" ? "bg-amber-50 border-amber-100" : "bg-white border-gray-100"}`}>
      <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold">{label}</div>
      <div className="mt-1 text-2xl font-heading font-bold text-dark-900 tabular-nums">{value}</div>
    </div>
  );
}

function StockSkeletonRow() {
  return <tr><td colSpan={7} className="px-4 py-4"><div className="h-8 bg-gray-100 rounded-xl animate-pulse" /></td></tr>;
}

function FragmentRows({
  product,
  image,
  form,
  savingId,
  variantForms,
  setProductForms,
  setVariantForms,
  saveProduct,
  saveVariant,
}: {
  product: StockProductRow;
  image?: string;
  form: ReturnType<typeof productDraft>;
  savingId: string | null;
  variantForms: Record<string, ReturnType<typeof variantDraft>>;
  setProductForms: Dispatch<SetStateAction<Record<string, ReturnType<typeof productDraft>>>>;
  setVariantForms: Dispatch<SetStateAction<Record<string, ReturnType<typeof variantDraft>>>>;
  saveProduct: (product: StockProductRow) => void;
  saveVariant: (variant: StockVariantRow) => void;
}) {
  return (
    <>
      <tr className="hover:bg-gray-50/50 align-top">
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gray-100 overflow-hidden shrink-0">
              {image ? <img src={image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><Package size={17} /></div>}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-dark-900 truncate max-w-[280px]">{product.name}</div>
              <div className="text-xs text-gray-400">{product.category || "Sans catégorie"} · {product.slug}</div>
            </div>
          </div>
        </td>
        <td className="px-3 py-3 text-right"><NumberInput value={form.price} onChange={value => setProductForms(current => ({ ...current, [product.id]: { ...form, price: value } }))} /></td>
        <td className="px-3 py-3 text-right"><NumberInput value={form.priceProEur} placeholder="—" onChange={value => setProductForms(current => ({ ...current, [product.id]: { ...form, priceProEur: value } }))} /></td>
        <td className="px-3 py-3 text-center"><NumberInput value={form.stockCount} integer onChange={value => setProductForms(current => ({ ...current, [product.id]: { ...form, stockCount: value } }))} /></td>
        <td className="px-3 py-3 text-center"><Toggle checked={form.inStock} onChange={checked => setProductForms(current => ({ ...current, [product.id]: { ...form, inStock: checked } }))} /></td>
        <td className="px-3 py-3 text-center">
          <select value={form.status} onChange={event => setProductForms(current => ({ ...current, [product.id]: { ...form, status: event.target.value } }))} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white">
            {STATUSES.filter(item => item.value).map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </td>
        <td className="px-4 py-3 text-right">
          <button onClick={() => saveProduct(product)} disabled={savingId === product.id} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-dark-900 text-white text-xs font-semibold hover:bg-dark-800 disabled:opacity-50">
            {savingId === product.id ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer
          </button>
        </td>
      </tr>
      {(product.variants || []).map(variant => {
        const draft = variantForms[variant.id] || variantDraft(variant);
        return (
          <tr key={variant.id} className="bg-gray-50/40 text-xs">
            <td className="px-4 py-2 pl-20 text-gray-600">↳ Variante <strong>{variant.name}</strong>{variant.sku && <span className="ml-2 text-gray-400">SKU {variant.sku}</span>}</td>
            <td className="px-3 py-2 text-right text-gray-400">{formatPrice(variant.price ?? product.price)}</td>
            <td className="px-3 py-2 text-right"><NumberInput value={draft.priceProEur} placeholder="—" compact onChange={value => setVariantForms(current => ({ ...current, [variant.id]: { ...draft, priceProEur: value } }))} /></td>
            <td className="px-3 py-2 text-center"><NumberInput value={draft.stock} integer compact onChange={value => setVariantForms(current => ({ ...current, [variant.id]: { ...draft, stock: value } }))} /></td>
            <td className="px-3 py-2 text-center"><Toggle checked={draft.inStock} onChange={checked => setVariantForms(current => ({ ...current, [variant.id]: { ...draft, inStock: checked } }))} /></td>
            <td className="px-3 py-2 text-center text-gray-400">Hérité</td>
            <td className="px-4 py-2 text-right"><button onClick={() => saveVariant(variant)} disabled={savingId === variant.id} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-dark-800 hover:bg-gray-50 disabled:opacity-50">{savingId === variant.id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Variante</button></td>
          </tr>
        );
      })}
    </>
  );
}

function NumberInput({ value, onChange, placeholder = "0", integer = false, compact = false }: { value: string; onChange: (value: string) => void; placeholder?: string; integer?: boolean; compact?: boolean }) {
  return <input type="number" min="0" step={integer ? 1 : 0.01} value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} className={`${compact ? "w-20" : "w-24"} px-2 py-1.5 border border-gray-200 rounded-lg text-right text-sm tabular-nums focus:outline-none focus:border-primary`} />;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${checked ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
      {checked ? "En stock" : "Rupture"}
    </button>
  );
}
