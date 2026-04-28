"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import {
  getAdminBrands,
  getAdminBrandStats,
  deleteAdminBrand,
  updateAdminBrand,
  uploadBrandLogo,
  uploadBrandBanner,
  type AdminBrand,
  type AdminBrandStats,
} from "@/lib/admin-api";
import {
  Upload,
  X,
  Check,
  Pencil,
  Trash2,
  AlertTriangle,
  Globe,
  Package,
  ImageIcon,
  Loader2,
  ExternalLink,
  Search,
} from "lucide-react";

// ─── Modale d'édition ────────────────────────────────────────
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
      let logoUrl = brand.logo;
      if (logoFile) {
        const res = await uploadBrandLogo(brand.id, logoFile);
        logoUrl = res.logo;
      }
      let bannerUrl = brand.bannerImage;
      if (bannerFile) {
        const res = await uploadBrandBanner(brand.id, bannerFile);
        bannerUrl = res.bannerImage;
      }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-dark-800">{brand.name}</h2>
            <p className="text-sm text-gray-400 mt-0.5">/{brand.slug}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Logo */}
          <div>
            <label className="block text-sm font-medium text-dark-700 mb-3">Logo</label>
            <div className="flex items-start gap-4">
              <div className="w-24 h-24 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
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
                  <ImageIcon size={32} className="text-gray-300" />
                )}
              </div>
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
                  className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-sm text-dark-700 transition-colors"
                >
                  <Upload size={16} />
                  {logoFile ? logoFile.name : "Choisir un logo"}
                </button>
                <p className="text-xs text-gray-400 mt-2">PNG, JPG, SVG, WebP — max 10 Mo — recommandé : 400×400 px</p>
                {logoFile && (
                  <button
                    onClick={() => { setLogoFile(null); setLogoPreview(brand.logo); }}
                    className="text-xs text-red-500 hover:text-red-600 mt-1"
                  >
                    Annuler le changement
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Bannière */}
          <div>
            <label className="block text-sm font-medium text-dark-700 mb-3">Image de bannière</label>
            <div
              className="w-full h-28 rounded-xl bg-gray-50 border border-dashed border-gray-300 overflow-hidden relative cursor-pointer hover:border-primary transition-colors"
              onClick={() => bannerInputRef.current?.click()}
            >
              {bannerPreview ? (
                <Image src={bannerPreview} alt="Bannière" fill className="object-cover" unoptimized />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <Upload size={24} className="text-gray-300" />
                  <span className="text-sm text-gray-400">Cliquer pour uploader une bannière</span>
                  <span className="text-xs text-gray-300">Recommandé : 1400×400 px</span>
                </div>
              )}
              {bannerPreview && (
                <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-sm font-medium flex items-center gap-2">
                    <Upload size={16} /> Changer la bannière
                  </span>
                </div>
              )}
            </div>
            <input ref={bannerInputRef} type="file" accept="image/*" onChange={handleBannerChange} className="hidden" />
            {bannerFile && (
              <button
                onClick={() => { setBannerFile(null); setBannerPreview(brand.bannerImage); }}
                className="text-xs text-red-500 hover:text-red-600 mt-1"
              >
                Annuler le changement
              </button>
            )}
          </div>

          {/* Nom */}
          <div>
            <label className="block text-sm font-medium text-dark-700 mb-2">Nom de la marque</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-dark-800 placeholder-gray-400 focus:outline-none focus:border-primary transition-colors text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-dark-700 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-dark-800 placeholder-gray-400 focus:outline-none focus:border-primary transition-colors resize-none text-sm"
              placeholder="Description de la marque..."
            />
          </div>

          {/* Site web */}
          <div>
            <label className="block text-sm font-medium text-dark-700 mb-2">Site web</label>
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-4 py-2.5 focus-within:border-primary transition-colors">
              <Globe size={16} className="text-gray-400 flex-shrink-0" />
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="flex-1 text-dark-800 placeholder-gray-400 focus:outline-none text-sm bg-transparent"
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Erreur */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Boutons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors text-sm"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving || success}
              className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium transition-colors text-sm flex items-center gap-2 disabled:opacity-60"
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

// ─── Modale de suppression définitive ─────────────────────────
function BrandDeleteModal({
  stats,
  onClose,
  onDeleted,
}: {
  stats: AdminBrandStats;
  onClose: () => void;
  onDeleted: (result: { brandId: number; brandName: string; productsDeleted: number }) => void;
}) {
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting]       = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const canDelete = confirmName === stats.brand.name;

  async function handleDelete() {
    if (!canDelete) return;
    setDeleting(true);
    setError(null);
    try {
      const result = await deleteAdminBrand(stats.brand.id);
      onDeleted({ brandId: stats.brand.id, brandName: result.brandName, productsDeleted: result.productsDeleted });
    } catch (err: any) {
      setError(err?.message || "Erreur lors de la suppression définitive");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white border border-red-100 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-red-100 bg-red-50/70 flex items-start gap-4">
          <div className="w-11 h-11 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-dark-800">Supprimer définitivement la marque</h2>
            <p className="text-sm text-red-600 mt-1">Cette action est irréversible.</p>
          </div>
          <button
            onClick={onClose}
            disabled={deleting}
            className="p-2 rounded-lg hover:bg-white/70 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-60"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-sm text-gray-600 leading-relaxed">
            Vous êtes sur le point de supprimer définitivement la marque <strong className="text-dark-800">{stats.brand.name}</strong>.
            Cette suppression retirera également <strong>{stats.productsCount}</strong> produit{stats.productsCount !== 1 ? "s" : ""}, <strong>{stats.reviewsCount}</strong> avis,
            <strong> {stats.variantsCount}</strong> variante{stats.variantsCount !== 1 ? "s" : ""} et <strong>{stats.imagesCount}</strong> image{stats.imagesCount !== 1 ? "s" : ""} référencée{stats.imagesCount !== 1 ? "s" : ""} dans les produits liés.
          </p>

          <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            Pour confirmer cette suppression définitive, saisissez exactement le nom de la marque : <strong>{stats.brand.name}</strong>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 mb-2">Nom exact de la marque</label>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={stats.brand.name}
              disabled={deleting}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-dark-800 placeholder-gray-400 focus:outline-none focus:border-red-400 transition-colors text-sm disabled:bg-gray-50"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              onClick={onClose}
              disabled={deleting}
              className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors text-sm disabled:opacity-60"
            >
              Annuler
            </button>
            <button
              onClick={handleDelete}
              disabled={!canDelete || deleting}
              className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleting ? <><Loader2 size={16} className="animate-spin" /> Suppression...</> : <><Trash2 size={16} /> Supprimer définitivement</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────
export default function AdminBrandsPage() {
  const [brands, setBrands]             = useState<AdminBrand[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [editingBrand, setEditingBrand]       = useState<AdminBrand | null>(null);
  const [deletingStats, setDeletingStats]     = useState<AdminBrandStats | null>(null);
  const [loadingDeleteId, setLoadingDeleteId] = useState<number | null>(null);
  const [toast, setToast]                     = useState<string | null>(null);
  const [search, setSearch]                   = useState("");

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

  const withLogo   = brands.filter((b) => b.logo).length;
  const withBanner = brands.filter((b) => b.bannerImage).length;
  const withDesc   = brands.filter((b) => b.description).length;

  function handleSaved(updated: AdminBrand) {
    setBrands((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  }

  async function handleOpenDelete(brand: AdminBrand) {
    setLoadingDeleteId(brand.id);
    setError(null);
    try {
      const stats = await getAdminBrandStats(brand.id);
      setDeletingStats(stats);
    } catch (err: any) {
      setToast(err?.message || "Impossible de charger les statistiques de suppression");
      setTimeout(() => setToast(null), 5000);
    } finally {
      setLoadingDeleteId(null);
    }
  }

  function handleDeleted(result: { brandId: number; brandName: string; productsDeleted: number }) {
    setBrands((prev) => prev.filter((brand) => brand.id !== result.brandId));
    setDeletingStats(null);
    const message = `La marque ${result.brandName} et ses ${result.productsDeleted} produits ont été supprimés définitivement`;
    setToast(message);
    setTimeout(() => setToast(null), 6000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-600 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed top-5 right-5 z-50 max-w-md rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700 shadow-lg transition-all">
          {toast}
        </div>
      )}

      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-heading font-bold text-xl text-dark-800">Marques</h1>
          <p className="text-sm text-gray-500">{brands.length} marques au total</p>
        </div>
        <a
          href="/marques"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:border-primary hover:text-primary transition-colors text-sm"
        >
          <ExternalLink size={14} />
          Voir la page marques
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total marques",    value: brands.length, color: "text-dark-800" },
          { label: "Avec logo",        value: withLogo,      color: "text-green-600" },
          { label: "Avec bannière",    value: withBanner,    color: "text-blue-600" },
          { label: "Avec description", value: withDesc,      color: "text-purple-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-gray-500 text-xs mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Recherche */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une marque..."
          className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-dark-800 placeholder-gray-400 focus:outline-none focus:border-primary transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
            className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:border-gray-200 hover:shadow-md transition-all"
          >
            {/* Bannière */}
            <div className="h-20 bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
              {brand.bannerImage ? (
                <Image src={brand.bannerImage} alt={`${brand.name} bannière`} fill className="object-cover" unoptimized />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <ImageIcon size={24} className="text-gray-200" />
                </div>
              )}
              {!brand.logo && (
                <div className="absolute top-2 right-2 bg-orange-100 text-orange-600 text-xs px-2 py-0.5 rounded-full font-medium">
                  Sans logo
                </div>
              )}
            </div>

            {/* Contenu */}
            <div className="p-4">
              <div className="flex items-start gap-3">
                {/* Logo */}
                <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0 -mt-8 relative z-10 shadow-sm">
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
                    <span className="text-lg font-bold text-gray-400">
                      {brand.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Infos */}
                <div className="flex-1 min-w-0 pt-1">
                  <h3 className="font-semibold text-dark-800 text-sm truncate">{brand.name}</h3>
                  <div className="flex items-center gap-1 text-gray-400 text-xs mt-0.5">
                    <Package size={11} />
                    <span>{brand.productCount} produit{brand.productCount !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              </div>

              {/* Description courte */}
              {brand.description && (
                <p className="text-gray-500 text-xs mt-3 line-clamp-2 leading-relaxed">
                  {brand.description}
                </p>
              )}

              {/* Indicateurs */}
              <div className="flex items-center gap-2 mt-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  brand.logo
                    ? "bg-green-50 text-green-600"
                    : "bg-orange-50 text-orange-600"
                }`}>
                  {brand.logo ? "Logo ✓" : "Logo manquant"}
                </span>
                {brand.website && (
                  <a
                    href={brand.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-primary transition-colors"
                    onClick={(e) => e.stopPropagation()}
                    title={brand.website}
                  >
                    <Globe size={13} />
                  </a>
                )}
              </div>

              {/* Actions */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setEditingBrand(brand)}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 hover:bg-primary/5 border border-gray-200 hover:border-primary/30 rounded-lg text-gray-600 hover:text-primary text-xs font-medium transition-all"
                >
                  <Pencil size={13} />
                  Modifier
                </button>
                <button
                  onClick={() => handleOpenDelete(brand)}
                  disabled={loadingDeleteId === brand.id}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 hover:bg-red-50 border border-gray-200 hover:border-red-200 rounded-lg text-red-600 hover:text-red-700 text-xs font-medium transition-all disabled:opacity-60 disabled:cursor-wait"
                >
                  {loadingDeleteId === brand.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
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

      {/* Modale de suppression définitive */}
      {deletingStats && (
        <BrandDeleteModal
          stats={deletingStats}
          onClose={() => setDeletingStats(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
