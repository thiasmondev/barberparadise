"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  addProductsToAdminCategory,
  getAdminCategoryDetail,
  getAdminProducts,
  removeProductFromAdminCategory,
  reorderAdminCategoryProducts,
  updateAdminCategoryDetail,
  uploadCategoryImage,
} from "@/lib/admin-api";
import type { Category, Product } from "@/types";
import {
  ArrowLeft,
  Check,
  GripVertical,
  ImageIcon,
  Loader2,
  Plus,
  Save,
  Search,
  Upload,
  X,
} from "lucide-react";

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getProductImage(product: Product): string {
  const images = product.images;
  if (Array.isArray(images)) return String(images[0] || "");
  try {
    const parsed = JSON.parse(images || "[]");
    return Array.isArray(parsed) ? String(parsed[0] || "") : "";
  } catch {
    return images || "";
  }
}

function productStatusLabel(status: string) {
  if (status === "active") return "Actif";
  if (status === "draft") return "Brouillon";
  return status || "Brouillon";
}

interface CategoryForm {
  name: string;
  slug: string;
  description: string;
  image: string;
  isActive: boolean;
  metaTitle: string;
  metaDescription: string;
}

function toForm(category: Category): CategoryForm {
  return {
    name: category.name || "",
    slug: category.slug || "",
    description: category.description || "",
    image: category.image || "",
    isActive: category.isActive ?? true,
    metaTitle: category.metaTitle || "",
    metaDescription: category.metaDescription || "",
  };
}

interface SortableProductRowProps {
  product: Product;
  onRemove: (productId: string) => void;
  removing: boolean;
}

function SortableProductRow({ product, onRemove, removing }: SortableProductRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product.id });
  const image = getProductImage(product);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm ${
        isDragging ? "opacity-60 ring-2 ring-amber-300" : ""
      }`}
    >
      <button
        type="button"
        className="cursor-grab rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing"
        aria-label="Réordonner le produit"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="h-12 w-12 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <ImageIcon className="h-5 w-5" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{product.name}</p>
        <p className="truncate text-xs text-slate-500">{product.brand} · {product.slug}</p>
      </div>
      <span
        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
          product.status === "active"
            ? "bg-emerald-50 text-emerald-700"
            : "bg-slate-100 text-slate-600"
        }`}
      >
        {productStatusLabel(product.status)}
      </span>
      <button
        type="button"
        onClick={() => onRemove(product.id)}
        disabled={removing}
        className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
        aria-label={`Retirer ${product.name}`}
      >
        {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
      </button>
    </div>
  );
}

interface ProductSelectionModalProps {
  open: boolean;
  onClose: () => void;
  currentProductIds: Set<string>;
  onAdd: (ids: string[]) => Promise<void>;
}

