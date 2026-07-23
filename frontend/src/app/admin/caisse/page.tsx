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
  SplitSquareHorizontal,
  Store,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  createPosPayment,
  createPosQuickSale,
  getAdminCustomers,
  getPosCatalog,
  type DiscountType,
  type PosOrder,
  type PosPaymentMethod,
  type PosProduct,
  type PosSplitLine,
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

type SplitLineInput = {
  method: Exclude<PosPaymentMethod, "split">;
  amount: string;
};

const PAYMENT_METHODS: { value: PosPaymentMethod; label: string; labelShort: string; color: string; activeColor: string }[] = [
  { value: "indy", label: "Carte · Indy", labelShort: "Indy", color: "border-gray-200 bg-white text-gray-700 hover:border-primary/40", activeColor: "border-primary bg-primary text-white" },
  { value: "mollie_manual", label: "Carte · Mollie", labelShort: "Mollie", color: "border-gray-200 bg-white text-gray-700 hover:border-blue-300", activeColor: "border-blue-600 bg-blue-600 text-white" },
  { value: "cash", label: "Espèces", labelShort: "Espèces", color: "border-gray-200 bg-white text-gray-700 hover:border-emerald-300", activeColor: "border-emerald-600 bg-emerald-600 text-white" },
  { value: "virement", label: "Virement", labelShort: "Virement", color: "border-gray-200 bg-white text-gray-700 hover:border-amber-300", activeColor: "border-amber-600 bg-amber-600 text-white" },
  { value: "split", label: "Diviser", labelShort: "Diviser", color: "border-gray-200 bg-white text-gray-700 hover:border-violet-300", activeColor: "border-violet-600 bg-violet-600 text-white" },
];

const SPLIT_METHODS: { value: Exclude<PosPaymentMethod, "split">; label: string }[] = [
  { value: "indy", label: "Carte · Indy" },
  { value: "mollie_manual", label: "Carte · Mollie" },
  { value: "cash", label: "Espèces" },
  { value: "virement", label: "Virement" },
];

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

function money(value: number) {
  return Math.max(0, Math.round((value + Number.EPSILON) * 100) / 100);
}

