"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState, useCallback } from "react";
import {
  getAdminProducts,
  getProductsMeta,
  deleteProduct,
  createProduct,
  updateProduct,
} from "@/lib/admin-api";
import type { Product } from "@/types";
import AutocompleteInput from "@/components/admin/AutocompleteInput";
import VariantManager from "@/components/admin/VariantManager";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Package,
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";

function formatPrice(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}
function parseImages(images: string | string[]): string[] {
  if (Array.isArray(images)) return images;
  try { return JSON.parse(images); } catch { return []; }
}

const STATUSES = [
  { value: "", label: "Tous les statuts" },
  { value: "active", label: "Actif" },
  { value: "draft", label: "Brouillon" },
  { value: "archived", label: "Archivé" },
];

interface ProductForm {
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  subsubcategory: string;
  price: string;
  originalPrice: string;
  description: string;
  inStock: boolean;
  isActive: boolean;
}

const emptyForm: ProductForm = {
  name: "",
  brand: "",
  category: "",
  subcategory: "",
  subsubcategory: "",
  price: "",
  originalPrice: "",
  description: "",
  inStock: true,
  isActive: true,
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  // Données pour l'autocomplétion
  const [brands, setBrands] = useState<string[]>([]);
  const [categories, setCategories] = useState<import("@/components/admin/AutocompleteInput").AutocompleteSuggestion[]>([]);
  const [allSubcategories, setAllSubcategories] = useState<import("@/components/admin/AutocompleteInput").AutocompleteSuggestion[]>([]);
  const [level3ByParent, setLevel3ByParent] = useState<Record<string, { slug: string; label: string }[]>>({});

  // Charger les métadonnées une seule fois
  useEffect(() => {
    getProductsMeta()
      .then((meta) => {
        setBrands(meta.brands);
        setCategories(
          meta.categoriesWithLabels?.length
            ? meta.categoriesWithLabels
            : meta.categories.map((s) => ({ slug: s, label: s }))
        );
        setAllSubcategories(
          meta.subcategoriesWithLabels?.length
            ? meta.subcategoriesWithLabels
            : meta.subcategories.map((s) => ({ slug: s, label: s }))
        );
        setLevel3ByParent(meta.level3ByParent || {});
      })
      .catch(console.error);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminProducts({ page, search, status: statusFilter, limit: 20 });
      setProducts(data.products);
      setTotal(data.total);
      setPages(data.pages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      brand: p.brand,
      category: p.category,
      subcategory: p.subcategory,
      subsubcategory: (p as any).subsubcategory || "",
      price: String(p.price),
      originalPrice: p.originalPrice ? String(p.originalPrice) : "",
      description: p.description,
      inStock: p.inStock,
      isActive: p.status === "active",
    });
    setError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.price) {
      setError("Le nom et le prix sont requis");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await updateProduct(editingId, form as unknown as Record<string, unknown>);
      } else {
        await createProduct(form as unknown as Record<string, unknown>);
      }
      setShowModal(false);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce produit ?")) return;
    setDeleting(id);
    try {
      await deleteProduct(id);
      load();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-heading font-bold text-xl text-dark-800">Produits</h1>
          <p className="text-sm text-gray-500">{total} produit{total !== 1 ? "s" : ""} au total</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={16} /> Nouveau produit
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
            placeholder="Rechercher un produit..."
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Produit</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">Catégorie</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Prix</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Stock</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Statut</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3" colSpan={6}>
                      <div className="h-5 bg-gray-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    <Package size={32} className="mx-auto mb-2 text-gray-300" />
                    Aucun produit trouvé
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const imgs = parseImages(p.images);
                  return (
                    <tr key={p.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                            {imgs[0] ? (
                              <img src={imgs[0]} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300">
                                <Package size={16} />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-dark-800 truncate max-w-[200px]">{p.name}</div>
                            <div className="text-xs text-gray-400">{p.brand}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{p.category}</td>
                      <td className="px-4 py-3 text-right font-medium text-dark-800 tabular-nums">
                        {formatPrice(p.price)}
                        {p.originalPrice && (
                          <div className="text-xs text-gray-400 line-through">{formatPrice(p.originalPrice)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${p.inStock ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"}`}>
                          {p.inStock ? "En stock" : "Rupture"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          p.status === "active" ? "text-green-600 bg-green-50" :
                          p.status === "draft" ? "text-yellow-600 bg-yellow-50" :
                          "text-gray-600 bg-gray-100"
                        }`}>
                          {p.status === "active" ? "Actif" : p.status === "draft" ? "Brouillon" : "Archivé"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(p)}
                            className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            disabled={deleting === p.id}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Supprimer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Page {page} sur {pages}</span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg text-gray-400 hover:text-dark-800 hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage(Math.min(pages, page + 1))}
                disabled={page >= pages}
                className="p-1.5 rounded-lg text-gray-400 hover:text-dark-800 hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Create/Edit */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-heading font-bold text-lg text-dark-800">
                {editingId ? "Modifier le produit" : "Nouveau produit"}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {error && (
                <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              {/* Nom */}
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">Nom *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
                  placeholder="Nom du produit"
                />
              </div>

              {/* Marque + Catégorie */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-700 mb-1">Marque</label>
                  <AutocompleteInput
                    value={form.brand}
                    onChange={(v) => setForm({ ...form, brand: v })}
                    suggestions={brands}
                    placeholder="Marque"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-700 mb-1">Catégorie</label>
                  <AutocompleteInput
                    value={form.category}
                    onChange={(v) => setForm({ ...form, category: v, subcategory: "" })}
                    suggestions={categories}
                    placeholder="Catégorie"
                  />
                </div>
              </div>

              {/* Sous-catégorie */}
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">Sous-catégorie</label>
                <AutocompleteInput
                  value={form.subcategory}
                  onChange={(v) => setForm({ ...form, subcategory: v, subsubcategory: "" })}
                  suggestions={allSubcategories}
                  placeholder="Sous-catégorie"
                />
              </div>

              {/* Sous-sous-catégorie (niveau 3) — visible uniquement si la sous-catégorie a des enfants */}
              {level3ByParent[form.subcategory]?.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-dark-700 mb-1">Sous-sous-catégorie</label>
                  <AutocompleteInput
                    value={form.subsubcategory}
                    onChange={(v) => setForm({ ...form, subsubcategory: v })}
                    suggestions={level3ByParent[form.subcategory].map((s) => ({ slug: s.slug, label: s.label }))}
                    placeholder="Sélectionner une sous-sous-catégorie..."
                  />
                </div>
              )}

              {/* Prix */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-700 mb-1">Prix *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-700 mb-1">Prix barré</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.originalPrice}
                    onChange={(e) => setForm({ ...form, originalPrice: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary resize-none"
                  placeholder="Description du produit"
                />
              </div>

              {/* Checkboxes */}
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.inStock}
                    onChange={(e) => setForm({ ...form, inStock: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  En stock
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  Actif (visible)
                </label>
              </div>

              {/* Variantes — uniquement en mode édition */}
              {editingId && (
                <div className="border-t border-gray-100 pt-4">
                  <VariantManager
                    productId={editingId}
                    productPrice={parseFloat(form.price) || 0}
                  />
                </div>
              )}
              {!editingId && (
                <p className="text-xs text-gray-400 italic border-t border-gray-100 pt-3">
                  Les variantes (couleurs, tailles) peuvent être ajoutées après la création du produit.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-dark-800">
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">
                {saving ? "Enregistrement..." : editingId ? "Mettre à jour" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
