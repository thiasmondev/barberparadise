"use client";

import { useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import {
  API_KEY_PERMISSION_LABELS,
  type AdminApiKey,
  type ApiKeyPermission,
  activateApiKey,
  createApiKey,
  deleteApiKey,
  listApiKeys,
  revokeApiKey,
} from "@/lib/admin-api";
import { AlertTriangle, CheckCircle, Copy, KeyRound, Loader2, Plus, RefreshCcw, ShieldCheck, Trash2 } from "lucide-react";

const PERMISSIONS = Object.keys(API_KEY_PERMISSION_LABELS) as ApiKeyPermission[];

function formatDate(value: string | null) {
  if (!value) return "Jamais";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function ApiKeysAdminPage() {
  const [keys, setKeys] = useState<AdminApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<ApiKeyPermission[]>(["carousel"]);
  const [expiresAt, setExpiresAt] = useState("");
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const activeCount = useMemo(() => keys.filter(key => key.isActive).length, [keys]);

  const loadKeys = async () => {
    try {
      setIsLoading(true);
      const data = await listApiKeys();
      setKeys(data.keys);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Impossible de charger les clés API." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const togglePermission = (permission: ApiKeyPermission) => {
    setPermissions(current => {
      if (current.includes(permission)) {
        const next = current.filter(item => item !== permission);
        return next.length > 0 ? next : current;
      }
      return [...current, permission];
    });
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setMessage({ type: "error", text: "Le nom de la clé est obligatoire." });
      return;
    }

    try {
      setIsSaving(true);
      setMessage(null);
      const result = await createApiKey({
        name: name.trim(),
        permissions,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      setRevealedToken(result.token);
      setName("");
      setPermissions(["carousel"]);
      setExpiresAt("");
      setMessage({ type: "success", text: result.message || "Clé API créée avec succès." });
      await loadKeys();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Impossible de créer la clé API." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!revealedToken) return;
    await navigator.clipboard.writeText(revealedToken);
    setMessage({ type: "success", text: "Clé copiée dans le presse-papiers." });
  };

  const runAction = async (action: () => Promise<unknown>, successText: string) => {
    try {
      setMessage(null);
      await action();
      setMessage({ type: "success", text: successText });
      await loadKeys();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Action impossible." });
    }
  };

  return (
    <AdminShell>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Sécurité et intégrations</p>
            <h1 className="mt-2 text-3xl font-heading font-bold text-dark-900">Clés API</h1>
            <p className="mt-2 max-w-3xl text-gray-600">
              Crée des clés de service limitées par permissions pour permettre à Buzz ou à des outils externes d’agir sur certains modules, sans exposer ton compte administrateur.
            </p>
          </div>
          <button
            type="button"
            onClick={loadKeys}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RefreshCcw size={16} /> Actualiser
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <KeyRound className="mb-3 text-primary" size={24} />
            <p className="text-2xl font-bold text-dark-900">{keys.length}</p>
            <p className="text-sm text-gray-500">clés créées</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <ShieldCheck className="mb-3 text-green-600" size={24} />
            <p className="text-2xl font-bold text-dark-900">{activeCount}</p>
            <p className="text-sm text-gray-500">clés actives</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <AlertTriangle className="mb-3 text-amber-600" size={24} />
            <p className="font-semibold text-amber-900">Token visible une seule fois</p>
            <p className="mt-1 text-sm text-amber-800">Copie la clé immédiatement après sa création.</p>
          </div>
        </div>

        {message && (
          <div className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${message.type === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
            {message.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
            <span>{message.text}</span>
          </div>
        )}

        {revealedToken && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
            <h2 className="font-heading text-lg font-bold text-dark-900">Nouvelle clé API</h2>
            <p className="mt-1 text-sm text-gray-600">Cette valeur ne sera plus jamais affichée. Copie-la maintenant et stocke-la dans un gestionnaire sécurisé.</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <code className="flex-1 overflow-x-auto rounded-lg bg-dark-900 px-4 py-3 text-sm text-white">{revealedToken}</code>
              <button onClick={handleCopy} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90">
                <Copy size={16} /> Copier
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleCreate} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Plus size={20} className="text-primary" />
            <h2 className="font-heading text-xl font-bold text-dark-900">Créer une clé</h2>
          </div>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Nom de la clé</span>
              <input
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="Ex. Buzz carrousel production"
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Expiration optionnelle</span>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={event => setExpiresAt(event.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </label>
          </div>
          <div className="mt-5">
            <span className="text-sm font-medium text-gray-700">Permissions</span>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {PERMISSIONS.map(permission => (
                <label key={permission} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${permissions.includes(permission) ? "border-primary bg-primary/10 text-primary" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
                  <input
                    type="checkbox"
                    checked={permissions.includes(permission)}
                    onChange={() => togglePermission(permission)}
                    className="sr-only"
                  />
                  <span className="font-medium">{API_KEY_PERMISSION_LABELS[permission]}</span>
                </label>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Créer la clé API
          </button>
        </form>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 p-5">
            <h2 className="font-heading text-xl font-bold text-dark-900">Clés existantes</h2>
            <p className="mt-1 text-sm text-gray-500">Les tokens complets ne sont jamais réaffichés, seul le préfixe permet de les identifier.</p>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 p-8 text-gray-500">
              <Loader2 size={18} className="animate-spin" /> Chargement des clés…
            </div>
          ) : keys.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Aucune clé API créée pour le moment.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-3">Nom</th>
                    <th className="px-5 py-3">Préfixe</th>
                    <th className="px-5 py-3">Permissions</th>
                    <th className="px-5 py-3">Statut</th>
                    <th className="px-5 py-3">Dernier usage</th>
                    <th className="px-5 py-3">Expiration</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {keys.map(apiKey => (
                    <tr key={apiKey.id} className="align-top">
                      <td className="px-5 py-4 font-medium text-dark-900">{apiKey.name}</td>
                      <td className="px-5 py-4"><code className="rounded bg-gray-100 px-2 py-1 text-xs">{apiKey.prefix}…</code></td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {apiKey.permissions.map(permission => (
                            <span key={permission} className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">
                              {API_KEY_PERMISSION_LABELS[permission] ?? permission}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${apiKey.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {apiKey.isActive ? "Active" : "Révoquée"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-gray-600">{formatDate(apiKey.lastUsedAt)}</td>
                      <td className="px-5 py-4 text-gray-600">{formatDate(apiKey.expiresAt)}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          {apiKey.isActive ? (
                            <button onClick={() => runAction(() => revokeApiKey(apiKey.id), "Clé révoquée.")} className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50">
                              Révoquer
                            </button>
                          ) : (
                            <button onClick={() => runAction(() => activateApiKey(apiKey.id), "Clé réactivée.")} className="rounded-lg border border-green-200 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-50">
                              Réactiver
                            </button>
                          )}
                          <button onClick={() => runAction(() => deleteApiKey(apiKey.id), "Clé supprimée.")} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50" title="Supprimer">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
