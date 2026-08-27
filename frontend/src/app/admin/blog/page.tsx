"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Eye,
  FilePlus2,
  ImagePlus,
  Loader2,
  Pencil,
  Search,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import {
  createAdminBlogArticle,
  createAdminBlogArticleFromDraft,
  getAdminBlogArticles,
  getAdminBlogDrafts,
  getAdminProduct,
  getAdminProducts,
  updateAdminBlogArticle,
  type BlogArticle,
  type BlogContentDraft,
} from "@/lib/admin-api";
import { uploadBlogCoverToCloudinary } from "@/lib/cloudinary";
import type { Product } from "@/types";
import BlogArticlePreview from "@/components/admin/BlogArticlePreview";

const TEMPLATES = [
  {
    id: "guide",
    label: "Guide d’achat",
    description: "Critères, comparatif et produits recommandés.",
    category: "Guide d’achat",
    title: "Comment choisir [produit] : le guide Barber Paradise",
    content: `## Pour qui est ce guide ?

Expliquez le besoin, le niveau d’expérience et le résultat recherché.

## Les critères essentiels

### 1. [Critère principal]

Développez le point de comparaison et les erreurs à éviter.

### 2. [Critère secondaire]

Ajoutez des conseils pratiques issus de l’expérience terrain.

## Comparatif rapide

Présentez les différences utiles entre les options retenues.

## Produits recommandés

Ajoutez les produits liés depuis le catalogue : ils seront affichés avec un lien direct vers leur fiche.

## Notre conseil

Concluez par une recommandation claire et actionnable.`,
  },
  {
    id: "howto",
    label: "Tutoriel / How-to",
    description: "Étapes concrètes et produits utilisés.",
    category: "Tutoriels",
    title: "Comment [obtenir un résultat] : tutoriel étape par étape",
    content: `## Ce qu’il vous faut

Listez les outils, produits et prérequis.

## Étape 1 — Préparer

Décrivez la préparation et le geste essentiel.

## Étape 2 — Appliquer

Expliquez précisément la technique et le produit utilisé.

## Étape 3 — Finaliser

Ajoutez les conseils de finition et de tenue.

## Produits utilisés

Ajoutez les produits liés au catalogue pour permettre au lecteur de les retrouver immédiatement.

## Astuce de pro

Partagez un conseil différenciant de barbier.`,
  },
  {
    id: "focus",
    label: "Focus produit / marque",
    description: "Bénéfices, cas d’usage et appel à l’action.",
    category: "Focus produit",
    title: "[Produit / marque] : pourquoi les barbiers l’apprécient",
    content: `## L’essentiel à retenir

Présentez le produit ou la marque en quelques lignes.

## Pour quels usages ?

Décrivez les profils, styles et situations adaptés.

## Ce qui le distingue

Expliquez les bénéfices concrets et les preuves utiles.

## Comment l’utiliser

Donnez une méthode courte et pratique.

## À découvrir chez Barber Paradise

Ajoutez les produits liés au catalogue et terminez par un appel à l’action clair.`,
  },
  {
    id: "trend",
    label: "Actualité / tendance",
    description: "Décryptage, implications et sélection produit.",
    category: "Tendances",
    title: "[Tendance] : ce qu’il faut savoir en 2026",
    content: `## La tendance en bref

Expliquez le phénomène, son contexte et son intérêt.

## Pourquoi elle gagne du terrain

Développez les facteurs professionnels et consommateurs.

## Comment l’adopter

Proposez des gestes, styles ou habitudes concrètes.

## Sélection Barber Paradise

Ajoutez les produits liés pertinents.

## À retenir

Synthétisez en trois à cinq phrases et ajoutez un appel à l’action.`,
  },
] as const;

type EditorState = {
  id?: string;
  sourceDraftId?: string | null;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  coverImage: string;
  category: string;
  tags: string;
  seoMetaTitle: string;
  seoMetaDescription: string;
  seoKeywords: string;
  linkedProductIds: string[];
};

const EMPTY_EDITOR: EditorState = {
  title: "",
  slug: "",
  content: "",
  excerpt: "",
  coverImage: "",
  category: "Conseils barbier",
  tags: "",
  seoMetaTitle: "",
  seoMetaDescription: "",
  seoKeywords: "",
  linkedProductIds: [],
};

