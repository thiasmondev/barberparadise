"use client";

import { useEffect, useState, useCallback } from "react";
import { getAdminCategories, createCategory, updateCategory, deleteCategory } from "@/lib/admin-api";
import type { Category } from "@/types";
import { Plus, Pencil, Trash2, FolderTree, X, AlertCircle } from "lucide-react";

interface CatForm {
  name: string;
  slug: string;
  description: string;
  image: string;
  parentSlug: string;
  order: string;
}

const emptyForm: CatForm = { name: "", slug: "", description: "", image: "", parentSlug: "", order: "0" };

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CatForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminCategories();
      setCategories(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  };

  const openEdit = (c: Category) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      slug: c.slug,
      description: c.description,
      image: c.image,
      parentSlug: c.parentSlug,
      order: String(c.order),
    });
    setError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.slug) {
      setError("Le nom et le slug sont requis");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const data = { ...form, order: parseInt(form.order) || 0 };
      if (editingId) {
        await updateCategory(editingId, data);
      } else {
        await createCategory(data);
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
    if (!confirm("Supprimer cette catégorie ?")) return;
    try {
      await deleteCategory(id);
      load();
    } catch (err) {
      console.error(err);
    }
  };

  const parents = categories.filter((c) => !c.parentSlug);
  const children = (parentSlug: string) => categories.filter((c) => c.parentSlug === parentSlug);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-bold text-xl text-dark-800">Catégories</h1>
          <p className="text-sm text-gray-500">{categories.length} catégorie{categories.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={16} /> Nouvelle catégorie
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          </div>
        ) : categories.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <FolderTree size={32} className="mx-auto mb-2 text-gray-300" />
            Aucune catégorie
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {parents.map((cat) => (
              <div key={cat.id}>
                <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/50">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                    <FolderTree size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-dark-800">{cat.name}</div>
                    <div className="text-xs text-gray-400">/{cat.slug} · Ordre: {cat.order}</div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(cat)} className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(cat.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {children(cat.slug).map((sub) => (
                  <div key={sub.id} className="flex items-center gap-4 px-5 py-3 pl-14 hover:bg-gray-50/50 border-t border-gray-50">
                    <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center text-gray-400">
                      <FolderTree size={12} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-dark-700">{sub.name}</div>
                      <div className="text-xs text-gray-400">/{sub.slug}</div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(sub)} className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(sub.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-heading font-bold text-lg text-dark-800">
                {editingId ? "Modifier la catégorie" : "Nouvelle catégorie"}
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
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">Nom *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || e.target.value.toLowerCase().replace(/ +/g, "-") })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">Slug *</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">Catégorie parente (slug)</label>
                <select
                  value={form.parentSlug}
                  onChange={(e) => setForm({ ...form, parentSlug: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
                >
                  <option value="">Aucune (catégorie racine)</option>
                  {parents.map((p) => (
                    <option key={p.id} value={p.slug}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">Ordre</label>
                <input
                  type="number"
                  value={form.order}
                  onChange={(e) => setForm({ ...form, order: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600">Annuler</button>
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
