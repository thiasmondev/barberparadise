"use client";

import { useState } from "react";
import { changeAdminPassword } from "@/lib/admin-api";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Shield } from "lucide-react";

export default function ParametresPage() {
  const { admin } = useAdminAuth();

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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-dark-900">Paramètres du compte</h1>
        <p className="text-gray-500 mt-1">Gérez les informations et la sécurité de votre compte administrateur.</p>
      </div>

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

        {/* Message de succès */}
        {success && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 mb-5">
            <CheckCircle size={18} className="flex-shrink-0" />
            <span className="text-sm font-medium">Mot de passe modifié avec succès !</span>
          </div>
        )}

        {/* Message d'erreur */}
        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-5">
            <AlertCircle size={18} className="flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Mot de passe actuel */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Mot de passe actuel
            </label>
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

          {/* Nouveau mot de passe */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nouveau mot de passe
            </label>
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
            {/* Indicateur de force */}
            {newPassword && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i <= strength.score ? strength.color : "bg-gray-200"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  Force : <span className="font-medium">{strength.label}</span>
                </p>
              </div>
            )}
          </div>

          {/* Confirmer nouveau mot de passe */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Confirmer le nouveau mot de passe
            </label>
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

      {/* Conseils de sécurité */}
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
  );
}
