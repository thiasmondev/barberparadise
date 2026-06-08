"use client";

import { useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import {
  AdminPromotion,
  AdminPromotionPayload,
  AdminPromotionStats,
  createAdminPromotion,
  deleteAdminPromotion,
  getAdminCategories,
  getAdminProducts,
  getAdminPromotionStats,
  getAdminPromotions,
  updateAdminPromotion,
} from "@/lib/admin-api";
import {
  AlertCircle,
  BarChart3,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  ImageIcon,
  Layers,
  Loader2,
  Package,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import type { Category, Product } from "@/types";

const emptyForm: AdminPromotionPayload = {
  code: "",
  name: "",
  description: "",
  method: "code",
  type: "percentage",
  value: 10,
  valueType: "percentage",
  appliesTo: "all",
  productIds: [],
  categoryIds: [],
  minOrderAmount: null,
  minQuantity: null,
  customerType: "all",
  usageLimit: null,
  usagePerCustomer: null,
  stackable: false,
  isActive: true,
  startsAt: null,
  endsAt: null,
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value));
}

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function getPromotionLabel(promotion: AdminPromotion) {
  if (promotion.type === "free_shipping") return "Livraison offerte";
  if (promotion.type === "fixed_amount") return `${formatMoney(promotion.value)} de remise`;
  if (promotion.type === "buy_x_get_y") return "Offre Buy X Get Y";
  return `${promotion.value || 0}% de remise`;
}

function getProductImage(product: Product) {
  if (Array.isArray(product.images)) return product.images[0] || "";
  try {
    const parsed = JSON.parse(String(product.images || "[]"));
    if (Array.isArray(parsed)) return parsed[0] || "";
  } catch {
    // Ignorer les images non JSON : certaines fiches peuvent stocker une URL directe.
  }
  return String(product.images || "");
}

function getCategoryDisplayName(category: Category) {
  return category.parentSlug ? `${category.name} · ${category.parentSlug}` : category.name;
}

function getTargetSummary(promotion: AdminPromotion) {
  if (promotion.appliesTo === "products") return `${promotion.productIds.length} produit(s)`;
  if (promotion.appliesTo === "categories") return `${promotion.categoryIds.length} collection(s)`;
  return "Toute la commande";
}

