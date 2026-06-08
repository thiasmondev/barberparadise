"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  createAdminCarouselSlide,
  deleteAdminCarouselSlide,
  getAdminCarouselSlides,
  reorderAdminCarouselSlides,
  toggleAdminCarouselSlide,
  updateAdminCarouselSlide,
  uploadAdminCarouselSlide,
  type AdminCarouselSlide,
  type AdminCarouselSlidePayload,
} from "@/lib/admin-api";

type FormStatus = { type: "success" | "error" | "info"; message: string } | null;

type SlideFormState = {
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  imageMobileUrl: string;
  imageAlt: string;
  ctaText: string;
  ctaLink: string;
  ctaStyle: "primary" | "secondary" | "outline";
  textPosition: "left" | "center" | "right";
  textColor: string;
  overlayOpacity: string;
  category: "promo" | "nouveaute" | "event" | "saison" | "general";
  startDate: string;
  endDate: string;
  isActive: boolean;
};

const emptyForm: SlideFormState = {
  title: "",
  subtitle: "",
  description: "",
  imageUrl: "",
  imageMobileUrl: "",
  imageAlt: "",
  ctaText: "",
  ctaLink: "",
  ctaStyle: "primary",
  textPosition: "left",
  textColor: "#FFFFFF",
  overlayOpacity: "0.3",
  category: "general",
  startDate: "",
  endDate: "",
  isActive: true,
};

const categories = [
  { value: "general", label: "Général" },
  { value: "promo", label: "Promo" },
  { value: "nouveaute", label: "Nouveauté" },
  { value: "event", label: "Événement" },
  { value: "saison", label: "Saison" },
] as const;

const ctaStyles = [
  { value: "primary", label: "Principal" },
  { value: "secondary", label: "Secondaire" },
  { value: "outline", label: "Contour" },
] as const;

const positions = [
  { value: "left", label: "Gauche" },
  { value: "center", label: "Centre" },
  { value: "right", label: "Droite" },
] as const;

function toInputDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

function fromSlide(slide: AdminCarouselSlide): SlideFormState {
  return {
    title: slide.title ?? "",
    subtitle: slide.subtitle ?? "",
    description: slide.description ?? "",
    imageUrl: slide.imageUrl,
    imageMobileUrl: slide.imageMobileUrl ?? "",
    imageAlt: slide.imageAlt ?? "",
    ctaText: slide.ctaText ?? "",
    ctaLink: slide.ctaLink ?? "",
    ctaStyle: (slide.ctaStyle as SlideFormState["ctaStyle"]) || "primary",
    textPosition: (slide.textPosition as SlideFormState["textPosition"]) || "left",
    textColor: slide.textColor || "#FFFFFF",
    overlayOpacity: String(slide.overlayOpacity ?? 0.3),
    category: (slide.category as SlideFormState["category"]) || "general",
    startDate: toInputDateTime(slide.startDate),
    endDate: toInputDateTime(slide.endDate),
    isActive: slide.isActive,
  };
}

