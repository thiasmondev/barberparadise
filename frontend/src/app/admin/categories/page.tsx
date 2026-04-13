"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState, useCallback } from "react";
import {
  getAdminCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/admin-api";
import type { Category } from "@/types";
import {
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  X,
  AlertCircle,
  Folder,
  FolderOpen,
  FolderPlus,
  Home,
} from "lucide-react";

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface CatNode extends Category {
  children: CatNode[];
  level: number;
}

function buildTree(cats: Category[]): CatNode[] {
  const map = new Map<string, CatNode>();
  cats.forEach((c) => map.set(c.slug, { ...c, children: [], level: 0 }));
  const roots: CatNode[] = [];
  map.forEach((node) => {
    if (!node.parentSlug) {
      node.level = 0;
      roots.push(node);
    } else {
      const parent = map.get(node.parentSlug);
      if (parent) {
        node.level = parent.level + 1;
        parent.children.push(node);
      } else {
        node.level = 0;
        roots.push(node);
      }
    }
  });
  const sort = (nodes: CatNode[]) => {
    nodes.sort((a, b) => a.order - b.order);
    nodes.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

interface CatForm {
  name: string;
  slug: string;
  parentSlug: string;
  description: string;
  order: string;
}

const emptyForm = (parentSlug = ""): CatForm => ({
  name: "",
  slug: "",
  parentSlug,
  description: "",
  order: "0",
});

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tree, setTree] = useState<CatNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CatForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [breadcrumb, setBreadcrumb] = useState<CatNode[]>([]);
  const [currentNode, setCurrentNode] = useState<CatNode | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cats = await getAdminCategories();
      setCategories(cats);
      setTree(buildTree(cats));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visibleNodes = currentNode ? currentNode.children : tree;
  const currentLevel = currentNode ? currentNode.level + 1 : 0;
  const levelLabel = ["Catégories racines", "Sous-catégories", "Sous-sous-catégories"];
  const addLabel = ["+ Nouvelle catégorie", "+ Nouvelle sous-catégorie", "+ Nouvelle sous-sous-catégorie"];

  const navigateTo = (node: CatNode) => {
    if (node.children.length === 0) return;
    setBreadcrumb((bc) => [...bc, node]);
    setCurrentNode(node);
  };

  const navigateToBreadcrumb = (index: number) => {
    if (index === -1) {
      setBreadcrumb([]);
      setCurrentNode(null);
    } else {
      const newBc = breadcrumb.slice(0, index + 1);
      setBreadcrumb(newBc);
      setCurrentNode(newBc[newBc.length - 1]);
    }
  };

  const openCreate = (parentSlug = "") => {
    setEditingId(null);
    setForm(emptyForm(parentSlug));
    setError("");
    setShowModal(true);
  };

  const openEdit = (cat: Category) => {
    setEditingId(cat.id);
    setForm({
      name: cat.name,
      slug: cat.slug,
      parentSlug: cat.parentSlug || "",
      description: cat.description || "",
      order: String(cat.order ?? 0),
    });
    setError("");
    setShowModal(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Supprimer "${name}" ?`)) return;
    try {
      await deleteCategory(id);
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erreur");
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.slug) {
      setError("Le nom et le slug sont requis");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name,
        slug: form.slug,
        parentSlug: form.parentSlug,
        description: form.description,
        order: parseInt(form.order) || 0,
      };
      if (editingId) {
        await updateCategory(editingId, payload);
      } else {
        await createCategory(payload);
      }
      setShowModal(false);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const allParents = categories.filter((c) => !editingId || c.id !== editingId);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-heading font-bold text-xl text-dark-800">Catégories</h1>
          <p className="text-sm text-gray-500">{categories.length} catégories au total</p>
        </div>
        <button onClick={() => openCreate(currentNode?.slug || "")} className="btn-primary">
          <Plus size={16} /> {addLabel[Math.min(currentLevel, 2)]}
        </button>
      </div>

      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-1 text-sm flex-wrap">
        <button
          onClick={() => navigateToBreadcrumb(-1)}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${
            breadcrumb.length === 0
              ? "text-violet-700 bg-violet-50 font-medium"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          }`}
        >
          <Home size={13} /> Toutes les catégories
        </button>
        {breadcrumb.map((bc, i) => (
          <span key={bc.id} className="flex items-center gap-1">
            <ChevronRight size={14} className="text-gray-300" />
            <button
              onClick={() => navigateToBreadcrumb(i)}
              className={`px-2 py-1 rounded-lg transition-colors ${
                i === breadcrumb.length - 1
                  ? "text-violet-700 bg-violet-50 font-medium"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              }`}
            >
              {bc.name}
            </button>
          </span>
        ))}
      </nav>

      {/* Liste */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2">
            {currentNode ? <FolderOpen size={16} className="text-violet-500" /> : <Folder size={16} className="text-gray-400" />}
            <span className="text-sm font-medium text-dark-700">
              {currentNode ? currentNode.name : "Toutes les catégories"}
            </span>
            <span className="text-xs text-gray-400">
              — {levelLabel[Math.min(currentLevel, 2)]} ({visibleNodes.length})
            </span>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : visibleNodes.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <FolderPlus size={32} className="mx-auto mb-2 text-gray-200" />
            <p className="text-sm">Aucune {levelLabel[Math.min(currentLevel, 2)].toLowerCase()}</p>
            <button
              onClick={() => openCreate(currentNode?.slug || "")}
              className="mt-3 text-sm text-violet-600 hover:underline"
            >
              {addLabel[Math.min(currentLevel, 2)]}
            </button>
          </div>
        ) : (
          <div>
            {visibleNodes.map((node) => (
              <div key={node.id}>
                {/* Ligne principale */}
                <div
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 group border-b border-gray-50 cursor-pointer"
                  onClick={() => node.children.length > 0 && navigateTo(node)}
                >
                  <div className="shrink-0">
                    {node.children.length > 0 ? (
                      <FolderOpen size={18} className="text-violet-400" />
                    ) : (
                      <Folder size={18} className="text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium text-sm ${node.children.length > 0 ? "text-violet-700" : "text-dark-700"}`}>
                        {node.name}
                      </span>
                      {node.children.length > 0 && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                          {node.children.length} {node.level === 0 ? "sous-catégorie" : "sous-sous-catégorie"}{node.children.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 font-mono">/{node.slug} · Ordre: {node.order}</div>
                  </div>
                  {node.children.length > 0 && (
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-violet-400 transition-colors shrink-0" />
                  )}
                  <div
                    className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {node.level < 2 && (
                      <button
                        onClick={() => openCreate(node.slug)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-violet-600 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg whitespace-nowrap"
                        title={`Ajouter une ${node.level === 0 ? "sous-catégorie" : "sous-sous-catégorie"}`}
                      >
                        <FolderPlus size={11} />
                        {node.level === 0 ? "Sous-catégorie" : "Sous-sous-catégorie"}
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(node)}
                      className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(node.id, node.name)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Aperçu des enfants (vue racine seulement) */}
                {breadcrumb.length === 0 && node.children.length > 0 && (
                  <div className="bg-gray-50/40 border-b border-gray-50">
                    {node.children.slice(0, 5).map((child) => (
                      <div
                        key={child.id}
                        className="flex items-center gap-3 pl-10 pr-4 py-2 hover:bg-gray-100/60 group/child cursor-pointer border-b border-gray-50/80"
                        onClick={() => child.children.length > 0 && navigateTo(child)}
                      >
                        <Folder size={14} className={child.children.length > 0 ? "text-blue-400" : "text-gray-200"} />
                        <div className="flex-1 min-w-0">
                          <span className={`text-xs ${child.children.length > 0 ? "text-blue-700 font-medium" : "text-gray-600"}`}>
                            {child.name}
                          </span>
                          {child.children.length > 0 && (
                            <span className="text-xs text-gray-400 ml-1.5">
                              ({child.children.length} sous-sous-catégorie{child.children.length > 1 ? "s" : ""})
                            </span>
                          )}
                          <span className="text-xs text-gray-300 font-mono ml-2">/{child.slug}</span>
                        </div>
                        {child.children.length > 0 && (
                          <ChevronRight size={12} className="text-gray-200 group-hover/child:text-blue-400 shrink-0" />
                        )}
                        <div
                          className="flex items-center gap-1 opacity-0 group-hover/child:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {child.level < 2 && (
                            <button
                              onClick={() => openCreate(child.slug)}
                              className="p-1 text-violet-400 hover:text-violet-600 hover:bg-violet-50 rounded"
                              title="Ajouter une sous-sous-catégorie"
                            >
                              <FolderPlus size={11} />
                            </button>
                          )}
                          <button onClick={() => openEdit(child)} className="p-1 text-gray-300 hover:text-primary rounded">
                            <Pencil size={11} />
                          </button>
                          <button onClick={() => handleDelete(child.id, child.name)} className="p-1 text-gray-300 hover:text-red-500 rounded">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {node.children.length > 5 && (
                      <button
                        onClick={() => navigateTo(node)}
                        className="pl-10 pr-4 py-1.5 text-xs text-violet-600 hover:underline block"
                      >
                        Voir les {node.children.length - 5} autres sous-catégories →
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Créer / Modifier */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
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

              {form.parentSlug && (
                <div className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2 text-xs text-violet-700">
                  Sera créée sous : <strong>{allParents.find((p) => p.slug === form.parentSlug)?.name || form.parentSlug}</strong>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">Nom *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((f) => ({ ...f, name, slug: f.slug || slugify(name) }));
                  }}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
                  placeholder="ex: Peigne coiffant"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">Slug *</label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-gray-400">/</span>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-primary"
                    placeholder="peigne-coiffant"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Utilisé dans l&apos;URL — lettres minuscules et tirets uniquement</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">Catégorie parente</label>
                <select
                  value={form.parentSlug}
                  onChange={(e) => setForm((f) => ({ ...f, parentSlug: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
                >
                  <option value="">Aucune (catégorie racine)</option>
                  {allParents.map((p) => (
                    <option key={p.id} value={p.slug}>
                      {p.parentSlug ? `  ↳ ${p.name}` : p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
                  placeholder="Description courte (optionnel)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">Ordre d&apos;affichage</label>
                <input
                  type="number"
                  value={form.order}
                  onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
                />
              </div>
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
