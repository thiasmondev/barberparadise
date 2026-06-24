"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  getAdminCustomer,
  updateAdminCustomerProAccount,
  getCustomerExtraEmails,
  addCustomerExtraEmail,
  updateCustomerExtraEmail,
  deleteCustomerExtraEmail,
  type CustomerExtraEmail,
} from "@/lib/admin-api";
import type { Customer } from "@/types";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  ShoppingCart,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  AlertCircle,
  Building2,
  Plus,
  Star,
  Trash2,
  Loader2,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "En attente", color: "text-yellow-600 bg-yellow-50", icon: Clock },
  processing: { label: "En cours", color: "text-blue-600 bg-blue-50", icon: AlertCircle },
  shipped: { label: "Expédiée", color: "text-purple-600 bg-purple-50", icon: Truck },
  delivered: { label: "Livrée", color: "text-green-600 bg-green-50", icon: CheckCircle },
  cancelled: { label: "Annulée", color: "text-red-600 bg-red-50", icon: XCircle },
};

const LABEL_SUGGESTIONS = ["Facturation", "Comptabilité", "Direction", "Commandes", "Secondaire"];

function formatPrice(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function CustomerDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingPro, setSavingPro] = useState(false);
  const [proMessage, setProMessage] = useState("");
  const [proForm, setProForm] = useState({ companyName: "", activity: "", phone: "", siret: "", vatNumber: "" });

  // Emails secondaires
  const [extraEmails, setExtraEmails] = useState<CustomerExtraEmail[]>([]);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [showAddEmail, setShowAddEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newLabel, setNewLabel] = useState("Facturation");
  const [newIsPrimary, setNewIsPrimary] = useState(false);
  const [addingEmail, setAddingEmail] = useState(false);
  const [emailError, setEmailError] = useState("");

  useEffect(() => {
    if (!id) return;
    getAdminCustomer(id)
      .then((data) => {
        setCustomer(data);
        setProForm({
          companyName: data.proAccount?.companyName || `${data.firstName || ""} ${data.lastName || ""}`.trim(),
          activity: data.proAccount?.activity || "Professionnel de la coiffure / barber",
          phone: data.proAccount?.phone || data.phone || "",
          siret: data.proAccount?.siret || "",
          vatNumber: data.proAccount?.vatNumber || "",
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    // Charger les emails secondaires
    setEmailsLoading(true);
    getCustomerExtraEmails(id)
      .then(setExtraEmails)
      .catch(console.error)
      .finally(() => setEmailsLoading(false));
  }, [id]);

  const setProField = (field: keyof typeof proForm, value: string) => {
    setProForm((current) => ({ ...current, [field]: value }));
  };

  const handleProUpdate = async (enabled: boolean) => {
    if (!customer || savingPro) return;
    setSavingPro(true);
    setProMessage("");
    try {
      const updated = await updateAdminCustomerProAccount(customer.id, { enabled, ...proForm });
      setCustomer(updated);
      setProForm({
        companyName: updated.proAccount?.companyName || `${updated.firstName || ""} ${updated.lastName || ""}`.trim(),
        activity: updated.proAccount?.activity || "Professionnel de la coiffure / barber",
        phone: updated.proAccount?.phone || updated.phone || "",
        siret: updated.proAccount?.siret || "",
        vatNumber: updated.proAccount?.vatNumber || "",
      });
      setProMessage(enabled ? "Compte B2B activé ou mis à jour." : "Compte B2B suspendu pour ce client.");
    } catch (err) {
      setProMessage(err instanceof Error ? err.message : "Impossible de modifier le compte B2B.");
    } finally {
      setSavingPro(false);
    }
  };

  const handleAddEmail = async () => {
    if (!customer) return;
    setEmailError("");
    if (!newEmail.includes("@")) {
      setEmailError("Adresse email invalide.");
      return;
    }
    setAddingEmail(true);
    try {
      const created = await addCustomerExtraEmail(customer.id, {
        email: newEmail.trim().toLowerCase(),
        label: newLabel.trim() || "Secondaire",
        isPrimary: newIsPrimary,
      });
      // Si isPrimary, mettre à jour les autres localement
      setExtraEmails((prev) =>
        newIsPrimary
          ? [...prev.map((e) => ({ ...e, isPrimary: false })), created]
          : [...prev, created]
      );
      setNewEmail("");
      setNewLabel("Facturation");
      setNewIsPrimary(false);
      setShowAddEmail(false);
    } catch (err: any) {
      setEmailError(err.message || "Impossible d'ajouter cet email.");
    } finally {
      setAddingEmail(false);
    }
  };

  const handleSetPrimary = async (emailId: string) => {
    if (!customer) return;
    try {
      await updateCustomerExtraEmail(customer.id, emailId, { isPrimary: true });
      setExtraEmails((prev) =>
        prev.map((e) => ({ ...e, isPrimary: e.id === emailId }))
      );
    } catch (err: any) {
      alert(err.message || "Impossible de modifier cet email.");
    }
  };

  const handleDeleteEmail = async (emailId: string) => {
    if (!customer) return;
    if (!window.confirm("Supprimer cet email du compte client ?")) return;
    try {
      await deleteCustomerExtraEmail(customer.id, emailId);
      setExtraEmails((prev) => prev.filter((e) => e.id !== emailId));
    } catch (err: any) {
      alert(err.message || "Impossible de supprimer cet email.");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-100 rounded w-48 animate-pulse" />
        <div className="bg-white rounded-xl p-6 animate-pulse space-y-4">
          <div className="h-6 bg-gray-100 rounded w-32" />
          <div className="h-4 bg-gray-100 rounded w-64" />
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Client non trouvé</p>
        <Link href="/admin/clients" className="text-primary text-sm hover:underline mt-2 inline-block">
          ← Retour aux clients
        </Link>
      </div>
    );
  }

  const totalSpent = customer.orders?.reduce((sum, o) => sum + o.total, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/clients" className="p-2 text-gray-400 hover:text-dark-800 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-heading font-bold text-xl text-dark-800">
            {customer.firstName} {customer.lastName}
          </h1>
          <p className="text-sm text-gray-500">Fiche client</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Customer info */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-lg">
                {customer.firstName?.charAt(0)}{customer.lastName?.charAt(0)}
              </div>
              <div>
                <div className="font-heading font-semibold text-dark-800">{customer.firstName} {customer.lastName}</div>
                <div className="text-xs text-gray-400">Client depuis {formatDate(customer.createdAt)}</div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <Mail size={14} className="text-gray-400 shrink-0" />
                <span className="font-medium">{customer.email}</span>
                <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Principal</span>
              </div>
              {customer.phone && (
                <div className="flex items-center gap-2.5 text-sm text-gray-600">
                  <Phone size={14} className="text-gray-400" />
                  {customer.phone}
                </div>
              )}
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <Calendar size={14} className="text-gray-400" />
                Inscrit le {formatDate(customer.createdAt)}
              </div>
            </div>
          </div>

          {/* Emails secondaires */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-semibold text-sm text-dark-800 flex items-center gap-2">
                <Mail size={15} className="text-gray-400" /> Adresses email
              </h3>
              <button
                onClick={() => { setShowAddEmail((v) => !v); setEmailError(""); }}
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80"
              >
                <Plus size={13} /> Ajouter
              </button>
            </div>

            {/* Formulaire ajout */}
            {showAddEmail && (
              <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                <label className="block text-xs font-semibold text-gray-500">
                  Adresse email
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="facturation@salon.fr"
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-dark-800 focus:border-primary focus:outline-none"
                  />
                </label>
                <label className="block text-xs font-semibold text-gray-500">
                  Libellé
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {LABEL_SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setNewLabel(s)}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium border transition ${
                          newLabel === s
                            ? "bg-dark-800 text-white border-dark-800"
                            : "border-gray-200 text-gray-600 hover:border-gray-400"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="Ou saisir un libellé personnalisé"
                    className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-dark-800 focus:border-primary focus:outline-none"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIsPrimary}
                    onChange={(e) => setNewIsPrimary(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Définir comme email de facturation par défaut
                </label>
                {emailError && <p className="text-xs text-red-600">{emailError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleAddEmail}
                    disabled={addingEmail || !newEmail}
                    className="flex-1 rounded-lg bg-dark-800 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-primary disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    {addingEmail ? <Loader2 size={12} className="animate-spin" /> : null}
                    Ajouter
                  </button>
                  <button
                    onClick={() => { setShowAddEmail(false); setEmailError(""); }}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {/* Liste des emails */}
            {emailsLoading ? (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Loader2 size={12} className="animate-spin" /> Chargement…
              </div>
            ) : extraEmails.length === 0 ? (
              <p className="text-xs text-gray-400">Aucun email secondaire. Cliquez sur "Ajouter" pour en créer un.</p>
            ) : (
              <div className="space-y-2">
                {extraEmails.map((e) => (
                  <div
                    key={e.id}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 ${
                      e.isPrimary ? "border-primary/30 bg-primary/5" : "border-gray-100 bg-white"
                    }`}
                  >
                    <Mail size={13} className={e.isPrimary ? "text-primary shrink-0" : "text-gray-400 shrink-0"} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-dark-800 truncate">{e.email}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-gray-400">{e.label}</span>
                        {e.isPrimary && (
                          <span className="text-xs font-semibold text-primary flex items-center gap-0.5">
                            <Star size={10} fill="currentColor" /> Facturation
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!e.isPrimary && (
                        <button
                          onClick={() => handleSetPrimary(e.id)}
                          title="Définir comme email de facturation"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/10 transition"
                        >
                          <Star size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteEmail(e.id)}
                        title="Supprimer"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* B2B account */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="font-heading font-semibold text-sm text-dark-800 flex items-center gap-2">
                  <Building2 size={16} className="text-primary" /> Compte B2B
                </h3>
                <p className="mt-1 text-xs text-gray-500">Activez ou modifiez manuellement l'accès aux tarifs professionnels.</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${customer.proAccount?.status === "approved" ? "bg-green-50 text-green-700" : customer.proAccount ? "bg-yellow-50 text-yellow-700" : "bg-gray-100 text-gray-500"}`}>
                {customer.proAccount?.status === "approved" ? "B2B actif" : customer.proAccount ? customer.proAccount.status : "B2C"}
              </span>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-gray-500">
                Entreprise / raison sociale
                <input value={proForm.companyName} onChange={(e) => setProField("companyName", e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-dark-800 focus:border-primary focus:outline-none" />
              </label>
              <label className="block text-xs font-semibold text-gray-500">
                Activité
                <input value={proForm.activity} onChange={(e) => setProField("activity", e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-dark-800 focus:border-primary focus:outline-none" />
              </label>
              <label className="block text-xs font-semibold text-gray-500">
                Téléphone pro
                <input value={proForm.phone} onChange={(e) => setProField("phone", e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-dark-800 focus:border-primary focus:outline-none" />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-gray-500">
                  SIRET
                  <input value={proForm.siret} onChange={(e) => setProField("siret", e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-dark-800 focus:border-primary focus:outline-none" />
                </label>
                <label className="block text-xs font-semibold text-gray-500">
                  TVA intracom.
                  <input value={proForm.vatNumber} onChange={(e) => setProField("vatNumber", e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm uppercase text-dark-800 focus:border-primary focus:outline-none" />
                </label>
              </div>
            </div>

            {proMessage && <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-dark-700">{proMessage}</div>}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button type="button" disabled={savingPro} onClick={() => handleProUpdate(true)} className="flex-1 rounded-lg bg-dark-800 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-primary disabled:opacity-50">
                {savingPro ? "Mise à jour..." : customer.proAccount?.status === "approved" ? "Mettre à jour B2B" : "Passer en B2B"}
              </button>
              {customer.proAccount && (
                <button type="button" disabled={savingPro} onClick={() => handleProUpdate(false)} className="rounded-lg border border-gray-200 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-gray-500 hover:border-red-200 hover:text-red-600 disabled:opacity-50">
                  Suspendre B2B
                </button>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              <div className="text-2xl font-heading font-bold text-dark-800">{customer._count?.orders || customer.orders?.length || 0}</div>
              <div className="text-xs text-gray-500 mt-0.5">Commandes</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              <div className="text-2xl font-heading font-bold text-dark-800">{formatPrice(totalSpent)}</div>
              <div className="text-xs text-gray-500 mt-0.5">Total dépensé</div>
            </div>
          </div>

          {/* Addresses */}
          {customer.addresses && customer.addresses.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-heading font-semibold text-sm text-dark-800 mb-3">Adresses</h3>
              <div className="space-y-3">
                {customer.addresses.map((addr) => (
                  <div key={addr.id} className="flex items-start gap-2 text-sm text-gray-600">
                    <MapPin size={14} className="text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <div>{addr.address}</div>
                      <div>{addr.postalCode} {addr.city}, {addr.country}</div>
                      {addr.isDefault && (
                        <span className="text-xs text-primary font-medium">Adresse par défaut</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Orders */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-heading font-semibold text-sm text-dark-800">
                Historique des commandes ({customer.orders?.length || 0})
              </h2>
            </div>
            {!customer.orders || customer.orders.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <ShoppingCart size={32} className="mx-auto mb-2 text-gray-300" />
                Aucune commande
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {customer.orders.map((order) => {
                  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                  return (
                    <Link
                      key={order.id}
                      href={`/admin/commandes/${order.id}`}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/50 transition-colors"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cfg.color}`}>
                        <cfg.icon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-dark-800">
                          #{order.orderNumber || order.id.slice(-8)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {formatDate(order.createdAt)} · {order.items?.length || 0} article{(order.items?.length || 0) !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <span className="text-sm font-semibold text-dark-800 tabular-nums">
                        {formatPrice(order.total)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
