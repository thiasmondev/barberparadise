"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle2, FileText, Loader2, Mail, PackagePlus, Plus, Save, Search, Trash2, UserPlus } from "lucide-react";

import AdminOrdersTabs from "@/components/admin/AdminOrdersTabs";
import { EmailPickerModal, type EmailOption } from "@/components/admin/EmailPickerModal";
import {
  AdminDraftAddressPayload,
  AdminOrderDraft,
  AdminOrderDraftPayload,
  CustomerExtraEmail,
  DiscountType,
  confirmAdminOrderDraft,
  createAdminOrderDraft,
  getAdminCustomers,
  getAdminOrderDrafts,
  getAdminProducts,
  getCustomerExtraEmails,
  sendAdminOrderDraftEmail,
  sendAdminPaymentReminder,
  updateAdminOrderDraft,
} from "@/lib/admin-api";
import type { Customer, OrderItem, Product } from "@/types";

export const dynamic = "force-dynamic";

const emptyAddress: AdminDraftAddressPayload = {
  firstName: "",
  lastName: "",
  address: "",
  extension: "",
  city: "",
  postalCode: "",
  country: "FR",
  phone: "",
};

type DraftLine = {
  productId: string;
  name: string;
  quantity: number;
  image?: string;
  product?: Product;
  fallbackPrice?: number;
  lineDiscountType: DiscountType;
  lineDiscountValue: string;
};

type DraftForm = {
  customerId: string | null;
  email: string;
  isB2B: boolean;
  paymentLater: boolean;
  noShipping: boolean;
  vatNumber: string;
  shipping: string;
  notes: string;
  orderDiscountType: DiscountType;
  orderDiscountValue: string;
  paymentDueDate: string; // YYYY-MM-DD ou vide
  shippingAddress: AdminDraftAddressPayload;
  items: DraftLine[];
};

const initialForm: DraftForm = {
  customerId: null,
  email: "",
  isB2B: false,
  paymentLater: false,
  noShipping: false,
  vatNumber: "",
  shipping: "",
  notes: "",
  orderDiscountType: "fixed",
  orderDiscountValue: "",
  paymentDueDate: "",
  shippingAddress: emptyAddress,
  items: [],
};