function asPayload(form: SlideFormState): AdminCarouselSlidePayload {
  return {
    title: form.title.trim() || null,
    subtitle: form.subtitle.trim() || null,
    description: form.description.trim() || null,
    imageUrl: form.imageUrl.trim(),
    imageMobileUrl: form.imageMobileUrl.trim() || null,
    imageAlt: form.imageAlt.trim() || form.title.trim() || "Barber Paradise",
    ctaText: form.ctaText.trim() || null,
    ctaLink: form.ctaLink.trim() || null,
    ctaStyle: form.ctaStyle,
    textPosition: form.textPosition,
    textColor: form.textColor,
    overlayOpacity: Number(form.overlayOpacity || 0.3),
    category: form.category,
    startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
    endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
    isActive: form.isActive,
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function StatusBanner({ status }: { status: FormStatus }) {
  if (!status) return null;
  const classes = status.type === "success"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : status.type === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-blue-200 bg-blue-50 text-blue-800";
  return <div className={`rounded-xl border px-4 py-3 text-sm ${classes}`}>{status.message}</div>;
}

function categoryLabel(value: string) {
  return categories.find((category) => category.value === value)?.label ?? value;
}

function textAlignment(position: string) {
  if (position === "center") return "items-center text-center mx-auto";
  if (position === "right") return "items-end text-right ml-auto";
  return "items-start text-left mr-auto";
}

function ctaClasses(style: string) {
  if (style === "secondary") return "border border-white/80 bg-white/15 text-white";
  if (style === "outline") return "border border-white bg-transparent text-white";
  return "bg-white text-black";
}

function SlidePreview({ form }: { form: SlideFormState }) {
  const imageUrl = form.imageUrl || form.imageMobileUrl;
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-black shadow-sm">
      <div className="relative aspect-[1920/600] min-h-[220px]">
        {imageUrl ? (
          <Image src={imageUrl} alt={form.imageAlt || form.title || "Aperçu carrousel"} fill sizes="720px" className="object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-sm text-gray-400">Aucun visuel sélectionné</div>
        )}
        <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${Math.min(0.85, Math.max(0, Number(form.overlayOpacity || 0.3)))})` }} />
        <div className="absolute inset-0 flex items-center p-8">
          <div className={`flex max-w-lg flex-col gap-2 ${textAlignment(form.textPosition)}`} style={{ color: form.textColor }}>
            {form.subtitle && <p className="text-xs font-bold uppercase tracking-[0.3em]">{form.subtitle}</p>}
            {form.title && <h3 className="text-3xl font-black uppercase leading-tight md:text-5xl">{form.title}</h3>}
            {form.description && <p className="text-sm leading-6 text-white/90">{form.description}</p>}
            {form.ctaText && <span className={`mt-2 inline-flex rounded-full px-5 py-2 text-xs font-bold uppercase ${ctaClasses(form.ctaStyle)}`}>{form.ctaText}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminCarouselPage() {
  const [slides, setSlides] = useState<AdminCarouselSlide[]>([]);
  const [form, setForm] = useState<SlideFormState>(emptyForm);
  const [editingSlide, setEditingSlide] = useState<AdminCarouselSlide | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<FormStatus>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");

  const filteredSlides = useMemo(() => {
    if (categoryFilter === "all") return slides;
    return slides.filter((slide) => slide.category === categoryFilter);
  }, [categoryFilter, slides]);

  async function loadSlides() {
    setIsLoading(true);
    try {
      const data = await getAdminCarouselSlides();
      setSlides(data.slides);
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Impossible de charger les slides." });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadSlides();
  }, []);

  function updateForm<K extends keyof SlideFormState>(key: K, value: SlideFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (!file) {
      setFilePreview("");
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    setFilePreview(dataUrl);
    setForm((prev) => ({ ...prev, imageUrl: prev.imageUrl || dataUrl, imageAlt: prev.imageAlt || file.name.replace(/\.[^.]+$/, "") }));
  }

  function startEdit(slide: AdminCarouselSlide) {
    setEditingSlide(slide);
    setForm(fromSlide(slide));
    setSelectedFile(null);
    setFilePreview("");
    setStatus({ type: "info", message: `Modification de la slide « ${slide.title || slide.id} ».` });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingSlide(null);
    setForm(emptyForm);
    setSelectedFile(null);
    setFilePreview("");
    setStatus(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setStatus(null);
    try {
      if (!editingSlide && selectedFile) {
        const dataUrl = await readFileAsDataUrl(selectedFile);
        const imageBase64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
        await uploadAdminCarouselSlide({ ...asPayload(form), imageBase64, createdBy: "admin" });
      } else if (editingSlide) {
        if (!form.imageUrl.trim()) throw new Error("L’URL image desktop est obligatoire pour modifier une slide.");
        await updateAdminCarouselSlide(editingSlide.id, asPayload(form));
      } else {
        if (!form.imageUrl.trim()) throw new Error("Ajoute une image ou renseigne une URL image desktop.");
        await createAdminCarouselSlide(asPayload(form));
      }
      setStatus({ type: "success", message: editingSlide ? "Slide mise à jour." : "Slide créée." });
      resetForm();
      await loadSlides();
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Erreur pendant l’enregistrement." });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggle(slide: AdminCarouselSlide) {
    try {
      await toggleAdminCarouselSlide(slide.id);
      await loadSlides();
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Impossible de changer le statut." });
    }
  }

  async function handleDelete(slide: AdminCarouselSlide) {
    if (!window.confirm(`Supprimer la slide « ${slide.title || slide.id} » ?`)) return;
    try {
      await deleteAdminCarouselSlide(slide.id);
      await loadSlides();
      setStatus({ type: "success", message: "Slide supprimée." });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Suppression impossible." });
    }
  }

  async function moveSlide(slide: AdminCarouselSlide, direction: -1 | 1) {
    const ordered = [...slides].sort((a, b) => a.position - b.position);
    const index = ordered.findIndex((item) => item.id === slide.id);
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    const swapped = [...ordered];
    [swapped[index], swapped[target]] = [swapped[target], swapped[index]];
    const order = swapped.map((item, position) => ({ id: item.id, position }));
    try {
      await reorderAdminCarouselSlides(order);
      await loadSlides();
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Réordonnancement impossible." });
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">Homepage</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-950">Carrousel dynamique</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
            Gérez les bannières de la page d’accueil et les créations envoyées par Buzz. La route publique affiche uniquement les slides actives et planifiées.
          </p>
        </div>
        <button type="button" onClick={resetForm} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 py-3 text-sm font-bold text-white hover:bg-gray-800">
          <Plus size={16} /> Nouvelle slide
        </button>
      </div>

      <StatusBanner status={status} />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
        <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-950">{editingSlide ? "Modifier une slide" : "Créer une slide"}</h2>
              <p className="text-sm text-gray-500">Upload Cloudinary ou URL existante, texte, CTA et planification.</p>
            </div>
            <button disabled={isSaving} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60">
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {editingSlide ? "Mettre à jour" : "Enregistrer"}
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm font-medium text-gray-700">
              Titre
              <input value={form.title} onChange={(e) => updateForm("title", e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2" placeholder="Fête des Pères" />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700">
              Sous-titre
              <input value={form.subtitle} onChange={(e) => updateForm("subtitle", e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2" placeholder="-20% sur les coffrets" />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700 md:col-span-2">
              Description
              <textarea value={form.description} onChange={(e) => updateForm("description", e.target.value)} className="min-h-24 w-full rounded-xl border border-gray-200 px-3 py-2" placeholder="Message marketing court affiché sur la bannière." />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500 hover:border-primary hover:bg-primary/5">
              <UploadCloud size={28} className="mb-2 text-primary" />
              <span className="font-semibold text-gray-700">Uploader une image</span>
              <span>Cloudinary créera desktop 1920×600 et mobile 1080×1080.</span>
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </label>
            <div className="space-y-3">
              {filePreview ? <div className="relative aspect-[16/6] overflow-hidden rounded-xl border"><Image src={filePreview} alt="Prévisualisation upload" fill className="object-cover" /></div> : null}
              <label className="space-y-1 text-sm font-medium text-gray-700">
                URL image desktop
                <input value={form.imageUrl} onChange={(e) => updateForm("imageUrl", e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2" placeholder="https://..." />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700">
                URL image mobile
                <input value={form.imageMobileUrl} onChange={(e) => updateForm("imageMobileUrl", e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2" placeholder="Optionnel" />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Texte alternatif SEO
                <input value={form.imageAlt} onChange={(e) => updateForm("imageAlt", e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2" placeholder="Barber Paradise — promotion" />
              </label>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1 text-sm font-medium text-gray-700">
              Texte bouton
              <input value={form.ctaText} onChange={(e) => updateForm("ctaText", e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2" placeholder="Voir la sélection" />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700">
              Lien bouton
              <input value={form.ctaLink} onChange={(e) => updateForm("ctaLink", e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2" placeholder="/catalogue" />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700">
              Style bouton
              <select value={form.ctaStyle} onChange={(e) => updateForm("ctaStyle", e.target.value as SlideFormState["ctaStyle"])} className="w-full rounded-xl border border-gray-200 px-3 py-2">
                {ctaStyles.map((style) => <option key={style.value} value={style.value}>{style.label}</option>)}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-5">
            <label className="space-y-1 text-sm font-medium text-gray-700">
              Position texte
              <select value={form.textPosition} onChange={(e) => updateForm("textPosition", e.target.value as SlideFormState["textPosition"])} className="w-full rounded-xl border border-gray-200 px-3 py-2">
                {positions.map((position) => <option key={position.value} value={position.value}>{position.label}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700">
              Couleur texte
              <input type="color" value={form.textColor} onChange={(e) => updateForm("textColor", e.target.value)} className="h-10 w-full rounded-xl border border-gray-200 px-2 py-1" />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700">
              Overlay
              <input type="number" min="0" max="1" step="0.05" value={form.overlayOpacity} onChange={(e) => updateForm("overlayOpacity", e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700">
              Catégorie
              <select value={form.category} onChange={(e) => updateForm("category", e.target.value as SlideFormState["category"])} className="w-full rounded-xl border border-gray-200 px-3 py-2">
                {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700">
              <input type="checkbox" checked={form.isActive} onChange={(e) => updateForm("isActive", e.target.checked)} /> Active
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm font-medium text-gray-700">
              Début diffusion
              <input type="datetime-local" value={form.startDate} onChange={(e) => updateForm("startDate", e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700">
              Fin diffusion
              <input type="datetime-local" value={form.endDate} onChange={(e) => updateForm("endDate", e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2" />
            </label>
          </div>
        </form>

        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-950"><ImagePlus size={18} /> Aperçu live</h2>
            <SlidePreview form={{ ...form, imageUrl: filePreview || form.imageUrl }} />
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
            <strong>Buzz</strong> peut créer une slide en une seule requête via <code>/api/carousel/upload</code>. Les slides issues de Buzz affichent un badge dans la liste.
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-950">Slides publiées et planifiées</h2>
            <p className="text-sm text-gray-500">Utilise les flèches pour réordonner. Le nouvel ordre est sauvegardé immédiatement.</p>
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
            <option value="all">Toutes les catégories</option>
            {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
          </select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-500"><Loader2 className="mr-2 animate-spin" size={18} /> Chargement...</div>
        ) : filteredSlides.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-sm text-gray-500">Aucune slide pour le moment.</div>
        ) : (
          <div className="space-y-3">
            {filteredSlides.map((slide, index) => {
              const now = Date.now();
              const startsInFuture = slide.startDate ? new Date(slide.startDate).getTime() > now : false;
              const isExpired = slide.endDate ? new Date(slide.endDate).getTime() < now : false;
              return (
                <div key={slide.id} className="grid gap-4 rounded-2xl border border-gray-100 p-4 md:grid-cols-[120px_minmax(0,1fr)_auto] md:items-center">
                  <div className="relative aspect-[16/7] overflow-hidden rounded-xl bg-gray-100">
                    <Image src={slide.imageUrl} alt={slide.imageAlt || slide.title || "Slide carrousel"} fill sizes="160px" className="object-cover" />
                  </div>
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-gray-950">{slide.title || "Slide sans titre"}</h3>
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">{categoryLabel(slide.category)}</span>
                      {slide.createdBy === "buzz" ? <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700">Buzz</span> : null}
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${slide.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{slide.isActive ? "Actif" : "Inactif"}</span>
                      {startsInFuture ? <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">Planifié</span> : null}
                      {isExpired ? <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700">Expiré</span> : null}
                    </div>
                    <p className="truncate text-sm text-gray-500">{slide.subtitle || slide.description || slide.ctaLink || "Aucun texte secondaire"}</p>
                    <p className="mt-1 text-xs text-gray-400">Position {slide.position} · {slide.startDate ? `Début ${new Date(slide.startDate).toLocaleString("fr-FR")}` : "Début immédiat"} · {slide.endDate ? `Fin ${new Date(slide.endDate).toLocaleString("fr-FR")}` : "Sans fin"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <button type="button" onClick={() => moveSlide(slide, -1)} disabled={index === 0} className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-30" aria-label="Monter la slide"><ArrowUp size={16} /></button>
                    <button type="button" onClick={() => moveSlide(slide, 1)} disabled={index === filteredSlides.length - 1} className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-30" aria-label="Descendre la slide"><ArrowDown size={16} /></button>
                    <button type="button" onClick={() => handleToggle(slide)} className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50" aria-label="Changer le statut">{slide.isActive ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                    <button type="button" onClick={() => startEdit(slide)} className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50" aria-label="Modifier"><Pencil size={16} /></button>
                    <button type="button" onClick={() => handleDelete(slide)} className="rounded-lg border border-red-100 p-2 text-red-600 hover:bg-red-50" aria-label="Supprimer"><Trash2 size={16} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
