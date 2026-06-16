"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  CreditCard,
  History,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Store,
  Trash2,
  UserRound,
  XCircle,
} from "lucide-react";
import {
  cancelPosPayment,
  closePosSession,
  createPosPayment,
  createPosQuickSale,
  getAdminCustomers,
  getPosCatalog,
  getPosPaymentStatus,
  getPosTerminals,
  openPosSession,
  type DiscountType,
  type PosOrder,
  type PosPaymentMethod,
  type PosProduct,
  type PosTerminal,
  type PosVariant,
} from "@/lib/admin-api";
import type { Customer } from "@/types";

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

function formatPrice(value: number) {
  return currency.format(Number.isFinite(value) ? value : 0);
}

type CartLine = {
  key: string;
  productId: string;
  variantId?: string | null;
  name: string;
  brand: string;
  image: string;
  price: number;
  stock: number;
  quantity: number;
  lineDiscountType: DiscountType;
  lineDiscountValue: string;
  variantLabel?: string | null;
};

function getProductImage(product: PosProduct, variant?: PosVariant | null) {
  return variant?.image || product.image || "/placeholder-product.png";
}

function customerName(customer: Customer) {
  const fullName = `${customer.firstName || ""} ${customer.lastName || ""}`.trim();
  return fullName || customer.email;
}

function numericValue(value: string | number | null | undefined) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function resolveDiscount(type: DiscountType, value: string | number | null | undefined, base: number) {
  const safeBase = Math.max(0, base);
  const safeValue = numericValue(value);
  if (safeValue <= 0 || safeBase <= 0) return 0;
  return type === "percent" ? Math.min(safeBase, safeBase * Math.min(100, safeValue) / 100) : Math.min(safeBase, safeValue);
}

function lineDiscountAmount(line: CartLine) {
  return resolveDiscount(line.lineDiscountType, line.lineDiscountValue, line.price * line.quantity);
}