function eur(value: number | null | undefined) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function customerName(customer?: Customer | AdminOrderDraft["customer"] | null) {
  if (!customer) return "Client non sélectionné";
  return `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || customer.email;
}

function productImages(product: Product): string[] {
  if (Array.isArray(product.images)) return product.images.filter((item): item is string => typeof item === "string");
  if (typeof product.images === "string") {
    try {
      const parsed = JSON.parse(product.images);
      if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string");
    } catch {
      return product.images ? [product.images] : [];
    }
  }
  return [];
}

function unitPrice(line: DraftLine, isB2B: boolean) {
  if (!line.product) return Number(line.fallbackPrice || 0);
  return isB2B ? Number(line.product.priceProEur ?? line.product.price / 1.2) : Number(line.product.price);
}

function numericValue(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function discountAmount(type: DiscountType, value: string | number | null | undefined, base: number) {
  const safeBase = Math.max(0, base);
  const safeValue = numericValue(value);
  if (safeValue <= 0 || safeBase <= 0) return 0;
  return type === "percent" ? Math.min(safeBase, safeBase * Math.min(100, safeValue) / 100) : Math.min(safeBase, safeValue);
}

function lineGrossTotal(line: DraftLine, isB2B: boolean) {
  return unitPrice(line, isB2B) * line.quantity;
}

function lineDiscountAmount(line: DraftLine, isB2B: boolean) {
  return discountAmount(line.lineDiscountType, line.lineDiscountValue, lineGrossTotal(line, isB2B));
}

function draftToForm(draft: AdminOrderDraft): DraftForm {
  const address = draft.shippingAddress
    ? {
        firstName: draft.shippingAddress.firstName || "",
        lastName: draft.shippingAddress.lastName || "",
        address: draft.shippingAddress.address || "",
        extension: draft.shippingAddress.extension || "",
        city: draft.shippingAddress.city || "",
        postalCode: draft.shippingAddress.postalCode || "",
        country: draft.shippingAddress.country || "FR",
        phone: draft.shippingAddress.phone || "",
      }
    : emptyAddress;
  return {
    customerId: draft.customerId || null,
    email: draft.email || draft.customerEmail || "",
    isB2B: Boolean(draft.isB2B),
    paymentLater: draft.paymentMethod === "b2b_deferred",
    noShipping: Boolean((draft as AdminOrderDraft).noShipping),
    vatNumber: draft.vatNumber || "",
    shipping: String(draft.shipping ?? ""),
    notes: draft.notes || "",
    orderDiscountType: (draft.orderDiscountType as DiscountType) || (Number(draft.discountAmount || 0) > 0 ? "fixed" : "fixed"),
    orderDiscountValue: String(draft.orderDiscountValue ?? draft.discountAmount ?? ""),
    paymentDueDate: draft.paymentDueDate ? draft.paymentDueDate.slice(0, 10) : "",
    shippingAddress: address,
    items: (draft.items || []).map((item: OrderItem) => ({
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      image: item.image,
      fallbackPrice: item.price,
      lineDiscountType: (item.lineDiscountType as DiscountType) || (Number(item.discountAmount || 0) > 0 ? "fixed" : "fixed"),
      lineDiscountValue: String(item.lineDiscountValue ?? item.discountAmount ?? ""),
    })),
  };
}

function addressFromCustomer(customer: Customer): AdminDraftAddressPayload {
  const defaultAddress = customer.addresses?.find((address) => address.isDefault) || customer.addresses?.[0];
  return {
    firstName: defaultAddress?.firstName || customer.firstName || "",
    lastName: defaultAddress?.lastName || customer.lastName || "",
    address: defaultAddress?.address || "",
    extension: "",
    city: defaultAddress?.city || "",
    postalCode: defaultAddress?.postalCode || "",
    country: defaultAddress?.country || "FR",
    phone: defaultAddress?.phone || customer.phone || "",
  };
}

export default function AdminOrderDraftsPage() {
  const [drafts, setDrafts] = useState<AdminOrderDraft[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(true);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DraftForm>(initialForm);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendingDraftEmailId, setSendingDraftEmailId] = useState<string | null>(null);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Modal sélecteur d'email
  const [emailPickerDraftId, setEmailPickerDraftId] = useState<string | null>(null);
  const [emailPickerOptions, setEmailPickerOptions] = useState<EmailOption[]>([]);
  const [emailPickerDefault, setEmailPickerDefault] = useState<string>("");

  const totals = useMemo(() => {
    const subtotal = form.items.reduce((sum, line) => sum + lineGrossTotal(line, form.isB2B), 0);
    const lineDiscount = form.items.reduce((sum, line) => sum + lineDiscountAmount(line, form.isB2B), 0);
    const subtotalAfterLineDiscount = Math.max(0, subtotal - lineDiscount);
    const orderDiscount = discountAmount(form.orderDiscountType, form.orderDiscountValue, subtotalAfterLineDiscount);
    const discountedSubtotal = Math.max(0, subtotalAfterLineDiscount - orderDiscount);
    const shipping = form.shipping === "" ? 0 : Number(form.shipping || 0);
    const ht = form.isB2B ? discountedSubtotal : discountedSubtotal / 1.2;
    const vat = form.isB2B ? ht * 0.2 : discountedSubtotal - ht;
    const total = form.isB2B ? ht + vat + shipping : discountedSubtotal + shipping;
    return { subtotal, lineDiscount, orderDiscount, discountedSubtotal, ht, vat, shipping, total };
  }, [form.items, form.isB2B, form.shipping, form.orderDiscountType, form.orderDiscountValue]);

  async function loadDrafts(query = search) {
    setLoadingDrafts(true);
    try {
      const data = await getAdminOrderDrafts({ search: query || undefined, limit: 50 });
      setDrafts(data.drafts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement des brouillons");
    } finally {
      setLoadingDrafts(false);
    }
  }

  useEffect(() => {
    loadDrafts("");
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      if (!customerSearch.trim()) return setCustomers([]);
      const data = await getAdminCustomers({ search: customerSearch, limit: 8 });
      setCustomers(data.customers || []);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [customerSearch]);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      if (!productSearch.trim()) return setProducts([]);
      const data = await getAdminProducts({ search: productSearch, status: "active", limit: 12 });
      setProducts(data.products || []);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [productSearch]);

  function selectCustomer(customer: Customer) {
    setForm((current) => ({
      ...current,
      customerId: customer.id,
      email: customer.email,
      isB2B: customer.proAccount?.status === "approved" ? true : current.isB2B,
      shippingAddress: addressFromCustomer(customer),
    }));
    setCustomerSearch(customerName(customer));
    setCustomers([]);
  }

  function addProduct(product: Product) {
    setForm((current) => {
      const existing = current.items.find((line) => line.productId === product.id);
      if (existing) {
        return {
          ...current,
          items: current.items.map((line) =>
            line.productId === product.id ? { ...line, quantity: line.quantity + 1, product } : line
          ),
        };
      }
      return {
        ...current,
        items: [
          ...current.items,
          {
            productId: product.id,
            name: product.name,
            quantity: 1,
            image: productImages(product)[0],
            product,
            fallbackPrice: product.price,
            lineDiscountType: "fixed",
            lineDiscountValue: "",
          },
        ],
      };
    });
    setProductSearch("");
    setProducts([]);
  }

  function updateLineDiscount(productId: string, type: DiscountType, value: string) {
    const cleanedValue = value === "" ? "" : String(Math.max(0, Number(value || 0)));
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => item.productId === productId ? { ...item, lineDiscountType: type, lineDiscountValue: cleanedValue } : item),
    }));
  }

  function updateOrderDiscount(type: DiscountType, value: string) {
    const cleanedValue = value === "" ? "" : String(Math.max(0, Number(value || 0)));
    setForm((current) => ({ ...current, orderDiscountType: type, orderDiscountValue: cleanedValue }));
  }

  function buildPayload(): AdminOrderDraftPayload {
    const shippingValue = form.shipping === "" ? undefined : Number(form.shipping);
    return {
      customerId: form.customerId,
      email: form.email,
      isB2B: form.isB2B,
      paymentLater: form.paymentLater,
      noShipping: form.noShipping,
      vatNumber: form.vatNumber || null,
      shipping: form.noShipping ? 0 : (Number.isFinite(shippingValue) ? shippingValue : undefined),
      notes: form.notes,
      orderDiscountType: numericValue(form.orderDiscountValue) > 0 ? form.orderDiscountType : null,
      orderDiscountValue: numericValue(form.orderDiscountValue) > 0 ? numericValue(form.orderDiscountValue) : null,
      paymentDueDate: form.paymentDueDate || null,
      shippingAddress: form.noShipping ? undefined : form.shippingAddress,
      billingAddress: form.shippingAddress,
      items: form.items.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        lineDiscountType: numericValue(line.lineDiscountValue) > 0 ? line.lineDiscountType : null,
        lineDiscountValue: numericValue(line.lineDiscountValue) > 0 ? numericValue(line.lineDiscountValue) : null,
      })),
    };
  }

  async function saveDraft() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = buildPayload();
      const data = editingId ? await updateAdminOrderDraft(editingId, payload) : await createAdminOrderDraft(payload);
      setEditingId(data.draft.id);
      setForm(draftToForm(data.draft));
      setMessage(editingId ? "Brouillon mis à jour." : "Brouillon créé.");
      await loadDrafts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur enregistrement brouillon");
    } finally {
      setSaving(false);
    }
  }

  async function sendDraftEmail(draftId = editingId, overrideEmail?: string) {
    if (!draftId) return;

    // Si pas d'overrideEmail, vérifier si le client a des emails secondaires
    if (!overrideEmail) {
      const draft = drafts.find((d) => d.id === draftId);
      const customerId = draft?.customerId || null;
      if (customerId) {
        try {
          const extras = await getCustomerExtraEmails(customerId);
          if (extras.length > 0) {
            const baseEmail = draft?.email || "";
            const options: EmailOption[] = [
              { email: baseEmail, label: "Email principal" },
              ...extras.map((e: CustomerExtraEmail) => ({ email: e.email, label: e.label, isPrimary: e.isPrimary })),
            ];
            const primaryExtra = extras.find((e: CustomerExtraEmail) => e.isPrimary);
            setEmailPickerDefault(primaryExtra?.email || baseEmail);
            setEmailPickerOptions(options);
            setEmailPickerDraftId(draftId);
            return; // Attendre la confirmation du modal
          }
        } catch {
          // Ignorer les erreurs de chargement des emails secondaires
        }
      }
    }

    setSendingDraftEmailId(draftId);
    setError(null);
    setMessage(null);
    try {
      const data = await sendAdminOrderDraftEmail(draftId, overrideEmail);
      setDrafts((current) => current.map((draft) => (draft.id === draftId ? data.draft : draft)));
      if (editingId === draftId) setForm(draftToForm(data.draft));
      const sentTo = overrideEmail || data.draft.email || "";
      setMessage(`Email envoyé${sentTo ? ` à ${sentTo}` : ""}. Lien valable jusqu'au ${new Date(data.expiresAt).toLocaleString("fr-FR")}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur envoi email brouillon");
    } finally {
      setSendingDraftEmailId(null);
    }
  }

  async function sendPaymentReminder(draftId = editingId) {
    if (!draftId) return;
    setSendingReminderId(draftId);
    setError(null);
    setMessage(null);
    try {
      const data = await sendAdminPaymentReminder(draftId);
      setDrafts((current) => current.map((d) => (d.id === draftId ? { ...d, ...data.order } : d)));
      if (editingId === draftId && data.order) setForm((current) => ({ ...current, paymentDueDate: data.order.paymentDueDate ? data.order.paymentDueDate.slice(0, 10) : current.paymentDueDate }));
      setMessage(`Relance stage ${data.stage} envoyée à ${data.sentTo}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur envoi relance paiement");
    } finally {
      setSendingReminderId(null);
    }
  }

  async function confirmDraft() {
    if (!editingId) return;
    setSaving(true);
    setError(null);
    try {
      const paymentMethod = form.paymentLater ? "b2b_deferred" : null;
      const data = await confirmAdminOrderDraft(editingId, paymentMethod);
      setMessage(`Commande ${data.order.orderNumber} créée avec succès.`);
      setEditingId(null);
      setForm(initialForm);
      await loadDrafts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur confirmation brouillon");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-heading text-xl font-bold text-dark-800">Commandes</h1>
          <p className="text-sm text-gray-500">Création manuelle de commandes avec brouillon, B2B/B2C et paiement ultérieur.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setForm(initialForm);
            setCustomerSearch("");
            setMessage(null);
            setError(null);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-dark-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-dark-900"
        >
          <Plus size={16} /> Nouveau brouillon
        </button>
      </div>
      <AdminOrdersTabs />

      {(message || error) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {error || message}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-gray-100 bg-white p-4">
          <div className="mb-4 flex items-center gap-2">
            <FileText size={18} className="text-gray-400" />
            <h2 className="font-semibold text-dark-800">Brouillons existants</h2>
          </div>
          <div className="mb-4 flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && loadDrafts(search)}
                placeholder="Client, email, numéro"
                className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-dark-800"
              />
            </div>
            <button onClick={() => loadDrafts(search)} className="rounded-xl border border-gray-200 px-3 text-sm font-medium hover:bg-gray-50">OK</button>
          </div>
          <div className="space-y-2">
            {loadingDrafts ? (
              <div className="flex items-center gap-2 rounded-xl bg-gray-50 p-4 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" /> Chargement...</div>
            ) : drafts.length === 0 ? (
              <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">Aucun brouillon pour le moment.</div>
            ) : (
              drafts.map((draft) => (
                <div
                  key={draft.id}
                  onClick={() => {
                    setEditingId(draft.id);
                    setForm(draftToForm(draft));
                    setCustomerSearch(customerName(draft.customer));
                    setError(null);
                    setMessage(null);
                  }}
                  className={`w-full cursor-pointer rounded-xl border p-3 text-left transition ${editingId === draft.id ? "border-dark-800 bg-gray-50" : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-dark-800">{draft.orderNumber}</p>
                      <p className="truncate text-sm text-gray-500">{customerName(draft.customer)} · {draft.email}</p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Draft</span>
                  </div>
                  <div className="mt-2 flex justify-between text-sm"><span className="text-gray-500">{draft.items?.length || 0} ligne(s)</span><strong>{eur(draft.total)}</strong></div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      sendDraftEmail(draft.id);
                    }}
                    disabled={sendingDraftEmailId === draft.id || !draft.email}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-dark-800 hover:border-dark-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sendingDraftEmailId === draft.id ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                    Envoyer au client
                  </button>
                  {draft.draftShareSentAt && (
                    <p className="mt-2 text-xs text-emerald-700">Dernier email : {new Date(draft.draftShareSentAt).toLocaleString("fr-FR")}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </aside>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-5">
            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <div className="mb-4 flex items-center gap-2"><UserPlus size={18} className="text-gray-400" /><h2 className="font-semibold text-dark-800">Client et tarification</h2></div>
              <div className="relative">
                <input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Rechercher un client" className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-dark-800" />
                {customers.length > 0 && (
                  <div className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-xl">
                    {customers.map((customer) => (
                      <button key={customer.id} type="button" onClick={() => selectCustomer(customer)} className="block w-full px-4 py-3 text-left text-sm hover:bg-gray-50">
                        <span className="font-semibold">{customerName(customer)}</span>
                        <span className="block text-gray-500">{customer.email}{customer.proAccount?.status === "approved" ? " · Pro approuvé" : ""}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Email client" className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-dark-800" />
                <input value={form.vatNumber} onChange={(event) => setForm({ ...form, vatNumber: event.target.value })} placeholder="N° TVA (optionnel)" className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-dark-800" />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => setForm({ ...form, isB2B: false })} className={`rounded-xl border p-3 text-left ${!form.isB2B ? "border-dark-800 bg-dark-800 text-white" : "border-gray-200"}`}><strong>B2C</strong><span className="block text-sm opacity-80">Prix publics TTC</span></button>
                <button type="button" onClick={() => setForm({ ...form, isB2B: true })} className={`rounded-xl border p-3 text-left ${form.isB2B ? "border-dark-800 bg-dark-800 text-white" : "border-gray-200"}`}><strong>B2B</strong><span className="block text-sm opacity-80">Prix pro HT</span></button>
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <div className="mb-4 flex items-center gap-2"><PackagePlus size={18} className="text-gray-400" /><h2 className="font-semibold text-dark-800">Articles</h2></div>
              <div className="relative mb-4">
                <input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Rechercher un produit à ajouter" className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-dark-800" />
                {products.length > 0 && (
                  <div className="absolute z-20 mt-2 max-h-80 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-xl">
                    {products.map((product) => (
                      <button key={product.id} type="button" onClick={() => addProduct(product)} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-gray-50">
                        <div className="h-10 w-10 overflow-hidden rounded-lg bg-gray-100">{productImages(product)[0] ? <img src={productImages(product)[0]} alt="" className="h-full w-full object-cover" /> : null}</div>
                        <div className="min-w-0 flex-1"><p className="truncate font-semibold">{product.name}</p><p className="text-gray-500">Public {eur(product.price)} · Pro {eur(product.priceProEur ?? product.price / 1.2)}</p></div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                {form.items.length === 0 ? <div className="p-6 text-center text-sm text-gray-500">Ajoutez au moins un produit au brouillon.</div> : form.items.map((line) => (
                  <div key={line.productId} className="grid gap-3 p-3 sm:grid-cols-[1fr_95px_190px_120px_36px] sm:items-center">
                    <div className="flex min-w-0 items-center gap-3"><div className="h-11 w-11 overflow-hidden rounded-lg bg-gray-100">{line.image ? <img src={line.image} alt="" className="h-full w-full object-cover" /> : null}</div><div className="min-w-0"><p className="truncate font-medium">{line.name}</p><button type="button" onClick={() => updateLineDiscount(line.productId, line.lineDiscountType, line.lineDiscountValue || "")} className="text-left text-sm text-gray-500 underline-offset-2 hover:text-dark-800 hover:underline">{form.isB2B ? "Pro HT" : "Public TTC"} : {eur(unitPrice(line, form.isB2B))}</button></div></div>
                    <input type="number" min={1} value={line.quantity} onChange={(event) => setForm((current) => ({ ...current, items: current.items.map((item) => item.productId === line.productId ? { ...item, quantity: Math.max(1, Number(event.target.value || 1)) } : item) }))} className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-dark-800" />
                    <div className="grid grid-cols-[82px_1fr] gap-2">
                      <select value={line.lineDiscountType} onChange={(event) => updateLineDiscount(line.productId, event.target.value as DiscountType, line.lineDiscountValue)} className="rounded-xl border border-gray-200 px-2 py-2 text-sm outline-none focus:border-dark-800">
                        <option value="fixed">€</option>
                        <option value="percent">%</option>
                      </select>
                      <input type="number" min="0" step="0.01" value={line.lineDiscountValue} onChange={(event) => updateLineDiscount(line.productId, line.lineDiscountType, event.target.value)} onFocus={(event) => event.currentTarget.select()} className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-dark-800" placeholder="Remise" />
                    </div>
                    <div className="text-sm font-semibold sm:text-right"><span>{eur(Math.max(0, lineGrossTotal(line, form.isB2B) - lineDiscountAmount(line, form.isB2B)))}</span>{lineDiscountAmount(line, form.isB2B) > 0 ? <span className="block text-xs font-medium text-emerald-700">-{eur(lineDiscountAmount(line, form.isB2B))}</span> : null}</div>
                    <button type="button" onClick={() => setForm((current) => ({ ...current, items: current.items.filter((item) => item.productId !== line.productId) }))} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <h2 className="mb-4 font-semibold text-dark-800">Adresse de livraison</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {(["firstName", "lastName", "address", "extension", "city", "postalCode", "country", "phone"] as const).map((field) => (
                  <input key={field} value={form.shippingAddress[field] || ""} onChange={(event) => setForm((current) => ({ ...current, shippingAddress: { ...current.shippingAddress, [field]: event.target.value } }))} placeholder={{ firstName: "Prénom", lastName: "Nom", address: "Adresse", extension: "Complément", city: "Ville", postalCode: "Code postal", country: "Pays", phone: "Téléphone" }[field]} className={`rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-dark-800 ${field === "address" ? "sm:col-span-2" : ""}`} />
                ))}
              </div>
            </div>
          </div>

          <aside className="h-fit rounded-xl border border-gray-100 bg-white p-4 lg:sticky lg:top-6">
            <h2 className="font-semibold text-dark-800">Résumé Shopify-like</h2>
            <label className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 text-sm"><span><strong className="block">Paiement ultérieur</strong><span className="text-gray-500">La commande sera en attente de paiement.</span></span><input type="checkbox" checked={form.paymentLater} onChange={(event) => setForm({ ...form, paymentLater: event.target.checked })} className="h-5 w-5" /></label>
            <label className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><span><strong className="block text-amber-900">Déjà remis en main propre / Retrait en magasin</strong><span className="text-amber-700">Aucune livraison n’est nécessaire. Le client ne verra pas l’étape de livraison.</span></span><input type="checkbox" checked={form.noShipping} onChange={(event) => setForm({ ...form, noShipping: event.target.checked, shipping: event.target.checked ? "0" : form.shipping })} className="h-5 w-5 accent-amber-600" /></label>
            {!form.noShipping && (
              <div className="mt-4"><label className="text-sm font-medium text-gray-700">Livraison</label><input type="number" min="0" step="0.01" value={form.shipping} onChange={(event) => setForm({ ...form, shipping: event.target.value })} placeholder="Auto si vide" className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-dark-800" /></div>
            )}
            <div className="mt-4"><label className="text-sm font-medium text-gray-700">Remise commande totale</label><div className="mt-2 grid grid-cols-[92px_1fr] gap-2"><select value={form.orderDiscountType} onChange={(event) => updateOrderDiscount(event.target.value as DiscountType, form.orderDiscountValue)} className="rounded-xl border border-gray-200 px-2 py-2.5 text-sm outline-none focus:border-dark-800"><option value="fixed">€ fixe</option><option value="percent">%</option></select><input type="number" min="0" step="0.01" value={form.orderDiscountValue} onChange={(event) => updateOrderDiscount(form.orderDiscountType, event.target.value)} placeholder="0" className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-dark-800" /></div></div>
            <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Notes internes" rows={4} className="mt-4 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-dark-800" />
            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700">Date d'échéance de paiement</label>
              <input
                type="date"
                value={form.paymentDueDate}
                onChange={(event) => setForm({ ...form, paymentDueDate: event.target.value })}
                className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-dark-800"
              />
              {form.paymentDueDate && (
                <p className="mt-1 text-xs text-gray-500">
                  Relances automatiques : J-3, jour J, J+3 (9h00).
                </p>
              )}
            </div>
            <div className="mt-5 space-y-3 border-t border-gray-100 pt-4 text-sm"><div className="flex justify-between"><span>Sous-total {form.isB2B ? "HT" : "TTC"}</span><strong>{eur(totals.subtotal)}</strong></div>{totals.lineDiscount > 0 ? <div className="flex justify-between text-emerald-700"><span>Remises articles</span><strong>- {eur(totals.lineDiscount)}</strong></div> : null}{totals.orderDiscount > 0 ? <div className="flex justify-between text-emerald-700"><span>Remise commande</span><strong>- {eur(totals.orderDiscount)}</strong></div> : null}<div className="flex justify-between"><span>TVA estimée</span><strong>{eur(totals.vat)}</strong></div><div className="flex justify-between"><span>Livraison</span><strong>{form.shipping === "" ? "Auto" : eur(totals.shipping)}</strong></div><div className="flex justify-between border-t border-gray-100 pt-3 text-base"><span>Total</span><strong>{eur(totals.total)}</strong></div></div>
            <button type="button" onClick={saveDraft} disabled={saving} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-dark-800 px-4 py-3 text-sm font-semibold text-white hover:bg-dark-900 disabled:opacity-60">{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Enregistrer</button>
            <button type="button" onClick={() => sendDraftEmail()} disabled={!editingId || sendingDraftEmailId === editingId || !form.email} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dark-800 px-4 py-3 text-sm font-semibold text-dark-800 hover:bg-gray-50 disabled:opacity-50">{sendingDraftEmailId === editingId ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />} Envoyer au client</button>
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="mb-2 text-xs font-semibold text-emerald-800">⚠️ Étape obligatoire pour activer la commande</p>
              <p className="mb-3 text-xs text-emerald-700">Cliquer sur ce bouton convertit le brouillon en commande active (statut : en attente de paiement). Sans cette étape, la commande reste en état brouillon et certaines fonctions (expédition, facturation) peuvent être limitées.</p>
              <button type="button" onClick={confirmDraft} disabled={!editingId || saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><CheckCircle2 size={16} /> Créer la commande</button>
            </div>
            {editingId && form.paymentDueDate && (
              <button
                type="button"
                onClick={() => sendPaymentReminder()}
                disabled={sendingReminderId === editingId}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
              >
                {sendingReminderId === editingId ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />}
                Envoyer une relance de paiement
              </button>
            )}
          </aside>
        </section>
      </div>

      {/* Modal sélecteur d'email pour les brouillons */}
      {emailPickerDraftId && (
        <EmailPickerModal
          options={emailPickerOptions}
          defaultEmail={emailPickerDefault}
          actionLabel="Envoyer au client"
          onConfirm={(email) => {
            const id = emailPickerDraftId;
            setEmailPickerDraftId(null);
            setEmailPickerOptions([]);
            sendDraftEmail(id, email);
          }}
          onCancel={() => {
            setEmailPickerDraftId(null);
            setEmailPickerOptions([]);
          }}
        />
      )}
    </div>
  );
}
