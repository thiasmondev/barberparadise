"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState, useCallback } from "react";
import { createAdminCustomer, getAdminCustomers, type AdminCreateCustomerPayload } from "@/lib/admin-api";
import type { Customer } from "@/types";
import Link from "next/link";
import {
  Search,
  Users,
  ChevronLeft,
  ChevronRight,
  Eye,
  ShoppingCart,
  Euro,
  Plus,
  X,
  Loader2,
  Building2,
  User,
} from "lucide-react";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatPrice(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

type CreateCustomerForm = AdminCreateCustomerPayload;

const initialCreateCustomerForm: CreateCustomerForm = {
  email: "",
  firstName: "",
  lastName: "",
  phone: "",
  accountType: "b2c",
  sendInvitation: true,
  acceptsEmailMarketing: false,
  companyName: "",
  activity: "",
  proPhone: "",
  siret: "",
  vatNumber: "",
};

export default function AdminClientsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateCustomerForm>(initialCreateCustomerForm);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminCustomers({ page, search, limit: 20 });
      setCustomers(data.customers);
      setTotal(data.total);
      setPages(data.pages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const updateCreateForm = <K extends keyof CreateCustomerForm>(key: K, value: CreateCustomerForm[K]) => {
    setCreateForm((prev) => ({ ...prev, [key]: value }));
  };

  const closeCreateModal = () => {
    if (creating) return;
    setShowCreateModal(false);
    setCreateError(null);
    setCreateSuccess(null);
    setCreateForm(initialCreateCustomerForm);
  };

  const cleanOptional = (value?: string) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  };

  const handleCreateCustomer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);
    setCreating(true);

    try {
      const payload: AdminCreateCustomerPayload = {
        email: createForm.email.trim(),
        firstName: createForm.firstName.trim(),
        lastName: createForm.lastName.trim(),
        phone: cleanOptional(createForm.phone),
        accountType: createForm.accountType,
        sendInvitation: createForm.sendInvitation,
        acceptsEmailMarketing: createForm.acceptsEmailMarketing,
      };

      if (createForm.accountType === "b2b") {
        payload.companyName = cleanOptional(createForm.companyName);
        payload.activity = cleanOptional(createForm.activity);
        payload.proPhone = cleanOptional(createForm.proPhone) || cleanOptional(createForm.phone);
        payload.siret = cleanOptional(createForm.siret);
        payload.vatNumber = cleanOptional(createForm.vatNumber);
      }

      const result = await createAdminCustomer(payload);
      const invitationLabel = result.invitation?.sent
        ? " L’invitation de création de mot de passe a été envoyée."
        : createForm.sendInvitation
          ? " Le client a été créé, mais l’email d’invitation n’a pas été envoyé."
          : " Aucun email d’invitation n’a été envoyé.";
      setCreateSuccess(`Client ${result.customer.firstName} ${result.customer.lastName} créé avec succès.${invitationLabel}`);
      setCreateForm(initialCreateCustomerForm);
      setPage(1);
      await load();
      window.setTimeout(() => {
        setShowCreateModal(false);
        setCreateSuccess(null);
      }, 1600);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Erreur lors de la création du client");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-heading font-bold text-xl text-dark-800">Clients</h1>
          <p className="text-sm text-gray-500">{total} client{total !== 1 ? "s" : ""} inscrit{total !== 1 ? "s" : ""}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus size={16} />
          Créer un client
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
          placeholder="Rechercher par nom ou email..."
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Client</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Inscrit le</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Commandes</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Total dépensé</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3" colSpan={6}>
                      <div className="h-5 bg-gray-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    <Users size={32} className="mx-auto mb-2 text-gray-300" />
                    Aucun client trouvé
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary text-xs font-bold shrink-0">
                          {c.firstName?.charAt(0)}{c.lastName?.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-dark-800 truncate">{c.firstName} {c.lastName}</div>
                          {c.proAccount && (
                            <span className="inline-flex mt-1 px-2 py-0.5 rounded-full bg-dark-800 text-white text-[10px] font-bold uppercase tracking-wide">
                              B2B
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell text-xs">{c.email}</td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell text-xs">{formatDate(c.createdAt)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                        <ShoppingCart size={12} />
                        {c._count?.orders || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 hidden md:table-cell text-xs tabular-nums">
                      <span className="inline-flex items-center gap-1 justify-end">
                        <Euro size={12} />
                        {formatPrice(c.totalSpent || 0)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/clients/${c.id}`}
                        className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg inline-flex"
                        title="Voir le détail"
                      >
                        <Eye size={14} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Page {page} sur {pages}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="p-1.5 rounded-lg text-gray-400 hover:text-dark-800 hover:bg-gray-100 disabled:opacity-30">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setPage(Math.min(pages, page + 1))} disabled={page >= pages} className="p-1.5 rounded-lg text-gray-400 hover:text-dark-800 hover:bg-gray-100 disabled:opacity-30">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-dark-900/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl border border-gray-100">
            <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-100">
              <div>
                <h2 className="font-heading text-lg font-bold text-dark-800">Créer un client</h2>
                <p className="mt-1 text-sm text-gray-500">Ajoutez un compte B2C ou B2B et envoyez une invitation de mot de passe au client.</p>
              </div>
              <button
                type="button"
                onClick={closeCreateModal}
                className="p-2 text-gray-400 hover:text-dark-800 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="px-6 py-5 space-y-5">
              <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => updateCreateForm("accountType", "b2c")}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${createForm.accountType === "b2c" ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-dark-800"}`}
                >
                  <User size={15} />
                  Client B2C
                </button>
                <button
                  type="button"
                  onClick={() => updateCreateForm("accountType", "b2b")}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${createForm.accountType === "b2b" ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-dark-800"}`}
                >
                  <Building2 size={15} />
                  Client B2B
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1.5 text-sm font-medium text-dark-800">
                  Prénom <span className="text-primary">*</span>
                  <input
                    required
                    type="text"
                    value={createForm.firstName}
                    onChange={(e) => updateCreateForm("firstName", e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-normal focus:outline-none focus:border-primary"
                    placeholder="Mathias"
                  />
                </label>
                <label className="space-y-1.5 text-sm font-medium text-dark-800">
                  Nom <span className="text-primary">*</span>
                  <input
                    required
                    type="text"
                    value={createForm.lastName}
                    onChange={(e) => updateCreateForm("lastName", e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-normal focus:outline-none focus:border-primary"
                    placeholder="Dupont"
                  />
                </label>
                <label className="space-y-1.5 text-sm font-medium text-dark-800">
                  Email <span className="text-primary">*</span>
                  <input
                    required
                    type="email"
                    value={createForm.email}
                    onChange={(e) => updateCreateForm("email", e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-normal focus:outline-none focus:border-primary"
                    placeholder="client@email.fr"
                  />
                </label>
                <label className="space-y-1.5 text-sm font-medium text-dark-800">
                  Téléphone
                  <input
                    type="tel"
                    value={createForm.phone || ""}
                    onChange={(e) => updateCreateForm("phone", e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-normal focus:outline-none focus:border-primary"
                    placeholder="06 12 34 56 78"
                  />
                </label>
              </div>

              {createForm.accountType === "b2b" && (
                <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/70 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-dark-800">
                    <Building2 size={16} className="text-primary" />
                    Informations professionnelles
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="space-y-1.5 text-sm font-medium text-dark-800">
                      Entreprise <span className="text-primary">*</span>
                      <input
                        required={createForm.accountType === "b2b"}
                        type="text"
                        value={createForm.companyName || ""}
                        onChange={(e) => updateCreateForm("companyName", e.target.value)}
                        className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-normal focus:outline-none focus:border-primary"
                        placeholder="Barber Shop Paris"
                      />
                    </label>
                    <label className="space-y-1.5 text-sm font-medium text-dark-800">
                      Activité <span className="text-primary">*</span>
                      <input
                        required={createForm.accountType === "b2b"}
                        type="text"
                        value={createForm.activity || ""}
                        onChange={(e) => updateCreateForm("activity", e.target.value)}
                        className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-normal focus:outline-none focus:border-primary"
                        placeholder="Salon de coiffure / Barbier"
                      />
                    </label>
                    <label className="space-y-1.5 text-sm font-medium text-dark-800">
                      Téléphone pro <span className="text-primary">*</span>
                      <input
                        required={createForm.accountType === "b2b" && !createForm.phone}
                        type="tel"
                        value={createForm.proPhone || ""}
                        onChange={(e) => updateCreateForm("proPhone", e.target.value)}
                        className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-normal focus:outline-none focus:border-primary"
                        placeholder="01 23 45 67 89"
                      />
                    </label>
                    <label className="space-y-1.5 text-sm font-medium text-dark-800">
                      SIRET
                      <input
                        type="text"
                        value={createForm.siret || ""}
                        onChange={(e) => updateCreateForm("siret", e.target.value)}
                        className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-normal focus:outline-none focus:border-primary"
                        placeholder="123 456 789 00012"
                      />
                    </label>
                    <label className="space-y-1.5 text-sm font-medium text-dark-800 sm:col-span-2">
                      Numéro TVA intracommunautaire
                      <input
                        type="text"
                        value={createForm.vatNumber || ""}
                        onChange={(e) => updateCreateForm("vatNumber", e.target.value)}
                        className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-normal uppercase focus:outline-none focus:border-primary"
                        placeholder="FR12345678901"
                      />
                    </label>
                  </div>
                  <p className="text-xs text-gray-500">Le compte professionnel sera approuvé immédiatement et pourra bénéficier du parcours B2B.</p>
                </div>
              )}

              <div className="space-y-3 rounded-xl border border-gray-100 p-4">
                <label className="flex items-start gap-3 text-sm text-dark-800">
                  <input
                    type="checkbox"
                    checked={Boolean(createForm.sendInvitation)}
                    onChange={(e) => updateCreateForm("sendInvitation", e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span>
                    <span className="font-semibold">Envoyer une invitation par email</span>
                    <span className="block text-xs text-gray-500">Le client recevra le lien sécurisé de création de mot de passe via le template de réinitialisation existant.</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 text-sm text-dark-800">
                  <input
                    type="checkbox"
                    checked={Boolean(createForm.acceptsEmailMarketing)}
                    onChange={(e) => updateCreateForm("acceptsEmailMarketing", e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span>
                    <span className="font-semibold">Autoriser les communications marketing</span>
                    <span className="block text-xs text-gray-500">À cocher uniquement si le client a donné son consentement.</span>
                  </span>
                </label>
              </div>

              {createError && (
                <div className="px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-100">
                  {createError}
                </div>
              )}
              {createSuccess && (
                <div className="px-4 py-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm border border-emerald-100">
                  {createSuccess}
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={creating}
                  className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-60"
                >
                  {creating && <Loader2 size={15} className="animate-spin" />}
                  Créer le client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
