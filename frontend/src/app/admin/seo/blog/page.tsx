"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  generateSeoBlogArticle,
  saveSeoBlogArticle,
  getAdminProducts,
  type BlogArticleGenerated,
} from "@/lib/admin-api";
import type { Product } from "@/types";
import {
  ChevronLeft,
  FileText,
  Sparkles,
  Loader2,
  Save,
  CheckCircle,
  Search,
  X,
  BookOpen,
  Eye,
  EyeOff,
} from "lucide-react";

const ARTICLE_TYPES = [
  { value: "guide", label: "Guide d'achat", description: "Critères de choix, comparaison et recommandations" },
  { value: "comparatif", label: "Comparatif", description: "Comparaison détaillée entre produits" },
  { value: "tutoriel", label: "Tutoriel", description: "Étapes pratiques avec conseils de pro" },
  { value: "tendances", label: "Tendances", description: "Actualités et tendances du secteur" },
];

export default function SeoBlogPage() {
  const [topic, setTopic] = useState("");
  const [type, setType] = useState("guide");
  const [keywords, setKeywords] = useState("");
  const [searchProduct, setSearchProduct] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [showProductSearch, setShowProductSearch] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [article, setArticle] = useState<BlogArticleGenerated | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(true);

  // Search products
  useEffect(() => {
    if (!searchProduct || searchProduct.length < 2) {
      setProducts([]);
      return;
    }
    const timer = setTimeout(() => {
      getAdminProducts({ search: searchProduct, limit: 10 })
        .then((data) => setProducts(data.products))
        .catch(console.error);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchProduct]);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError("Veuillez entrer un sujet");
      return;
    }
    setGenerating(true);
    setError("");
    setArticle(null);
    setSaved(false);
    try {
      const result = await generateSeoBlogArticle({
        topic: topic.trim(),
        type,
        relatedProductIds: selectedProducts.map((p) => p.id),
        keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
      });
      setArticle(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async (published: boolean) => {
    if (!article) return;
    setSaving(true);
    try {
      await saveSeoBlogArticle({
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt,
        content: article.content,
        category: article.category,
        readTime: article.readTime,
        published,
      });
      setSaved(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/seo" className="text-gray-400 hover:text-gray-600">
          <ChevronLeft size={20} />
        </Link>
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
          <FileText className="text-white" size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Générateur d&apos;articles SEO</h1>
          <p className="text-sm text-gray-500">Créez des articles de blog optimisés pour le référencement</p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        {/* Topic */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Sujet de l&apos;article *</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ex: Comment choisir sa tondeuse de coupe professionnelle"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Type d&apos;article</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {ARTICLE_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  type === t.value
                    ? "border-violet-500 bg-violet-50 ring-1 ring-violet-500"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <p className={`text-sm font-medium ${type === t.value ? "text-violet-700" : "text-gray-700"}`}>{t.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Keywords */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Mots-clés (séparés par des virgules)</label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="Ex: tondeuse professionnelle, barbier, coupe homme"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
        </div>

        {/* Related Products */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Produits liés (liens internes)</label>
          {selectedProducts.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedProducts.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-50 text-violet-700 rounded-full text-xs font-medium">
                  {p.name.substring(0, 40)}
                  <button onClick={() => setSelectedProducts((prev) => prev.filter((pp) => pp.id !== p.id))}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchProduct}
                  onChange={(e) => { setSearchProduct(e.target.value); setShowProductSearch(true); }}
                  onFocus={() => setShowProductSearch(true)}
                  placeholder="Rechercher un produit..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
            </div>
            {showProductSearch && products.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {products.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (!selectedProducts.find((sp) => sp.id === p.id)) {
                        setSelectedProducts((prev) => [...prev, p]);
                      }
                      setSearchProduct("");
                      setShowProductSearch(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    <span className="text-gray-700 truncate">{p.name}</span>
                    <span className="text-xs text-gray-400 shrink-0">{(p as any).brand}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Generate Button */}
        <div className="flex justify-end pt-2">
          <button
            onClick={handleGenerate}
            disabled={generating || !topic.trim()}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg font-medium hover:from-violet-700 hover:to-purple-700 transition-all shadow-lg shadow-violet-200 disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Génération en cours...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                Générer l&apos;article
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      )}

      {saved && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-700 text-sm flex items-center gap-2">
          <CheckCircle size={16} />
          Article sauvegardé avec succès !
        </div>
      )}

      {/* Article Preview */}
      {article && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <BookOpen size={20} className="text-blue-500" />
              Article généré
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
                {showPreview ? "Masquer" : "Prévisualiser"}
              </button>
              <button
                onClick={() => handleSave(false)}
                disabled={saving || saved}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                <Save size={14} />
                Brouillon
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving || saved}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                Publier
              </button>
            </div>
          </div>

          {showPreview && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Article Meta */}
              <div className="p-5 border-b border-gray-100 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{article.category.toUpperCase()}</span>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs text-gray-400">{article.readTime} min de lecture</span>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs text-gray-400">/{article.slug}</span>
                </div>
                <h1 className="text-2xl font-bold text-gray-900">{article.title}</h1>
                <p className="text-gray-600">{article.excerpt}</p>
                <div className="flex flex-wrap gap-1.5">
                  {article.tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{tag}</span>
                  ))}
                </div>
                {/* Google Preview */}
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-400 mb-1">Aperçu Google :</p>
                  <p className="text-blue-700 text-base font-medium">{article.title}</p>
                  <p className="text-xs text-emerald-700">barberparadise.fr › blog › {article.slug}</p>
                  <p className="text-sm text-gray-600 mt-0.5">{article.metaDescription}</p>
                </div>
              </div>

              {/* Article Content */}
              <div className="p-5">
                <div
                  className="prose prose-sm max-w-none text-gray-700"
                  dangerouslySetInnerHTML={{ __html: article.content }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
