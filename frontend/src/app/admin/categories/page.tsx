"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  getAdminCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
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
  GripVertical,
  Check,
  Loader2,
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

// ─── Composant ligne sortable ─────────────────────────────────────────────────
interface SortableRowProps {
  node: CatNode;
  breadcrumbLength: number;
  onNavigate: (node: CatNode) => void;
  onEdit: (cat: Category) => void;
  onDelete: (id: string, name: string) => void;
  onAddChild: (slug: string) => void;
  isDragging?: boolean;
}

function SortableRow({
  node,
  breadcrumbLength,
  onNavigate,
  onEdit,
  onDelete,
  onAddChild,
  isDragging = false,
}: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSelfDragging,
  } = useSortable({ id: node.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSelfDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "shadow-lg rounded-lg" : ""}>
      {/* Ligne principale */}
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 group border-b border-gray-50 cursor-pointer"
        onClick={() => node.children.length > 0 && onNavigate(node)}
      >
        {/* Poignée drag */}
        <div
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 touch-none"
          onClick={(e) => e.stopPropagation()}
          title="Glisser pour réorganiser"
        >
          <GripVertical size={16} />
        </div>

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
              onClick={() => onAddChild(node.slug)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-violet-600 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg whitespace-nowrap"
              title={`Ajouter une ${node.level === 0 ? "sous-catégorie" : "sous-sous-catégorie"}`}
            >
              <FolderPlus size={11} />
              {node.level === 0 ? "Sous-catégorie" : "Sous-sous-catégorie"}
            </button>
          )}
          <button
            onClick={() => onEdit(node)}
            className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => onDelete(node.id, node.name)}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Aperçu des enfants (vue racine seulement) */}
      {breadcrumbLength === 0 && node.children.length > 0 && (
        <div className="bg-gray-50/40 border-b border-gray-50">
          {node.children.slice(0, 5).map((child) => (
            <div
              key={child.id}
              className="flex items-center gap-3 pl-10 pr-4 py-2 hover:bg-gray-100/60 group/child cursor-pointer border-b border-gray-50/80"
              onClick={() => child.children.length > 0 && onNavigate(child)}
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
                    onClick={() => onAddChild(child.slug)}
                    className="p-1 text-violet-400 hover:text-violet-600 hover:bg-violet-50 rounded"
                    title="Ajouter une sous-sous-catégorie"
                  >
                    <FolderPlus size={11} />
                  </button>
                )}
                <button onClick={() => onEdit(child)} className="p-1 text-gray-300 hover:text-primary rounded">
                  <Pencil size={11} />
                </button>
                <button onClick={() => onDelete(child.id, child.name)} className="p-1 text-gray-300 hover:text-red-500 rounded">
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
          {node.children.length > 5 && (
            <button
              onClick={() => onNavigate(node)}
              className="pl-10 pr-4 py-1.5 text-xs text-violet-600 hover:underline block"
            >
              Voir les {node.children.length - 5} autres sous-catégories →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
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
  const [reordering, setReordering] = useState(false);
  const [reorderSaved, setReorderSaved] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Noeuds visibles dans la vue courante (réorganisables)
  const [visibleNodes, setVisibleNodes] = useState<CatNode[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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

  // Synchronise visibleNodes quand l'arbre ou le noeud courant change
  // MAIS seulement si on n'est pas en train de réorganiser (pour ne pas écraser le drag)
  const isDraggingRef = useRef(false);
  useEffect(() => {
    if (isDraggingRef.current) return; // Ne pas écraser pendant/après un drag
    const nodes = currentNode ? currentNode.children : tree;
    setVisibleNodes(nodes);
  }, [tree, currentNode]);

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

  // ─── Drag-and-drop handlers ────────────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
    setReorderSaved(false);
    isDraggingRef.current = true; // Bloquer la sync depuis l'arbre
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = visibleNodes.findIndex((n) => n.id === active.id);
    const newIndex = visibleNodes.findIndex((n) => n.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Réorganiser localement et assigner les nouveaux ordres
    const reordered = arrayMove(visibleNodes, oldIndex, newIndex);
    const updatedItems = reordered.map((n, i) => ({ ...n, order: i }));
    setVisibleNodes(updatedItems); // Mise à jour visuelle immédiate

    // Mettre à jour aussi l'arbre et les catégories en mémoire (sans recharger depuis la base)
    setCategories((prev) =>
      prev.map((c) => {
        const found = updatedItems.find((n) => n.id === c.id);
        return found ? { ...c, order: found.order } : c;
      })
    );

    // Sauvegarder en base avec debounce
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setReordering(true);
    saveTimer.current = setTimeout(async () => {
      try {
        await reorderCategories(updatedItems.map((n, i) => ({ id: n.id, order: i })));
        setReorderSaved(true);
        setTimeout(() => {
          setReorderSaved(false);
          isDraggingRef.current = false; // Réactiver la sync seulement après confirmation
        }, 2000);
      } catch (err) {
        console.error("Erreur sauvegarde ordre:", err);
        isDraggingRef.current = false;
        // En cas d'erreur, recharger pour retrouver l'état cohérent
        await load();
      } finally {
        setReordering(false);
      }
    }, 600);
  };

  const activeDragNode = activeDragId ? visibleNodes.find((n) => n.id === activeDragId) : null;
  const allParents = categories.filter((c) => !editingId || c.id !== editingId);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-heading font-bold text-xl text-dark-800">Catégories</h1>
          <p className="text-sm text-gray-500">{categories.length} catégories au total</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Indicateur de sauvegarde */}
          {reordering && (
            <span className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
              <Loader2 size={12} className="animate-spin" /> Sauvegarde...
            </span>
          )}
          {reorderSaved && !reordering && (
            <span className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
              <Check size={12} /> Ordre sauvegardé
            </span>
          )}
          <button onClick={() => openCreate(currentNode?.slug || "")} className="btn-primary">
            <Plus size={16} /> {addLabel[Math.min(currentLevel, 2)]}
          </button>
        </div>
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

      {/* Liste avec drag-and-drop */}
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
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <GripVertical size={12} /> Glissez pour réorganiser
          </span>
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={visibleNodes.map((n) => n.id)}
              strategy={verticalListSortingStrategy}
            >
              <div>
                {visibleNodes.map((node) => (
                  <SortableRow
                    key={node.id}
                    node={node}
                    breadcrumbLength={breadcrumb.length}
                    onNavigate={navigateTo}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onAddChild={openCreate}
                  />
                ))}
              </div>
            </SortableContext>

            {/* Overlay affiché pendant le drag */}
            <DragOverlay>
              {activeDragNode ? (
                <div className="bg-white border-2 border-violet-300 rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3 opacity-95">
                  <GripVertical size={16} className="text-violet-400" />
                  {activeDragNode.children.length > 0 ? (
                    <FolderOpen size={18} className="text-violet-400" />
                  ) : (
                    <Folder size={18} className="text-gray-300" />
                  )}
                  <span className="font-medium text-sm text-dark-700">{activeDragNode.name}</span>
                  <span className="text-xs text-gray-400 font-mono">/{activeDragNode.slug}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
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
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-primary"
                  placeholder="ex: peigne-coiffant"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">Catégorie parente</label>
                <select
                  value={form.parentSlug}
                  onChange={(e) => setForm((f) => ({ ...f, parentSlug: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
                >
                  <option value="">— Aucune (catégorie racine) —</option>
                  {allParents.map((p) => (
                    <option key={p.id} value={p.slug}>
                      {p.parentSlug ? `  ↳ ${p.name}` : p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary resize-none"
                  placeholder="Description optionnelle"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                {editingId ? "Mettre à jour" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
