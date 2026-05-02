"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { Heart, Loader2, LogOut, MapPin, Package, Trash2, UserRound } from "lucide-react";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import type { Order, Product } from "@/types";
import {
  createCustomerAddress,
  deleteCustomerAddress,
  getCustomerAddresses,
  getCustomerOrders,
  getCustomerWishlist,
  removeCustomerWishlist,
  updateCustomerAddress,
  updateCustomerMe,
  type CustomerAddress,
  type CustomerAddressInput,
} from "@/lib/customer-api";

const tabs = [
  { id: "infos", label: "Mes informations", icon: UserRound },
  { id: "commandes", label: "Mes commandes", icon: Package },
  { id: "adresses", label: "Mes adresses", icon: MapPin },
  { id: "wishlist", label: "Ma wishlist", icon: Heart },
] as const;

type AccountTab = (typeof tabs)[number]["id"];

const statusLabels: Record<string, string> = {
  pending: "En attente",
  processing: "Payé",
  paid: "Payé",
  shipped: "Expédié",
  delivered: "Livré",
  cancelled: "Annulé",
};

const statusClass: Record<string, string> = {
  pending: "bg-zinc-700 text-zinc-200",
  processing: "bg-emerald-500/15 text-emerald-300",
  paid: "bg-emerald-500/15 text-emerald-300",
  shipped: "bg-sky-500/15 text-sky-300",
  delivered: "bg-green-800/60 text-green-100",
  cancelled: "bg-red-500/15 text-red-300",
};

const emptyAddress: CustomerAddressInput = {
  firstName: "",
  lastName: "",
  address: "",
  extension: "",
  postalCode: "",
  city: "",
  country: "France",
  phone: "",
};

function getProductImage(product: Product): string {
  if (Array.isArray(product.images)) return product.images[0] || "/placeholder-product.jpg";
  try {
    const parsed = JSON.parse(product.images || "[]");
    return Array.isArray(parsed) && parsed[0] ? parsed[0] : "/placeholder-product.jpg";
  } catch {
    return product.images || "/placeholder-product.jpg";
  }
}

function AccountLoadingState() {
  return (
    <section className="min-h-[calc(100vh-160px)] bg-[#0b0b0b] px-6 py-20 text-white">
      <div className="mx-auto flex max-w-4xl items-center justify-center gap-3 border border-white/10 bg-[#131313] p-10 text-white/60">
        <Loader2 className="animate-spin text-[#E91E8C]" size={22} /> Chargement de votre espace client...
      </div>
    </section>
  );
}

export default function ComptePage() {
  return (
    <Suspense fallback={<AccountLoadingState />}>
      <ComptePageContent />
    </Suspense>
  );
}

function ComptePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab") as AccountTab | null;
  const { customer, isAuthenticated, isLoading, logout } = useCustomerAuth();
  const [activeTab, setActiveTab] = useState<AccountTab>(tabs.some((tab) => tab.id === requestedTab) ? requestedTab! : "infos");
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/connexion");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (tabs.some((tab) => tab.id === requestedTab)) {
      setActiveTab(requestedTab!);
    }
  }, [requestedTab]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    async function loadAccountData() {
      setDataLoading(true);
      try {
        const [ordersData, addressesData, wishlistData] = await Promise.all([
          getCustomerOrders(),
          getCustomerAddresses(),
          getCustomerWishlist(),
        ]);
        if (!cancelled) {
          setOrders(ordersData);
          setAddresses(addressesData);
          setWishlist(wishlistData);
        }
      } catch (err) {
        if (!cancelled) setMessage(err instanceof Error ? err.message : "Impossible de charger les données du compte.");
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    }

    loadAccountData();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const totalWishlist = useMemo(() => wishlist.length, [wishlist.length]);

  if (isLoading || !isAuthenticated || !customer) {
    return <AccountLoadingState />;
  }

  return (
    <section className="min-h-[calc(100vh-160px)] bg-[#0b0b0b] px-4 py-10 text-white sm:px-6 lg:py-14">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col justify-between gap-6 border border-white/10 bg-[#131313] p-6 sm:flex-row sm:items-end sm:p-8">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-[#E91E8C]">Espace client</p>
            <h1 className="mt-4 text-3xl font-black uppercase sm:text-4xl">Bonjour {customer.firstName}</h1>
            <p className="mt-3 text-sm text-white/50">Gérez vos informations, vos commandes, vos adresses et votre wishlist Barber Paradise.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              router.push("/");
            }}
            className="inline-flex items-center justify-center gap-2 border border-white/10 px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white/70 transition hover:border-[#E91E8C] hover:text-white"
          >
            <LogOut size={16} /> Se déconnecter
          </button>
        </div>

        {message && <div className="mb-6 border border-[#E91E8C]/30 bg-[#E91E8C]/10 px-4 py-3 text-sm text-pink-100">{message}</div>}

        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          <aside className="h-fit border border-white/10 bg-[#131313] p-3">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const count = tab.id === "commandes" ? orders.length : tab.id === "adresses" ? addresses.length : tab.id === "wishlist" ? totalWishlist : undefined;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    router.replace(`/compte?tab=${tab.id}`, { scroll: false });
                  }}
                  className={`mb-2 flex w-full items-center justify-between px-4 py-4 text-left text-[12px] font-black uppercase tracking-[0.16em] transition last:mb-0 ${activeTab === tab.id ? "bg-[#E91E8C] text-white" : "text-white/55 hover:bg-white/5 hover:text-white"}`}
                >
                  <span className="flex items-center gap-3"><Icon size={17} /> {tab.label}</span>
                  {typeof count === "number" && <span className="text-xs opacity-70">{count}</span>}
                </button>
              );
            })}
          </aside>

          <div className="border border-white/10 bg-[#131313] p-5 sm:p-8">
            {dataLoading && activeTab !== "infos" ? (
              <div className="flex items-center gap-3 py-20 text-white/55"><Loader2 className="animate-spin text-[#E91E8C]" /> Chargement...</div>
            ) : (
              <>
                {activeTab === "infos" && <ProfilePanel customer={customer} setMessage={setMessage} />}
                {activeTab === "commandes" && <OrdersPanel orders={orders} />}
                {activeTab === "adresses" && <AddressesPanel addresses={addresses} setAddresses={setAddresses} setMessage={setMessage} />}
                {activeTab === "wishlist" && <WishlistPanel products={wishlist} setProducts={setWishlist} setMessage={setMessage} />}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProfilePanel({ customer, setMessage }: { customer: NonNullable<ReturnType<typeof useCustomerAuth>["customer"]>; setMessage: (message: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ firstName: customer.firstName, lastName: customer.lastName, phone: customer.phone || "" });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setMessage("Le prénom et le nom sont obligatoires.");
      return;
    }
    setSaving(true);
    try {
      await updateCustomerMe({ firstName: form.firstName.trim(), lastName: form.lastName.trim(), phone: form.phone.trim() || null });
      setMessage("Vos informations ont été mises à jour.");
      setEditing(false);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erreur lors de la mise à jour du profil.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PanelTitle title="Mes informations" subtitle="Consultez et modifiez les informations principales de votre compte." />
      {!editing ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <InfoCard label="Prénom" value={customer.firstName} />
          <InfoCard label="Nom" value={customer.lastName} />
          <InfoCard label="Email" value={customer.email} />
          <InfoCard label="Téléphone" value={customer.phone || "Non renseigné"} />
          <button type="button" onClick={() => setEditing(true)} className="mt-2 w-fit bg-[#E91E8C] px-6 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white hover:bg-[#ff4a9f]">Modifier</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 grid gap-5 sm:grid-cols-2">
          <AccountInput label="Prénom" value={form.firstName} onChange={(value) => setForm((current) => ({ ...current, firstName: value }))} />
          <AccountInput label="Nom" value={form.lastName} onChange={(value) => setForm((current) => ({ ...current, lastName: value }))} />
          <AccountInput label="Téléphone" value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value }))} />
          <div className="sm:col-span-2 flex gap-3">
            <button type="submit" disabled={saving} className="bg-[#E91E8C] px-6 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white disabled:opacity-60">{saving ? "Enregistrement..." : "Enregistrer"}</button>
            <button type="button" onClick={() => setEditing(false)} className="border border-white/10 px-6 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white/60 hover:text-white">Annuler</button>
          </div>
        </form>
      )}
    </div>
  );
}

