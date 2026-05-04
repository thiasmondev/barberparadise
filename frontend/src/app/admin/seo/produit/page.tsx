"use client";

import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  analyzeSeoProduct,
  optimizeSeoProduct,
  applySeoOptimization,
  getProductsMeta,
  updateProduct,
  optimizeProductGeo,
  applyGeoOptimization,
  enrichProductGeo,
  applyGeoEnrichedContent,
  generateImageAltsSeo,
  saveImageAltsSeo,
  bulkGenerateImageAlts,
  generateProductDraftFromUrl,
  createProductFromUrlDraft,
  getAdminProducts,
  type SeoOptimization,
  type GeoOptimization,
  type GeoEnrichedContent,
  type CategorySuggestion,
  type ProductUrlDraft,
} from "@/lib/admin-api";
import type { Product } from "@/types";
import { parseImages, formatPrice, getDiscount } from "@/lib/utils";
import AutocompleteInput from "@/components/admin/AutocompleteInput";
import ImageManager from "@/components/admin/ImageManager";
import VariantManager from "@/components/admin/VariantManager";
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
  Globe,
  HelpCircle,
  Braces,
  TrendingUp,
  Copy,
  ChevronDown,
  ChevronUp,
  Mic,
  Shield,
  Search,
  BarChart2,
  Users,
  BookOpen,
  Zap,
} from "lucide-react";

// Chargement dynamique de l'éditeur WYSIWYG (client-side only)
const RichTextEditor = dynamic(
  () => import("@/components/admin/RichTextEditor"),
  { ssr: false, loading: () => <div className="h-48 bg-gray-50 rounded-xl animate-pulse" /> }
);

type PublicationStatus = "active" | "draft" | "archived" | "inactive" | string;