export default function AdminPromotionsPage() {
  const [promotions, setPromotions] = useState<AdminPromotion[]>([]);
  const [stats, setStats] = useState<AdminPromotionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [method, setMethod] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminPromotion | null>(null);
  const [form, setForm] = useState<AdminPromotionPayload>(emptyForm);
  const [productSearch, setProductSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [productOptions, setProductOptions] = useState<Product[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<Category[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(false);

  const filteredPromotions = useMemo(() => promotions, [promotions]);
  const selectedProductIds = useMemo(() => new Set(form.productIds || []), [form.productIds]);
  const selectedCategoryIds = useMemo(() => new Set(form.categoryIds || []), [form.categoryIds]);
  const productById = useMemo(() => new Map(productOptions.map((product) => [product.id, product])), [productOptions]);
  const categoryById = useMemo(() => new Map(categoryOptions.map((category) => [category.id, category])), [categoryOptions]);
  const filteredCategoryOptions = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    if (!query) return categoryOptions;
    return categoryOptions.filter((category) =>
      [category.name, category.slug, category.parentSlug || ""].join(" ").toLowerCase().includes(query)
    );
  }, [categoryOptions, categorySearch]);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [promoRes, statsRes] = await Promise.all([
        getAdminPromotions({ search, status, method }),
        getAdminPromotionStats(),
      ]);
      setPromotions(promoRes.promotions || []);
      setStats(statsRes.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les promotions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(refresh, 250);
    return () => window.clearTimeout(timer);
  }, [search, status, method]);

  useEffect(() => {
    if (!modalOpen) return;
    let cancelled = false;
    setTargetsLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const [productsData, categoriesData] = await Promise.all([
          getAdminProducts({ search: productSearch, status: "active", limit: 100 }),
          getAdminCategories(),
        ]);
        if (cancelled) return;
        setProductOptions(productsData.products || []);
        setCategoryOptions(categoriesData || []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Impossible de charger les produits et collections");
      } finally {
        if (!cancelled) setTargetsLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [modalOpen, productSearch]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setProductSearch("");
    setCategorySearch("");
    setSuccess("");
    setError("");
    setModalOpen(true);
  }

  function openEdit(promotion: AdminPromotion) {
    setEditing(promotion);
    setForm({
      code: promotion.code || "",
      name: promotion.name,
      description: promotion.description || "",
      method: promotion.method,
      type: promotion.type,
      value: promotion.value,
      valueType: promotion.valueType,
      appliesTo: promotion.appliesTo,
      productIds: promotion.productIds,
      categoryIds: promotion.categoryIds,
      minOrderAmount: promotion.minOrderAmount,
      minQuantity: promotion.minQuantity,
      customerType: promotion.customerType,
      usageLimit: promotion.usageLimit,
      usagePerCustomer: promotion.usagePerCustomer,
      stackable: promotion.stackable,
      isActive: promotion.isActive,
      startsAt: promotion.startsAt,
      endsAt: promotion.endsAt,
    });
    setProductSearch("");
    setCategorySearch("");
    setSuccess("");
    setError("");
    setModalOpen(true);
  }

  function updateForm<K extends keyof AdminPromotionPayload>(key: K, value: AdminPromotionPayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateAppliesTo(value: AdminPromotionPayload["appliesTo"]) {
    setForm((prev) => ({
      ...prev,
      appliesTo: value,
      productIds: value === "products" ? prev.productIds || [] : [],
      categoryIds: value === "categories" ? prev.categoryIds || [] : [],
    }));
  }

  function toggleProductTarget(productId: string) {
    setForm((prev) => {
      const next = new Set(prev.productIds || []);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return { ...prev, productIds: Array.from(next) };
    });
  }

  function toggleCategoryTarget(categoryId: string) {
    setForm((prev) => {
      const next = new Set(prev.categoryIds || []);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return { ...prev, categoryIds: Array.from(next) };
    });
  }

  function removeProductTarget(productId: string) {
    setForm((prev) => ({ ...prev, productIds: (prev.productIds || []).filter((id) => id !== productId) }));
  }

  function removeCategoryTarget(categoryId: string) {
    setForm((prev) => ({ ...prev, categoryIds: (prev.categoryIds || []).filter((id) => id !== categoryId) }));
  }

  function normalizePayload(): AdminPromotionPayload {
    const type = form.type || "percentage";
    return {
      ...form,
      code: form.method === "automatic" ? null : String(form.code || "").trim().toUpperCase(),
      value: type === "free_shipping" ? null : Number(form.value || 0),
      valueType: type === "fixed_amount" ? "fixed" : "percentage",
      productIds: form.appliesTo === "products" ? form.productIds || [] : [],
      categoryIds: form.appliesTo === "categories" ? form.categoryIds || [] : [],
      minOrderAmount: form.minOrderAmount === null || form.minOrderAmount === undefined || form.minOrderAmount === ("" as unknown as number) ? null : Number(form.minOrderAmount),
      minQuantity: form.minQuantity === null || form.minQuantity === undefined || form.minQuantity === ("" as unknown as number) ? null : Number(form.minQuantity),
      usageLimit: form.usageLimit === null || form.usageLimit === undefined || form.usageLimit === ("" as unknown as number) ? null : Number(form.usageLimit),
      usagePerCustomer: form.usagePerCustomer === null || form.usagePerCustomer === undefined || form.usagePerCustomer === ("" as unknown as number) ? null : Number(form.usagePerCustomer),
      startsAt: form.startsAt || null,
      endsAt: form.endsAt || null,
    };
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = normalizePayload();
      if (!payload.name) throw new Error("Le nom de la promotion est obligatoire.");
      if (payload.method === "code" && !payload.code) throw new Error("Le code promo est obligatoire pour une promotion par code.");
      if (editing) await updateAdminPromotion(editing.id, payload);
      else await createAdminPromotion(payload);
      setSuccess(editing ? "Promotion mise à jour." : "Promotion créée.");
      setModalOpen(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d’enregistrer la promotion");
    } finally {
      setSaving(false);
    }
  }

  async function togglePromotion(promotion: AdminPromotion) {
    try {
      await updateAdminPromotion(promotion.id, { isActive: !promotion.isActive });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de modifier le statut");
    }
  }

  async function handleDelete(promotion: AdminPromotion) {
    if (!window.confirm(`Supprimer la promotion ${promotion.name} ?`)) return;
    try {
      await deleteAdminPromotion(promotion.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de supprimer la promotion");
    }
  }

  async function generateCode() {
    const base = (form.name || "BP PROMO")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "")
      .toUpperCase()
      .slice(0, 10);
    updateForm("code", `${base || "PROMO"}${Math.floor(100 + Math.random() * 900)}`);
  }

  return (
    <AdminShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">Promotions</p>
            <h1 className="text-3xl font-bold text-gray-900">Codes promo et réductions automatiques</h1>
            <p className="mt-2 text-sm text-gray-500">Gestion centralisée inspirée Shopify : codes, règles automatiques, limites, ciblage et statistiques.</p>
          </div>
          <button onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90">
            <Plus size={16} /> Nouvelle promotion
          </button>
        </div>

        {error && <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle size={18} />{error}</div>}
        {success && <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"><CheckCircle2 size={18} />{success}</div>}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard label="Total" value={stats?.totalPromotions || 0} />
          <StatCard label="Actives" value={stats?.activePromotions || 0} />
          <StatCard label="Codes" value={stats?.codePromotions || 0} />
          <StatCard label="Automatiques" value={stats?.automaticPromotions || 0} />
          <StatCard label="Utilisations" value={stats?.totalUsage || 0} />
          <StatCard label="Remises" value={formatMoney(stats?.totalDiscount || 0)} />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-gray-100 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une promotion ou un code" className="w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary" />
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary">
              <option value="all">Tous les statuts</option>
              <option value="active">Actives</option>
              <option value="inactive">Inactives</option>
            </select>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary">
              <option value="all">Toutes les méthodes</option>
              <option value="code">Codes promo</option>
              <option value="automatic">Automatiques</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Promotion</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Ciblage</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Période</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Usage</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-500">Chargement des promotions...</td></tr>
                ) : filteredPromotions.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-500">Aucune promotion trouvée.</td></tr>
                ) : filteredPromotions.map((promotion) => (
                  <tr key={promotion.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-4">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg ${promotion.isActive ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"}`}><Tag size={18} /></div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-gray-900">{promotion.name}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${promotion.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{promotion.isActive ? "Actif" : "Inactif"}</span>
                          </div>
                          <p className="mt-1 text-sm text-gray-500">{promotion.method === "code" ? promotion.code : "Réduction automatique"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700">{getPromotionLabel(promotion)}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{getTargetSummary(promotion)}<br /><span className="text-xs text-gray-400">{promotion.customerType.toUpperCase()}</span></td>
                    <td className="px-4 py-4 text-sm text-gray-700">{formatDate(promotion.startsAt)} → {formatDate(promotion.endsAt)}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{promotion.usageCount}{promotion.usageLimit ? ` / ${promotion.usageLimit}` : ""}</td>
                    <td className="px-4 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        {promotion.code && <button onClick={() => navigator.clipboard?.writeText(promotion.code || "")} className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:text-gray-900" title="Copier"><Copy size={15} /></button>}
                        <button onClick={() => togglePromotion(promotion)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">{promotion.isActive ? "Désactiver" : "Activer"}</button>
                        <button onClick={() => openEdit(promotion)} className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:text-gray-900" title="Modifier"><Edit3 size={15} /></button>
                        <button onClick={() => handleDelete(promotion)} className="rounded-lg border border-red-100 p-2 text-red-500 hover:bg-red-50" title="Supprimer"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8">
          <div className="w-full max-w-5xl rounded-xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{editing ? "Modifier la promotion" : "Nouvelle promotion"}</h2>
                <p className="text-sm text-gray-500">Définis le mécanisme, les conditions, le ciblage et les limites d’utilisation.</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X size={20} /></button>
            </div>

            <div className="grid gap-6 p-6 lg:grid-cols-[1.5fr_1fr]">
              <div className="space-y-6">
                <Section title="Méthode">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Choice active={form.method === "code"} title="Code promo" description="Le client saisit un code dans le panier." onClick={() => updateForm("method", "code")} />
                    <Choice active={form.method === "automatic"} title="Réduction automatique" description="Application automatique si les conditions sont remplies." onClick={() => updateForm("method", "automatic")} />
                  </div>
                  {form.method === "code" && (
                    <div className="mt-4 flex gap-2">
                      <input value={String(form.code || "")} onChange={(e) => updateForm("code", e.target.value.toUpperCase())} placeholder="SUMMER20" className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold uppercase outline-none focus:border-primary" />
                      <button onClick={generateCode} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Générer</button>
                    </div>
                  )}
                </Section>

                <Section title="Informations">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Nom interne"><input value={String(form.name || "")} onChange={(e) => updateForm("name", e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary" placeholder="Promotion rentrée" /></Field>
                    <Field label="Statut"><select value={form.isActive ? "active" : "inactive"} onChange={(e) => updateForm("isActive", e.target.value === "active")} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary"><option value="active">Actif</option><option value="inactive">Inactif</option></select></Field>
                  </div>
                  <Field label="Description"><textarea value={String(form.description || "")} onChange={(e) => updateForm("description", e.target.value)} rows={3} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary" placeholder="Note visible uniquement dans l’administration" /></Field>
                </Section>

                <Section title="Valeur de la réduction">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Type"><select value={form.type} onChange={(e) => updateForm("type", e.target.value as AdminPromotionPayload["type"])} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary"><option value="percentage">Pourcentage</option><option value="fixed_amount">Montant fixe</option><option value="free_shipping">Livraison offerte</option><option value="buy_x_get_y">Buy X Get Y</option></select></Field>
                    {form.type !== "free_shipping" && <Field label={form.type === "fixed_amount" ? "Montant €" : "Valeur %"}><input type="number" min="0" step="0.01" value={Number(form.value || 0)} onChange={(e) => updateForm("value", Number(e.target.value))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary" /></Field>}
                  </div>
                </Section>

                <Section title="Ciblage">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="S’applique à"><select value={form.appliesTo} onChange={(e) => updateAppliesTo(e.target.value as AdminPromotionPayload["appliesTo"])} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary"><option value="all">Toute la commande</option><option value="products">Produits spécifiques</option><option value="categories">Collections spécifiques</option></select></Field>
                    <Field label="Type de client"><select value={form.customerType} onChange={(e) => updateForm("customerType", e.target.value as AdminPromotionPayload["customerType"])} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary"><option value="all">Tous</option><option value="b2c">B2C uniquement</option><option value="b2b">B2B / pro uniquement</option></select></Field>
                  </div>

                  {form.appliesTo === "products" && (
                    <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900"><Package size={16} /> Produits ciblés</div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-500">{selectedProductIds.size} sélectionné{selectedProductIds.size > 1 ? "s" : ""}</span>
                      </div>
                      <div className="relative mb-3">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Rechercher un produit par nom, marque ou slug..." className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-primary" />
                      </div>
                      {(form.productIds || []).length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-2">
                          {(form.productIds || []).map((productId) => {
                            const product = productById.get(productId);
                            return <button key={productId} type="button" onClick={() => removeProductTarget(productId)} className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15"><X size={13} />{product?.name || productId}</button>;
                          })}
                        </div>
                      )}
                      <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
                        {targetsLoading ? (
                          <div className="flex items-center justify-center py-6 text-sm text-gray-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement des produits...</div>
                        ) : productOptions.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-gray-200 p-5 text-center text-sm text-gray-500">Aucun produit trouvé.</div>
                        ) : productOptions.map((product) => {
                          const checked = selectedProductIds.has(product.id);
                          const image = getProductImage(product);
                          return (
                            <label key={product.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent p-2 transition hover:border-primary/30 hover:bg-primary/5">
                              <input type="checkbox" checked={checked} onChange={() => toggleProductTarget(product.id)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                              <div className="h-10 w-10 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                                {image ? <img src={image} alt={product.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-gray-300"><ImageIcon size={16} /></div>}
                              </div>
                              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-gray-900">{product.name}</p><p className="truncate text-xs text-gray-500">{product.brand || "Sans marque"} · {product.slug}</p></div>
                              {checked && <Check size={16} className="text-primary" />}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {form.appliesTo === "categories" && (
                    <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900"><Layers size={16} /> Collections ciblées</div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-500">{selectedCategoryIds.size} sélectionnée{selectedCategoryIds.size > 1 ? "s" : ""}</span>
                      </div>
                      <div className="relative mb-3">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} placeholder="Rechercher une collection par nom ou slug..." className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-primary" />
                      </div>
                      {(form.categoryIds || []).length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-2">
                          {(form.categoryIds || []).map((categoryId) => {
                            const category = categoryById.get(categoryId);
                            return <button key={categoryId} type="button" onClick={() => removeCategoryTarget(categoryId)} className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15"><X size={13} />{category ? getCategoryDisplayName(category) : categoryId}</button>;
                          })}
                        </div>
                      )}
                      <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
                        {targetsLoading ? (
                          <div className="flex items-center justify-center py-6 text-sm text-gray-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement des collections...</div>
                        ) : filteredCategoryOptions.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-gray-200 p-5 text-center text-sm text-gray-500">Aucune collection trouvée.</div>
                        ) : filteredCategoryOptions.map((category) => {
                          const checked = selectedCategoryIds.has(category.id);
                          return (
                            <label key={category.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent p-2 transition hover:border-primary/30 hover:bg-primary/5">
                              <input type="checkbox" checked={checked} onChange={() => toggleCategoryTarget(category.id)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400"><Layers size={16} /></div>
                              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-gray-900">{category.name}</p><p className="truncate text-xs text-gray-500">{category.parentSlug ? `${category.parentSlug} · ` : ""}{category.slug}</p></div>
                              {checked && <Check size={16} className="text-primary" />}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </Section>
              </div>

              <div className="space-y-6">
                <Section title="Conditions">
                  <Field label="Montant minimum"><input type="number" min="0" step="0.01" value={form.minOrderAmount ?? ""} onChange={(e) => updateForm("minOrderAmount", e.target.value === "" ? null : Number(e.target.value))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary" placeholder="Aucun" /></Field>
                  <Field label="Quantité minimum"><input type="number" min="0" step="1" value={form.minQuantity ?? ""} onChange={(e) => updateForm("minQuantity", e.target.value === "" ? null : Number(e.target.value))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary" placeholder="Aucune" /></Field>
                  <label className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 text-sm text-gray-700"><input type="checkbox" checked={Boolean(form.stackable)} onChange={(e) => updateForm("stackable", e.target.checked)} /> Cumulable avec d’autres promotions</label>
                </Section>

                <Section title="Limites d’utilisation">
                  <Field label="Limite totale"><input type="number" min="0" value={form.usageLimit ?? ""} onChange={(e) => updateForm("usageLimit", e.target.value === "" ? null : Number(e.target.value))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary" placeholder="Illimitée" /></Field>
                  <Field label="Limite par client"><input type="number" min="0" value={form.usagePerCustomer ?? ""} onChange={(e) => updateForm("usagePerCustomer", e.target.value === "" ? null : Number(e.target.value))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary" placeholder="Illimitée" /></Field>
                </Section>

                <Section title="Dates">
                  <Field label="Début"><input type="datetime-local" value={toDateTimeLocal(form.startsAt as string | null)} onChange={(e) => updateForm("startsAt", fromDateTimeLocal(e.target.value))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary" /></Field>
                  <Field label="Fin"><input type="datetime-local" value={toDateTimeLocal(form.endsAt as string | null)} onChange={(e) => updateForm("endsAt", fromDateTimeLocal(e.target.value))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary" /></Field>
                </Section>

                <div className="sticky bottom-0 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
                  <button onClick={handleSave} disabled={saving} className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60">{saving ? "Enregistrement..." : editing ? "Enregistrer les modifications" : "Créer la promotion"}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500"><BarChart3 size={14} />{label}</div><p className="mt-2 text-2xl font-bold text-gray-900">{value}</p></div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"><h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-900">{title}</h3><div className="space-y-4">{children}</div></section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</span>{children}</label>;
}

function Choice({ active, title, description, onClick }: { active: boolean; title: string; description: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-xl border p-4 text-left transition ${active ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"}`}><p className="font-semibold text-gray-900">{title}</p><p className="mt-1 text-sm text-gray-500">{description}</p></button>;
}
