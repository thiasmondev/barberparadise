"use client";
import { useState, useEffect } from "react";
import {
  getProductVariants,
  createProductVariant,
  updateProductVariant,
  deleteProductVariant,
  type ProductVariant,
} from "@/lib/admin-api";
import {
  Plus, Pencil, Trash2, X, Check, ChevronDown, Palette, Ruler, Tag,
  Package, AlertCircle, Loader2,
} from "lucide-react";

const PRESET_COLORS = [
  { name: "Noir", hex: "#1a1a1a" }, { name: "Blanc", hex: "#ffffff" },
  { name: "Gris", hex: "#9ca3af" }, { name: "Argent", hex: "#c0c0c0" },
  { name: "Or", hex: "#d4af37" }, { name: "Rouge", hex: "#ef4444" },
  { name: "Bleu", hex: "#3b82f6" }, { name: "Vert", hex: "#22c55e" },
  { name: "Jaune", hex: "#eab308" }, { name: "Orange", hex: "#f97316" },
  { name: "Violet", hex: "#a855f7" }, { name: "Rose", hex: "#ec4899" },
  { name: "Marron", hex: "#92400e" }, { name: "Beige", hex: "#d4b896" },
  { name: "Transparent", hex: "#e5e7eb" },
];

const PRESET_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "Unique", "30ml", "50ml", "100ml", "150ml", "200ml", "250ml", "500ml", "1L"];

const TYPE_OPTIONS = [
  { value: "color", label: "Couleur", icon: Palette },
  { value: "size", label: "Taille", icon: Ruler },
  { value: "other", label: "Autre", icon: Tag },
];

interface VariantFormData {
  name: string;
  type: string;
  color: string;
  colorHex: string;
  size: string;
  price: string;
  stock: string;
  inStock: boolean;
  sku: string;
  image: string;
}

const emptyForm = (): VariantFormData => ({
  name: "", type: "color", color: "", colorHex: "", size: "",
  price: "", stock: "0", inStock: true, sku: "", image: "",
});

interface VariantManagerProps {
  productId: string;
  productPrice: number;
  onVariantsChange?: (variants: ProductVariant[]) => void;
}