export default function AdminCaissePage() {
  const [catalog, setCatalog] = useState<PosProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderDiscountType, setOrderDiscountType] = useState<DiscountType>("fixed");
  const [orderDiscountValue, setOrderDiscountValue] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>("indy");
  const [cashReceived, setCashReceived] = useState("");
  const [splitLines, setSplitLines] = useState<SplitLineInput[]>([
    { method: "indy", amount: "" },
    { method: "cash", amount: "" },
  ]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [quickAmount, setQuickAmount] = useState("");
  const [quickDescription, setQuickDescription] = useState("Vente comptoir");
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastOrder, setLastOrder] = useState<PosOrder | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setCustomerLoading(true);
    try {
      const data = await getAdminCustomers({ search: customerSearch, limit: 8 });
      setCustomers(data.customers);
    } finally {
      setCustomerLoading(false);
    }
  }, [customerSearch]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([loadCatalog(), loadCustomers()])
      .catch((err) => alive && setError(err.message || "Impossible de charger la caisse."))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
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

  const selectedCustomer = useMemo(() => customers.find((c) => c.id === selectedCustomerId) || null, [customers, selectedCustomerId]);
  const trimmedCustomerSearch = customerSearch.trim();
  const showCustomerResults = customerPickerOpen && trimmedCustomerSearch.length > 0;
  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + line.price * line.quantity, 0), [cart]);
  const lineDiscount = useMemo(() => cart.reduce((sum, line) => sum + lineDiscountAmount(line), 0), [cart]);
  const subtotalAfterLineDiscount = Math.max(0, subtotal - lineDiscount);
  const orderDiscount = resolveDiscount(orderDiscountType, orderDiscountValue, subtotalAfterLineDiscount);
  const discount = Math.max(0, Math.min(subtotal, lineDiscount + orderDiscount));
  const total = Math.max(0, subtotalAfterLineDiscount - orderDiscount);
  const vat = total - total / 1.2;
  const receivedAmount = numericValue(cashReceived);
  const changeDue = paymentMethod === "cash" && receivedAmount > 0 ? Math.max(0, receivedAmount - total) : 0;

  // Calcul du reste à répartir en mode DIVISER
  const splitAllocated = useMemo(() => splitLines.reduce((sum, l) => sum + numericValue(l.amount), 0), [splitLines]);
  const splitRemaining = money(total - splitAllocated);

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

  function updateSplitLine(idx: number, field: "method" | "amount", value: string) {
    setSplitLines((lines) =>
      lines.map((line, i) =>
        i === idx ? { ...line, [field]: field === "method" ? (value as Exclude<PosPaymentMethod, "split">) : value } : line
      )
    );
  }

  function addSplitLine() {
    setSplitLines((lines) => [...lines, { method: "cash", amount: "" }]);
  }

  function removeSplitLine(idx: number) {
    setSplitLines((lines) => lines.filter((_, i) => i !== idx));
  }

  function autoFillLastSplitLine() {
    if (splitLines.length === 0) return;
    const allocated = splitLines.slice(0, -1).reduce((sum, l) => sum + numericValue(l.amount), 0);
    const remaining = money(total - allocated);
    if (remaining > 0) {
      setSplitLines((lines) =>
        lines.map((line, i) =>
          i === lines.length - 1 ? { ...line, amount: String(remaining) } : line
        )
      );
    }
  }

  function resetCart() {
    setCart([]);
    setOrderDiscountType("fixed");
    setOrderDiscountValue("");
    setCashReceived("");
    setNotes("");
    setSplitLines([{ method: "indy", amount: "" }, { method: "cash", amount: "" }]);
  }

  function buildSplitPayload(): PosSplitLine[] {
    return splitLines.map((l) => ({ method: l.method, amount: money(numericValue(l.amount)) }));
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
    if (paymentMethod === "split") {
      if (Math.abs(splitAllocated - total) > 0.01) {
        setError(`La somme des lignes (${formatPrice(splitAllocated)}) ne correspond pas au total (${formatPrice(total)}).`);
        return;
      }
    }
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const data = await createPosPayment({
        paymentMethod,
        splitLines: paymentMethod === "split" ? buildSplitPayload() : undefined,
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
      setLastOrder(data.order);
      const methodLabel = PAYMENT_METHODS.find((m) => m.value === paymentMethod)?.label || paymentMethod;
      setMessage(`Encaissement ${methodLabel} validé — ${data.order.orderNumber} · ${formatPrice(data.order.totalTTC || data.order.total)}.`);
      resetCart();
      await loadCatalog();
    } catch (err: any) {
      setError(err.message || "Impossible de créer le paiement POS.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleQuickSale(event: FormEvent) {
    event.preventDefault();
    const amount = Number(quickAmount.replace(",", "."));
    if (isNaN(amount) || amount < 0) {
      setError("Saisissez un montant de vente rapide valide.");
      return;
    }
    if (paymentMethod === "split") {
      // Pour la vente rapide en mode split, on utilise le montant saisi comme base
      const splitTotal = splitLines.reduce((sum, l) => sum + numericValue(l.amount), 0);
      if (Math.abs(splitTotal - amount) > 0.01) {
        setError(`La somme des lignes (${formatPrice(splitTotal)}) ne correspond pas au montant (${formatPrice(amount)}).`);
        return;
      }
    }
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const data = await createPosQuickSale({
        paymentMethod,
        splitLines: paymentMethod === "split" ? buildSplitPayload() : undefined,
        customerId: selectedCustomerId,
        amount,
        description: quickDescription || "Vente comptoir",
        orderDiscountType: numericValue(orderDiscountValue) > 0 ? orderDiscountType : null,
        orderDiscountValue: numericValue(orderDiscountValue) > 0 ? numericValue(orderDiscountValue) : null,
        notes: notes || null,
      });
      setLastOrder(data.order);
      const methodLabel = PAYMENT_METHODS.find((m) => m.value === paymentMethod)?.label || paymentMethod;
      setMessage(`Vente rapide ${methodLabel} validée — ${data.order.orderNumber} · ${formatPrice(data.order.totalTTC || data.order.total)}.`);
      setQuickAmount("");
      setOrderDiscountType("fixed");
      setOrderDiscountValue("");
    } catch (err: any) {
      setError(err.message || "Impossible de créer la vente rapide.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeMethod = PAYMENT_METHODS.find((m) => m.value === paymentMethod);

  return (
    <div className="space-y-4 overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">Administration</p>
          <h1 className="mt-1 flex items-center gap-2 text-xl font-black tracking-tight text-gray-950 sm:text-2xl">
            <Store className="h-6 w-6 text-primary" /> Caisse POS
          </h1>
          <p className="mt-1 hidden sm:block max-w-2xl text-sm text-gray-600">
            Encaissez les ventes physiques Barber Paradise — carte Indy, Mollie, espèces, virement ou paiement divisé.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/caisse/historique" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:border-primary/40 hover:text-primary min-h-[44px]">
            <History size={16} /> Historique
          </Link>
          <Link href="/admin/caisse/stats" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:border-primary/40 hover:text-primary min-h-[44px]">
            <Banknote size={16} /> Statistiques
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
        </div>
      )}
      {message && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {message}
            {lastOrder && (
              <Link href={`/admin/commandes/${lastOrder.id}`} className="ml-2 font-bold underline underline-offset-2 hover:text-emerald-900">
                Voir la commande →
              </Link>
            )}
          </span>
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr] min-w-0">
        {/* ── Catalogue ── */}
        <div className="space-y-4 min-w-0">
          <div className="rounded-2xl border border-gray-100 bg-white p-3 sm:p-4 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[1fr_220px_180px]">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Recherche produit</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom, marque, SKU…" className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Catégorie</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary">
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
              <article key={product.id} className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm min-w-0">
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

        {/* ── Panier + Paiement ── */}
        <aside className="space-y-4 min-w-0">
          <form onSubmit={handleCheckout} className="rounded-2xl border border-gray-100 bg-white p-3 sm:p-4 shadow-sm min-w-0">
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
                      <span className="mt-1 text-sm font-black text-gray-950">{formatPrice(line.price)}</span>
                    </div>
                    <button type="button" onClick={() => updateQuantity(line.key, 0)} className="text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <div className="flex items-center justify-between rounded-lg border border-gray-200 px-2 py-1 min-h-[44px] min-w-[110px]">
                      <button type="button" onClick={() => updateQuantity(line.key, line.quantity - 1)} className="p-1"><Minus size={14} /></button>
                      <span className="text-sm font-bold px-2">{line.quantity}</span>
                      <button type="button" onClick={() => updateQuantity(line.key, line.quantity + 1)} className="p-1"><Plus size={14} /></button>
                    </div>
                    <div className="flex flex-1 min-w-[140px] gap-2">
                      <select value={line.lineDiscountType} onChange={(e) => updateLineDiscount(line.key, e.target.value as DiscountType, line.lineDiscountValue)} className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-sm outline-none focus:border-primary min-h-[44px]">
                        <option value="fixed">€</option>
                        <option value="percent">%</option>
                      </select>
                      <input type="number" min="0" step="0.01" value={line.lineDiscountValue} onChange={(e) => updateLineDiscount(line.key, line.lineDiscountType, e.target.value)} onFocus={(e) => e.currentTarget.select()} className="flex-1 min-w-0 rounded-lg border border-gray-200 px-2 py-1 text-sm outline-none focus:border-primary min-h-[44px]" placeholder="Remise" />
                    </div>
                  </div>
                  {lineDiscountAmount(line) > 0 ? <p className="mt-2 text-right text-xs font-semibold text-emerald-700">Remise ligne : - {formatPrice(lineDiscountAmount(line))}</p> : null}
                </div>
              ))}
            </div>

            {/* Client + remise + notes */}
            <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
              <label className="block text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Client facultatif</label>
              <div className="relative">
                <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={customerSearch}
                  onChange={(e) => { setCustomerSearch(e.target.value); setCustomerPickerOpen(true); }}
                  onFocus={() => setCustomerPickerOpen(true)}
                  placeholder="Rechercher un client"
                  className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary"
                />
              </div>
              {showCustomerResults ? (
                <div className="max-h-56 overflow-auto rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
                  {customerLoading ? (
                    <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Recherche…</div>
                  ) : customers.length ? (
                    customers.map((customer) => (
                      <button key={customer.id} type="button"
                        onClick={() => { setSelectedCustomerId(customer.id); setCustomerSearch(customerName(customer)); setCustomerPickerOpen(false); }}
                        className={`flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition ${selectedCustomerId === customer.id ? "bg-primary/10 text-gray-950" : "hover:bg-gray-50"}`}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-black uppercase text-gray-600">{customerName(customer).charAt(0)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-gray-950">{customerName(customer)}</span>
                          <span className="block truncate text-xs text-gray-500">{customer.email}{customer.phone ? ` · ${customer.phone}` : ""}</span>
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-2 text-sm text-gray-500">Aucun client trouvé pour « {trimmedCustomerSearch} ».</p>
                  )}
                </div>
              ) : null}
              <select
                value={selectedCustomerId || ""}
                onChange={(e) => {
                  const nextId = e.target.value || null;
                  setSelectedCustomerId(nextId);
                  const nextCustomer = customers.find((c) => c.id === nextId);
                  if (nextCustomer) setCustomerSearch(customerName(nextCustomer));
                }}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary"
              >
                <option value="">Client comptoir</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customerName(customer)} · {customer.email}</option>)}
              </select>
              {selectedCustomer && (
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  <span>Vente rattachée à <strong>{customerName(selectedCustomer)}</strong>.</span>
                  <button type="button" onClick={() => { setSelectedCustomerId(null); setCustomerSearch(""); setCustomerPickerOpen(false); }} className="font-bold text-emerald-900 underline-offset-2 hover:underline">Retirer</button>
                </div>
              )}
              <div className="flex gap-2">
                <select value={orderDiscountType} onChange={(e) => updateOrderDiscount(e.target.value as DiscountType, orderDiscountValue)} className="w-20 shrink-0 rounded-xl border border-gray-200 px-2 py-2.5 text-sm outline-none focus:border-primary min-h-[44px]">
                  <option value="fixed">€ fixe</option>
                  <option value="percent">%</option>
                </select>
                <input type="number" min="0" step="0.01" value={orderDiscountValue} onChange={(e) => updateOrderDiscount(orderDiscountType, e.target.value)} className="flex-1 min-w-0 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary min-h-[44px]" placeholder="Remise commande" />
              </div>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary" placeholder="Notes internes de vente" />
            </div>

            {/* Modes de paiement */}
            <div className="mt-4 space-y-3 rounded-2xl border border-gray-100 bg-gray-50 p-3">
              <label className="block text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Moyen de paiement</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setPaymentMethod(m.value)}
                    className={`rounded-xl border px-3 py-3 text-sm font-black min-h-[44px] flex items-center justify-center gap-1.5 ${paymentMethod === m.value ? m.activeColor : m.color}`}
                  >
                    {m.value === "split" && <SplitSquareHorizontal size={14} />}
                    {m.value === "cash" && <Banknote size={14} />}
                    {(m.value === "indy" || m.value === "mollie_manual") && <CreditCard size={14} />}
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Espèces : monnaie à rendre */}
              {paymentMethod === "cash" && (
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">Montant reçu</label>
                    <input value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} inputMode="decimal" className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500" placeholder={formatPrice(total)} />
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2.5">
                    <p className="text-xs font-semibold text-gray-500">Monnaie à rendre</p>
                    <p className="mt-1 text-lg font-black text-emerald-700">{formatPrice(changeDue)}</p>
                  </div>
                </div>
              )}

              {/* DIVISER : répartition par mode */}
              {paymentMethod === "split" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
                    <span>Répartition du paiement</span>
                    <span className={splitRemaining === 0 ? "text-emerald-600 font-bold" : splitRemaining < 0 ? "text-red-600 font-bold" : "text-amber-600 font-bold"}>
                      {splitRemaining === 0 ? "✓ Équilibré" : splitRemaining > 0 ? `Reste : ${formatPrice(splitRemaining)}` : `Dépassement : ${formatPrice(-splitRemaining)}`}
                    </span>
                  </div>
                  {splitLines.map((line, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select
                        value={line.method}
                        onChange={(e) => updateSplitLine(idx, "method", e.target.value)}
                        className="w-36 shrink-0 rounded-xl border border-gray-200 bg-white px-2 py-2.5 text-sm outline-none focus:border-violet-500 min-h-[44px]"
                      >
                        {SPLIT_METHODS.map((sm) => <option key={sm.value} value={sm.value}>{sm.label}</option>)}
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.amount}
                        onChange={(e) => updateSplitLine(idx, "amount", e.target.value)}
                        onFocus={(e) => e.currentTarget.select()}
                        className="flex-1 min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500 min-h-[44px]"
                        placeholder="Montant (€)"
                      />
                      {splitLines.length > 2 && (
                        <button type="button" onClick={() => removeSplitLine(idx)} className="text-gray-400 hover:text-red-500 shrink-0"><Trash2 size={16} /></button>
                      )}
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <button type="button" onClick={addSplitLine} className="flex-1 rounded-xl border border-dashed border-gray-300 px-3 py-2 text-xs font-bold text-gray-500 hover:border-violet-400 hover:text-violet-600 min-h-[40px]">
                      + Ajouter une ligne
                    </button>
                    {splitRemaining > 0 && (
                      <button type="button" onClick={autoFillLastSplitLine} className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100 min-h-[40px]">
                        Compléter ({formatPrice(splitRemaining)})
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Récapitulatif */}
            <div className="mt-4 rounded-2xl bg-gray-950 p-3 sm:p-4 text-white min-w-0">
              <div className="space-y-1.5 text-sm text-gray-300">
                <div className="flex items-center justify-between gap-2"><span className="shrink-0">Sous-total</span><span className="tabular-nums">{formatPrice(subtotal)}</span></div>
                {lineDiscount > 0 ? <div className="flex items-center justify-between gap-2"><span className="shrink-0">Remises articles</span><span className="tabular-nums">- {formatPrice(lineDiscount)}</span></div> : null}
                {orderDiscount > 0 ? <div className="flex items-center justify-between gap-2"><span className="shrink-0">Remise commande</span><span className="tabular-nums">- {formatPrice(orderDiscount)}</span></div> : null}
                {discount <= 0 ? <div className="flex items-center justify-between gap-2"><span className="shrink-0">Remises</span><span className="tabular-nums">- {formatPrice(0)}</span></div> : null}
                <div className="flex items-center justify-between gap-2"><span className="shrink-0">TVA estimée</span><span className="tabular-nums">{formatPrice(vat)}</span></div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 text-xl font-black"><span>Total</span><span className="tabular-nums">{formatPrice(total)}</span></div>
            </div>

            <button
              type="submit"
              disabled={submitting || !cart.length || (paymentMethod === "split" && Math.abs(splitAllocated - total) > 0.01)}
              className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-black uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-50 min-h-[52px] ${
                paymentMethod === "cash" ? "bg-emerald-600 hover:bg-emerald-700" :
                paymentMethod === "virement" ? "bg-amber-600 hover:bg-amber-700" :
                paymentMethod === "split" ? "bg-violet-600 hover:bg-violet-700" :
                paymentMethod === "mollie_manual" ? "bg-blue-600 hover:bg-blue-700" :
                "bg-primary hover:bg-primary/90"
              }`}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : paymentMethod === "cash" ? <Banknote size={16} /> : paymentMethod === "split" ? <SplitSquareHorizontal size={16} /> : <CreditCard size={16} />}
              <span>
                {paymentMethod === "cash" ? "Valider l'encaissement espèces" :
                 paymentMethod === "virement" ? "Valider le virement" :
                 paymentMethod === "split" ? "Valider le paiement divisé" :
                 paymentMethod === "mollie_manual" ? "Valider · Mollie" :
                 "Valider · Indy"}
              </span>
            </button>
          </form>

          {/* Vente rapide */}
          <form onSubmit={handleQuickSale} className="rounded-2xl border border-gray-100 bg-white p-3 sm:p-4 shadow-sm min-w-0">
            <h2 className="text-base font-black text-gray-950">Vente rapide</h2>
            <p className="mt-1 text-xs text-gray-500">Pour une prestation ou un article non catalogué.</p>
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <input value={quickAmount} onChange={(e) => setQuickAmount(e.target.value)} inputMode="decimal" className="w-full sm:w-32 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary min-h-[44px]" placeholder="Montant (€)" />
              <input value={quickDescription} onChange={(e) => setQuickDescription(e.target.value)} className="flex-1 min-w-0 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary min-h-[44px]" placeholder="Libellé" />
            </div>
            <p className="mt-2 text-xs text-gray-500">Mode actif : <strong>{activeMethod?.label || paymentMethod}</strong></p>
            <button type="submit" disabled={submitting} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-800 hover:border-primary/40 hover:text-primary disabled:opacity-40">
              <Banknote size={16} /> Valider la vente rapide
            </button>
          </form>
        </aside>
      </section>
    </div>
  );
}
