"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  changeAdminPassword,
  getAdminLegalPage,
  getAdminLegalPages,
  updateAdminLegalPage,
  type AdminLegalPage,
} from "@/lib/admin-api";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Shield,
  FileText,
  Save,
  RefreshCw,
  ChevronRight,
  X,
  RotateCcw,
  Truck,
  MapPin,
  Scale,
  Cookie,
  ShieldCheck,
  Ban,
} from "lucide-react";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

const LEGAL_PAGE_ITEMS = [
  {
    slug: "politique-de-remboursement",
    label: "Politique de retour et de remboursement",
    description: "Procédure de retour, délais, inspection, remboursement et échange.",
    icon: "refund",
  },
  {
    slug: "politique-de-confidentialite",
    label: "Politique de confidentialité",
    description: "Données personnelles, bases légales, durées de conservation et droits RGPD.",
    icon: "privacy",
  },
  {
    slug: "cgv",
    label: "Conditions de service",
    description: "Conditions d’utilisation, vente, paiement, livraison et garanties.",
    icon: "terms",
  },
  {
    slug: "politique-expedition",
    label: "Politique d’expédition",
    description: "Préparation, transport, suivi, frais de livraison et responsabilité colis.",
    icon: "shipping",
  },
  {
    slug: "coordonnees",
    label: "Coordonnées",
    description: "Adresse, email, téléphone et informations de contact Barber Paradise.",
    icon: "contact",
  },
  {
    slug: "mentions-legales",
    label: "Mention légale",
    description: "Identité de l’entreprise, hébergement, directeur de publication et médiateur.",
    icon: "legal",
  },
  {
    slug: "cookies",
    label: "Politique de Cookies",
    description: "Usage des cookies, consentement, mesure d’audience et paramétrage.",
    icon: "cookies",
  },
  {
    slug: "politique-annulation-options-achat",
    label: "Politique d’annulation des options d’achat",
    description: "Conditions d’annulation applicables aux options d’achat et services associés.",
    icon: "cancellation",
    required: true,
  },
];

const LEGAL_PAGE_ORDER = LEGAL_PAGE_ITEMS.map((page) => page.slug);
const LEGAL_PAGE_LABELS = Object.fromEntries(LEGAL_PAGE_ITEMS.map((page) => [page.slug, page.label]));

function getLegalPolicyIcon(icon: string) {
  switch (icon) {
    case "refund":
      return <RotateCcw size={18} />;
    case "privacy":
      return <ShieldCheck size={18} />;
    case "shipping":
      return <Truck size={18} />;
    case "contact":
      return <MapPin size={18} />;
    case "legal":
      return <Scale size={18} />;
    case "cookies":
      return <Cookie size={18} />;
    case "cancellation":
      return <Ban size={18} />;
    default:
      return <FileText size={18} />;
  }
}

