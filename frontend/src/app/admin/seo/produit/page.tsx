"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  analyzeSeoProduct,
  optimizeSeoProduct,
  applySeoOptimization,
  type SeoOptimization,
} from "@/lib/admin-api";
import type { Product } from "@/types";
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
} from "lucide-react";

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#3b82f6" : score >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="6" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className="absolute text-lg font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

/** Champ texte éditable avec indicateur de longueur */
function EditableField({
  label,
  value,
  onChange,
  multiline = false,
  maxLength,
  hint,
  badgeColor = "violet",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  maxLength?: number;
  hint?: string;
  badgeColor?: "violet" | "blue" | "emerald" | "amber";
}) {
  const badgeClasses: Record<string, string> = {
    violet: "text-violet-600 bg-violet-50",
    blue: "text-blue-600 bg-blue-50",
    emerald: "text-emerald-600 bg-emerald-50",
    amber: "text-amber-600 bg-amber-50",
  };
  const lengthColor = maxLength
    ? value.length > maxLength
      ? "text-red-500"
      : value.length >= maxLength * 0.8
      ? "text-amber-500"
      : "text-gray-400"
    : "text-gray-400";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${badgeClasses[badgeColor]}`}>
          {label}
        </span>
        <span className={`text-xs font-mono ${lengthColor}`}>
          {value.length} car.{maxLength ? ` / ${maxLength} recommandés` : ""}
        </span>
        <Pencil size={12} className="text-gray-300 ml-auto" />
      </div>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="w-full text-sm text-gray-800 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-y"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full text-sm text-gray-800 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300"
        />
      )}
      {hint && <p className="text-xs text-gray-400 mt-1.5">{hint}</p>}
    </div>
  );
}

/** Éditeur de tags avec ajout/suppression */
function TagsEditor({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [newTag, setNewTag] = useState("");

  const addTag = () => {
    const t = newTag.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      onChange([...tags, t]);
    }
    setNewTag("");
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
          TAGS / MOTS-CLÉS
        </span>
        <span className="text-xs text-gray-400">{tags.length} tag(s)</span>
        <Pencil size={12} className="text-gray-300 ml-auto" />
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium group"
          >
            {tag}
            <button
              onClick={() => removeTag(tag)}
              className="text-gray-400 hover:text-red-500 transition-colors"
              title="Supprimer"
            >
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
          placeholder="Ajouter un tag..."
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-300"
        />
        <button
          onClick={addTag}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-medium hover:bg-amber-100"
        >
          <Plus size={12} />
          Ajouter
        </button>
      </div>
    </div>
  );
}

/** Éditeur de description HTML avec aperçu */
function DescriptionEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
          DESCRIPTION SEO
        </span>
        <span className="text-xs text-gray-400">{value.replace(/<[^>]+>/g, "").length} car. (texte brut)</span>
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="ml-auto text-xs text-gray-500 hover:text-gray-700 underline"
        >
          {showPreview ? "Éditer" : "Aperçu rendu"}
        </button>
      </div>
      {showPreview ? (
        <div
          className="prose prose-sm max-w-none text-gray-700 border border-gray-100 rounded-lg p-3 bg-gray-50 min-h-[120px]"
          dangerouslySetInnerHTML={{ __html: value }}
        />
      ) : (
        <>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={12}
            className="w-full text-xs font-mono text-gray-700 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-y"
          />
          <p className="text-xs text-gray-400 mt-1.5">
            Vous pouvez modifier le HTML directement. Utilisez &lt;h2&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;strong&gt; pour structurer.
          </p>
        </>
      )}
    </div>
  );
}

export default function SeoProductPage() {
  const searchParams = useSearchParams();
  const productId = searchParams.get("id");

  const [product, setProduct] = useState<Product | null>(null);
  const [score, setScore] = useState(0);
  const [details, setDetails] = useState<{ criterion: string; score: number; max: number; tip: string }[]>([]);
  const [optimization, setOptimization] = useState<SeoOptimization | null>(null);

  // États d'édition manuelle (séparés de l'optimisation IA pour permettre la modification)
  const [editTitle, setEditTitle] = useState("");
  const [editMeta, setEditMeta] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    analyzeSeoProduct(productId)
      .then((data) => {
        setProduct(data.product);
        setScore(data.score);
        setDetails(data.details);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [productId]);

  // Synchroniser les champs éditables quand l'optimisation IA arrive
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
    if (!productId) return;
    setApplying(true);
    setError("");
    try {
      await applySeoOptimization(productId, {
        optimizedTitle: editTitle,
        metaDescription: editMeta,
        seoDescription: editDescription,
        suggestedTags: editTags,
      });
      setApplied(true);
      // Rafraîchir l'analyse après application
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
        <p>Aucun produit sélectionné. <Link href="/admin/seo/optimiser" className="underline">Retour à la liste</Link></p>
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/seo/optimiser" className="text-gray-400 hover:text-gray-600">
          <ChevronLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 truncate">{product?.name}</h1>
          <p className="text-sm text-gray-500">{(product as any)?.brand} · {(product as any)?.category}</p>
        </div>
        <ScoreRing score={score} />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {applied && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-700 text-sm flex items-center gap-2">
          <CheckCircle size={16} />
          Optimisations appliquées avec succès !
        </div>
      )}

      {/* Analyse SEO actuelle */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Analyse SEO actuelle</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {details.map((d) => {
            const pct = d.max > 0 ? (d.score / d.max) * 100 : 0;
            const color = pct >= 80 ? "text-emerald-600" : pct >= 60 ? "text-blue-600" : pct >= 40 ? "text-amber-600" : "text-red-600";
            const bgColor = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-blue-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
            return (
              <div key={d.criterion} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">{d.criterion}</span>
                  <span className={`text-sm font-bold ${color}`}>{d.score}/{d.max}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                  <div className={`h-full ${bgColor} rounded-full`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-gray-500">{d.tip}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bouton générer */}
      {!optimization && (
        <div className="flex justify-center">
          <button
            onClick={handleOptimize}
            disabled={optimizing}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-medium hover:from-violet-700 hover:to-purple-700 transition-all shadow-lg shadow-violet-200 disabled:opacity-50"
          >
            {optimizing ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Analyse IA en cours...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                Générer l&apos;optimisation IA
              </>
            )}
          </button>
        </div>
      )}

      {/* Zone d'édition — visible après génération IA */}
      {optimization && (
        <div className="space-y-4">
          {/* Barre d'actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-violet-500" />
              <span className="font-semibold text-gray-900">Contenu généré par l&apos;IA</span>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                Modifiable directement
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                title="Remettre les valeurs générées par l'IA"
              >
                <RotateCcw size={14} />
                Réinitialiser
              </button>
              <button
                onClick={() => { setOptimization(null); setApplied(false); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                <Sparkles size={14} />
                Régénérer
              </button>
              <button
                onClick={handleApply}
                disabled={applying || applied}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {applying ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {applied ? "Appliqué ✓" : "Appliquer les modifications"}
              </button>
            </div>
          </div>

          {/* Note d'information */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-800 text-xs flex items-start gap-2">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>
              <strong>Vérifiez et corrigez</strong> le contenu généré par l&apos;IA avant de l&apos;appliquer.
              L&apos;IA peut inventer des caractéristiques produit — assurez-vous que tout est exact.
            </span>
          </div>

          {/* Titre éditable */}
          <EditableField
            label="TITRE"
            value={editTitle}
            onChange={setEditTitle}
            maxLength={60}
            hint="Visez 50-60 caractères. Incluez le nom exact du produit et la marque."
            badgeColor="violet"
          />

          {/* Meta description éditable */}
          <EditableField
            label="META DESCRIPTION"
            value={editMeta}
            onChange={setEditMeta}
            multiline
            maxLength={155}
            hint="Visez 120-155 caractères. Décrivez le produit avec précision, évitez les inventions."
            badgeColor="blue"
          />

          {/* Aperçu Google */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs font-semibold text-gray-500 mb-3">APERÇU GOOGLE</p>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-blue-700 text-base font-medium hover:underline cursor-pointer truncate">{editTitle || "Titre non défini"}</p>
              <p className="text-xs text-emerald-700">barberparadise.fr › produit › {(product as any)?.slug}</p>
              <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{editMeta || "Meta description non définie"}</p>
            </div>
          </div>

          {/* Tags éditables */}
          <TagsEditor tags={editTags} onChange={setEditTags} />

          {/* Description SEO éditable */}
          <DescriptionEditor value={editDescription} onChange={setEditDescription} />

          {/* Image alts (lecture seule si présents) */}
          {optimization.imageAlts.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-3">
                <ImageIcon size={16} className="text-gray-400" />
                <span className="text-xs font-semibold text-gray-600">TEXTES ALT DES IMAGES</span>
              </div>
              <div className="space-y-2">
                {optimization.imageAlts.map((alt, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-xs text-gray-400 mt-0.5">Image {i + 1}:</span>
                    <span className="text-sm text-gray-700">{alt}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions IA */}
          {optimization.suggestions.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                SUGGESTIONS SUPPLÉMENTAIRES
              </span>
              <ul className="mt-3 space-y-2">
                {optimization.suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-violet-500 mt-0.5">•</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Score estimé */}
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex items-center gap-4">
            <ScoreRing score={optimization.seoScore} size={60} />
            <div>
              <p className="font-medium text-violet-900">Score SEO estimé après optimisation</p>
              <p className="text-sm text-violet-600">
                Gain estimé : +{Math.max(0, optimization.seoScore - score)} points
              </p>
            </div>
          </div>

          {/* Bouton appliquer en bas de page */}
          <div className="flex justify-end pb-6">
            <button
              onClick={handleApply}
              disabled={applying || applied}
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-lg shadow-emerald-200"
            >
              {applying ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {applied ? "Modifications appliquées ✓" : "Appliquer les modifications"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
