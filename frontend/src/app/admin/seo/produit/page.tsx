"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  analyzeSeoProduct,
  optimizeSeoProduct,
  applySeoOptimization,
  getProductsMeta,
  updateProduct,
  type SeoOptimization,
} from "@/lib/admin-api";
import type { Product } from "@/types";
import { parseImages, formatPrice, getDiscount } from "@/lib/utils";
import AutocompleteInput from "@/components/admin/AutocompleteInput";
import {
  ChevronLeft,
  Sparkles,
  Loader2,
  CheckCircle,
  Save,
  RotateCcw,
  AlertCircle,
  Image as ImageIcon,
  Pencil,
  X,
  Plus,
  Eye,
  EyeOff,
  ShoppingCart,
  Truck,
  Star,
  Tag,
  Code2,
  FileText,
} from "lucide-react";

// Chargement dynamique de l'éditeur WYSIWYG (client-side only)
const RichTextEditor = dynamic(
  () => import("@/components/admin/RichTextEditor"),
  { ssr: false, loading: () => <div className="h-48 bg-gray-50 rounded-xl animate-pulse" /> }
);

// ─── Score Ring ──────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 80 ? "#10b981" : score >= 60 ? "#3b82f6" : score >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className="absolute text-lg font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

// ─── Editable Field ───────────────────────────────────────────────────────────
function EditableField({
  label, value, onChange, multiline = false, maxLength, hint,
  badgeColor = "violet",
}: {
  label: string; value: string; onChange: (v: string) => void;
  multiline?: boolean; maxLength?: number; hint?: string;
  badgeColor?: "violet" | "blue" | "emerald" | "amber";
}) {
  const badgeClasses: Record<string, string> = {
    violet: "text-violet-600 bg-violet-50",
    blue: "text-blue-600 bg-blue-50",
    emerald: "text-emerald-600 bg-emerald-50",
    amber: "text-amber-600 bg-amber-50",
  };
  const lengthColor = maxLength
    ? value.length > maxLength ? "text-red-500" : value.length >= maxLength * 0.8 ? "text-amber-500" : "text-gray-400"
    : "text-gray-400";
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${badgeClasses[badgeColor]}`}>{label}</span>
        <span className={`text-xs font-mono ${lengthColor}`}>
          {value.length} car.{maxLength ? ` / ${maxLength}` : ""}
        </span>
        <Pencil size={11} className="text-gray-300 ml-auto" />
      </div>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3}
          className="w-full text-sm text-gray-800 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-y" />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full text-sm text-gray-800 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300" />
      )}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

// ─── Tags Editor ──────────────────────────────────────────────────────────────
function TagsEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [newTag, setNewTag] = useState("");
  const addTag = () => {
    const t = newTag.trim().toLowerCase();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setNewTag("");
  };
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">TAGS / MOTS-CLÉS</span>
        <span className="text-xs text-gray-400">{tags.length} tag(s)</span>
        <Tag size={11} className="text-gray-300 ml-auto" />
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
            {tag}
            <button onClick={() => onChange(tags.filter((t) => t !== tag))} className="text-gray-400 hover:text-red-500">
              <X size={9} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input type="text" value={newTag} onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
          placeholder="Ajouter un tag..."
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-300" />
        <button onClick={addTag}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-medium hover:bg-amber-100">
          <Plus size={12} /> Ajouter
        </button>
      </div>
    </div>
  );
}

// ─── Product Preview (simule la fiche produit publique) ───────────────────────
function ProductPreview({
  product, title, metaDescription, description, tags, category, subcategory,
}: {
  product: Product; title: string; metaDescription: string;
  description: string; tags: string[]; category: string; subcategory: string;
}) {
  const images = parseImages(product.images);
  const discount = getDiscount(product.price, product.originalPrice);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm text-sm">
      {/* Browser chrome */}
      <div className="bg-gray-900 text-white px-4 py-2 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <div className="flex-1 bg-gray-700 rounded-md px-3 py-0.5 text-xs text-gray-300 truncate">
          barberparadise.fr/produit/{(product as any).slug}
        </div>
      </div>

      {/* Page content */}
      <div className="p-4 max-h-[calc(100vh-280px)] overflow-y-auto">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-xs text-gray-400 mb-4 flex-wrap">
          <span className="hover:text-violet-600 cursor-pointer">Accueil</span>
          <span>/</span>
          <span className="hover:text-violet-600 cursor-pointer">Catalogue</span>
          <span>/</span>
          <span className="hover:text-violet-600 cursor-pointer">{category || product.category}</span>
          {subcategory && (
            <>
              <span>/</span>
              <span className="hover:text-violet-600 cursor-pointer">{subcategory}</span>
            </>
          )}
          <span>/</span>
          <span className="text-gray-700 font-medium truncate">{title || product.name}</span>
        </nav>

        <div className="grid grid-cols-2 gap-4">
          {/* Image */}
          <div className="aspect-square bg-gray-50 rounded-xl overflow-hidden relative">
            {images[0] ? (
              <Image src={images[0]} alt={title || product.name} fill className="object-contain p-3" sizes="200px" />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-300 text-xs">Pas d&apos;image</div>
            )}
            <div className="absolute top-2 left-2 flex flex-col gap-1">
              {product.isNew && <span className="bg-violet-600 text-white text-xs font-bold px-2 py-0.5 rounded">NOUVEAU</span>}
              {discount && <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded">-{discount}%</span>}
            </div>
          </div>

          {/* Info */}
          <div className="space-y-2">
            <p className="text-xs text-gray-400 uppercase tracking-wide">{product.brand}</p>
            <h1 className="font-bold text-gray-900 leading-tight text-base">{title || product.name}</h1>

            {product.rating > 0 && (
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map((s) => (
                  <Star key={s} size={10} className={s <= Math.round(product.rating) ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-200"} />
                ))}
                <span className="text-xs text-gray-400">({product.reviewCount})</span>
              </div>
            )}

            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-gray-900">{formatPrice(product.price)}</span>
              {product.originalPrice && product.originalPrice > product.price && (
                <span className="text-sm text-gray-400 line-through">{formatPrice(product.originalPrice)}</span>
              )}
            </div>

            {metaDescription && (
              <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">{metaDescription}</p>
            )}

            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${product.inStock ? "bg-green-500" : "bg-red-500"}`} />
              <span className={`text-xs font-medium ${product.inStock ? "text-green-600" : "text-red-600"}`}>
                {product.inStock ? "En stock" : "Rupture de stock"}
              </span>
            </div>

            <button className="w-full flex items-center justify-center gap-1.5 py-2 bg-violet-600 text-white rounded-lg text-xs font-medium">
              <ShoppingCart size={12} />
              Ajouter au panier
            </button>

            <div className="bg-gray-50 rounded-lg p-2 flex items-center gap-2">
              <Truck size={12} className="text-violet-600 shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-700">Livraison gratuite dès 49€</p>
                <p className="text-xs text-gray-400">Expédition sous 24-48h</p>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        {description && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm mb-2">Description</h2>
            <div
              className="prose prose-xs max-w-none text-gray-600 leading-relaxed
                [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-gray-800 [&_h2]:mt-3 [&_h2]:mb-1
                [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:text-gray-700 [&_h3]:mt-2 [&_h3]:mb-1
                [&_ul]:pl-4 [&_ul]:space-y-0.5 [&_li]:text-xs
                [&_strong]:font-semibold [&_strong]:text-gray-800
                [&_p]:text-xs [&_p]:mb-1.5"
              dangerouslySetInnerHTML={{ __html: description }}
            />
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">{tag}</span>
              ))}
            </div>
          </div>
        )}

        {/* Google Preview */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Aperçu Google</p>
          <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
            <p className="text-blue-700 text-sm font-medium hover:underline cursor-pointer truncate">
              {title || product.name}
            </p>
            <p className="text-xs text-emerald-700">barberparadise.fr › produit › {(product as any).slug}</p>
            <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
              {metaDescription || "Meta description non définie"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SeoProductPage() {
  const searchParams = useSearchParams();
  const productId = searchParams.get("id");

  const [product, setProduct] = useState<Product | null>(null);
  const [score, setScore] = useState(0);
  const [details, setDetails] = useState<{ criterion: string; score: number; max: number; tip: string }[]>([]);
  const [optimization, setOptimization] = useState<SeoOptimization | null>(null);

  // Champs éditables SEO
  const [editTitle, setEditTitle] = useState("");
  const [editMeta, setEditMeta] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);

  // Champs éditables produit
  const [editCategory, setEditCategory] = useState("");
  const [editSubcategory, setEditSubcategory] = useState("");

  // Autocomplétion
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [allSubcategories, setAllSubcategories] = useState<string[]>([]);

  // Éditeur description : mode WYSIWYG ou HTML brut
  const [htmlMode, setHtmlMode] = useState(false);

  // UI state
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(true);

  // Charger les métadonnées pour l'autocomplétion
  useEffect(() => {
    getProductsMeta()
      .then((meta) => {
        setAllCategories(meta.categories);
        setAllSubcategories(meta.subcategories);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    analyzeSeoProduct(productId)
      .then((data) => {
        setProduct(data.product);
        setScore(data.score);
        setDetails(data.details);
        setEditTitle(data.product.name || "");
        setEditMeta((data.product as any).metaDescription || "");
        setEditDescription(data.product.description || "");
        setEditCategory(data.product.category || "");
        setEditSubcategory(data.product.subcategory || "");
        setEditTags(
          Array.isArray(data.product.tags)
            ? data.product.tags
            : typeof data.product.tags === "string" && data.product.tags
            ? (data.product.tags as string).split(",").map((t: string) => t.trim()).filter(Boolean)
            : []
        );
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [productId]);

  // Sync champs éditables quand l'IA génère
  useEffect(() => {
    if (optimization) {
      setEditTitle(optimization.optimizedTitle);
      setEditMeta(optimization.metaDescription);
      setEditDescription(optimization.seoDescription);
      setEditTags(optimization.suggestedTags);
    }
  }, [optimization]);

  const handleOptimize = async () => {
    if (!productId) return;
    setOptimizing(true);
    setError("");
    setApplied(false);
    try {
      const data = await optimizeSeoProduct(productId);
      setOptimization(data.optimization);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setOptimizing(false);
    }
  };

  const handleApply = async () => {
    if (!productId || !product) return;
    setApplying(true);
    setError("");
    try {
      // Appliquer l'optimisation SEO (titre, meta, description, tags)
      await applySeoOptimization(productId, {
        optimizedTitle: editTitle,
        metaDescription: editMeta,
        seoDescription: editDescription,
        suggestedTags: editTags,
      });
      // Sauvegarder aussi catégorie et sous-catégorie si modifiées
      if (editCategory !== product.category || editSubcategory !== product.subcategory) {
        await updateProduct(productId, {
          category: editCategory,
          subcategory: editSubcategory,
        });
      }
      setApplied(true);
      const data = await analyzeSeoProduct(productId);
      setProduct(data.product);
      setScore(data.score);
      setDetails(data.details);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setApplying(false);
    }
  };

  const handleReset = () => {
    if (optimization) {
      setEditTitle(optimization.optimizedTitle);
      setEditMeta(optimization.metaDescription);
      setEditDescription(optimization.seoDescription);
      setEditTags(optimization.suggestedTags);
    }
    setApplied(false);
  };

  if (!productId) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-700">
        Aucun produit sélectionné.{" "}
        <Link href="/admin/seo" className="underline">Retour à la liste</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-violet-500" />
      </div>
    );
  }

  if (error && !product) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
        <p className="font-medium">Erreur</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/admin/seo" className="text-gray-400 hover:text-gray-600">
          <ChevronLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">{product?.name}</h1>
          <p className="text-sm text-gray-500">{product?.brand} · {editCategory || product?.category}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showPreview
                ? "bg-violet-50 text-violet-700 border-violet-200"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {showPreview ? <Eye size={13} /> : <EyeOff size={13} />}
            Aperçu live
          </button>
          <ScoreRing score={score} size={56} />
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle size={15} /> {error}
        </div>
      )}
      {applied && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-700 text-sm flex items-center gap-2">
          <CheckCircle size={15} /> Optimisations appliquées avec succès !
        </div>
      )}

      {/* Layout principal : éditeur + aperçu */}
      <div className={`grid gap-4 ${showPreview ? "xl:grid-cols-[1fr_400px]" : "grid-cols-1"}`}>

        {/* ── Colonne gauche : éditeur ── */}
        <div className="space-y-4 min-w-0">

          {/* Analyse SEO actuelle */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h2 className="font-semibold text-gray-900 mb-3 text-sm">Analyse SEO actuelle</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {details.map((d) => {
                const pct = d.max > 0 ? (d.score / d.max) * 100 : 0;
                const color = pct >= 80 ? "text-emerald-600" : pct >= 60 ? "text-blue-600" : pct >= 40 ? "text-amber-600" : "text-red-600";
                const bg = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-blue-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
                return (
                  <div key={d.criterion} className="border border-gray-100 rounded-lg p-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-gray-700 truncate">{d.criterion}</span>
                      <span className={`text-xs font-bold ${color} shrink-0 ml-1`}>{d.score}/{d.max}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1.5">
                      <div className={`h-full ${bg} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-gray-400 leading-tight">{d.tip}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Catégorie + Sous-catégorie */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">CATÉGORIE & SOUS-CATÉGORIE</span>
              <span className="text-xs text-gray-400">Modifiables directement</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Catégorie</label>
                <AutocompleteInput
                  value={editCategory}
                  onChange={(v) => { setEditCategory(v); setApplied(false); }}
                  suggestions={allCategories}
                  placeholder="ex: tondeuses"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Sous-catégorie</label>
                <AutocompleteInput
                  value={editSubcategory}
                  onChange={(v) => { setEditSubcategory(v); setApplied(false); }}
                  suggestions={allSubcategories}
                  placeholder="ex: accessoires-tondeuses"
                />
              </div>
            </div>
          </div>

          {/* Bouton générer IA */}
          {!optimization && (
            <div className="flex justify-center py-2">
              <button onClick={handleOptimize} disabled={optimizing}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-medium hover:from-violet-700 hover:to-purple-700 transition-all shadow-lg shadow-violet-200 disabled:opacity-50">
                {optimizing ? <><Loader2 size={18} className="animate-spin" />Analyse IA en cours...</> : <><Sparkles size={18} />Générer l&apos;optimisation IA</>}
              </button>
            </div>
          )}

          {/* Zone d'édition */}
          {(optimization || true) && (
            <div className="space-y-3">
              {/* Barre d'actions */}
              {optimization && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles size={15} className="text-violet-500" />
                    <span className="font-semibold text-gray-900 text-sm">Contenu généré par l&apos;IA</span>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Modifiable</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={handleReset}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">
                      <RotateCcw size={12} /> Réinitialiser
                    </button>
                    <button onClick={() => { setOptimization(null); setApplied(false); }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">
                      <Sparkles size={12} /> Régénérer
                    </button>
                    <button onClick={handleApply} disabled={applying || applied}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50">
                      {applying ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      {applied ? "Appliqué ✓" : "Appliquer"}
                    </button>
                  </div>
                </div>
              )}

              {/* Avertissement IA */}
              {optimization && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-800 text-xs flex items-start gap-2">
                  <AlertCircle size={13} className="mt-0.5 shrink-0" />
                  <span><strong>Vérifiez le contenu</strong> avant d&apos;appliquer — l&apos;IA peut inventer des caractéristiques produit.</span>
                </div>
              )}

              {/* Titre */}
              <EditableField label="TITRE" value={editTitle} onChange={(v) => { setEditTitle(v); setApplied(false); }}
                maxLength={60} hint="50-60 caractères recommandés. Incluez le nom exact du produit et la marque."
                badgeColor="violet" />

              {/* Meta description */}
              <EditableField label="META DESCRIPTION" value={editMeta} onChange={(v) => { setEditMeta(v); setApplied(false); }}
                multiline maxLength={155} hint="120-155 caractères. Décrivez le produit avec précision."
                badgeColor="blue" />

              {/* Tags */}
              <TagsEditor tags={editTags} onChange={(t) => { setEditTags(t); setApplied(false); }} />

              {/* Description : WYSIWYG ou HTML brut */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">DESCRIPTION SEO</span>
                  <span className="text-xs text-gray-400">
                    {editDescription.replace(/<[^>]+>/g, "").length} car.
                    {" · "}
                    {editDescription.replace(/<[^>]+>/g, "").trim().split(/\s+/).filter(Boolean).length} mots
                  </span>
                  {/* Bouton bascule HTML / WYSIWYG */}
                  <button
                    onClick={() => setHtmlMode(!htmlMode)}
                    title={htmlMode ? "Passer en éditeur visuel" : "Voir / éditer le code HTML"}
                    className={`ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      htmlMode
                        ? "bg-gray-800 text-white border-gray-700"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {htmlMode ? <FileText size={12} /> : <Code2 size={12} />}
                    {htmlMode ? "Éditeur visuel" : "Code HTML"}
                  </button>
                </div>

                {htmlMode ? (
                  /* Mode HTML brut */
                  <div>
                    <textarea
                      value={editDescription}
                      onChange={(e) => { setEditDescription(e.target.value); setApplied(false); }}
                      rows={14}
                      spellCheck={false}
                      className="w-full font-mono text-xs text-gray-800 bg-gray-950 text-green-400 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y leading-relaxed"
                      placeholder="<h2>Titre de section</h2>&#10;<p>Description du produit...</p>"
                    />
                    <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                      <Code2 size={11} />
                      Mode HTML brut — les balises sont interprétées dans l&apos;aperçu live
                    </p>
                  </div>
                ) : (
                  /* Mode WYSIWYG */
                  <div>
                    <RichTextEditor
                      value={editDescription}
                      onChange={(v) => { setEditDescription(v); setApplied(false); }}
                      placeholder="Rédigez une description riche et structurée pour ce produit..."
                    />
                    <p className="text-xs text-gray-400 mt-2">
                      Utilisez H2/H3 pour structurer, les listes à puces pour les caractéristiques, et le gras pour les mots-clés importants.
                    </p>
                  </div>
                )}
              </div>

              {/* Image alts */}
              {optimization?.imageAlts && optimization.imageAlts.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ImageIcon size={14} className="text-gray-400" />
                    <span className="text-xs font-semibold text-gray-600">TEXTES ALT DES IMAGES</span>
                  </div>
                  <div className="space-y-1.5">
                    {optimization.imageAlts.map((alt, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-xs text-gray-400 mt-0.5 shrink-0">Image {i + 1}:</span>
                        <span className="text-sm text-gray-700">{alt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions IA */}
              {optimization?.suggestions && optimization.suggestions.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">SUGGESTIONS IA</span>
                  <ul className="mt-2 space-y-1.5">
                    {optimization.suggestions.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-violet-500 mt-0.5 shrink-0">•</span>{s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Score estimé */}
              {optimization && (
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex items-center gap-4">
                  <ScoreRing score={optimization.seoScore} size={56} />
                  <div>
                    <p className="font-medium text-violet-900 text-sm">Score SEO estimé après optimisation</p>
                    <p className="text-sm text-violet-600">Gain estimé : +{Math.max(0, optimization.seoScore - score)} points</p>
                  </div>
                </div>
              )}

              {/* Bouton appliquer bas de page */}
              <div className="flex justify-end pb-4">
                <button onClick={handleApply} disabled={applying || applied}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 shadow-lg shadow-emerald-200">
                  {applying ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  {applied ? "Modifications appliquées ✓" : "Appliquer les modifications"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Colonne droite : aperçu live ── */}
        {showPreview && product && (
          <div className="xl:sticky xl:top-4 xl:self-start space-y-2">
            <div className="flex items-center gap-2 px-1">
              <Eye size={14} className="text-violet-500" />
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Aperçu en temps réel</span>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full ml-auto">Se met à jour en direct</span>
            </div>
            <ProductPreview
              product={product}
              title={editTitle}
              metaDescription={editMeta}
              description={editDescription}
              tags={editTags}
              category={editCategory}
              subcategory={editSubcategory}
            />
          </div>
        )}
      </div>
    </div>
  );
}