export default function VariantManager({ productId, productPrice, onVariantsChange }: VariantManagerProps) {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VariantFormData>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showSizePicker, setShowSizePicker] = useState(false);

  const load = async () => {
    try {
      const data = await getProductVariants(productId);
      setVariants(data);
      onVariantsChange?.(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [productId]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setError("");
    setShowForm(true);
  };

  const openEdit = (v: ProductVariant) => {
    setEditingId(v.id);
    setForm({
      name: v.name,
      type: v.type,
      color: v.color,
      colorHex: v.colorHex,
      size: v.size,
      price: v.price != null ? String(v.price) : "",
      stock: String(v.stock),
      inStock: v.inStock,
      sku: v.sku,
      image: v.image,
    });
    setError("");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name) { setError("Le nom est requis"); return; }
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name,
        type: form.type,
        color: form.color,
        colorHex: form.colorHex,
        size: form.size,
        price: form.price !== "" ? parseFloat(form.price) : null,
        stock: parseInt(form.stock) || 0,
        inStock: form.inStock,
        sku: form.sku,
        image: form.image,
        order: editingId ? variants.find((v) => v.id === editingId)?.order ?? 0 : variants.length,
      };
      if (editingId) {
        await updateProductVariant(editingId, payload);
      } else {
        await createProductVariant(productId, payload);
      }
      setShowForm(false);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Supprimer la variante "${name}" ?`)) return;
    try {
      await deleteProductVariant(id);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erreur");
    }
  };

  const selectColor = (name: string, hex: string) => {
    setForm((f) => ({ ...f, color: name, colorHex: hex, name: f.name || name }));
    setShowColorPicker(false);
  };

  const selectSize = (size: string) => {
    setForm((f) => ({ ...f, size, name: f.name || size }));
    setShowSizePicker(false);
  };

  const typeIcon = (type: string) => {
    if (type === "color") return <Palette size={13} className="text-violet-500" />;
    if (type === "size") return <Ruler size={13} className="text-blue-500" />;
    return <Tag size={13} className="text-gray-400" />;
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package size={15} className="text-violet-500" />
          <span className="text-sm font-semibold text-dark-700">
            Variantes
            {variants.length > 0 && (
              <span className="ml-1.5 text-xs text-gray-400 font-normal">({variants.length})</span>
            )}
          </span>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg transition-colors"
        >
          <Plus size={13} /> Ajouter une variante
        </button>
      </div>

      {/* Liste des variantes */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
          <Loader2 size={13} className="animate-spin" /> Chargement...
        </div>
      ) : variants.length === 0 ? (
        <div className="text-xs text-gray-400 py-2 border border-dashed border-gray-200 rounded-lg text-center">
          Aucune variante — cliquez sur "Ajouter une variante" pour commencer
        </div>
      ) : (
        <div className="space-y-1.5">
          {variants.map((v) => (
            <div
              key={v.id}
              className="flex items-center gap-3 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg group border border-gray-100"
            >
              {/* Aperçu couleur */}
              {v.type === "color" && v.colorHex && (
                <div
                  className="w-5 h-5 rounded-full border border-gray-200 shrink-0"
                  style={{ backgroundColor: v.colorHex }}
                />
              )}
              {/* Icône type */}
              <div className="shrink-0">{typeIcon(v.type)}</div>

              {/* Infos */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-dark-700">{v.name}</span>
                  {v.size && (
                    <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                      {v.size}
                    </span>
                  )}
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${v.inStock ? "bg-green-50 text-green-700 border-green-100" : "bg-red-50 text-red-600 border-red-100"}`}>
                    {v.inStock ? `En stock (${v.stock})` : "Rupture"}
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {v.price != null ? (
                    <span className="font-medium text-dark-600">{v.price.toFixed(2)} €</span>
                  ) : (
                    <span className="italic">Prix du produit ({productPrice.toFixed(2)} €)</span>
                  )}
                  {v.sku && <span className="ml-2 font-mono">SKU: {v.sku}</span>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={() => openEdit(v)}
                  className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => handleDelete(v.id, v.name)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulaire d'ajout/modification */}
      {showForm && (
        <div className="border border-violet-200 rounded-xl bg-violet-50/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-dark-700">
              {editingId ? "Modifier la variante" : "Nouvelle variante"}
            </span>
            <button onClick={() => setShowForm(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
              <X size={14} />
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle size={13} /> {error}
            </div>
          )}

          {/* Type de variante */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Type de variante</label>
            <div className="flex gap-2">
              {TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setForm((f) => ({ ...f, type: value }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    form.type === value
                      ? "bg-violet-600 text-white border-violet-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-violet-300"
                  }`}
                >
                  <Icon size={12} /> {label}
                </button>
              ))}
            </div>
          </div>

          {/* Couleur (si type color) */}
          {form.type === "color" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Couleur</label>
              <div className="relative">
                <button
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:border-violet-300 text-left"
                >
                  {form.colorHex && (
                    <div className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: form.colorHex }} />
                  )}
                  <span className={form.color ? "text-dark-700" : "text-gray-400"}>
                    {form.color || "Choisir une couleur..."}
                  </span>
                  <ChevronDown size={14} className="ml-auto text-gray-400" />
                </button>
                {showColorPicker && (
                  <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-72">
                    <div className="grid grid-cols-5 gap-2 mb-3">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c.hex}
                          onClick={() => selectColor(c.name, c.hex)}
                          className="flex flex-col items-center gap-1 p-1 rounded-lg hover:bg-gray-50 group"
                          title={c.name}
                        >
                          <div
                            className="w-8 h-8 rounded-full border-2 border-gray-200 group-hover:border-violet-400 transition-colors"
                            style={{ backgroundColor: c.hex }}
                          />
                          <span className="text-xs text-gray-500 truncate w-full text-center">{c.name}</span>
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-gray-100 pt-2">
                      <label className="text-xs text-gray-500 mb-1 block">Couleur personnalisée</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={form.colorHex || "#000000"}
                          onChange={(e) => setForm((f) => ({ ...f, colorHex: e.target.value }))}
                          className="w-10 h-8 rounded border border-gray-200 cursor-pointer"
                        />
                        <input
                          type="text"
                          placeholder="Nom (ex: Bordeaux)"
                          value={form.color}
                          onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-lg"
                        />
                        <button
                          onClick={() => { setShowColorPicker(false); }}
                          className="px-2 py-1 text-xs bg-violet-600 text-white rounded-lg"
                        >
                          <Check size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Taille (si type size) */}
          {form.type === "size" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Taille</label>
              <div className="relative">
                <button
                  onClick={() => setShowSizePicker(!showSizePicker)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:border-violet-300 text-left"
                >
                  <span className={form.size ? "text-dark-700" : "text-gray-400"}>
                    {form.size || "Choisir une taille..."}
                  </span>
                  <ChevronDown size={14} className="ml-auto text-gray-400" />
                </button>
                {showSizePicker && (
                  <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-64">
                    <div className="flex flex-wrap gap-2 mb-3">
                      {PRESET_SIZES.map((s) => (
                        <button
                          key={s}
                          onClick={() => selectSize(s)}
                          className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                            form.size === s
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-gray-100 pt-2">
                      <input
                        type="text"
                        placeholder="Taille personnalisée..."
                        value={form.size}
                        onChange={(e) => setForm((f) => ({ ...f, size: e.target.value, name: f.name || e.target.value }))}
                        className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg"
                        onKeyDown={(e) => { if (e.key === "Enter") setShowSizePicker(false); }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Nom de la variante */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Nom affiché <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={form.type === "color" ? "ex: Rouge carmin" : form.type === "size" ? "ex: Taille L" : "ex: Pack 3 unités"}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>

          {/* Prix et stock */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Prix (€)
                <span className="text-gray-400 font-normal ml-1">— vide = prix du produit</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                placeholder={productPrice.toFixed(2)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Stock</label>
              <input
                type="number"
                min="0"
                value={form.stock}
                onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
            </div>
          </div>

          {/* En stock + SKU */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.inStock}
                onChange={(e) => setForm((f) => ({ ...f, inStock: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-violet-600"
              />
              <span className="text-xs text-gray-600">En stock</span>
            </label>
            <div className="flex-1">
              <input
                type="text"
                value={form.sku}
                onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                placeholder="SKU (optionnel)"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
            </div>
          </div>

          {/* Boutons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {editingId ? "Mettre à jour" : "Créer la variante"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