function ProductSelectionModal({ open, onClose, currentProductIds, onAdd }: ProductSelectionModalProps) {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    const timeout = window.setTimeout(async () => {
      try {
        const data = await getAdminProducts({ search, limit: 100 });
        if (!cancelled) setProducts(data.products);
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Erreur chargement produits");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [open, search]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelected(new Set());
      setProducts([]);
      setError("");
    }
  }, [open]);

  if (!open) return null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectableProducts = products.filter((product) => !currentProductIds.has(product.id));

  const submit = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    setError("");
    try {
      await onAdd(Array.from(selected));
      onClose();
    } catch (err: any) {
      setError(err.message || "Erreur ajout produits");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Ajouter des produits</h2>
            <p className="text-sm text-slate-500">{selected.size} produit{selected.size > 1 ? "s" : ""} sélectionné{selected.size > 1 ? "s" : ""}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-slate-200 p-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher par nom, marque ou slug..."
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              autoFocus
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {error && <div className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement des produits...
            </div>
          ) : selectableProducts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              Aucun produit disponible pour cette recherche.
            </div>
          ) : (
            <div className="space-y-2">
              {selectableProducts.map((product) => {
                const image = getProductImage(product);
                const checked = selected.has(product.id);
                return (
                  <label
                    key={product.id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-amber-300 hover:bg-amber-50/40"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(product.id)}
                      className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <div className="h-11 w-11 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt={product.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-300">
                          <ImageIcon className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{product.name}</p>
                      <p className="truncate text-xs text-slate-500">{product.brand} · {productStatusLabel(product.status)}</p>
                    </div>
                    {checked && <Check className="h-4 w-4 text-amber-600" />}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <p className="text-sm text-slate-500">{selected.size} sélectionné{selected.size > 1 ? "s" : ""}</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Annuler
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={selected.size === 0 || submitting}
              className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Ajouter la sélection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminCategoryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [category, setCategory] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryForm | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const data = await getAdminCategoryDetail(id);
      setCategory(data.category);
      setForm(toForm(data.category));
      setProducts(data.products);
    } catch (err: any) {
      setError(err.message || "Erreur chargement catégorie");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const currentProductIds = useMemo(() => new Set(products.map((product) => product.id)), [products]);
  const filteredProducts = useMemo(() => {
    const needle = productSearch.trim().toLowerCase();
    if (!needle) return products;
    return products.filter((product) =>
      [product.name, product.brand, product.slug, product.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [productSearch, products]);

  const updateField = <K extends keyof CategoryForm>(field: K, value: CategoryForm[K]) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const save = async () => {
    if (!id || !form) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await updateAdminCategoryDetail(id, { ...form });
      setCategory(updated);
      setForm(toForm(updated));
      setSuccess("Catégorie enregistrée.");
    } catch (err: any) {
      setError(err.message || "Erreur enregistrement catégorie");
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const result = await uploadCategoryImage(file);
      updateField("image", result.image);
    } catch (err: any) {
      setError(err.message || "Erreur upload image");
    } finally {
      setUploading(false);
    }
  };

  const addProducts = async (productIds: string[]) => {
    if (!id) return;
    const result = await addProductsToAdminCategory(id, productIds);
    setProducts(result.products);
    setSuccess(`${productIds.length} produit${productIds.length > 1 ? "s" : ""} ajouté${productIds.length > 1 ? "s" : ""}.`);
  };

  const removeProduct = async (productId: string) => {
    if (!id) return;
    setRemovingId(productId);
    setError("");
    try {
      await removeProductFromAdminCategory(id, productId);
      setProducts((prev) => prev.filter((product) => product.id !== productId));
      setSuccess("Produit retiré de la catégorie.");
    } catch (err: any) {
      setError(err.message || "Erreur retrait produit");
    } finally {
      setRemovingId(null);
    }
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !id) return;

    const oldIndex = products.findIndex((product) => product.id === active.id);
    const newIndex = products.findIndex((product) => product.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const nextProducts = arrayMove(products, oldIndex, newIndex);
    setProducts(nextProducts);
    setError("");
    try {
      await reorderAdminCategoryProducts(id, nextProducts.map((product) => product.id));
      setSuccess("Ordre des produits mis à jour.");
    } catch (err: any) {
      setProducts(products);
      setError(err.message || "Erreur réorganisation produits");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Chargement de la catégorie...
      </div>
    );
  }

  if (!form || !category) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
        {error || "Catégorie introuvable."}
      </div>
    );
  }

  return (
    <div className="pb-28">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <Link href="/admin/categories" className="mb-2 inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900">
            <ArrowLeft className="mr-2 h-4 w-4" /> Retour aux catégories
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">{category.name}</h1>
          <p className="mt-1 text-sm text-slate-500">Gestion inline de la catégorie, de son SEO et des produits associés.</p>
        </div>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Rafraîchir
        </button>
      </div>

      {(error || success) && (
        <div className={`mb-6 rounded-xl p-4 text-sm ${error ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
          {error || success}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(320px,3fr)]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Informations</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Nom</span>
                <input
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  onBlur={() => !form.slug && updateField("slug", slugify(form.name))}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Slug</span>
                <input
                  value={form.slug}
                  onChange={(event) => updateField("slug", slugify(event.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                />
              </label>
            </div>
            <label className="mt-4 block">
              <span className="text-sm font-medium text-slate-700">Description</span>
              <textarea
                value={form.description}
                onChange={(event) => updateField("description", event.target.value)}
                rows={6}
                className="mt-1 w-full resize-y rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              />
            </label>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Produits</h2>
                <p className="mt-1 text-sm text-slate-500">{products.length} produit{products.length > 1 ? "s" : ""} actuellement associé{products.length > 1 ? "s" : ""}.</p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <Plus className="mr-2 h-4 w-4" /> Ajouter des produits
              </button>
            </div>

            <div className="relative mt-5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Filtrer les produits de cette catégorie..."
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div className="mt-5">
              {filteredProducts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                  Aucun produit dans cette catégorie ne correspond au filtre.
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={filteredProducts.map((product) => product.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                      {filteredProducts.map((product) => (
                        <SortableProductRow
                          key={product.id}
                          product={product}
                          onRemove={removeProduct}
                          removing={removingId === product.id}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Publication</h2>
            <label className="mt-5 flex items-center justify-between rounded-xl border border-slate-200 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Catégorie active</p>
                <p className="text-xs text-slate-500">Contrôle la publication de la fiche catégorie.</p>
              </div>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => updateField("isActive", event.target.checked)}
                className="h-5 w-5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
            </label>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Image</h2>
            <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              {form.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.image} alt={form.name} className="h-44 w-full object-cover" />
              ) : (
                <div className="flex h-44 items-center justify-center text-slate-300">
                  <ImageIcon className="h-10 w-10" />
                </div>
              )}
            </div>
            <label className="mt-4 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-amber-400 hover:bg-amber-50/50">
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Upload image de la catégorie
              <input type="file" accept="image/*" className="hidden" onChange={(event) => uploadImage(event.target.files?.[0])} />
            </label>
            <label className="mt-4 block">
              <span className="text-sm font-medium text-slate-700">URL image</span>
              <input
                value={form.image}
                onChange={(event) => updateField("image", event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              />
            </label>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">SEO</h2>
            <label className="mt-5 block">
              <span className="text-sm font-medium text-slate-700">Meta title</span>
              <input
                value={form.metaTitle}
                onChange={(event) => updateField("metaTitle", event.target.value)}
                maxLength={70}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              />
              <span className="mt-1 block text-xs text-slate-400">{form.metaTitle.length}/70</span>
            </label>
            <label className="mt-4 block">
              <span className="text-sm font-medium text-slate-700">Meta description</span>
              <textarea
                value={form.metaDescription}
                onChange={(event) => updateField("metaDescription", event.target.value)}
                rows={4}
                maxLength={170}
                className="mt-1 w-full resize-y rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              />
              <span className="mt-1 block text-xs text-slate-400">{form.metaDescription.length}/170</span>
            </label>
          </section>
        </aside>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <p className="hidden text-sm text-slate-500 md:block">Les modifications de la fiche catégorie sont enregistrées via ce bouton.</p>
          <button
            type="button"
            onClick={save}
            disabled={saving || uploading}
            className="ml-auto inline-flex items-center rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Enregistrer
          </button>
        </div>
      </div>

      <ProductSelectionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        currentProductIds={currentProductIds}
        onAdd={addProducts}
      />
    </div>
  );
}
