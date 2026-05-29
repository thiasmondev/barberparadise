"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Download,
  Loader2,
  Mail,
  MapPin,
  Package,
  Phone,
  StickyNote,
  Truck,
  User,
  X,
} from "lucide-react";
import {
  getAdminOrder,
  getAdminToken,
  getLogisticsCarrierQuotes,
  getLogisticsLabelUrl,
  getLogisticsOrder,
  purchaseLogisticsLabel,
  updateOrderStatus,
  type LogisticsCarrierQuote,
  type LogisticsPreparationDetail,
  type ShipmentRecord,
} from "@/lib/admin-api";
import type { Order, Packaging, ShippingAddress } from "@/types";

const PAYMENT_BADGES: Record<string, { label: string; className: string }> = {
  paid: { label: "Payée", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  processing: { label: "Payée", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  shipped: { label: "Payée", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  delivered: { label: "Payée", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  pending_payment: { label: "En attente", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  pending: { label: "En attente", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  cancelled: { label: "Remboursée", className: "bg-rose-50 text-rose-700 ring-rose-200" },
};

function formatPrice(value: number, currency = "EUR") {
  return value.toLocaleString("fr-FR", { style: "currency", currency });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function customerName(order: Order) {
  const firstName = order.customer?.firstName || order.shippingAddress?.firstName || "";
  const lastName = order.customer?.lastName || order.shippingAddress?.lastName || "";
  return `${firstName} ${lastName}`.trim() || "Client invité";
}

function paymentBadge(order: Order) {
  return PAYMENT_BADGES[order.status] || PAYMENT_BADGES.pending;
}

function fulfillmentBadge(order: Order) {
  const treated = ["processing", "shipped", "delivered"].includes(order.status);
  return treated
    ? { label: "Traité", className: "bg-sky-50 text-sky-700 ring-sky-200" }
    : { label: "Non traité", className: "bg-gray-100 text-gray-700 ring-gray-200" };
}

function carrierLabel(carrier?: string | null) {
  if (carrier === "mondial_relay") return "Mondial Relay";
  if (carrier === "colissimo_international") return "Colissimo International";
  if (carrier === "colissimo") return "Colissimo";
  return carrier || "Non défini";
}

function renderAddress(address?: ShippingAddress | null) {
  if (!address) return <p className="text-sm text-gray-500">Adresse non renseignée.</p>;
  return (
    <div className="space-y-1 text-sm text-gray-700">
      <p className="font-medium text-gray-950">{address.firstName} {address.lastName}</p>
      <p>{address.address}</p>
      {address.extension && <p>{address.extension}</p>}
      <p>{address.postalCode} {address.city}</p>
      <p>{address.country}</p>
      {address.phone && <p className="pt-1 text-gray-500">{address.phone}</p>}
    </div>
  );
}

function renderBillingAddress(order: Order) {
  const billing = order.billingAddress as Partial<ShippingAddress> | null | undefined;
  if (!billing || typeof billing !== "object") return renderAddress(order.shippingAddress);
  const address: ShippingAddress = {
    id: "billing",
    orderId: order.id,
    firstName: billing.firstName || order.shippingAddress?.firstName || "",
    lastName: billing.lastName || order.shippingAddress?.lastName || "",
    address: billing.address || order.shippingAddress?.address || "",
    city: billing.city || order.shippingAddress?.city || "",
    postalCode: billing.postalCode || order.shippingAddress?.postalCode || "",
    country: billing.country || order.shippingAddress?.country || "France",
    extension: billing.extension || null,
    phone: billing.phone || null,
  };
  return renderAddress(address);
}

export default function OrderDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [logistics, setLogistics] = useState<LogisticsPreparationDetail | null>(null);
  const [quotes, setQuotes] = useState<LogisticsCarrierQuote[]>([]);
  const [shipment, setShipment] = useState<ShipmentRecord | null>(null);
  const [selectedPackagingId, setSelectedPackagingId] = useState<number | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [labelUrl, setLabelUrl] = useState("");
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState("");

  const loadOrder = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getAdminOrder(id);
      setOrder(data);
      setShipment((data.shipment as ShipmentRecord | null) || null);
      setNotes(data.notes || "");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrder().catch(console.error);
  }, [id]);

  const totals = useMemo(() => {
    const taxes = order?.vatAmount ?? Math.max(0, (order?.total || 0) - (order?.totalHT || order?.subtotal || 0));
    return { taxes };
  }, [order]);

  const openLabelDrawer = async () => {
    if (!order) return;
    setDrawerOpen(true);
    setDrawerLoading(true);
    setDrawerError("");
    try {
      const detail = await getLogisticsOrder(order.id);
      setLogistics(detail);
      setShipment(detail.shipment || shipment);
      const recommendedId = detail.recommendation.recommendedBox?.id || detail.packagings[0]?.id || null;
      setSelectedPackagingId(recommendedId);
    } catch (err: any) {
      setDrawerError(err.message || "Impossible de charger la préparation logistique.");
    } finally {
      setDrawerLoading(false);
    }
  };

  const calculateQuotes = async () => {
    if (!order) return;
    setDrawerLoading(true);
    setDrawerError("");
    try {
      const result = await getLogisticsCarrierQuotes(order.id, selectedPackagingId);
      setQuotes(result.quotes);
      setSelectedQuoteId(result.quotes.find((quote) => quote.purchasable)?.id || result.quotes[0]?.id || "");
    } catch (err: any) {
      setDrawerError(err.message || "Impossible de calculer les devis transporteur.");
    } finally {
      setDrawerLoading(false);
    }
  };

  const purchaseLabel = async () => {
    if (!order || !selectedQuoteId) return;
    const quote = quotes.find((item) => item.id === selectedQuoteId);
    if (!quote) return;
    setDrawerLoading(true);
    setDrawerError("");
    try {
      const result = await purchaseLogisticsLabel(order.id, {
        carrier: quote.carrier,
        offerId: quote.id,
        insuranceValueCents: quote.insuranceValueCents,
        packagingId: selectedPackagingId,
      });
      setShipment(result.shipment);
      setLabelUrl(result.label?.downloadUrl || getLogisticsLabelUrl(order.id));
      await loadOrder();
    } catch (err: any) {
      setDrawerError(err.message || "Impossible d’acheter l’étiquette.");
    } finally {
      setDrawerLoading(false);
    }
  };

  const downloadLabel = async () => {
    if (!order) return;
    const token = getAdminToken();
    const response = await fetch(labelUrl || getLogisticsLabelUrl(order.id), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error("Téléchargement impossible");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `etiquette-${order.orderNumber}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const markAsProcessed = async () => {
    if (!order) return;
    setUpdating(true);
    try {
      const updated = await updateOrderStatus(order.id, "processing");
      setOrder(updated);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-7xl space-y-4">
          <div className="h-8 w-64 animate-pulse rounded bg-gray-200" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="h-96 animate-pulse rounded-2xl bg-white" />
            <div className="h-96 animate-pulse rounded-2xl bg-white" />
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 text-center">
        <p className="text-gray-500">Commande non trouvée</p>
        <Link href="/admin/commandes" className="mt-2 inline-block text-sm font-medium text-gray-950 underline">Retour aux commandes</Link>
      </div>
    );
  }

  const pay = paymentBadge(order);
  const fulfillment = fulfillmentBadge(order);
  const selectedQuote = quotes.find((quote) => quote.id === selectedQuoteId);

  return (
    <div className="min-h-screen bg-gray-50 p-4 text-gray-900 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Link href="/admin/commandes" className="rounded-xl border border-gray-200 bg-white p-2 text-gray-500 shadow-sm hover:text-gray-950">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-gray-950 sm:text-3xl">{order.orderNumber}</h1>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${pay.className}`}>{pay.label}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${fulfillment.className}`}>{fulfillment.label}</span>
              </div>
              <p className="mt-1 text-sm text-gray-500">Créée le {formatDate(order.createdAt)}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <main className="space-y-6">
            <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-5 py-4">
                <h2 className="font-semibold text-gray-950">Articles</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {order.items.map((item) => (
                  <div key={item.id} className="flex gap-4 px-5 py-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                      {item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : <Package className="h-5 w-5 text-gray-300" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-950">{item.name}</p>
                      <p className="mt-1 text-sm text-gray-500">{formatPrice(item.price, order.currency)} × {item.quantity}</p>
                    </div>
                    <div className="font-semibold text-gray-950">{formatPrice(item.price * item.quantity, order.currency)}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2 border-t border-gray-200 px-5 py-4 sm:flex-row">
                <button
                  onClick={markAsProcessed}
                  disabled={updating || ["processing", "shipped", "delivered"].includes(order.status)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Marquer comme traité
                </button>
                <button
                  onClick={openLabelDrawer}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
                >
                  <Truck className="h-4 w-4" /> Créer une étiquette d'expédition
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 font-semibold text-gray-950">Récapitulatif financier</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Sous-total</span><span>{formatPrice(order.subtotal, order.currency)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Expédition ({carrierLabel(order.shipment?.carrier)} · {order.shipment?.totalWeightG || "—"} g)</span><span>{order.shipping === 0 ? "Gratuite" : formatPrice(order.shipping, order.currency)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Taxes</span><span>{formatPrice(totals.taxes, order.currency)}</span></div>
                <div className="flex justify-between border-t border-gray-200 pt-3 text-base font-semibold text-gray-950"><span>Total</span><span>{formatPrice(order.total, order.currency)}</span></div>
                <div className="flex justify-between text-sm font-medium text-emerald-700"><span>Payé</span><span>{paymentBadge(order).label === "Payée" ? formatPrice(order.total, order.currency) : formatPrice(0, order.currency)}</span></div>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 font-semibold text-gray-950">Calendrier</h2>
              <div className="space-y-4">
                {[
                  { label: "Commande créée", date: order.createdAt, icon: CalendarClock },
                  { label: paymentBadge(order).label === "Payée" ? "Paiement confirmé" : "Paiement en attente", date: order.updatedAt, icon: CheckCircle2 },
                  { label: "Email de confirmation envoyé", date: order.createdAt, icon: Mail },
                  ...(order.shipment?.labelGeneratedAt ? [{ label: "Étiquette d’expédition générée", date: order.shipment.labelGeneratedAt, icon: Truck }] : []),
                  ...(order.shipment?.shippedAt ? [{ label: "Commande expédiée", date: order.shipment.shippedAt, icon: Truck }] : []),
                ].map((event, index) => {
                  const Icon = event.icon;
                  return (
                    <div key={`${event.label}-${index}`} className="flex gap-3">
                      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600"><Icon className="h-4 w-4" /></div>
                      <div><p className="text-sm font-medium text-gray-950">{event.label}</p><p className="text-xs text-gray-500">{formatDate(event.date)}</p></div>
                    </div>
                  );
                })}
              </div>
            </section>
          </main>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2"><StickyNote className="h-4 w-4 text-gray-500" /><h2 className="font-semibold text-gray-950">Notes</h2></div>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={5} placeholder="Ajouter une note interne..." className="w-full rounded-xl border border-gray-300 p-3 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10" />
              <p className="mt-2 text-xs text-gray-500">Note interne affichée dans l’admin.</p>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2"><User className="h-4 w-4 text-gray-500" /><h2 className="font-semibold text-gray-950">Client</h2></div>
              <Link href={order.customerId ? `/admin/clients/${order.customerId}` : "#"} className="font-medium text-gray-950 underline-offset-4 hover:underline">{customerName(order)}</Link>
              <p className="mt-1 text-sm text-gray-500">{order.customer?._count?.orders || 1} commande{(order.customer?._count?.orders || 1) > 1 ? "s" : ""}</p>
              <div className="mt-4 space-y-2 text-sm text-gray-600">
                <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> {order.customer?.email || order.customerEmail || order.email}</p>
                <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {order.customer?.phone || order.shippingAddress?.phone || "Téléphone non renseigné"}</p>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2"><MapPin className="h-4 w-4 text-gray-500" /><h2 className="font-semibold text-gray-950">Adresse de livraison</h2></div>
              {order.shipment?.carrier === "mondial_relay" && (
                <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                  <span className="rounded bg-red-600 px-1.5 py-0.5 text-white">MR</span> Mondial Relay {order.shipment.relayPointId ? `· ${order.shipment.relayPointId}` : ""}
                </div>
              )}
              {renderAddress(order.shippingAddress)}
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 font-semibold text-gray-950">Adresse de facturation</h2>
              {renderBillingAddress(order)}
            </section>
          </aside>
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setDrawerOpen(false)}>
          <aside className="ml-auto flex h-full w-full max-w-xl flex-col bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div><h2 className="text-lg font-semibold text-gray-950">Créer une étiquette d'expédition</h2><p className="text-sm text-gray-500">{order.orderNumber}</p></div>
              <button onClick={() => setDrawerOpen(false)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              {drawerError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{drawerError}</div>}
              <div>
                <label className="text-sm font-medium text-gray-700">Transporteur</label>
                <select value={selectedQuoteId} onChange={(event) => setSelectedQuoteId(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-900">
                  <option value="">Calculer un devis pour choisir</option>
                  {quotes.map((quote) => <option key={quote.id} value={quote.id}>{quote.carrierLabel} · {quote.serviceLabel} · {formatPrice(quote.amountCents / 100, quote.currency)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Poids colis</label>
                <input readOnly value={`${logistics?.recommendation.packageTotalWeightG || logistics?.recommendation.totalWeightG || shipment?.totalWeightG || "—"} g`} className="mt-2 w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm text-gray-700" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Emballage</label>
                <select value={selectedPackagingId || ""} onChange={(event) => setSelectedPackagingId(event.target.value ? Number(event.target.value) : null)} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-900">
                  <option value="">Aucun emballage</option>
                  {(logistics?.packagings || []).map((packaging: Packaging) => (
                    <option key={packaging.id} value={packaging.id}>{packaging.name} · {packaging.lengthCm}×{packaging.widthCm}×{packaging.heightCm} cm · max {packaging.maxWeightG} g</option>
                  ))}
                </select>
              </div>
              <button onClick={calculateQuotes} disabled={drawerLoading} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50">
                {drawerLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Calculer devis
              </button>
              {selectedQuote && (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-semibold text-gray-950">Prix transporteur</p>
                  <p className="mt-2 text-2xl font-semibold text-gray-950">{formatPrice(selectedQuote.amountCents / 100, selectedQuote.currency)}</p>
                  <p className="mt-1 text-sm text-gray-500">{selectedQuote.carrierLabel} · {selectedQuote.serviceLabel} · {selectedQuote.estimatedDeliveryDays}</p>
                </div>
              )}
              <button onClick={purchaseLabel} disabled={drawerLoading || !selectedQuoteId} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50">
                Acheter étiquette
              </button>
              {shipment?.trackingNumber && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  <p className="font-semibold">Étiquette générée</p>
                  <p className="mt-1">Numéro de suivi : {shipment.trackingNumber}</p>
                  <button onClick={downloadLabel} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
                    <Download className="h-4 w-4" /> Télécharger PDF étiquette
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
