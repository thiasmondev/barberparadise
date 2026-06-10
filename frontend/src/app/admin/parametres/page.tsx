"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  changeAdminPassword,
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
} from "lucide-react";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

const LEGAL_PAGE_LABELS: Record<string, string> = {
  "mentions-legales": "Mentions légales",
  cgv: "CGV",
  "politique-de-confidentialite": "Politique de confidentialité",
  cookies: "Cookies",
};

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
  const [activeSlug, setActiveSlug] = useState<string>("mentions-legales");
  const [legalTitle, setLegalTitle] = useState("");
  const [legalContent, setLegalContent] = useState("");
  const [legalLoading, setLegalLoading] = useState(false);
  const [legalSaving, setLegalSaving] = useState(false);
  const [legalSuccess, setLegalSuccess] = useState<string | null>(null);
  const [legalError, setLegalError] = useState<string | null>(null);

  const activeLegalPage = useMemo(
    () => legalPages.find((page) => page.slug === activeSlug) || null,
    [legalPages, activeSlug]
  );

  useEffect(() => {
    async function loadLegalPages() {
      setLegalLoading(true);
      setLegalError(null);
      try {
        const pages = await getAdminLegalPages();
        const sortedPages = [...pages].sort((a, b) => {
          const order = ["mentions-legales", "cgv", "politique-de-confidentialite", "cookies"];
          return order.indexOf(a.slug) - order.indexOf(b.slug);
        });
        setLegalPages(sortedPages);
        const firstSlug = sortedPages[0]?.slug || "mentions-legales";
        setActiveSlug((current) => (sortedPages.some((page) => page.slug === current) ? current : firstSlug));
      } catch (err) {
        setLegalError(err instanceof Error ? err.message : "Erreur lors du chargement des pages légales");
      } finally {
        setLegalLoading(false);
      }
    }

    loadLegalPages();
  }, []);

  useEffect(() => {
    if (!activeLegalPage) return;
    setLegalTitle(activeLegalPage.title);
    setLegalContent(activeLegalPage.content);
    setLegalSuccess(null);
    setLegalError(null);
  }, [activeLegalPage]);

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

  async function handleLegalSave(e: React.FormEvent) {
    e.preventDefault();
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

    setLegalSaving(true);
    try {
      const updatedPage = await updateAdminLegalPage(activeSlug, {
        title: legalTitle.trim(),
        content: legalContent,
      });
      setLegalPages((pages) => pages.map((page) => (page.slug === updatedPage.slug ? updatedPage : page)));
      setLegalSuccess(`${updatedPage.title} enregistrée avec succès.`);
    } catch (err) {
      setLegalError(err instanceof Error ? err.message : "Erreur lors de l’enregistrement de la page légale");
    } finally {
      setLegalSaving(false);
    }
  }

  return (
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
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
              <div className="flex items-center gap-2">
                <FileText size={20} className="text-primary" />
                <div>
                  <h2 className="text-lg font-semibold text-dark-900">Pages légales administrables</h2>
                  <p className="text-sm text-gray-500">Modifiez le contenu en Markdown puis enregistrez pour mettre à jour le site public.</p>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                Dernière mise à jour : {formatUpdatedAt(activeLegalPage?.updatedAt)}
              </div>
            </div>

            {legalSuccess && (
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 mb-5">
                <CheckCircle size={18} className="flex-shrink-0" />
                <span className="text-sm font-medium">{legalSuccess}</span>
              </div>
            )}

            {legalError && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-5">
                <AlertCircle size={18} className="flex-shrink-0" />
                <span className="text-sm">{legalError}</span>
              </div>
            )}

            {legalLoading ? (
              <div className="flex items-center gap-3 text-gray-500 text-sm py-8">
                <RefreshCw size={18} className="animate-spin" />
                Chargement des pages légales...
              </div>
            ) : (
              <form onSubmit={handleLegalSave} className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  {legalPages.map((page) => (
                    <button
                      key={page.slug}
                      type="button"
                      onClick={() => setActiveSlug(page.slug)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        activeSlug === page.slug ? "bg-dark-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {LEGAL_PAGE_LABELS[page.slug] || page.title}
                    </button>
                  ))}
                </div>

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
                      height={620}
                      textareaProps={{
                        placeholder: "Rédigez le contenu légal en Markdown...",
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    L’éditeur affiche la rédaction Markdown à gauche et l’aperçu rendu à droite. Le contenu enregistré est stocké en Markdown.
                  </p>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={legalSaving}
                    className="px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {legalSaving ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        Enregistrement...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Enregistrer la page légale
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