function splitValues(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function articleToEditor(article: BlogArticle): EditorState {
  return {
    id: article.id,
    sourceDraftId: article.sourceDraftId,
    title: article.title,
    slug: article.slug,
    content: article.content,
    excerpt: article.excerpt,
    coverImage: article.coverImage || "",
    category: article.category,
    tags: article.tags.join(", "),
    seoMetaTitle: article.seoMetaTitle || "",
    seoMetaDescription: article.seoMetaDescription || "",
    seoKeywords: article.seoKeywords.join(", "),
    linkedProductIds: article.linkedProductIds,
  };
}

export default function AdminBlogPage() {
  const [drafts, setDrafts] = useState<BlogContentDraft[]>([]);
  const [articles, setArticles] = useState<BlogArticle[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [contentImageAlt, setContentImageAlt] = useState("");
  const [uploadingContentImage, setUploadingContentImage] = useState(false);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

  const linkedProductSet = useMemo(() => new Set(editor?.linkedProductIds || []), [editor?.linkedProductIds]);

  const load = async () => {
    setLoading(true);
    try {
      const [draftResponse, articleResponse] = await Promise.all([
        getAdminBlogDrafts(),
        getAdminBlogArticles({ limit: 100 }),
      ]);
      setDrafts(draftResponse.drafts);
      setArticles(articleResponse.articles);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger le blog");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (productSearch.trim().length < 2) {
      setProductResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      getAdminProducts({ search: productSearch.trim(), limit: 8 })
        .then((response) => setProductResults(response.products))
        .catch(() => setProductResults([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [productSearch]);

  const chooseTemplate = (templateId: string) => {
    const template = TEMPLATES.find((item) => item.id === templateId);
    if (!template) return;
    if (editor && editor.content.trim() && !window.confirm("Appliquer ce template remplacera le contenu actuel de l’article. Continuer ?")) return;
    setEditor((current) => current ? {
      ...current,
      title: current.title || template.title,
      content: template.content,
      category: current.category === "Conseils barbier" ? template.category : current.category,
      seoMetaTitle: current.seoMetaTitle || template.title,
    } : {
      ...EMPTY_EDITOR,
      title: template.title,
      content: template.content,
      category: template.category,
      seoMetaTitle: template.title,
    });
    if (!editor) setSelectedProducts([]);
    setError("");
    setNotice("");
  };

  const hydrateLinkedProducts = async (productIds: string[]) => {
    if (!productIds.length) {
      setSelectedProducts([]);
      return;
    }
    const products = await Promise.all(productIds.map((id) => getAdminProduct(id).catch(() => null)));
    setSelectedProducts(products.filter((product): product is Product => Boolean(product)));
  };

  const openArticleEditor = (article: BlogArticle) => {
    setEditor(articleToEditor(article));
    setNotice("");
    setError("");
    void hydrateLinkedProducts(article.linkedProductIds);
  };

  const finalizeDraft = async (draft: BlogContentDraft) => {
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const article = await createAdminBlogArticleFromDraft(draft.id);
      setEditor(articleToEditor(article));
      await hydrateLinkedProducts(article.linkedProductIds);
      setNotice("Le brouillon Hermes a été transformé en article éditable. Il reste non publié tant que vous ne le décidez pas.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Impossible de finaliser ce brouillon");
    } finally {
      setSaving(false);
    }
  };

  const saveArticle = async () => {
    if (!editor) return;
    if (!editor.title.trim() || !editor.content.trim()) {
      setError("Le titre et le contenu sont requis.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    const payload: Partial<BlogArticle> = {
      title: editor.title.trim(),
      slug: editor.slug.trim(),
      content: editor.content.trim(),
      excerpt: editor.excerpt.trim(),
      coverImage: editor.coverImage.trim() || null,
      category: editor.category.trim() || "Conseils barbier",
      tags: splitValues(editor.tags),
      seoMetaTitle: editor.seoMetaTitle.trim() || null,
      seoMetaDescription: editor.seoMetaDescription.trim() || null,
      seoKeywords: splitValues(editor.seoKeywords),
      linkedProductIds: editor.linkedProductIds,
      sourceDraftId: editor.sourceDraftId || null,
    };
    try {
      const article = editor.id
        ? await updateAdminBlogArticle(editor.id, payload)
        : await createAdminBlogArticle({ ...payload, status: "draft" });
      setEditor(articleToEditor(article));
      await hydrateLinkedProducts(article.linkedProductIds);
      setNotice("Article sauvegardé en brouillon. La publication reste une action humaine explicite.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Impossible de sauvegarder l’article");
    } finally {
      setSaving(false);
    }
  };

  const uploadCover = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editor) return;
    setUploading(true);
    setError("");
    try {
      const coverImage = await uploadBlogCoverToCloudinary(file);
      setEditor({ ...editor, coverImage });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Impossible d’importer l’image");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const uploadContentImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editor) return;

    setUploadingContentImage(true);
    setError("");
    try {
      const imageUrl = await uploadBlogCoverToCloudinary(file);
      const textarea = contentTextareaRef.current;
      const selectionStart = textarea?.selectionStart ?? editor.content.length;
      const selectionEnd = textarea?.selectionEnd ?? selectionStart;
      const alt = (contentImageAlt.trim() || "Illustration de l’article").replace(/[\[\]]/g, "");
      const markdownImage = `\n\n![${alt}](${imageUrl})\n\n`;
      const nextContent = `${editor.content.slice(0, selectionStart)}${markdownImage}${editor.content.slice(selectionEnd)}`;
      setEditor({ ...editor, content: nextContent });
      setContentImageAlt("");
      window.requestAnimationFrame(() => {
        textarea?.focus();
        const nextCursor = selectionStart + markdownImage.length;
        textarea?.setSelectionRange(nextCursor, nextCursor);
      });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Impossible d’importer l’image dans le contenu");
    } finally {
      setUploadingContentImage(false);
      event.target.value = "";
    }
  };

  const addProduct = (product: Product) => {
    if (!editor || linkedProductSet.has(product.id)) return;
    setEditor({ ...editor, linkedProductIds: [...editor.linkedProductIds, product.id] });
    setSelectedProducts((current) => [...current, product]);
    setProductSearch("");
    setProductResults([]);
  };

  const removeProduct = (productId: string) => {
    if (!editor) return;
    setEditor({ ...editor, linkedProductIds: editor.linkedProductIds.filter((id) => id !== productId) });
    setSelectedProducts((current) => current.filter((product) => product.id !== productId));
  };

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="animate-spin text-[#fd2786]" size={30} /></div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"><ArrowLeft size={18} /></Link>
          <div>
            <p className="text-sm font-semibold text-[#fd2786]">CONTENU & CONVERSION</p>
            <h1 className="text-2xl font-bold text-[#0f056b]">Blog</h1>
            <p className="text-sm text-gray-600">Les idées Hermes restent en attente de votre validation avant toute publication.</p>
          </div>
        </div>
        <button onClick={() => { setEditor({ ...EMPTY_EDITOR }); setSelectedProducts([]); setNotice(""); setError(""); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0f056b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#180a8d]">
          <FilePlus2 size={17} /> Nouvel article
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

      <section className="rounded-2xl border border-[#fd2786]/25 bg-[#fd2786]/5 p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2"><Sparkles size={19} className="text-[#fd2786]" /><div><h2 className="font-bold text-[#0f056b]">Idées Hermes à valider</h2><p className="text-xs text-gray-600">L’agent propose ; vous choisissez de finaliser et modifiez avant publication.</p></div></div>
        {drafts.length === 0 ? <p className="text-sm text-gray-600">Aucune idée blog en attente.</p> : (
          <div className="grid gap-3 lg:grid-cols-2">
            {drafts.map((draft) => (
              <article key={draft.id} className="rounded-xl border border-white bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-[#fd2786]">{draft.status === "review" ? "En finalisation" : "À valider"}</p><h3 className="mt-1 font-semibold text-gray-900">{draft.prefill.title}</h3><p className="mt-1 line-clamp-2 text-sm text-gray-600">{draft.prefill.metaDescription || draft.content}</p></div><BookOpen className="shrink-0 text-[#0f056b]" size={20} /></div>
                <div className="mt-3 flex items-center justify-between gap-2"><span className="text-xs text-gray-500">{new Date(draft.createdAt).toLocaleDateString("fr-FR")}</span>{draft.blogArticle ? <button onClick={() => { const article = articles.find((item) => item.id === draft.blogArticle?.id); if (article) openArticleEditor(article); }} className="rounded-lg border border-[#0f056b]/20 px-3 py-2 text-xs font-semibold text-[#0f056b] hover:bg-[#0f056b]/5">Ouvrir l’article</button> : <button disabled={saving} onClick={() => void finalizeDraft(draft)} className="inline-flex items-center gap-1 rounded-lg bg-[#fd2786] px-3 py-2 text-xs font-semibold text-white hover:bg-[#df1d70] disabled:opacity-50">{saving ? <Loader2 size={13} className="animate-spin" /> : <Pencil size={13} />} Finaliser cette idée</button>}</div>
              </article>
            ))}
          </div>
        )}
      </section>

      {!editor && (
        <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
          <h2 className="font-bold text-[#0f056b]">Créer à partir d’un template</h2>
          <p className="mt-1 text-sm text-gray-600">Chaque template structure l’article pour le SEO, la lecture et les liens produits.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {TEMPLATES.map((template) => <button key={template.id} onClick={() => chooseTemplate(template.id)} className="rounded-xl border border-gray-200 p-4 text-left transition hover:border-[#fd2786] hover:bg-[#fd2786]/5"><h3 className="font-semibold text-[#0f056b]">{template.label}</h3><p className="mt-1 text-sm text-gray-600">{template.description}</p></button>)}
          </div>
        </section>
      )}

      {editor && (
        <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-[#0f056b]">{editor.id ? "Éditer l’article" : "Nouvel article"}</h2><p className="text-sm text-gray-600">Sauvegardez d’abord le contenu. La publication immédiate et la planification arrivent dans l’étape suivante.</p></div><div className="flex flex-wrap gap-2"><button onClick={() => setPreviewing(true)} className="inline-flex items-center gap-2 rounded-lg border border-[#fd2786] px-3 py-2 text-sm font-semibold text-[#fd2786] hover:bg-[#fd2786]/5"><Eye size={16} /> Prévisualiser</button><button onClick={() => setEditor(null)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">Fermer</button><button disabled={saving} onClick={() => void saveArticle()} className="inline-flex items-center gap-2 rounded-lg bg-[#0f056b] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Sauvegarder le brouillon</button></div></div>
          <div className="mb-5 rounded-xl border border-[#fd2786]/25 bg-[#fd2786]/5 p-4"><div className="flex flex-wrap items-end justify-between gap-2"><div><h3 className="font-semibold text-[#0f056b]">Choisir une structure</h3><p className="text-xs text-gray-600">Disponible aussi après « Finaliser cette idée ». L’application d’un modèle remplace le corps actuel après confirmation.</p></div><span className="text-xs font-semibold text-[#fd2786]">4 templates</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{TEMPLATES.map((template) => <button key={template.id} onClick={() => chooseTemplate(template.id)} className="rounded-lg border border-white bg-white p-3 text-left transition hover:border-[#fd2786] hover:bg-[#fd2786]/5"><p className="text-sm font-semibold text-[#0f056b]">{template.label}</p><p className="mt-1 text-xs text-gray-600">{template.description}</p></button>)}</div></div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">Titre<input value={editor.title} onChange={(event) => setEditor({ ...editor, title: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 focus:border-[#fd2786] focus:outline-none" /></label>
              <div className="space-y-2"><label className="block text-sm font-medium text-gray-700" htmlFor="blog-content">Contenu (Markdown)</label><div className="flex flex-col gap-2 rounded-lg border border-dashed border-[#0f056b]/25 bg-[#0f056b]/[0.03] p-3 sm:flex-row sm:items-end"><label className="min-w-0 flex-1 text-xs font-medium text-gray-700" htmlFor="blog-image-alt">Texte alternatif de l’image<input id="blog-image-alt" value={contentImageAlt} onChange={(event) => setContentImageAlt(event.target.value)} placeholder="Ex. Comparatif de cires coiffantes" className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-900 focus:border-[#fd2786] focus:outline-none" /></label><label className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#0f056b]/20 bg-white px-3 py-2 text-sm font-semibold text-[#0f056b] transition hover:bg-[#0f056b]/5"><ImagePlus size={16} />{uploadingContentImage ? "Import en cours…" : "Insérer une image"}<input type="file" accept="image/*" disabled={uploadingContentImage} onChange={uploadContentImage} className="hidden" /></label></div><p className="text-xs text-gray-500">L’image est insérée à la position du curseur sous forme Markdown et son texte alternatif est utilisé pour l’accessibilité et le référencement.</p><textarea id="blog-content" ref={contentTextareaRef} value={editor.content} onChange={(event) => setEditor({ ...editor, content: event.target.value })} rows={20} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 font-mono text-sm text-gray-900 focus:border-[#fd2786] focus:outline-none" /></div>
              <label className="block text-sm font-medium text-gray-700">Extrait<input value={editor.excerpt} onChange={(event) => setEditor({ ...editor, excerpt: event.target.value })} placeholder="Résumé court affiché dans la liste blog" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 focus:border-[#fd2786] focus:outline-none" /></label>
            </div>
            <aside className="space-y-4 rounded-xl bg-gray-50 p-4">
              <div><p className="mb-2 text-sm font-semibold text-[#0f056b]">Image de couverture</p>{editor.coverImage ? <div className="relative"><img src={editor.coverImage} alt="Couverture article" className="h-40 w-full rounded-lg object-cover" /><button onClick={() => setEditor({ ...editor, coverImage: "" })} className="absolute right-2 top-2 rounded-full bg-white p-1.5 text-gray-700 shadow"><X size={14} /></button></div> : <label className="flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[#0f056b]/30 bg-white text-sm text-[#0f056b] hover:bg-[#0f056b]/5"><ImagePlus size={22} />{uploading ? "Import en cours..." : "Importer une couverture"}<input type="file" accept="image/*" onChange={uploadCover} className="hidden" /></label>}</div>
              <label className="block text-sm font-medium text-gray-700">Catégorie<input value={editor.category} onChange={(event) => setEditor({ ...editor, category: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
              <label className="block text-sm font-medium text-gray-700">Tags<input value={editor.tags} onChange={(event) => setEditor({ ...editor, tags: event.target.value })} placeholder="barbe, coiffure" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
              <div><p className="mb-2 text-sm font-semibold text-[#0f056b]">Produits liés</p><div className="relative"><Search size={15} className="absolute left-3 top-2.5 text-gray-400" /><input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Rechercher le catalogue" className="w-full rounded-lg border border-gray-300 py-2 pl-8 pr-3 text-sm" />{productResults.length > 0 && <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">{productResults.map((product) => <button key={product.id} onClick={() => addProduct(product)} className="block w-full border-b border-gray-100 px-3 py-2 text-left text-xs hover:bg-gray-50">{product.name}</button>)}</div>}</div><div className="mt-2 flex flex-wrap gap-1">{editor.linkedProductIds.map((id) => <span key={id} className="inline-flex items-center gap-1 rounded-full bg-[#0f056b]/10 px-2 py-1 text-xs text-[#0f056b]">{selectedProducts.find((product) => product.id === id)?.name || id.slice(0, 10)}<button onClick={() => removeProduct(id)}><X size={12} /></button></span>)}</div></div>
              <div className="border-t border-gray-200 pt-4"><div className="mb-2 flex items-center gap-1 text-sm font-semibold text-[#0f056b]"><Tag size={15} /> SEO</div><label className="block text-xs font-medium text-gray-600">Slug<input value={editor.slug} onChange={(event) => setEditor({ ...editor, slug: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label><label className="mt-3 block text-xs font-medium text-gray-600">Meta title<input value={editor.seoMetaTitle} onChange={(event) => setEditor({ ...editor, seoMetaTitle: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label><label className="mt-3 block text-xs font-medium text-gray-600">Meta description<textarea value={editor.seoMetaDescription} onChange={(event) => setEditor({ ...editor, seoMetaDescription: event.target.value })} rows={3} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label><label className="mt-3 block text-xs font-medium text-gray-600">Mots-clés<input value={editor.seoKeywords} onChange={(event) => setEditor({ ...editor, seoKeywords: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label></div>
            </aside>
          </div>
        </section>
      )}

      {editor && previewing && <BlogArticlePreview article={{ title: editor.title, excerpt: editor.excerpt, content: editor.content, coverImage: editor.coverImage, category: editor.category, tags: splitValues(editor.tags) }} products={selectedProducts.filter((product) => editor.linkedProductIds.includes(product.id))} onClose={() => setPreviewing(false)} />}

      <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5"><div className="mb-4 flex items-center gap-2"><BookOpen size={19} className="text-[#0f056b]" /><div><h2 className="font-bold text-[#0f056b]">Articles</h2><p className="text-xs text-gray-600">Brouillons en cours et publications existantes.</p></div></div>{articles.length === 0 ? <p className="text-sm text-gray-600">Aucun article BlogArticle pour le moment.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500"><tr><th className="pb-2">Titre</th><th className="pb-2">Catégorie</th><th className="pb-2">Statut</th><th className="pb-2">Mis à jour</th><th className="pb-2" /></tr></thead><tbody>{articles.map((article) => <tr key={article.id} className="border-b border-gray-100"><td className="py-3 font-medium text-gray-900">{article.title}</td><td className="py-3 text-gray-600">{article.category}</td><td className="py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${article.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-700"}`}>{article.status === "published" ? "Publié" : "Brouillon"}</span></td><td className="py-3 text-gray-500">{new Date(article.updatedAt).toLocaleDateString("fr-FR")}</td><td className="py-3 text-right"><button onClick={() => openArticleEditor(article)} className="rounded-lg border border-[#0f056b]/20 px-3 py-1.5 text-xs font-semibold text-[#0f056b] hover:bg-[#0f056b]/5">Modifier</button></td></tr>)}</tbody></table></div>}</section>
    </div>
  );
}