function getPublicationStatusMeta(status: PublicationStatus | undefined) {
  if (status === "active") return { label: "Actif", availability: "Disponible en ligne", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" };
  if (status === "draft") return { label: "Brouillon", availability: "Non disponible en ligne", badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" };
  if (status === "archived") return { label: "Archivé", availability: "Retiré du catalogue", badge: "bg-gray-100 text-gray-600 border-gray-200", dot: "bg-gray-400" };
  return { label: "Inactif", availability: "Non disponible en ligne", badge: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" };
}

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

//// ─── Product Preview (simule la fiche produit publique) ────────────────────
function ProductPreview({
  product, title, metaDescription, description, tags, category, subcategory, images: editImages, publicationStatus,
}: {
  product: Product; title: string; metaDescription: string;
  description: string; tags: string[]; category: string; subcategory: string; images: string[]; publicationStatus: string;
}) {
  const images = editImages.length > 0 ? editImages : parseImages(product.images);
  const discount = getDiscount(product.price, product.originalPrice);
  const publication = getPublicationStatusMeta(publicationStatus);

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
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-gray-400 uppercase tracking-wide">{product.brand}</p>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${publication.badge}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${publication.dot}`} />
                {publication.label}
              </span>
            </div>
            <h1 className="font-bold text-gray-900 leading-tight text-base">{title || product.name}</h1>
            <p className="text-[11px] text-gray-500">Disponibilité SEO : {publication.availability}</p>

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
                <p className="text-xs font-medium text-gray-700">
                  {product.priceProEur ? "Livraison gratuite dès 500€ HT" : "Livraison gratuite dès 49€"}
                </p>
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
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Chargement...</div>}>
      <SeoProductPageContent />
    </Suspense>
  );
}

function SeoProductPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
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
  const [editSubsubcategory, setEditSubsubcategory] = useState("");
  const [editImages, setEditImages] = useState<string[]>([]);
  const [editImageAlts, setEditImageAlts] = useState<string[]>([]);
  const [editWeightG, setEditWeightG] = useState("");
  const [editLengthCm, setEditLengthCm] = useState("");
  const [editWidthCm, setEditWidthCm] = useState("");
  const [editHeightCm, setEditHeightCm] = useState("");
  const [editIsFragile, setEditIsFragile] = useState(false);
  const [editIsLiquid, setEditIsLiquid] = useState(false);
  const [editIsAerosol, setEditIsAerosol] = useState(false);
  const [editRequiresGlass, setEditRequiresGlass] = useState(false);
  const [editLogisticNote, setEditLogisticNote] = useState("");
  const [editPriceProEur, setEditPriceProEur] = useState("");
  const [editStatus, setEditStatus] = useState("active");

  // Autocomplétion (suggestions enrichies avec labels hiérarchiques)
  const [allCategories, setAllCategories] = useState<CategorySuggestion[]>([]);
  const [allSubcategories, setAllSubcategories] = useState<CategorySuggestion[]>([]);
  const [level2ByParent, setLevel2ByParent] = useState<Record<string, { slug: string; label: string }[]>>({});
  const [level3ByParent, setLevel3ByParent] = useState<Record<string, { slug: string; label: string }[]>>({});

  // Éditeur description : mode WYSIWYG ou HTML brut
  const [htmlMode, setHtmlMode] = useState(false);

  // Alt texts SEO state
  const [generatingAlts, setGeneratingAlts] = useState(false);
  const [altsSaved, setAltsSaved] = useState(false);
  const [altsError, setAltsError] = useState("");
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ processed: number; total: number; remaining: number; message: string } | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [isNewSaving, setIsNewSaving] = useState(false);
  const [isNewSaved, setIsNewSaved] = useState(false);
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(true);
  // Onglet actif : "seo" ou "geo"
  const [activeTab, setActiveTab] = useState<"seo" | "geo">("seo");
  // GEO state
  const [geoOptimization, setGeoOptimization] = useState<GeoOptimization | null>(null);
  const [geoOptimizing, setGeoOptimizing] = useState(false);
  const [geoApplying, setGeoApplying] = useState(false);
  const [geoApplied, setGeoApplied] = useState(false);
  const [editFaqItems, setEditFaqItems] = useState<{ question: string; answer: string }[]>([]);
  const [editSchemaJsonLd, setEditSchemaJsonLd] = useState("");
  const [editDirectAnswer, setEditDirectAnswer] = useState("");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [schemaCopied, setSchemaCopied] = useState(false);
  // GEO enrichi state
  const [geoEnriched, setGeoEnriched] = useState<GeoEnrichedContent | null>(null);
  const [geoEnriching, setGeoEnriching] = useState(false);
  const [geoEnrichApplying, setGeoEnrichApplying] = useState(false);
  const [geoEnrichApplied, setGeoEnrichApplied] = useState(false);
  const [editVoiceSnippet, setEditVoiceSnippet] = useState("");
  const [editEeaatContent, setEditEeaatContent] = useState("");
  const [editLongTailQuestions, setEditLongTailQuestions] = useState<{ question: string; answer: string; intent: string }[]>([]);
  const [editCompetitorComparison, setEditCompetitorComparison] = useState<{ feature: string; ourProduct: string; competitor1: string; competitor2: string }[]>([]);
  const [editUseCases, setEditUseCases] = useState<{ profile: string; useCase: string; benefit: string }[]>([]);
  const [editBuyingGuideSnippet, setEditBuyingGuideSnippet] = useState("");
  const [editEntityKeywords, setEditEntityKeywords] = useState<string[]>([]);
  const [geoSubTab, setGeoSubTab] = useState<"base" | "enrichi">("base");


  // Création d’un nouveau produit depuis URL de marque
  const [sourceUrl, setSourceUrl] = useState("");
  const [urlDraft, setUrlDraft] = useState<ProductUrlDraft | null>(null);
  const [urlGenerating, setUrlGenerating] = useState(false);
  const [urlCreating, setUrlCreating] = useState(false);
  const [urlSuccess, setUrlSuccess] = useState("");

  // Recherche d’un produit existant dans l’agent SEO
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [productSearchResults, setProductSearchResults] = useState<Product[]>([]);
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [productSearchError, setProductSearchError] = useState("");

  // Charger les métadonnées pour l'autocomplétion
  useEffect(() => {
    getProductsMeta()
      .then((meta) => {
        // Utiliser les listes enrichies si disponibles, sinon fallback sur les slugs simples
        setAllCategories(
          meta.categoriesWithLabels?.length
            ? meta.categoriesWithLabels
            : meta.categories.map((s) => ({ slug: s, label: s }))
        );
        setAllSubcategories(
          meta.subcategoriesWithLabels?.length
            ? meta.subcategoriesWithLabels
            : meta.subcategories.map((s) => ({ slug: s, label: s }))
        );
        setLevel2ByParent(meta.level2ByParent || {});
        setLevel3ByParent(meta.level3ByParent || {});
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
        setEditSubsubcategory((data.product as any).subsubcategory || "");
        setEditImages(parseImages(data.product.images));
        setEditImageAlts(JSON.parse((data.product as any).imageAlts || "[]"));
        setEditWeightG(data.product.weightG != null ? String(data.product.weightG) : "");
        setEditLengthCm(data.product.lengthCm != null ? String(data.product.lengthCm) : "");
        setEditWidthCm(data.product.widthCm != null ? String(data.product.widthCm) : "");
        setEditHeightCm(data.product.heightCm != null ? String(data.product.heightCm) : "");
        setEditIsFragile(Boolean(data.product.isFragile));
        setEditIsLiquid(Boolean(data.product.isLiquid));
        setEditIsAerosol(Boolean(data.product.isAerosol));
        setEditRequiresGlass(Boolean(data.product.requiresGlass));
        setEditLogisticNote(data.product.logisticNote || "");
        setEditPriceProEur(data.product.priceProEur != null ? String(data.product.priceProEur) : "");
        setEditStatus(data.product.status || "active");
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

  useEffect(() => {
    const query = productSearchTerm.trim();
    if (query.length < 2) {
      setProductSearchResults([]);
      setProductSearchLoading(false);
      setProductSearchError("");
      return;
    }

    let cancelled = false;
    setProductSearchLoading(true);
    setProductSearchError("");
    const timer = setTimeout(() => {
      getAdminProducts({ search: query, limit: 8 })
        .then((data) => {
          if (!cancelled) setProductSearchResults(data.products);
        })
        .catch((err: any) => {
          if (!cancelled) {
            setProductSearchResults([]);
            setProductSearchError(err.message || "Impossible de rechercher les produits.");
          }
        })
        .finally(() => {
          if (!cancelled) setProductSearchLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [productSearchTerm]);

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
      // Sauvegarder aussi les données produit modifiables hors SEO, dont la logistique.
      await updateProduct(productId, {
        category: editCategory,
        subcategory: editSubcategory,
        subsubcategory: editSubsubcategory,
        weightG: editWeightG,
        lengthCm: editLengthCm,
        widthCm: editWidthCm,
        heightCm: editHeightCm,
        isFragile: editIsFragile,
        isLiquid: editIsLiquid,
        isAerosol: editIsAerosol,
        requiresGlass: editRequiresGlass,
        logisticNote: editLogisticNote,
        priceProEur: editPriceProEur.trim() === "" ? null : Number(editPriceProEur),
        status: editStatus,
      });
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

  const handleToggleIsNew = async () => {
    if (!productId || !product || isNewSaving) return;
    const previous = Boolean(product.isNew);
    const next = !previous;
    setIsNewSaving(true);
    setIsNewSaved(false);
    setError("");
    setProduct({ ...product, isNew: next });
    try {
      const updated = await updateProduct(productId, { isNew: next });
      setProduct((current) => current ? { ...current, isNew: updated.isNew } : updated);
      setIsNewSaved(true);
      setTimeout(() => setIsNewSaved(false), 2000);
    } catch (err: any) {
      setProduct({ ...product, isNew: previous });
      setError(err.message || "Erreur lors de la mise à jour du statut Nouveauté");
    } finally {
      setIsNewSaving(false);
    }
  };

  const handleGenerateProductFromUrl = async () => {
    const cleanUrl = sourceUrl.trim();
    if (!cleanUrl) {
      setError("Colle l’URL de la fiche produit de la marque avant de lancer la création.");
      return;
    }

    setUrlGenerating(true);
    setUrlSuccess("");
    setError("");
    try {
      const data = await generateProductDraftFromUrl(cleanUrl);
      setUrlDraft(data.draft);
    } catch (err: any) {
      setError(err.message || "Impossible de générer la fiche produit depuis cette URL.");
    } finally {
      setUrlGenerating(false);
    }
  };

  const handleCreateProductFromUrlDraft = async () => {
    if (!urlDraft) return;
    setUrlCreating(true);
    setUrlSuccess("");
    setError("");
    try {
      const data = await createProductFromUrlDraft(urlDraft);
      setUrlSuccess(`Brouillon créé : ${data.product.name}`);
      router.push(`/admin/seo/produit?id=${data.product.id}`);
    } catch (err: any) {
      setError(err.message || "Impossible de créer le brouillon produit.");
    } finally {
      setUrlCreating(false);
    }
  };

  // ─── GEO Handlers ────────────────────────────────────────────
  const handleGeoOptimize = async () => {
    if (!productId) return;
    setGeoOptimizing(true);
    setError("");
    setGeoApplied(false);
    try {
      const data = await optimizeProductGeo(productId);
      setGeoOptimization(data.geoOptimization);
      setEditFaqItems(data.geoOptimization.faqItems || []);
      setEditSchemaJsonLd(data.geoOptimization.schemaJsonLd || "");
      setEditDirectAnswer(data.geoOptimization.directAnswerIntro || "");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGeoOptimizing(false);
    }
  };

  const handleGeoApply = async () => {
    if (!productId) return;
    setGeoApplying(true);
    setError("");
    try {
      await applyGeoOptimization(productId, {
        schemaJsonLd: editSchemaJsonLd,
        faqItems: editFaqItems,
        directAnswerIntro: editDirectAnswer,
      });
      setGeoApplied(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGeoApplying(false);
    }
  };

  const handleCopySchema = () => {
    navigator.clipboard.writeText(editSchemaJsonLd);
    setSchemaCopied(true);
    setTimeout(() => setSchemaCopied(false), 2000);
  };

  // ─── GEO Enrichi Handlers ────────────────────────────────────
  const handleGeoEnrich = async () => {
    if (!productId) return;
    setGeoEnriching(true);
    setError("");
    setGeoEnrichApplied(false);
    try {
      const data = await enrichProductGeo(productId);
      setGeoEnriched(data.enriched);
      setEditVoiceSnippet(data.enriched.voiceSnippet || "");
      setEditEeaatContent(data.enriched.eeaatContent || "");
      setEditLongTailQuestions(data.enriched.longTailQuestions || []);
      setEditCompetitorComparison(data.enriched.competitorComparison || []);
      setEditUseCases(data.enriched.useCases || []);
      setEditBuyingGuideSnippet(data.enriched.buyingGuideSnippet || "");
      setEditEntityKeywords(data.enriched.entityKeywords || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGeoEnriching(false);
    }
  };

  const handleGeoEnrichApply = async () => {
    if (!productId) return;
    setGeoEnrichApplying(true);
    setError("");
    try {
      await applyGeoEnrichedContent(productId, {
        voiceSnippet: editVoiceSnippet,
        eeaatContent: editEeaatContent,
        longTailQuestions: editLongTailQuestions,
        competitorComparison: editCompetitorComparison,
        useCases: editUseCases,
        buyingGuideSnippet: editBuyingGuideSnippet,
        entityKeywords: editEntityKeywords,
      });
      setGeoEnrichApplied(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGeoEnrichApplying(false);
    }
  };

  if (!productId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/admin/seo" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-violet-600 mb-3">
              <ChevronLeft size={16} /> Retour à l’agent SEO
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="text-violet-500" size={26} /> Agent SEO produit
            </h1>
            <p className="text-sm text-gray-500 mt-1 max-w-3xl">
              Recherche un produit existant pour l’optimiser, ou colle l’URL officielle d’une fiche produit de marque pour générer un nouveau brouillon SEO/GEO à valider avant publication.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Produit existant</p>
              <h2 className="text-lg font-bold text-gray-900 mt-1">Rechercher un produit à optimiser</h2>
              <p className="text-sm text-gray-500 mt-1">Recherche par nom, slug, marque ou catégorie, puis ouvre directement la fiche dans l’agent SEO.</p>
            </div>
            <Search className="text-violet-400" size={22} />
          </div>
          <div className="relative">
            <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={productSearchTerm}
              onChange={(e) => { setProductSearchTerm(e.target.value); setProductSearchOpen(true); }}
              onFocus={() => setProductSearchOpen(true)}
              placeholder="Ex : tondeuse, babyliss, haircut-ciseaux, capes..."
              className="w-full border border-gray-200 rounded-xl pl-11 pr-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
            {productSearchLoading && <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-violet-500 animate-spin" />}

            {productSearchOpen && productSearchTerm.trim().length >= 2 && (
              <div className="absolute z-20 mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-80 overflow-y-auto">
                {productSearchError ? (
                  <div className="px-4 py-3 text-sm text-red-600">{productSearchError}</div>
                ) : productSearchResults.length > 0 ? (
                  productSearchResults.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => router.push(`/admin/seo/produit?id=${p.id}`)}
                      className="w-full px-4 py-3 text-left hover:bg-violet-50 border-b border-gray-100 last:border-b-0 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                          <p className="text-xs text-gray-500 truncate">/{(p as any).slug || p.handle} · {(p as any).brand || "Sans marque"}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="inline-flex px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[11px] font-medium">{(p as any).status || "—"}</span>
                          <p className="text-xs text-gray-400 mt-1 truncate max-w-36">{p.category || "Sans catégorie"}</p>
                        </div>
                      </div>
                    </button>
                  ))
                ) : productSearchLoading ? (
                  <div className="px-4 py-3 text-sm text-gray-500">Recherche en cours...</div>
                ) : (
                  <div className="px-4 py-3 text-sm text-gray-500">Aucun produit trouvé.</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <label className="block text-sm font-semibold text-gray-800 mb-2">Créer un nouveau produit depuis une URL de fiche produit source</label>
          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://marque.com/products/tondeuse-professionnelle"
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
            <button
              onClick={handleGenerateProductFromUrl}
              disabled={urlGenerating}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-60"
            >
              {urlGenerating ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
              {urlGenerating ? "Analyse en cours..." : "Générer la fiche"}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Le résultat reste un brouillon : vérifie toujours le prix, le stock, les droits d’utilisation des images importées et les caractéristiques techniques avant publication.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            <AlertCircle size={16} className="inline mr-2" /> {error}
          </div>
        )}

        {urlSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-700 text-sm">
            <CheckCircle size={16} className="inline mr-2" /> {urlSuccess}
          </div>
        )}

        {urlDraft && (
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Brouillon généré depuis {urlDraft.sourceDomain}</p>
                  <h2 className="text-xl font-bold text-gray-900 mt-1">{urlDraft.name}</h2>
                  <p className="text-sm text-gray-500 mt-1">{urlDraft.shortDescription}</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200">Brouillon</span>
              </div>

              <div className="grid md:grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded-xl p-3"><span className="text-gray-400">Marque</span><p className="font-semibold text-gray-900">{urlDraft.brand || "À compléter"}</p></div>
                <div className="bg-gray-50 rounded-xl p-3"><span className="text-gray-400">Prix détecté</span><p className="font-semibold text-gray-900">{urlDraft.price != null ? formatPrice(urlDraft.price) : "À compléter"}</p></div>
                <div className="bg-gray-50 rounded-xl p-3"><span className="text-gray-400">Catégorie</span><p className="font-semibold text-gray-900">{urlDraft.category} / {urlDraft.subcategory}</p></div>
                <div className="bg-gray-50 rounded-xl p-3"><span className="text-gray-400">Images trouvées</span><p className="font-semibold text-gray-900">{urlDraft.imageUrls.length} image(s)</p></div>
              </div>

              {urlDraft.confidenceWarnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-amber-800 mb-2">Points à vérifier avant publication</p>
                  <ul className="space-y-1 text-sm text-amber-700 list-disc pl-5">
                    {urlDraft.confidenceWarnings.map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                </div>
              )}

              <div>
                <p className="text-sm font-semibold text-gray-800 mb-2">Tags SEO proposés</p>
                <div className="flex flex-wrap gap-2">
                  {urlDraft.suggestedTags.map((tag) => (
                    <span key={tag} className="px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 text-xs font-medium">{tag}</span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-800 mb-2">Aperçu description SEO/GEO</p>
                <div className="prose prose-sm max-w-none bg-gray-50 rounded-xl p-4 text-gray-700 max-h-72 overflow-y-auto" dangerouslySetInnerHTML={{ __html: urlDraft.seoDescription }} />
              </div>

              <button
                onClick={handleCreateProductFromUrlDraft}
                disabled={urlCreating}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60"
              >
                {urlCreating ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {urlCreating ? "Création du brouillon..." : "Créer le produit brouillon et l’ouvrir dans l’agent SEO"}
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <p className="text-sm font-semibold text-gray-800 mb-3">Images candidates</p>
              <div className="grid grid-cols-2 gap-3">
                {urlDraft.imageUrls.slice(0, 6).map((image, index) => (
                  <div key={image} className="aspect-square bg-gray-50 rounded-xl border border-gray-100 relative overflow-hidden">
                    <Image src={image} alt={urlDraft.imageAlts[index] || urlDraft.name} fill className="object-contain p-2" sizes="180px" unoptimized />
                  </div>
                ))}
              </div>
              <div className="mt-5 bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
                <p className="font-semibold mb-1">Garde-fou qualité</p>
                <p>Les images sont d’abord affichées comme candidates, puis importées dans le stockage média lors de la création du brouillon lorsque la configuration Cloudinary est disponible. Après création, tu pourras les remplacer ou les réordonner dans le gestionnaire d’images produit.</p>
              </div>
            </div>
          </div>
        )}
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
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
            <span>{product?.brand} · {editCategory || product?.category}</span>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${getPublicationStatusMeta(editStatus).badge}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${getPublicationStatusMeta(editStatus).dot}`} />
              {getPublicationStatusMeta(editStatus).label}
            </span>
          </div>
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

      {/* ─── Onglets SEO / GEO ─── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setActiveTab("seo")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === "seo"
              ? "bg-white text-violet-700 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <TrendingUp size={15} />
          SEO Google
          {score > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
              score >= 80 ? "bg-emerald-100 text-emerald-700" :
              score >= 60 ? "bg-blue-100 text-blue-700" :
              score >= 40 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
            }`}>{score}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("geo")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === "geo"
              ? "bg-white text-emerald-700 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Globe size={15} />
          GEO — IA & LLM
          <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">Nouveau</span>
        </button>
      </div>

      {/* Layout principal : éditeur + aperçu */}
      <div className={`grid gap-4 ${showPreview ? "xl:grid-cols-[1fr_400px]" : "grid-cols-1"}`}>
        {/* ── Colonne gauche : éditeur ── */}
        <div className="space-y-4 min-w-0">
          {activeTab === "seo" && (<>
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
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Catégorie</label>
                  <AutocompleteInput
                    value={editCategory}
                    onChange={(v) => { setEditCategory(v); setEditSubcategory(""); setEditSubsubcategory(""); setApplied(false); }}
                    suggestions={allCategories}
                    placeholder="ex: cheveux, barbe, peignes..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Sous-catégorie</label>
                  <AutocompleteInput
                    value={editSubcategory}
                    onChange={(v) => { setEditSubcategory(v); setEditSubsubcategory(""); setApplied(false); }}
                    suggestions={
                      editCategory && level2ByParent[editCategory]?.length
                        ? level2ByParent[editCategory].map(s => ({ slug: s.slug, label: s.label }))
                        : allSubcategories
                    }
                    placeholder="ex: cires, gel, laques..."
                  />
                </div>
              </div>
              {level3ByParent[editSubcategory]?.length > 0 && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Sous-sous-catégorie</label>
                  <AutocompleteInput
                    value={editSubsubcategory}
                    onChange={(v) => { setEditSubsubcategory(v); setApplied(false); }}
                    suggestions={level3ByParent[editSubcategory].map((s) => ({ slug: s.slug, label: s.label }))}
                    placeholder="Sélectionner une sous-sous-catégorie..."
                  />
                </div>
              )}
              <div className="rounded-xl border border-violet-100 bg-violet-50/60 px-4 py-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Disponibilité de publication</p>
                    <p className="text-xs text-gray-500">Indique si la fiche SEO correspond à un produit actif en ligne ou à un brouillon non publié.</p>
                  </div>
                  <select
                    value={editStatus}
                    onChange={(e) => { setEditStatus(e.target.value); setApplied(false); }}
                    className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                  >
                    <option value="active">Actif — disponible en ligne</option>
                    <option value="draft">Brouillon — non disponible en ligne</option>
                  </select>
                </div>
                <p className="mt-2 text-xs text-violet-700">Le JSON-LD GEO marquera un brouillon comme non disponible, même si le stock est positif.</p>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Mettre en avant dans Nouveautés</p>
                  <p className="text-xs text-gray-500">
                    Le produit apparaîtra sur la page dédiée /nouveautes dès l’activation.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isNewSaving && <Loader2 size={14} className="animate-spin text-gray-400" />}
                  {isNewSaved && <span className="text-xs font-medium text-emerald-600">Enregistré</span>}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={Boolean(product?.isNew)}
                    aria-label="Mettre en avant dans Nouveautés"
                    onClick={handleToggleIsNew}
                    disabled={isNewSaving || !product}
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-bp-pink/40 disabled:cursor-not-allowed disabled:opacity-70 ${
                      product?.isNew ? "bg-bp-pink" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
                        product?.isNew ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>



          {/* Tarification professionnelle */}
          <div className="bg-white rounded-xl shadow-sm border border-amber-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">B2B</span>
              <span className="text-xs text-gray-400">Prix visible uniquement pour les comptes professionnels approuvés</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Prix public TTC actuel</label>
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-800">{product ? formatPrice(product.price) : "—"}</div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Prix pro HT (€)</label>
                <input type="number" min="0" step="0.01" value={editPriceProEur} onChange={(e) => { setEditPriceProEur(e.target.value); setApplied(false); }} placeholder="ex: 24.90" className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none" />
              </div>
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Laissez vide pour ne pas proposer de tarif pro dédié sur ce produit.</div>
            </div>
          </div>

          {/* Données logistiques */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded">DONNÉES LOGISTIQUES</span>
              <span className="text-xs text-gray-400">Préparation colis et calcul transport</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div><label className="block text-xs text-gray-500 mb-1">Poids en grammes</label><input type="number" min="0" value={editWeightG} onChange={(e) => { setEditWeightG(e.target.value); setApplied(false); }} placeholder="ex: 250" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Longueur cm</label><input type="number" min="0" step="0.1" value={editLengthCm} onChange={(e) => { setEditLengthCm(e.target.value); setApplied(false); }} placeholder="ex: 12" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Largeur cm</label><input type="number" min="0" step="0.1" value={editWidthCm} onChange={(e) => { setEditWidthCm(e.target.value); setApplied(false); }} placeholder="ex: 6" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Hauteur cm</label><input type="number" min="0" step="0.1" value={editHeightCm} onChange={(e) => { setEditHeightCm(e.target.value); setApplied(false); }} placeholder="ex: 4" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none" /></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              {[
                ["Produit fragile", editIsFragile, setEditIsFragile],
                ["Liquide", editIsLiquid, setEditIsLiquid],
                ["Aérosol", editIsAerosol, setEditIsAerosol],
                ["Verre / protection renforcée", editRequiresGlass, setEditRequiresGlass],
              ].map(([label, checked, setter]) => (
                <label key={String(label)} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  <input type="checkbox" checked={Boolean(checked)} onChange={(e) => { (setter as (value: boolean) => void)(e.target.checked); setApplied(false); }} className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
                  {String(label)}
                </label>
              ))}
            </div>
            <div className="mt-4"><label className="block text-xs text-gray-500 mb-1">Note logistique spéciale</label><textarea value={editLogisticNote} onChange={(e) => { setEditLogisticNote(e.target.value); setApplied(false); }} placeholder="ex: ne pas coucher, ajouter calage, éviter point relais..." rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none" /></div>
          </div>

          {/* Gestion des images */}
          {productId && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold text-pink-600 bg-pink-50 px-2 py-0.5 rounded">IMAGES DU PRODUIT</span>
                <span className="text-xs text-gray-400">{editImages.length} image(s) — glissez pour réorganiser</span>
                <ImageIcon size={13} className="text-gray-300 ml-auto" />
              </div>
              <ImageManager
                productId={productId}
                images={editImages}
                imageAlts={editImageAlts}
                onChange={(imgs) => { setEditImages(imgs); setApplied(false); }}
                onAltsChange={(alts) => setEditImageAlts(alts)}
                productName={product?.name}
                productBrand={product?.brand}
                productCategory={editCategory || product?.category}
              />
            </div>
          )}

          {/* Gestion des variantes */}
          {productId && product && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">VARIANTES</span>
                <span className="text-xs text-gray-400">Couleurs, tailles, options</span>
              </div>
              <VariantManager
                productId={productId}
                productPrice={product.price}
              />
            </div>
          )}

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

              {/* Image alts SEO — section interactive */}
              {productId && editImages.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <ImageIcon size={14} className="text-gray-400" />
                      <span className="text-xs font-semibold text-gray-600">ALT TEXTS SEO DES IMAGES</span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{editImages.length} image(s)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={async () => {
                          setGeneratingAlts(true);
                          setAltsError("");
                          setAltsSaved(false);
                          try {
                            const res = await generateImageAltsSeo(productId);
                            setEditImageAlts(res.alts);
                            setAltsSaved(true);
                          } catch (e: any) {
                            setAltsError(e.message);
                          } finally {
                            setGeneratingAlts(false);
                          }
                        }}
                        disabled={generatingAlts}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-medium hover:bg-violet-700 disabled:opacity-50"
                      >
                        {generatingAlts ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                        Générer SEO
                      </button>
                      <button
                        onClick={async () => {
                          setAltsError("");
                          try {
                            await saveImageAltsSeo(productId, editImageAlts);
                            setAltsSaved(true);
                          } catch (e: any) {
                            setAltsError(e.message);
                          }
                        }}
                        disabled={generatingAlts}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <Save size={12} />
                        {altsSaved ? "Sauvegardé ✓" : "Sauvegarder"}
                      </button>
                    </div>
                  </div>
                  {altsError && (
                    <div className="mb-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{altsError}</div>
                  )}
                  <div className="space-y-2">
                    {editImages.map((imgUrl, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <img src={imgUrl} alt="" className="w-10 h-10 object-cover rounded border border-gray-200 shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] text-gray-400">{i === 0 ? "Image principale" : `Image ${i + 1}`}</span>
                            <span className={`text-[10px] ${(editImageAlts[i] || "").length > 100 ? "text-orange-500" : "text-gray-400"}`}>
                              {(editImageAlts[i] || "").length}/125
                            </span>
                          </div>
                          <input
                            type="text"
                            value={editImageAlts[i] || ""}
                            onChange={(e) => {
                              const next = [...editImageAlts];
                              while (next.length <= i) next.push("");
                              next[i] = e.target.value;
                              setEditImageAlts(next);
                              setAltsSaved(false);
                            }}
                            placeholder={`Alt text SEO image ${i + 1}...`}
                            maxLength={125}
                            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-400"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Bouton génération en masse */}
                  {!productId && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <button
                        onClick={async () => {
                          setBulkGenerating(true);
                          setBulkResult(null);
                          try {
                            const res = await bulkGenerateImageAlts();
                            setBulkResult(res);
                          } catch (e: any) {
                            setAltsError(e.message);
                          } finally {
                            setBulkGenerating(false);
                          }
                        }}
                        disabled={bulkGenerating}
                        className="inline-flex items-center gap-1.5 px-3 py-2 border border-violet-300 text-violet-700 rounded-lg text-xs font-medium hover:bg-violet-50 disabled:opacity-50"
                      >
                        {bulkGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                        Générer en masse (batch 10)
                      </button>
                      {bulkResult && (
                        <p className="mt-1.5 text-xs text-emerald-600">{bulkResult.message}{bulkResult.remaining > 0 ? ` — ${bulkResult.remaining} restants` : ""}</p>
                      )}
                    </div>
                  )}
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

          </>)}

          {/* ─── Panneau GEO ─── */}
          {activeTab === "geo" && (
            <div className="space-y-4">
              {/* Intro */}
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Globe size={18} className="text-emerald-600" />
                  <h2 className="font-semibold text-emerald-900 text-sm">Optimisation GEO — Être cité par ChatGPT, Claude & Perplexity</h2>
                </div>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  Le GEO (Generative Engine Optimization) permet d&apos;être référencé dans les réponses des IA. Générez le <strong>Schema.org</strong>, la <strong>FAQ</strong> et l&apos;<strong>introduction directe</strong> (GEO Base), puis enrichissez avec le <strong>snippet vocal</strong>, l&apos;<strong>E-E-A-T</strong>, les <strong>questions longue traîne</strong> et le <strong>comparatif concurrents</strong> (GEO Enrichi).
                </p>
              </div>

              {/* Sous-onglets GEO Base / GEO Enrichi */}
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => setGeoSubTab("base")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                    geoSubTab === "base"
                      ? "bg-white text-emerald-700 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Globe size={13} /> GEO Base
                  {geoOptimization && <span className="bg-emerald-100 text-emerald-700 text-xs px-1.5 py-0.5 rounded-full font-bold">{geoOptimization.geoScore}</span>}
                </button>
                <button
                  onClick={() => setGeoSubTab("enrichi")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                    geoSubTab === "enrichi"
                      ? "bg-white text-teal-700 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Zap size={13} /> GEO Enrichi
                  {geoEnriched && <span className="bg-teal-100 text-teal-700 text-xs px-1.5 py-0.5 rounded-full font-bold">✓</span>}
                </button>
              </div>

              {/* ─── GEO Base ─── */}
              {geoSubTab === "base" && (<>

              {/* Bouton générer GEO */}
              {!geoOptimization && (
                <div className="flex justify-center py-2">
                  <button onClick={handleGeoOptimize} disabled={geoOptimizing}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-medium hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50">
                    {geoOptimizing ? <><Loader2 size={18} className="animate-spin" />Génération GEO en cours...</> : <><Globe size={18} />Générer l&apos;optimisation GEO</>}
                  </button>
                </div>
              )}

              {/* Zone d'édition GEO */}
              {geoOptimization && (
                <div className="space-y-4">
                  {/* Barre d'actions GEO */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Globe size={15} className="text-emerald-500" />
                      <span className="font-semibold text-gray-900 text-sm">Contenu GEO généré</span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Modifiable</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => { setGeoOptimization(null); setGeoApplied(false); }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">
                        <RotateCcw size={12} /> Régénérer
                      </button>
                      <button onClick={handleGeoApply} disabled={geoApplying || geoApplied}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50">
                        {geoApplying ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        {geoApplied ? "Appliqué ✓" : "Appliquer"}
                      </button>
                    </div>
                  </div>

                  {/* Score GEO */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-center gap-3">
                      <ScoreRing score={geoOptimization.geoScore} size={56} />
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">Score GEO estimé</p>
                        <p className="text-xs text-gray-500">Probabilité d&apos;être cité par les LLM</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      {geoOptimization.geoDetails?.map((d) => {
                        const pct = d.max > 0 ? (d.score / d.max) * 100 : 0;
                        const color = pct >= 80 ? "text-emerald-600" : pct >= 60 ? "text-blue-600" : pct >= 40 ? "text-amber-600" : "text-red-600";
                        const bg = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-blue-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
                        return (
                          <div key={d.criterion} className="border border-gray-100 rounded-lg p-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-gray-700 truncate">{d.criterion}</span>
                              <span className={`text-xs font-bold ${color}`}>{d.score}/{d.max}</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
                              <div className={`h-full ${bg} rounded-full`} style={{ width: `${pct}%` }} />
                            </div>
                            <p className="text-xs text-gray-400 leading-tight">{d.tip}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Introduction directe (150 premiers mots) */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText size={15} className="text-blue-500" />
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Introduction directe (150 premiers mots)</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">Les LLM citent les pages qui répondent directement à la question. Ce texte sera placé en tête de description.</p>
                    <textarea
                      value={editDirectAnswer}
                      onChange={(e) => setEditDirectAnswer(e.target.value)}
                      rows={4}
                      className="w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none"
                      placeholder="Réponse directe à la question : Qu'est-ce que ce produit et à qui s'adresse-t-il ?"
                    />
                    <p className="text-xs text-gray-400 mt-1">{editDirectAnswer.split(/\s+/).filter(Boolean).length} mots (idéal : 100-150)</p>
                  </div>

                  {/* FAQ produit */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <HelpCircle size={15} className="text-violet-500" />
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">FAQ Produit ({editFaqItems.length} questions)</span>
                      </div>
                      <button
                        onClick={() => setEditFaqItems([...editFaqItems, { question: "", answer: "" }])}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-violet-50 text-violet-700 rounded-lg text-xs hover:bg-violet-100">
                        <Plus size={12} /> Ajouter
                      </button>
                    </div>
                    <div className="space-y-2">
                      {editFaqItems.map((item, idx) => (
                        <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                          <div
                            className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-gray-50"
                            onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                          >
                            <input
                              value={item.question}
                              onChange={(e) => {
                                const updated = [...editFaqItems];
                                updated[idx] = { ...updated[idx], question: e.target.value };
                                setEditFaqItems(updated);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="flex-1 text-sm font-medium text-gray-800 bg-transparent focus:outline-none"
                              placeholder="Question..."
                            />
                            <div className="flex items-center gap-1 ml-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditFaqItems(editFaqItems.filter((_, i) => i !== idx)); }}
                                className="p-1 text-red-400 hover:text-red-600 rounded"
                              ><X size={12} /></button>
                              {expandedFaq === idx ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                            </div>
                          </div>
                          {expandedFaq === idx && (
                            <div className="border-t border-gray-100 p-2.5">
                              <textarea
                                value={item.answer}
                                onChange={(e) => {
                                  const updated = [...editFaqItems];
                                  updated[idx] = { ...updated[idx], answer: e.target.value };
                                  setEditFaqItems(updated);
                                }}
                                rows={3}
                                className="w-full text-sm text-gray-700 bg-gray-50 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-violet-300 resize-none"
                                placeholder="Réponse..."
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Schema.org JSON-LD */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Braces size={15} className="text-orange-500" />
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Schema.org JSON-LD</span>
                      </div>
                      <button onClick={handleCopySchema}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-50 text-orange-700 rounded-lg text-xs hover:bg-orange-100">
                        <Copy size={12} /> {schemaCopied ? "Copié !" : "Copier"}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">Ce bloc JSON-LD sera automatiquement injecté dans le <code className="bg-gray-100 px-1 rounded">&lt;head&gt;</code> de la fiche produit.</p>
                    <textarea
                      value={editSchemaJsonLd}
                      onChange={(e) => setEditSchemaJsonLd(e.target.value)}
                      rows={12}
                      className="w-full font-mono text-xs text-gray-800 bg-gray-900 text-green-400 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
                    />
                  </div>

                  {/* Suggestions GEO */}
                  {geoOptimization.geoSuggestions && geoOptimization.geoSuggestions.length > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp size={14} className="text-emerald-600" />
                        <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">Suggestions d&apos;amélioration GEO</span>
                      </div>
                      <ul className="space-y-1">
                        {geoOptimization.geoSuggestions.map((s, i) => (
                          <li key={i} className="text-xs text-emerald-700 flex items-start gap-1.5">
                            <span className="text-emerald-500 mt-0.5">→</span> {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Bouton appliquer bas de page GEO */}
                  {geoApplied && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-700 text-sm flex items-center gap-2">
                      <CheckCircle size={15} /> Optimisation GEO appliquée avec succès !
                    </div>
                  )}
                  <div className="flex justify-end pb-4">
                    <button onClick={handleGeoApply} disabled={geoApplying || geoApplied}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 shadow-lg shadow-emerald-200">
                      {geoApplying ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                      {geoApplied ? "GEO appliqué ✓" : "Appliquer l'optimisation GEO"}
                    </button>
                  </div>
                </div>
              )}
              </>)}

              {/* ─── GEO Enrichi ─── */}
              {geoSubTab === "enrichi" && (
                <div className="space-y-4">
                  {/* Bouton générer */}
                  {!geoEnriched && (
                    <div className="flex flex-col items-center gap-3 py-4">
                      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-center max-w-md">
                        <Zap size={24} className="text-teal-600 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-teal-900 mb-1">GEO Enrichi</p>
                        <p className="text-xs text-teal-700 leading-relaxed">
                          Génère 7 nouveaux éléments : snippet vocal, contenu E-E-A-T, 8 questions longue traîne, comparatif concurrents, cas d&apos;usage par profil, extrait guide d&apos;achat et entités Knowledge Graph.
                        </p>
                      </div>
                      <button onClick={handleGeoEnrich} disabled={geoEnriching}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-xl font-medium hover:from-teal-700 hover:to-cyan-700 transition-all shadow-lg shadow-teal-200 disabled:opacity-50">
                        {geoEnriching ? <><Loader2 size={18} className="animate-spin" />Génération en cours...</> : <><Zap size={18} />Générer le GEO Enrichi</>}
                      </button>
                    </div>
                  )}

                  {geoEnriched && (
                    <div className="space-y-4">
                      {/* Barre d'actions */}
                      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Zap size={15} className="text-teal-500" />
                          <span className="font-semibold text-gray-900 text-sm">Contenu GEO Enrichi</span>
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Modifiable</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => { setGeoEnriched(null); setGeoEnrichApplied(false); }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">
                            <RotateCcw size={12} /> Régénérer
                          </button>
                          <button onClick={handleGeoEnrichApply} disabled={geoEnrichApplying || geoEnrichApplied}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 disabled:opacity-50">
                            {geoEnrichApplying ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                            {geoEnrichApplied ? "Appliqué ✓" : "Appliquer"}
                          </button>
                        </div>
                      </div>

                      {/* Snippet vocal */}
                      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Mic size={15} className="text-teal-500" />
                          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Snippet Vocal (Google Assistant, Siri, Alexa)</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-2">Texte de 30-40 mots lu à voix haute par les assistants vocaux. Factuel et naturel à l&apos;oral.</p>
                        <textarea
                          value={editVoiceSnippet}
                          onChange={(e) => setEditVoiceSnippet(e.target.value)}
                          rows={3}
                          className="w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-300 resize-none"
                        />
                        <p className="text-xs text-gray-400 mt-1">{editVoiceSnippet.split(/\s+/).filter(Boolean).length} mots (idéal : 30-40)</p>
                      </div>

                      {/* E-E-A-T */}
                      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Shield size={15} className="text-blue-500" />
                          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Contenu E-E-A-T (Expérience, Expertise, Autorité, Confiance)</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-2">Bloc HTML démontrant la crédibilité du produit. Renforce la confiance des LLM et de Google.</p>
                        <textarea
                          value={editEeaatContent}
                          onChange={(e) => setEditEeaatContent(e.target.value)}
                          rows={5}
                          className="w-full border border-gray-200 rounded-lg p-3 text-sm font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                        />
                      </div>

                      {/* Questions longue traîne */}
                      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Search size={15} className="text-violet-500" />
                            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Questions Longue Traîne ({editLongTailQuestions.length})</span>
                          </div>
                          <button
                            onClick={() => setEditLongTailQuestions([...editLongTailQuestions, { question: "", answer: "", intent: "informationnelle" }])}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-violet-50 text-violet-700 rounded-lg text-xs hover:bg-violet-100">
                            <Plus size={12} /> Ajouter
                          </button>
                        </div>
                        <div className="space-y-2">
                          {editLongTailQuestions.map((item, idx) => (
                            <div key={idx} className="border border-gray-200 rounded-lg p-3">
                              <div className="flex items-start gap-2">
                                <div className="flex-1 space-y-1.5">
                                  <input
                                    value={item.question}
                                    onChange={(e) => {
                                      const updated = [...editLongTailQuestions];
                                      updated[idx] = { ...updated[idx], question: e.target.value };
                                      setEditLongTailQuestions(updated);
                                    }}
                                    className="w-full text-sm font-medium text-gray-800 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-300"
                                    placeholder="Question longue traîne..."
                                  />
                                  <textarea
                                    value={item.answer}
                                    onChange={(e) => {
                                      const updated = [...editLongTailQuestions];
                                      updated[idx] = { ...updated[idx], answer: e.target.value };
                                      setEditLongTailQuestions(updated);
                                    }}
                                    rows={2}
                                    className="w-full text-xs text-gray-600 border border-gray-100 rounded-lg px-2 py-1 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-violet-300 resize-none"
                                    placeholder="Réponse..."
                                  />
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-gray-400">Intent :</span>
                                    {["informationnelle", "commerciale", "transactionnelle", "navigationnelle"].map((intent) => (
                                      <button key={intent}
                                        onClick={() => {
                                          const updated = [...editLongTailQuestions];
                                          updated[idx] = { ...updated[idx], intent };
                                          setEditLongTailQuestions(updated);
                                        }}
                                        className={`text-xs px-1.5 py-0.5 rounded-full transition-colors ${
                                          item.intent === intent
                                            ? "bg-violet-600 text-white"
                                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                        }`}
                                      >{intent}</button>
                                    ))}
                                  </div>
                                </div>
                                <button onClick={() => setEditLongTailQuestions(editLongTailQuestions.filter((_, i) => i !== idx))}
                                  className="p-1 text-red-400 hover:text-red-600 rounded shrink-0">
                                  <X size={12} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Comparatif concurrents */}
                      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <BarChart2 size={15} className="text-orange-500" />
                          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Comparatif Concurrents</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-3">Tableau comparé pour être cité quand les LLM répondent à &quot;quelle est la différence entre...&quot;</p>
                        {editCompetitorComparison.length > 0 && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                              <thead>
                                <tr className="bg-gray-50">
                                  <th className="border border-gray-200 px-2 py-1.5 text-left font-semibold text-gray-600">Critère</th>
                                  <th className="border border-gray-200 px-2 py-1.5 text-left font-semibold text-emerald-600">Notre produit</th>
                                  <th className="border border-gray-200 px-2 py-1.5 text-left font-semibold text-gray-500">Concurrent A</th>
                                  <th className="border border-gray-200 px-2 py-1.5 text-left font-semibold text-gray-500">Concurrent B</th>
                                </tr>
                              </thead>
                              <tbody>
                                {editCompetitorComparison.map((row, idx) => (
                                  <tr key={idx} className="hover:bg-gray-50">
                                    <td className="border border-gray-200 px-2 py-1.5 font-medium text-gray-700">{row.feature}</td>
                                    <td className="border border-gray-200 px-2 py-1.5 text-emerald-700 font-medium">{row.ourProduct}</td>
                                    <td className="border border-gray-200 px-2 py-1.5 text-gray-500">{row.competitor1}</td>
                                    <td className="border border-gray-200 px-2 py-1.5 text-gray-500">{row.competitor2}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Cas d'usage */}
                      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Users size={15} className="text-indigo-500" />
                          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Cas d&apos;Usage par Profil</span>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {editUseCases.map((uc, idx) => (
                            <div key={idx} className="border border-gray-100 rounded-lg p-3 bg-indigo-50/30">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">{uc.profile}</span>
                              </div>
                              <p className="text-xs text-gray-700 mb-1"><strong>Cas :</strong> {uc.useCase}</p>
                              <p className="text-xs text-gray-500"><strong>Bénéfice :</strong> {uc.benefit}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Extrait guide d'achat */}
                      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <BookOpen size={15} className="text-amber-500" />
                          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Extrait Guide d&apos;Achat</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-2">Paragraphe pour être cité dans les guides d&apos;achat générés par les LLM.</p>
                        <textarea
                          value={editBuyingGuideSnippet}
                          onChange={(e) => setEditBuyingGuideSnippet(e.target.value)}
                          rows={3}
                          className="w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
                        />
                      </div>

                      {/* Entités Knowledge Graph */}
                      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Globe size={15} className="text-cyan-500" />
                          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Entités Knowledge Graph ({editEntityKeywords.length})</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-2">Termes techniques, marques et certifications pour renforcer le Knowledge Graph Google.</p>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {editEntityKeywords.map((kw, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-full text-xs font-medium">
                              {kw}
                              <button onClick={() => setEditEntityKeywords(editEntityKeywords.filter((_, i) => i !== idx))}
                                className="text-cyan-400 hover:text-red-500">
                                <X size={9} />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Bouton appliquer */}
                      {geoEnrichApplied && (
                        <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-teal-700 text-sm flex items-center gap-2">
                          <CheckCircle size={15} /> Contenu GEO Enrichi appliqué avec succès !
                        </div>
                      )}
                      <div className="flex justify-end pb-4">
                        <button onClick={handleGeoEnrichApply} disabled={geoEnrichApplying || geoEnrichApplied}
                          className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 disabled:opacity-50 shadow-lg shadow-teal-200">
                          {geoEnrichApplying ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                          {geoEnrichApplied ? "GEO Enrichi appliqué ✓" : "Appliquer le GEO Enrichi"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
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
              images={editImages}
              publicationStatus={editStatus}
            />
          </div>
        )}
      </div>
    </div>
  );
}