function formatUpdatedAt(value?: string) {
  if (!value) return "Jamais";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function ParametresPage() {
  const { admin } = useAdminAuth();

  const [activeTab, setActiveTab] = useState<"security" | "legal">("security");

  // Formulaire changement de mot de passe
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pages légales
  const [legalPages, setLegalPages] = useState<AdminLegalPage[]>([]);
  const [selectedLegalSlug, setSelectedLegalSlug] = useState<string | null>(null);
  const [legalTitle, setLegalTitle] = useState("");
  const [legalContent, setLegalContent] = useState("");
  const [originalLegalTitle, setOriginalLegalTitle] = useState("");
  const [originalLegalContent, setOriginalLegalContent] = useState("");
  const [legalLoading, setLegalLoading] = useState(false);
  const [legalModalLoading, setLegalModalLoading] = useState(false);
  const [legalSaving, setLegalSaving] = useState(false);
  const [legalSuccess, setLegalSuccess] = useState<string | null>(null);
  const [legalError, setLegalError] = useState<string | null>(null);

  const legalPagesBySlug = useMemo(() => {
    return Object.fromEntries(legalPages.map((page) => [page.slug, page]));
  }, [legalPages]);

  const selectedLegalItem = LEGAL_PAGE_ITEMS.find((page) => page.slug === selectedLegalSlug) || null;
  const isLegalDirty = legalTitle !== originalLegalTitle || legalContent !== originalLegalContent;

  useEffect(() => {
    async function loadLegalPages() {
      setLegalLoading(true);
      setLegalError(null);
      try {
        const pages = await getAdminLegalPages();
        const sortedPages = [...pages].sort((a, b) => {
          const aIndex = LEGAL_PAGE_ORDER.indexOf(a.slug);
          const bIndex = LEGAL_PAGE_ORDER.indexOf(b.slug);
          return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
        });
        setLegalPages(sortedPages);
      } catch (err) {
        setLegalError(err instanceof Error ? err.message : "Erreur lors du chargement des pages légales");
      } finally {
        setLegalLoading(false);
      }
    }

    loadLegalPages();
  }, []);

  // Indicateur de force du mot de passe
  function getPasswordStrength(pwd: string): { score: number; label: string; color: string } {
    if (!pwd) return { score: 0, label: "", color: "" };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { score, label: "Très faible", color: "bg-red-500" };
    if (score === 2) return { score, label: "Faible", color: "bg-orange-500" };
    if (score === 3) return { score, label: "Moyen", color: "bg-yellow-500" };
    if (score === 4) return { score, label: "Fort", color: "bg-blue-500" };
    return { score, label: "Très fort", color: "bg-green-500" };
  }

  const strength = getPasswordStrength(newPassword);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("Les deux nouveaux mots de passe ne correspondent pas.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("Le nouveau mot de passe doit être différent de l'actuel.");
      return;
    }

    setLoading(true);
    try {
      await changeAdminPassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors du changement de mot de passe");
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenLegalModal(slug: string) {
    const item = LEGAL_PAGE_ITEMS.find((page) => page.slug === slug);

    setSelectedLegalSlug(slug);
    setLegalTitle(item?.label || LEGAL_PAGE_LABELS[slug] || "Page légale");
    setLegalContent("");
    setOriginalLegalTitle(item?.label || LEGAL_PAGE_LABELS[slug] || "Page légale");
    setOriginalLegalContent("");
    setLegalError(null);
    setLegalSuccess(null);
    setLegalModalLoading(true);

    try {
      const page = await getAdminLegalPage(slug);
      setLegalTitle(page.title);
      setLegalContent(page.content);
      setOriginalLegalTitle(page.title);
      setOriginalLegalContent(page.content);
      setLegalPages((pages) => {
        const exists = pages.some((storedPage) => storedPage.slug === page.slug);
        if (exists) return pages.map((storedPage) => (storedPage.slug === page.slug ? page : storedPage));
        return [...pages, page].sort((a, b) => {
          const aIndex = LEGAL_PAGE_ORDER.indexOf(a.slug);
          const bIndex = LEGAL_PAGE_ORDER.indexOf(b.slug);
          return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
        });
      });
    } catch (err) {
      setLegalError(
        err instanceof Error
          ? `Impossible de charger cette page : ${err.message}`
          : "Impossible de charger cette page légale"
      );
    } finally {
      setLegalModalLoading(false);
    }
  }

  function handleCloseLegalModal() {
    if (legalSaving) return;
    setSelectedLegalSlug(null);
    setLegalTitle("");
    setLegalContent("");
    setOriginalLegalTitle("");
    setOriginalLegalContent("");
    setLegalModalLoading(false);
  }

  async function handleLegalSave(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLegalSlug) return;

    setLegalError(null);
    setLegalSuccess(null);

    if (!legalTitle.trim()) {
      setLegalError("Le titre de la page est obligatoire.");
      return;
    }
    if (!legalContent.trim()) {
      setLegalError("Le contenu Markdown est obligatoire.");
      return;
    }
    if (!isLegalDirty) return;

    setLegalSaving(true);
    try {
      const updatedPage = await updateAdminLegalPage(selectedLegalSlug, {
        title: legalTitle.trim(),
        content: legalContent,
      });
      setLegalPages((pages) => {
        const exists = pages.some((page) => page.slug === updatedPage.slug);
        const nextPages = exists
          ? pages.map((page) => (page.slug === updatedPage.slug ? updatedPage : page))
          : [...pages, updatedPage];
        return nextPages.sort((a, b) => {
          const aIndex = LEGAL_PAGE_ORDER.indexOf(a.slug);
          const bIndex = LEGAL_PAGE_ORDER.indexOf(b.slug);
          return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
        });
      });
      setOriginalLegalTitle(updatedPage.title);
      setOriginalLegalContent(updatedPage.content);
      setLegalSuccess(`${updatedPage.title} enregistrée avec succès.`);
      setSelectedLegalSlug(null);
    } catch (err) {
      setLegalError(err instanceof Error ? err.message : "Erreur lors de l’enregistrement de la page légale");
    } finally {
      setLegalSaving(false);
    }
  }

  return (
    <>
      <div className="max-w-6xl mx-auto space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-dark-900">Paramètres du compte</h1>
        <p className="text-gray-500 mt-1">Gérez les informations, la sécurité et les pages légales du site.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("security")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === "security" ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          Sécurité
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("legal")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === "legal" ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          Pages légales
        </button>
      </div>

      {activeTab === "security" ? (
        <div className="max-w-2xl space-y-6">
          {/* Infos du compte */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center text-primary text-xl font-bold">
                {admin?.name?.charAt(0).toUpperCase() || "A"}
              </div>
              <div>
                <div className="text-lg font-semibold text-dark-900">{admin?.name}</div>
                <div className="text-sm text-gray-500">{admin?.email}</div>
                <span className="inline-block mt-1 px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full capitalize">
                  {admin?.role || "admin"}
                </span>
              </div>
            </div>
          </div>

          {/* Changement de mot de passe */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-5">
              <Shield size={20} className="text-primary" />
              <h2 className="text-lg font-semibold text-dark-900">Changer le mot de passe</h2>
            </div>

            {success && (
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 mb-5">
                <CheckCircle size={18} className="flex-shrink-0" />
                <span className="text-sm font-medium">Mot de passe modifié avec succès !</span>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-5">
                <AlertCircle size={18} className="flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe actuel</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nouveau mot de passe</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="Minimum 8 caractères"
                    className="w-full pl-9 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {newPassword && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${i <= strength.score ? strength.color : "bg-gray-200"}`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">
                      Force : <span className="font-medium">{strength.label}</span>
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmer le nouveau mot de passe</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className={`w-full pl-9 pr-10 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${
                      confirmPassword && confirmPassword !== newPassword
                        ? "border-red-300 bg-red-50"
                        : confirmPassword && confirmPassword === newPassword
                        ? "border-green-300 bg-green-50"
                        : "border-gray-300"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-xs text-red-500 mt-1">Les mots de passe ne correspondent pas.</p>
                )}
                {confirmPassword && confirmPassword === newPassword && (
                  <p className="text-xs text-green-600 mt-1">Les mots de passe correspondent.</p>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                  className="w-full sm:w-auto px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Modification en cours...
                    </>
                  ) : (
                    <>
                      <Shield size={16} />
                      Changer le mot de passe
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">Conseils pour un mot de passe sécurisé</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Au moins 12 caractères</li>
              <li>• Mélangez majuscules, minuscules, chiffres et symboles (ex : @, !, #)</li>
              <li>• N'utilisez pas de mots du dictionnaire ni d'informations personnelles</li>
              <li>• Utilisez un gestionnaire de mots de passe (Bitwarden, 1Password...)</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden max-w-4xl">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 px-5 py-5 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold text-dark-900">Politiques écrites</h2>
                <p className="text-sm text-gray-600 mt-1 max-w-2xl">
                  Les politiques sont liées dans le pied de page et peuvent être ajoutées au menu de la boutique en ligne.
                  Cliquez sur une ligne pour modifier son contenu, comme dans Shopify.
                </p>
              </div>
              <span className="text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-3 py-1 whitespace-nowrap">
                {legalPages.length}/{LEGAL_PAGE_ITEMS.length} politiques en base
              </span>
            </div>

            {legalSuccess && (
              <div className="mx-5 mt-4 flex items-center gap-3 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3">
                <CheckCircle size={18} className="flex-shrink-0" />
                <span className="text-sm font-medium">{legalSuccess}</span>
              </div>
            )}

            {legalError && !selectedLegalSlug && (
              <div className="mx-5 mt-4 flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3">
                <AlertCircle size={18} className="flex-shrink-0" />
                <span className="text-sm">{legalError}</span>
              </div>
            )}

            {legalLoading ? (
              <div className="flex items-center gap-3 text-gray-500 text-sm p-5">
                <RefreshCw size={18} className="animate-spin" />
                Chargement des politiques écrites...
              </div>
            ) : (
              <div className="m-5 rounded-xl border border-gray-200 overflow-hidden bg-white divide-y divide-gray-100">
                {LEGAL_PAGE_ITEMS.map((item) => {
                  const page = legalPagesBySlug[item.slug];
                  return (
                    <button
                      key={item.slug}
                      type="button"
                      onClick={() => handleOpenLegalModal(item.slug)}
                      className="w-full px-4 py-3.5 flex items-center justify-between gap-4 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 text-gray-500 flex items-center justify-center flex-shrink-0">
                          {getLegalPolicyIcon(item.icon)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-medium text-dark-900 truncate">{item.label}</h3>
                            {item.required && (
                              <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 rounded-full px-2 py-0.5">
                                Obligatoire
                              </span>
                            )}
                            {!page && (
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                                Seed requis
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            Dernière mise à jour : {formatUpdatedAt(page?.updatedAt)}
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-gray-400 flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      </div>

      {selectedLegalSlug && selectedLegalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="w-full max-w-5xl max-h-[92vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-200">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Page légale</p>
                <h2 className="text-xl font-bold text-dark-900 mt-1">{selectedLegalItem.label}</h2>
                <p className="text-sm text-gray-500 mt-1">Contenu récupéré depuis l’API avant édition.</p>
              </div>
              <button
                type="button"
                onClick={handleCloseLegalModal}
                disabled={legalSaving}
                className="w-9 h-9 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-800 disabled:opacity-50 flex items-center justify-center transition-colors"
                aria-label="Fermer la modale"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleLegalSave} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-5">
                {legalError && selectedLegalSlug && (
                  <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3">
                    <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{legalError}</span>
                  </div>
                )}

                {legalModalLoading ? (
                  <div className="flex items-center gap-3 text-gray-500 text-sm py-16 justify-center">
                    <RefreshCw size={18} className="animate-spin" />
                    Chargement du contenu actuel...
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Titre public</label>
                      <input
                        type="text"
                        value={legalTitle}
                        onChange={(e) => setLegalTitle(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        placeholder="Titre de la page"
                      />
                    </div>

                    <div className="space-y-2" data-color-mode="light">
                      <label className="block text-sm font-medium text-gray-700">Contenu Markdown</label>
                      <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
                        <MDEditor
                          value={legalContent}
                          onChange={(value) => setLegalContent(value || "")}
                          preview="live"
                          height={560}
                          textareaProps={{
                            placeholder: "Rédigez le contenu légal en Markdown...",
                          }}
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        Le bouton Enregistrer reste désactivé tant qu’aucune modification n’a été apportée.
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseLegalModal}
                  disabled={legalSaving}
                  className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={legalSaving || legalModalLoading || !isLegalDirty || !legalTitle.trim() || !legalContent.trim()}
                  className="px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {legalSaving ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Enregistrer
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