function OrdersPanel({ orders }: { orders: Order[] }) {
  return (
    <div>
      <PanelTitle title="Mes commandes" subtitle="Suivez le statut de vos achats Barber Paradise." />
      <div className="mt-8 space-y-4">
        {orders.length === 0 ? <EmptyState text="Aucune commande pour le moment." /> : orders.map((order) => (
          <div key={order.id} className="flex flex-col gap-4 border border-white/10 bg-black/20 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-black uppercase">Commande {order.orderNumber}</h3>
                <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${statusClass[order.status] || statusClass.pending}`}>{statusLabels[order.status] || order.status}</span>
              </div>
              <p className="mt-2 text-sm text-white/45">{new Date(order.createdAt).toLocaleDateString("fr-FR")} · {order.items?.length || 0} article(s)</p>
            </div>
            <div className="flex items-center gap-4">
              <p className="text-xl font-black">{order.total.toFixed(2)} €</p>
              <Link href={`/compte/commandes/${order.id}`} className="border border-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/70 hover:border-[#E91E8C] hover:text-white">Voir le détail</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddressesPanel({ addresses, setAddresses, setMessage }: { addresses: CustomerAddress[]; setAddresses: (addresses: CustomerAddress[]) => void; setMessage: (message: string) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerAddressInput>(emptyAddress);
  const [saving, setSaving] = useState(false);

  const isEditing = Boolean(editingAddressId);
  const setField = (key: keyof CustomerAddressInput, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const resetForm = () => {
    setEditingAddressId(null);
    setForm(emptyAddress);
    setShowForm(false);
  };

  const handleStartAdd = () => {
    setEditingAddressId(null);
    setForm(emptyAddress);
    setShowForm(true);
  };

  const handleStartEdit = (item: CustomerAddress) => {
    setEditingAddressId(item.id);
    setForm({
      firstName: item.firstName,
      lastName: item.lastName,
      address: item.address,
      extension: item.extension || "",
      postalCode: item.postalCode,
      city: item.city,
      country: item.country || "France",
      phone: item.phone || "",
    });
    setShowForm(true);
    setMessage("Adresse sélectionnée : vous pouvez la modifier puis enregistrer.");
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      ...form,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      address: form.address.trim(),
      extension: form.extension?.trim() || "",
      postalCode: form.postalCode.trim(),
      city: form.city.trim(),
      country: form.country.trim() || "France",
      phone: form.phone?.trim() || "",
    };

    if (!payload.firstName || !payload.lastName || !payload.address || !payload.postalCode || !payload.city || !payload.country) {
      setMessage("Tous les champs d’adresse obligatoires doivent être renseignés.");
      return;
    }

    setSaving(true);
    try {
      if (editingAddressId) {
        const updated = await updateCustomerAddress(editingAddressId, payload);
        setAddresses(addresses.map((address) => (address.id === editingAddressId ? updated : address)));
        setMessage("Adresse mise à jour avec succès.");
      } else {
        const created = await createCustomerAddress(payload);
        setAddresses([created, ...addresses]);
        setMessage("Adresse ajoutée avec succès.");
      }
      resetForm();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : isEditing ? "Erreur lors de la mise à jour de l’adresse." : "Erreur lors de l’ajout de l’adresse.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCustomerAddress(id);
      setAddresses(addresses.filter((address) => address.id !== id));
      if (editingAddressId === id) resetForm();
      setMessage("Adresse supprimée.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erreur lors de la suppression de l’adresse.");
    }
  };

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <PanelTitle title="Mes adresses" subtitle="Cliquez sur une adresse pour la modifier, ou ajoutez une nouvelle adresse enregistrée." />
        <button type="button" onClick={handleStartAdd} className="bg-[#E91E8C] px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white hover:bg-[#ff4a9f]">Ajouter une adresse</button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="mt-8 grid gap-5 border border-[#E91E8C]/25 bg-[#E91E8C]/5 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#E91E8C]">{isEditing ? "Modifier l’adresse" : "Nouvelle adresse"}</p>
          </div>
          <AccountInput label="Prénom" value={form.firstName} onChange={(value) => setField("firstName", value)} />
          <AccountInput label="Nom" value={form.lastName} onChange={(value) => setField("lastName", value)} />
          <AccountInput label="Adresse" value={form.address} onChange={(value) => setField("address", value)} className="sm:col-span-2" />
          <AccountInput label="Extension (bâtiment, étage, appartement...)" value={form.extension || ""} onChange={(value) => setField("extension", value)} className="sm:col-span-2" />
          <AccountInput label="Code postal" value={form.postalCode} onChange={(value) => setField("postalCode", value)} />
          <AccountInput label="Ville" value={form.city} onChange={(value) => setField("city", value)} />
          <AccountInput label="Pays" value={form.country} onChange={(value) => setField("country", value)} />
          <AccountInput label="Téléphone" value={form.phone || ""} onChange={(value) => setField("phone", value)} />
          <div className="flex gap-3 sm:col-span-2">
            <button type="submit" disabled={saving} className="bg-[#E91E8C] px-6 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white disabled:opacity-60">{saving ? "Enregistrement..." : isEditing ? "Enregistrer les modifications" : "Enregistrer l'adresse"}</button>
            <button type="button" onClick={resetForm} className="border border-white/10 px-6 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white/60 hover:text-white">Annuler</button>
          </div>
        </form>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {addresses.length === 0 ? <EmptyState text="Aucune adresse enregistrée." /> : addresses.map((item) => (
          <article
            key={item.id}
            className={`border bg-black/20 p-5 transition hover:border-[#E91E8C] hover:bg-[#E91E8C]/5 ${editingAddressId === item.id ? "border-[#E91E8C]" : "border-white/10"}`}
          >
            <div className="flex justify-between gap-4">
              <button
                type="button"
                onClick={() => handleStartEdit(item)}
                className="min-w-0 flex-1 text-left"
                aria-label={`Modifier l’adresse de ${item.firstName} ${item.lastName}`}
              >
                <span className="block font-black uppercase">{item.firstName} {item.lastName}</span>
                <span className="mt-3 block text-sm leading-6 text-white/55">{item.address}{item.extension ? <><br />{item.extension}</> : null}<br />{item.postalCode} {item.city}<br />{item.country}</span>
                {item.phone && <span className="mt-2 block text-sm text-white/45">{item.phone}</span>}
                <span className="mt-4 block text-[10px] font-black uppercase tracking-[0.18em] text-[#E91E8C]">Cliquer pour modifier</span>
              </button>
              <button type="button" onClick={() => handleDelete(item.id)} className="h-fit text-red-300 hover:text-red-200" aria-label="Supprimer l’adresse">
                <Trash2 size={18} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function WishlistPanel({ products, setProducts, setMessage }: { products: Product[]; setProducts: (products: Product[]) => void; setMessage: (message: string) => void }) {
  const handleRemove = async (productId: string) => {
    try {
      await removeCustomerWishlist(productId);
      setProducts(products.filter((product) => product.id !== productId));
      setMessage("Produit retiré de votre wishlist.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erreur lors du retrait de la wishlist.");
    }
  };

  return (
    <div>
      <PanelTitle title="Ma wishlist" subtitle="Retrouvez vos produits sauvegardés." />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {products.length === 0 ? <EmptyState text="Votre wishlist est vide." /> : products.map((product) => (
          <article key={product.id} className="overflow-hidden border border-white/10 bg-black/20">
            <div className="relative aspect-square bg-white/5">
              <Image src={getProductImage(product)} alt={product.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
            </div>
            <div className="p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#E91E8C]">{product.brand}</p>
              <h3 className="mt-2 line-clamp-2 font-black uppercase">{product.name}</h3>
              <p className="mt-3 text-lg font-black">{product.price.toFixed(2)} €</p>
              <div className="mt-4 grid gap-2">
                <Link href={`/produit/${product.slug}`} className="bg-white px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.18em] text-black hover:bg-[#E91E8C] hover:text-white">Voir le produit</Link>
                <button type="button" onClick={() => handleRemove(product.id)} className="border border-red-500/25 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-red-300 hover:bg-red-500/10">Retirer</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function PanelTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#E91E8C]">Compte</p>
      <h2 className="mt-3 text-2xl font-black uppercase">{title}</h2>
      <p className="mt-2 text-sm text-white/45">{subtitle}</p>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 bg-black/20 p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">{label}</p>
      <p className="mt-3 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function AccountInput({ label, value, onChange, className = "" }: { label: string; value: string; onChange: (value: string) => void; className?: string }) {
  return (
    <label className={className}>
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full border border-white/10 bg-[#0e0e0e] px-4 py-3 text-sm text-white outline-none transition focus:border-[#E91E8C]" />
    </label>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="col-span-full border border-dashed border-white/10 bg-black/20 px-5 py-10 text-center text-sm text-white/45">{text}</div>;
}