export default function AdminCaissePage() {
  const [terminals, setTerminals] = useState<PosTerminal[]>([]);
  const [terminalId, setTerminalId] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<PosProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderDiscountType, setOrderDiscountType] = useState<DiscountType>("fixed");
  const [orderDiscountValue, setOrderDiscountValue] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>("card");
  const [cashReceived, setCashReceived] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [quickAmount, setQuickAmount] = useState("");
  const [quickDescription, setQuickDescription] = useState("Vente comptoir");
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [currentOrder, setCurrentOrder] = useState<PosOrder | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTerminals = useCallback(async () => {
    const data = await getPosTerminals();
    setTerminals(data.terminals);
    if (!terminalId && data.terminals.length) {
      setTerminalId(data.terminals[0].id);
    }
  }, [terminalId]);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const data = await getPosCatalog({ q: query, category, limit: 80 });
      setCatalog(data.products);
      setCategories(data.categories);
    } finally {
      setCatalogLoading(false);
    }
  }, [category, query]);

  const loadCustomers = useCallback(async () => {
    const data = await getAdminCustomers({ search: customerSearch, limit: 8 });
    setCustomers(data.customers);
  }, [customerSearch]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([loadTerminals(), loadCatalog(), loadCustomers()])
      .catch((err) => alive && setError(err.message || "Impossible de charger la caisse."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadCatalog().catch((err) => setError(err.message || "Impossible de charger le catalogue."));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [loadCatalog]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadCustomers().catch(() => undefined);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [loadCustomers]);

  useEffect(() => {
    if (!paymentId || paymentStatus === "paid" || paymentStatus === "failed" || paymentStatus === "canceled" || paymentStatus === "expired") return;
    const timer = window.setInterval(async () => {
      try {
        const data = await getPosPaymentStatus(paymentId);
        setPaymentStatus(data.status);
        if (data.order) setCurrentOrder(data.order);
        if (data.status === "paid") {
          setMessage(`Paiement validé pour la commande ${data.order?.orderNumber || "POS"}.`);
          setCart([]);
          setOrderDiscountType("fixed");
          setOrderDiscountValue("");
          setNotes("");
          setPaymentId(null);
          await loadCatalog();
        }
        if (["failed", "canceled", "expired"].includes(data.status)) {
          setError(`Paiement ${data.status}. Vous pouvez relancer l’encaissement.`);
          setPaymentId(null);
        }
      } catch (err: any) {
        setError(err.message || "Impossible de rafraîchir le statut du paiement.");
      }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [loadCatalog, paymentId, paymentStatus]);

  const selectedCustomer = useMemo(() => customers.find((customer) => customer.id === selectedCustomerId) || null, [customers, selectedCustomerId]);
  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + line.price * line.quantity, 0), [cart]);
  const lineDiscount = useMemo(() => cart.reduce((sum, line) => sum + lineDiscountAmount(line), 0), [cart]);
  const subtotalAfterLineDiscount = Math.max(0, subtotal - lineDiscount);
  const orderDiscount = resolveDiscount(orderDiscountType, orderDiscountValue, subtotalAfterLineDiscount);
  const discount = Math.max(0, Math.min(subtotal, lineDiscount + orderDiscount));
  const total = Math.max(0, subtotalAfterLineDiscount - orderDiscount);
  const vat = total - total / 1.2;
  const receivedAmount = numericValue(cashReceived);
  const changeDue = paymentMethod === "cash" && receivedAmount > 0 ? Math.max(0, receivedAmount - total) : 0;

  function addToCart(product: PosProduct, variant?: PosVariant | null) {
    const price = variant?.price ?? product.price;
    const stock = variant?.stock ?? product.stockCount;
    const key = `${product.id}:${variant?.id || "default"}`;
    setCart((lines) => {
      const existing = lines.find((line) => line.key === key);
      if (existing) {
        return lines.map((line) =>
          line.key === key ? { ...line, quantity: Math.min(line.quantity + 1, Math.max(1, line.stock)) } : line
        );
      }
      return [
        ...lines,
        {
          key,
          productId: product.id,
          variantId: variant?.id || null,
          name: product.name,
          brand: product.brand,
          image: getProductImage(product, variant),
          price,
          stock,
          quantity: 1,
          lineDiscountType: "fixed",
          lineDiscountValue: "",
          variantLabel: variant?.label || variant?.name || null,
        },
      ];
    });
  }

  function updateQuantity(key: string, quantity: number) {
    setCart((lines) =>
      lines
        .map((line) => (line.key === key ? { ...line, quantity: Math.max(0, Math.min(quantity, Math.max(1, line.stock))) } : line))
        .filter((line) => line.quantity > 0)
    );
  }

  function updateLineDiscount(key: string, type: DiscountType, value: string) {
    const cleanedValue = value === "" ? "" : String(numericValue(value));
    setCart((lines) => lines.map((line) => (line.key === key ? { ...line, lineDiscountType: type, lineDiscountValue: cleanedValue } : line)));
  }

  function updateOrderDiscount(type: DiscountType, value: string) {
    setOrderDiscountType(type);
    setOrderDiscountValue(value === "" ? "" : String(numericValue(value)));
  }

  async function ensureSession() {
    if (sessionId) return sessionId;
    if (!terminalId) throw new Error("Sélectionnez un terminal Mollie.");
    const data = await openPosSession({ terminalId, notes: "Session ouverte depuis l’admin Barber Paradise" });
    setSessionId(data.session.id);
    return data.session.id;
  }

  async function handleStartSession() {
    try {
      setError(null);
      const id = await ensureSession();
      setMessage(`Session de caisse ouverte sur le terminal ${terminalId}.`);
      setSessionId(id);
    } catch (err: any) {
      setError(err.message || "Impossible d’ouvrir la session de caisse.");
    }
  }

  async function handleCloseSession() {
    if (!sessionId) return;
    try {
      await closePosSession(sessionId);
      setSessionId(null);
      setMessage("Session de caisse clôturée.");
    } catch (err: any) {
      setError(err.message || "Impossible de clôturer la session.");
    }
  }

  async function handleCheckout(event: FormEvent) {
    event.preventDefault();
    if (!cart.length) {
      setError("Ajoutez au moins un article au panier.");
      return;
    }
    if (paymentMethod === "cash" && cashReceived && receivedAmount < total) {
      setError("Le montant reçu est inférieur au total du panier.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const activeSessionId = paymentMethod === "card" ? await ensureSession() : sessionId;
      const data = await createPosPayment({
        terminalId: paymentMethod === "card" ? terminalId : null,
        posSessionId: activeSessionId,
        paymentMethod,
        customerId: selectedCustomerId,
        items: cart.map((line) => ({
          productId: line.productId,
          variantId: line.variantId,
          quantity: line.quantity,
          lineDiscountType: numericValue(line.lineDiscountValue) > 0 ? line.lineDiscountType : null,
          lineDiscountValue: numericValue(line.lineDiscountValue) > 0 ? numericValue(line.lineDiscountValue) : null,
        })),
        orderDiscountType: numericValue(orderDiscountValue) > 0 ? orderDiscountType : null,
        orderDiscountValue: numericValue(orderDiscountValue) > 0 ? numericValue(orderDiscountValue) : null,
        notes: notes || null,
      });
      setCurrentOrder(data.order);
      setPaymentId(data.paymentId);
      setPaymentStatus(data.status);
      if (paymentMethod === "cash") {
        setCart([]);
        setOrderDiscountType("fixed");
        setOrderDiscountValue("");
        setCashReceived("");
        setNotes("");
        setMessage(`Encaissement espèces validé pour ${formatPrice(data.order.totalTTC || data.order.total)}.`);
        await loadCatalog();
      } else {
        setMessage(`Paiement envoyé au terminal pour ${formatPrice(data.order.totalTTC || data.order.total)}.`);
      }
    } catch (err: any) {
      setError(err.message || "Impossible de créer le paiement POS.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleQuickSale(event: FormEvent) {
    event.preventDefault();
    const amount = Number(quickAmount.replace(",", "."));
    if (!amount || amount <= 0) {
      setError("Saisissez un montant de vente rapide valide.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      if (paymentMethod === "cash" && cashReceived && receivedAmount < amount) {
        setError("Le montant reçu est inférieur au montant de la vente rapide.");
        return;
      }
      const activeSessionId = paymentMethod === "card" ? await ensureSession() : sessionId;
      const data = await createPosQuickSale({
        terminalId: paymentMethod === "card" ? terminalId : null,
        posSessionId: activeSessionId,
        paymentMethod,
        customerId: selectedCustomerId,
        amount,
        description: quickDescription || "Vente comptoir",
        orderDiscountType: numericValue(orderDiscountValue) > 0 ? orderDiscountType : null,
        orderDiscountValue: numericValue(orderDiscountValue) > 0 ? numericValue(orderDiscountValue) : null,
        notes: notes || null,
      });
      setCurrentOrder(data.order);
      setPaymentId(data.paymentId);
      setPaymentStatus(data.status);
      if (paymentMethod === "cash") {
        setMessage(`Vente rapide espèces validée pour ${formatPrice(data.order.totalTTC || data.order.total)}.`);
        setCashReceived("");
        await loadCatalog();
      } else {
        setMessage(`Vente rapide envoyée au terminal pour ${formatPrice(data.order.totalTTC || data.order.total)}.`);
      }
      setQuickAmount("");
      setOrderDiscountType("fixed");
      setOrderDiscountValue("");
    } catch (err: any) {
      setError(err.message || "Impossible de créer la vente rapide.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelPayment() {
    if (!paymentId) return;
    try {
      await cancelPosPayment(paymentId);
      setPaymentId(null);
      setPaymentStatus("canceled");
      setMessage("Paiement POS annulé.");
    } catch (err: any) {
      setError(err.message || "Impossible d’annuler le paiement.");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">Administration</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-black tracking-tight text-gray-950 sm:text-3xl">
            <Store className="h-7 w-7 text-primary" /> Caisse POS
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-600">
            Encaissez les ventes physiques Barber Paradise avec terminal Mollie, décrémentation du stock, historique et rattachement client facultatif.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/caisse/historique" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:border-primary/40 hover:text-primary">
            <History size={16} /> Historique
          </Link>
          <Link href="/admin/caisse/stats" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:border-primary/40 hover:text-primary">
            <Banknote size={16} /> Statistiques
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4" /> <span>{error}</span>
        </div>
      )}
      {message && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4" /> <span>{message}</span>
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[1fr_220px_180px]">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Recherche produit</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nom, marque, SKU…" className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Catégorie</label>
                <select value={category} onChange={(event) => setCategory(event.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary">
                  <option value="">Toutes</option>
                  {categories.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button type="button" onClick={loadCatalog} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-gray-800">
                  <RefreshCw size={16} className={catalogLoading ? "animate-spin" : ""} /> Actualiser
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {catalog.map((product) => (
              <article key={product.id} className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
                <div className="flex gap-3">
                  <img src={product.image || "/placeholder-product.png"} alt="" className="h-20 w-20 rounded-xl border border-gray-100 object-contain" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold uppercase tracking-[0.18em] text-primary">{product.brand || "Barber Paradise"}</p>
                    <h2 className="line-clamp-2 text-sm font-bold text-gray-950">{product.name}</h2>
                    <div className="mt-1 flex items-center justify-between text-sm">
                      <span className="font-black text-gray-950">{formatPrice(product.price)}</span>
                      <span className={`text-xs font-bold ${product.inStock ? "text-emerald-600" : "text-red-500"}`}>{product.stockCount} en stock</span>
                    </div>
                  </div>
                </div>
                {product.variants.length ? (
                  <div className="mt-3 grid gap-2">
                    {product.variants.map((variant) => (
                      <button key={variant.id} type="button" disabled={!variant.inStock || variant.stock <= 0} onClick={() => addToCart(product, variant)} className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2 text-left text-xs font-semibold hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-40">
                        <span className="truncate">{variant.label || variant.name}</span>
                        <span>{formatPrice(variant.price)} · {variant.stock}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <button type="button" disabled={!product.inStock || product.stockCount <= 0} onClick={() => addToCart(product)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-black uppercase tracking-[0.16em] text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40">
                    <Plus size={16} /> Ajouter
                  </button>
                )}
              </article>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-base font-black text-gray-950"><CreditCard size={18} /> Terminal</h2>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${sessionId ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{sessionId ? "Session ouverte" : "Session fermée"}</span>
            </div>
            <select value={terminalId} onChange={(event) => setTerminalId(event.target.value)} className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary">
              <option value="">Sélectionner un terminal</option>
              {terminals.map((terminal) => <option key={terminal.id} value={terminal.id}>{terminal.description || terminal.id} · {terminal.status}</option>)}
            </select>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={handleStartSession} disabled={!terminalId || Boolean(sessionId)} className="rounded-xl bg-gray-950 px-3 py-2 text-sm font-bold text-white disabled:opacity-40">Ouvrir</button>
              <button type="button" onClick={handleCloseSession} disabled={!sessionId} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 disabled:opacity-40">Clôturer</button>
            </div>
          </div>

          <form onSubmit={handleCheckout} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-black text-gray-950"><ShoppingBag size={18} /> Panier</h2>
              <button type="button" onClick={() => setCart([])} className="text-xs font-bold text-gray-400 hover:text-red-500">Vider</button>
            </div>
            <div className="max-h-[360px] space-y-3 overflow-auto pr-1">
              {cart.length === 0 && <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">Aucun article dans le panier.</p>}
              {cart.map((line) => (
                <div key={line.key} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex gap-3">
                    <img src={line.image} alt="" className="h-14 w-14 rounded-lg object-contain" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-gray-950">{line.name}</p>
                      <p className="text-xs text-gray-500">{line.variantLabel || line.brand}</p>
                      <button type="button" onClick={() => updateLineDiscount(line.key, line.lineDiscountType, line.lineDiscountValue || "")} className="mt-1 text-left text-sm font-black text-gray-950 underline-offset-2 hover:text-primary hover:underline">{formatPrice(line.price)}</button>
                    </div>
                    <button type="button" onClick={() => updateQuantity(line.key, 0)} className="text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                  </div>
                  <div className="mt-3 grid grid-cols-[110px_1fr] gap-2">
                    <div className="flex items-center justify-between rounded-lg border border-gray-200 px-2 py-1">
                      <button type="button" onClick={() => updateQuantity(line.key, line.quantity - 1)}><Minus size={14} /></button>
                      <span className="text-sm font-bold">{line.quantity}</span>
                      <button type="button" onClick={() => updateQuantity(line.key, line.quantity + 1)}><Plus size={14} /></button>
                    </div>
                    <div className="grid grid-cols-[76px_1fr] gap-2">
                      <select value={line.lineDiscountType} onChange={(event) => updateLineDiscount(line.key, event.target.value as DiscountType, line.lineDiscountValue)} className="rounded-lg border border-gray-200 px-2 py-1 text-sm outline-none focus:border-primary">
                        <option value="fixed">€</option>
                        <option value="percent">%</option>
                      </select>
                      <input type="number" min="0" step="0.01" value={line.lineDiscountValue} onChange={(event) => updateLineDiscount(line.key, line.lineDiscountType, event.target.value)} onFocus={(event) => event.currentTarget.select()} className="rounded-lg border border-gray-200 px-2 py-1 text-sm outline-none focus:border-primary" placeholder="Remise" />
                    </div>
                  </div>
                  {lineDiscountAmount(line) > 0 ? <p className="mt-2 text-right text-xs font-semibold text-emerald-700">Remise ligne : - {formatPrice(lineDiscountAmount(line))}</p> : null}
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
              <label className="block text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Client facultatif</label>
              <div className="relative">
                <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Rechercher un client" className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary" />
              </div>
              <select value={selectedCustomerId || ""} onChange={(event) => setSelectedCustomerId(event.target.value || null)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary">
                <option value="">Client comptoir</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customerName(customer)} · {customer.email}</option>)}
              </select>
              {selectedCustomer && <p className="text-xs text-emerald-700">Vente rattachée à {customerName(selectedCustomer)}.</p>}
              <div className="grid grid-cols-[96px_1fr] gap-2">
                <select value={orderDiscountType} onChange={(event) => updateOrderDiscount(event.target.value as DiscountType, orderDiscountValue)} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary">
                  <option value="fixed">€ fixe</option>
                  <option value="percent">%</option>
                </select>
                <input type="number" min="0" step="0.01" value={orderDiscountValue} onChange={(event) => updateOrderDiscount(orderDiscountType, event.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary" placeholder="Remise commande" />
              </div>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary" placeholder="Notes internes de vente" />
            </div>

            <div className="mt-4 space-y-3 rounded-2xl border border-gray-100 bg-gray-50 p-3">
              <label className="block text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Moyen de paiement</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setPaymentMethod("card")} className={`rounded-xl border px-3 py-2 text-sm font-black ${paymentMethod === "card" ? "border-primary bg-primary text-white" : "border-gray-200 bg-white text-gray-700 hover:border-primary/40"}`}>Carte · Tap to Pay</button>
                <button type="button" onClick={() => setPaymentMethod("cash")} className={`rounded-xl border px-3 py-2 text-sm font-black ${paymentMethod === "cash" ? "border-emerald-600 bg-emerald-600 text-white" : "border-gray-200 bg-white text-gray-700 hover:border-emerald-300"}`}>Espèces</button>
              </div>
              {paymentMethod === "cash" ? (
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">Montant reçu</label>
                    <input value={cashReceived} onChange={(event) => setCashReceived(event.target.value)} inputMode="decimal" className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500" placeholder={formatPrice(total)} />
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2.5">
                    <p className="text-xs font-semibold text-gray-500">Monnaie à rendre</p>
                    <p className="mt-1 text-lg font-black text-emerald-700">{formatPrice(changeDue)}</p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-4 rounded-2xl bg-gray-950 p-4 text-white">
              <div className="space-y-1 text-sm text-gray-300">
                <div className="flex justify-between"><span>Sous-total</span><span>{formatPrice(subtotal)}</span></div>
                {lineDiscount > 0 ? <div className="flex justify-between"><span>Remises articles</span><span>- {formatPrice(lineDiscount)}</span></div> : null}
                {orderDiscount > 0 ? <div className="flex justify-between"><span>Remise commande</span><span>- {formatPrice(orderDiscount)}</span></div> : null}
                {discount <= 0 ? <div className="flex justify-between"><span>Remises</span><span>- {formatPrice(0)}</span></div> : null}
                <div className="flex justify-between"><span>TVA incluse estimée</span><span>{formatPrice(vat)}</span></div>
              </div>
              <div className="mt-3 flex justify-between text-xl font-black"><span>Total</span><span>{formatPrice(total)}</span></div>
            </div>

            <button type="submit" disabled={submitting || (paymentMethod === "card" && !terminalId) || !cart.length || Boolean(paymentId)} className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:opacity-50 ${paymentMethod === "cash" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-primary hover:bg-primary/90"}`}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : paymentMethod === "cash" ? <Banknote size={16} /> : <CreditCard size={16} />} {paymentMethod === "cash" ? "Valider l’encaissement espèces" : "Encaisser sur terminal"}
            </button>
          </form>

          <form onSubmit={handleQuickSale} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <h2 className="text-base font-black text-gray-950">Vente rapide</h2>
            <p className="mt-1 text-xs text-gray-500">Pour une prestation ou un article non catalogué.</p>
            <div className="mt-3 grid grid-cols-[1fr_1.5fr] gap-2">
              <input value={quickAmount} onChange={(event) => setQuickAmount(event.target.value)} inputMode="decimal" className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary" placeholder="Montant" />
              <input value={quickDescription} onChange={(event) => setQuickDescription(event.target.value)} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary" placeholder="Libellé" />
            </div>
            <button type="submit" disabled={submitting || (paymentMethod === "card" && !terminalId) || Boolean(paymentId)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-800 hover:border-primary/40 hover:text-primary disabled:opacity-40">
              <Banknote size={16} /> {paymentMethod === "cash" ? "Valider la vente rapide espèces" : "Encaisser une vente rapide"}
            </button>
          </form>

          {paymentId && (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-amber-900">
              <div className="flex items-start gap-3">
                <Loader2 className="mt-0.5 h-5 w-5 animate-spin" />
                <div>
                  <p className="font-black">Paiement en attente terminal</p>
                  <p className="mt-1 text-sm">Statut : {paymentStatus || "pending"}</p>
                  {currentOrder && <p className="mt-1 text-sm">Commande : {currentOrder.orderNumber}</p>}
                </div>
              </div>
              <button type="button" onClick={handleCancelPayment} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-bold text-amber-900 hover:text-red-600">
                <XCircle size={16} /> Annuler le paiement
              </button>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
