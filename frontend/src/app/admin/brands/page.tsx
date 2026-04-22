"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import {
  getAdminBrands,
  updateAdminBrand,
  uploadBrandLogo,
  uploadBrandBanner,
  type AdminBrand,
} from "@/lib/admin-api";
import {
  Upload,
  X,
  Check,
  Pencil,
  Globe,
  Package,
  ImageIcon,
  Loader2,
  ExternalLink,
} from "lucide-react";

// ─── Modale d'édition d'une marque ───────────────────────────
function BrandEditModal({
  brand,
  onClose,
  onSaved,
}: {
  brand: AdminBrand;
  onClose: () => void;
  onSaved: (updated: AdminBrand) => void;
}) {
  const [name, setName]               = useState(brand.name);
  const [description, setDescription] = useState(brand.description || "");
  const [website, setWebsite]         = useState(brand.website || "");
  const [logoPreview, setLogoPreview] = useState<string | null>(brand.logo);
  const [bannerPreview, setBannerPreview] = useState<string | null>(brand.bannerImage);
  const [logoFile, setLogoFile]       = useState<File | null>(null);
  const [bannerFile, setBannerFile]   = useState<File | null>(null);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState(false);

  const logoInputRef   = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function handleBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      // 1. Upload logo si changé
      let logoUrl = brand.logo;
      if (logoFile) {
        const res = await uploadBrandLogo(brand.id, logoFile);
        logoUrl = res.logo;
      }

      // 2. Upload bannière si changée
      let bannerUrl = brand.bannerImage;
      if (bannerFile) {
        const res = await uploadBrandBanner(brand.id, bannerFile);
        bannerUrl = res.bannerImage;
      }

      // 3. Mettre à jour les champs texte
      const updated = await updateAdminBrand(brand.id, {
        name:        name.trim() || brand.name,
        description: description.trim() || null,
        website:     website.trim() || null,
        logo:        logoUrl,
        bannerImage: bannerUrl,
      });

      setSuccess(true);
      setTimeout(() => {
        onSaved({ ...updated, productCount: brand.productCount });
        onClose();
      }, 800);
    } catch (err: any) {
      setError(err?.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white">{brand.name}</h2>
            <p className="text-sm text-white/50 mt-0.5">/{brand.slug}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Logo */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-3">Logo</label>
            <div className="flex items-start gap-4">
              {/* Aperçu */}
              <div className="w-24 h-24 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                {logoPreview ? (
                  <Image
                    src={logoPreview}
                    alt={brand.name}
                    width={96}
                    height={96}
                    className="object-contain w-full h-full p-2"
                    unoptimized
                  />
                ) : (
                  <ImageIcon size={32} className="text-white/20" />
                )}
              </div>
              {/* Bouton upload */}
              <div className="flex-1">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white transition-colors"
                >
                  <Upload size={16} />
                  {logoFile ? logoFile.name : "Choisir un logo"}
                </button>
                <p className="text-xs text-white/40 mt-2">PNG, JPG, SVG, WebP — max 10 Mo — recommandé : 400×400 px</p>
                {logoFile && (
                  <button
                    onClick={() => { setLogoFile(null); setLogoPreview(brand.logo); }}
                    className="text-xs text-red-400 hover:text-red-300 mt-1"
                  >
                    Annuler le changement
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Bannière */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-3">Image de bannière</label>
            <div
              className="w-full h-28 rounded-xl bg-white/5 border border-dashed border-white/20 overflow-hidden relative cursor-pointer hover:border-white/40 transition-colors"
              onClick={() => bannerInputRef.current?.click()}
            >
              {bannerPreview ? (
                <Image
                  src={bannerPreview}
                  alt="Bannière"
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <Upload size={24} className="text-white/30" />
                  <span className="text-sm text-white/40">Cliquer pour uploader une bannière</span>
                  <span className="text-xs text-white/30">Recommandé : 1400×400 px</span>
                </div>
              )}
              {bannerPreview && (
                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-sm font-medium flex items-center gap-2">
                    <Upload size={16} /> Changer la bannière
                  </span>
                </div>
              )}
            </div>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              onChange={handleBannerChange}
              className="hidden"
            />
            {bannerFile && (
              <button
                onClick={() => { setBannerFile(null); setBannerPreview(brand.bannerImage); }}
                className="text-xs text-red-400 hover:text-red-300 mt-1"
              >
                Annuler le changement
              </button>
            )}
          </div>

          {/* Nom */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Nom de la marque</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-[#e91e8c] transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-[#e91e8c] transition-colors resize-none"
              placeholder="Description de la marque..."
            />
          </div>

          {/* Site web */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Site web</label>
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-white/40 flex-shrink-0" />
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-[#e91e8c] transition-colors"
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Erreur */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Boutons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2.5 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 transition-colors text-sm"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving || success}
              className="px-5 py-2.5 rounded-lg bg-[#e91e8c] hover:bg-[#c4157a] text-white font-medium transition-colors text-sm flex items-center gap-2 disabled:opacity-60"
            >
              {saving ? (
                <><Loader2 size={16} className="animate-spin" /> Sauvegarde...</>
              ) : success ? (
                <><Check size={16} /> Sauvegardé !</>
              ) : (
                "Sauvegarder"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────
export default function AdminBrandsPage() {
  const [brands, setBrands]         = useState<AdminBrand[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [editingBrand, setEditingBrand] = useState<AdminBrand | null>(null);
  const [search, setSearch]         = useState("");

  useEffect(() => {
    getAdminBrands()
      .then(setBrands)
      .catch((err) => setError(err?.message || "Erreur chargement"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = brands.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.slug.toLowerCase().includes(search.toLowerCase())
  );

  const withLogo    = brands.filter((b) => b.logo).length;
  const withBanner  = brands.filter((b) => b.bannerImage).length;
  const withDesc    = brands.filter((b) => b.description).length;

  function handleSaved(updated: AdminBrand) {
    setBrands((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-[#e91e8c]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Marques</h1>
          <p className="text-white/50 text-sm mt-1">{brands.length} marques au total</p>
        </div>
        <a
          href="/marques"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 transition-colors text-sm"
        >
          <ExternalLink size={14} />
          Voir la page marques
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total marques",    value: brands.length,  color: "text-white" },
          { label: "Avec logo",        value: withLogo,       color: "text-green-400" },
          { label: "Avec bannière",    value: withBanner,     color: "text-blue-400" },
          { label: "Avec description", value: withDesc,       color: "text-purple-400" },
        ].map((s) => (
          <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-white/50 text-xs mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Recherche */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une marque..."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#e91e8c] transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Grille des marques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((brand) => (
          <div
            key={brand.id}
            className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-all group"
          >
            {/* Bannière ou fond */}
            <div className="h-20 bg-gradient-to-br from-white/5 to-white/10 relative overflow-hidden">
              {brand.bannerImage ? (
                <Image
                  src={brand.bannerImage}
                  alt={`${brand.name} bannière`}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <ImageIcon size={24} className="text-white/10" />
                </div>
              )}
              {/* Badge logo absent */}
              {!brand.logo && (
                <div className="absolute top-2 right-2 bg-orange-500/80 text-white text-xs px-2 py-0.5 rounded-full">
                  Sans logo
                </div>
              )}
            </div>

            {/* Contenu */}
            <div className="p-4">
              <div className="flex items-start gap-3">
                {/* Logo */}
                <div className="w-12 h-12 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0 -mt-8 relative z-10 shadow-lg">
                  {brand.logo ? (
                    <Image
                      src={brand.logo}
                      alt={brand.name}
                      width={48}
                      height={48}
                      className="object-contain w-full h-full p-1"
                      unoptimized
                    />
                  ) : (
                    <span className="text-lg font-bold text-white/40">
                      {brand.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Infos */}
                <div className="flex-1 min-w-0 pt-1">
                  <h3 className="font-semibold text-white text-sm truncate">{brand.name}</h3>
                  <div className="flex items-center gap-1 text-white/40 text-xs mt-0.5">
                    <Package size={11} />
                    <span>{brand.productCount} produit{brand.productCount !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              </div>

              {/* Description courte */}
              {brand.description && (
                <p className="text-white/40 text-xs mt-3 line-clamp-2 leading-relaxed">
                  {brand.description}
                </p>
              )}

              {/* Indicateurs */}
              <div className="flex items-center gap-2 mt-3">
                <span className={`text-xs px-2 py-0.5 rounded-full ${brand.logo ? "bg-green-500/15 text-green-400" : "bg-orange-500/15 text-orange-400"}`}>
                  {brand.logo ? "Logo ✓" : "Logo manquant"}
                </span>
                {brand.website && (
                  <a
                    href={brand.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-white/30 hover:text-white/60 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Globe size={12} />
                  </a>
                )}
              </div>

              {/* Bouton modifier */}
              <button
                onClick={() => setEditingBrand(brand)}
                className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-white/5 hover:bg-[#e91e8c]/20 border border-white/10 hover:border-[#e91e8c]/40 rounded-lg text-white/70 hover:text-white text-xs font-medium transition-all"
              >
                <Pencil size={13} />
                Modifier
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-white/30">
          Aucune marque trouvée pour « {search} »
        </div>
      )}

      {/* Modale d'édition */}
      {editingBrand && (
        <BrandEditModal
          brand={editingBrand}
          onClose={() => setEditingBrand(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
