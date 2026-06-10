"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Package,
  Phone,
  Scale,
  ShieldCheck,
  StickyNote,
  Truck,
  User,
  X,
} from "lucide-react";
import {
  getAdminOrder,
  getAdminToken,
  cancelShipmentLabel,
  getLogisticsCarrierQuotes,
  getLogisticsLabelUrl,
  getLogisticsOrder,
  getShipmentLabelPdfUrl,
  purchaseLogisticsLabel,
  updateOrderStatus,
  type LogisticsCarrierQuote,
  type LogisticsPreparationDetail,
  type LogisticsPreparationItem,
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

function centsToEuroInput(value?: number | null) {
  if (!value || value <= 0) return "0";
  return (value / 100).toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function parseEuroToCents(value?: string) {
  const normalized = (value || "").replace(",", ".").trim();
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed * 100);
}

function getQuoteTaxDetails(quote?: LogisticsCarrierQuote | null, fallbackCents?: number | null, fallbackCurrency = "EUR") {
  const amountCents = quote?.amountCents ?? fallbackCents ?? 0;
  const currency = quote?.currency || fallbackCurrency;
  const label = quote?.priceTaxLabel || "TTC";
  const taxAmountCents = label === "HT" ? quote?.taxAmountCents ?? Math.round(amountCents * 0.2) : 0;
  const totalWithTaxCents = label === "HT" ? quote?.totalWithTaxCents ?? amountCents + taxAmountCents : amountCents;
  return { amountCents, currency, label, taxAmountCents, totalWithTaxCents };
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

function gramsToKgInput(value?: number | null) {
  if (!value || value <= 0) return "";
  return (value / 1000).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function parseKgToGrams(value?: string) {
  const normalized = (value || "").replace(",", ".").trim();
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed * 1000);
}

function formatWeight(value?: number | null) {
  if (!value || value <= 0) return "—";
  if (value >= 1000) return `${(value / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 3 })} kg`;
  return `${value.toLocaleString("fr-FR")} g`;
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
  const [labelStep, setLabelStep] = useState<"form" | "confirmation">("form");
  const [logistics, setLogistics] = useState<LogisticsPreparationDetail | null>(null);
  const [quotes, setQuotes] = useState<LogisticsCarrierQuote[]>([]);
  const [shipment, setShipment] = useState<ShipmentRecord | null>(null);
  const [selectedPackagingId, setSelectedPackagingId] = useState<number | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [labelUrl, setLabelUrl] = useState("");
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState("");
  const [itemWeightsKg, setItemWeightsKg] = useState<Record<string, string>>({});
  const [saveProductWeights, setSaveProductWeights] = useState<Record<string, boolean>>({});
  const [totalWeightOverrideKg, setTotalWeightOverrideKg] = useState("");
  const [shipDate, setShipDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sendEmailToCustomer, setSendEmailToCustomer] = useState(true);
  const [labelPrintFormat, setLabelPrintFormat] = useState("100x150");
  const [packingSlipFormat, setPackingSlipFormat] = useState("a4");
  const [includePackingSlip, setIncludePackingSlip] = useState(true);
  const [carrierInsuranceValues, setCarrierInsuranceValues] = useState<Record<string, string>>({});
  const [carrierSignatureRequired, setCarrierSignatureRequired] = useState<Record<string, boolean>>({});
  const [quoteRefreshingByCarrier, setQuoteRefreshingByCarrier] = useState<Record<string, boolean>>({});
  const [quoteErrorsByCarrier, setQuoteErrorsByCarrier] = useState<Record<string, string>>({});

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

  const initializeWeights = (items: LogisticsPreparationItem[]) => {
    const nextWeights: Record<string, string> = {};
    const nextSaveFlags: Record<string, boolean> = {};
    items.forEach((item) => {
      nextWeights[item.id] = gramsToKgInput(item.weightG);
      nextSaveFlags[item.id] = false;
    });
    setItemWeightsKg(nextWeights);
    setSaveProductWeights(nextSaveFlags);
  };

  const openLabelDrawer = async () => {
    if (!order) return;
    setDrawerOpen(true);
    setLabelStep("form");
    setDrawerLoading(true);
    setDrawerError("");
    setQuotes([]);
    setSelectedQuoteId("");
    setTotalWeightOverrideKg("");
    try {
      const detail = await getLogisticsOrder(order.id);
      setLogistics(detail);
      setShipment(detail.shipment || shipment);
      initializeWeights(detail.items);
      const recommendedId = detail.recommendation.recommendedBox?.id || detail.packagings[0]?.id || null;
      setSelectedPackagingId(recommendedId);
    } catch (err: any) {
      setDrawerError(err.message || "Impossible de charger la préparation logistique.");
    } finally {
      setDrawerLoading(false);
    }
  };

  const selectedPackaging = useMemo(() => {
    return logistics?.packagings.find((packaging) => packaging.id === selectedPackagingId) || null;
  }, [logistics?.packagings, selectedPackagingId]);

  const articleWeightG = useMemo(() => {
    return (logistics?.items || []).reduce((sum, item) => {
      const unitWeightG = parseKgToGrams(itemWeightsKg[item.id]);
      return sum + unitWeightG * item.quantity;
    }, 0);
  }, [logistics?.items, itemWeightsKg]);

  const calculatedPackageWeightG = articleWeightG + (selectedPackaging?.selfWeightG || 0);
  const overrideWeightG = parseKgToGrams(totalWeightOverrideKg);
  const packageWeightG = overrideWeightG || calculatedPackageWeightG;
  const hasZeroWeight = packageWeightG <= 0;
  const selectedQuote = quotes.find((quote) => quote.id === selectedQuoteId);
  const activeShipment = shipment || (order?.shipment as ShipmentRecord | null) || null;
  const hasGeneratedLabel = activeShipment?.labelSource === "carrier_api" && Boolean(activeShipment?.trackingNumber) && activeShipment.labelStatus !== "cancelled";
  const hasCarrierScan = Boolean(activeShipment?.shippedAt) || ["in_transit", "shipped", "delivered", "scanned"].some((status) =>
    String(activeShipment?.lastTrackingStatus || "").toLowerCase().includes(status)
  );
  const canCancelLabel = hasGeneratedLabel && !hasCarrierScan;
  const activeLabelUrl = activeShipment?.id ? getShipmentLabelPdfUrl(activeShipment.id) : labelUrl || getLogisticsLabelUrl(order?.id || "");
  const cheapestQuoteId = quotes.reduce<string>((currentId, quote) => {
    if (!quote.purchasable) return currentId;
    const currentQuote = quotes.find((item) => item.id === currentId);
    if (!currentQuote || quote.amountCents < currentQuote.amountCents) return quote.id;
    return currentId;
  }, "");
  const purchasableQuotes = quotes.filter((quote) => quote.purchasable);
  const selectedQuoteTax = getQuoteTaxDetails(selectedQuote);
  const activeShipmentTax = getQuoteTaxDetails(selectedQuote, activeShipment?.labelPriceCents, activeShipment?.labelCurrency || "EUR");

  const handlePackagingChange = (value: string) => {
    setSelectedPackagingId(value ? Number(value) : null);
    setSelectedQuoteId("");
    setQuoteRefreshingByCarrier({});
    setQuoteErrorsByCarrier({});
  };

  const buildQuoteRequestOptions = () => {
      const currentColissimoQuote = quotes.find((quote) => quote.carrier === "colissimo" || quote.carrier === "colissimo_international");
      const currentMondialRelayQuote = quotes.find((quote) => quote.carrier === "mondial_relay");
      const colissimoInsuranceValueCents = currentColissimoQuote
        ? parseEuroToCents(carrierInsuranceValues[currentColissimoQuote.id] ?? centsToEuroInput(currentColissimoQuote.insuranceValueCents))
        : 0;
      const mondialRelayInsuranceValueCents = currentMondialRelayQuote
        ? parseEuroToCents(carrierInsuranceValues[currentMondialRelayQuote.id] ?? centsToEuroInput(currentMondialRelayQuote.insuranceValueCents))
        : 0;
      return {
        packagingId: selectedPackagingId,
        totalWeightG: packageWeightG > 0 ? packageWeightG : null,
        colissimoInsuranceValueCents,
        colissimoSignatureRequired: currentColissimoQuote ? Boolean(carrierSignatureRequired[currentColissimoQuote.id]) : undefined,
        mondialRelayInsuranceValueCents,
      };
  };

  const mergeQuoteOptions = (nextQuotes: LogisticsCarrierQuote[], preserveCurrentOptions: boolean) => {
    setCarrierInsuranceValues((current) => {
      const next = { ...current };
      nextQuotes.forEach((quote) => {
        if (!preserveCurrentOptions || next[quote.id] === undefined) {
          next[quote.id] = centsToEuroInput(quote.insuranceValueCents);
        }
      });
      return next;
    });
    setCarrierSignatureRequired((current) => {
      const next = { ...current };
      nextQuotes.forEach((quote) => {
        if (!preserveCurrentOptions || next[quote.id] === undefined) {
          next[quote.id] = Boolean(quote.signatureRequired);
        }
      });
      return next;
    });
  };

  const calculateQuotes = async (mode: "manual" | "auto" = "manual") => {
    if (!order) return;
    const carrierKeys = quotes.length > 0 ? quotes.map((quote) => quote.carrier) : ["colissimo", "mondial_relay"];
    if (mode === "manual") {
      setDrawerLoading(true);
      setQuoteErrorsByCarrier({});
    } else {
      setQuoteRefreshingByCarrier(Object.fromEntries(carrierKeys.map((carrier) => [carrier, true])));
      setQuoteErrorsByCarrier({});
    }
    setDrawerError("");
    try {
      const result = await getLogisticsCarrierQuotes(order.id, buildQuoteRequestOptions());
      setQuotes(result.quotes);
      mergeQuoteOptions(result.quotes, mode === "auto");
      setSelectedQuoteId((current) => {
        if (current && result.quotes.some((quote) => quote.id === current)) return current;
        return result.quotes.find((quote) => quote.purchasable)?.id || result.quotes[0]?.id || "";
      });
      if (!result.quotes.length) {
        setDrawerError("Aucun devis transporteur n’a été retourné pour cette commande.");
      }
    } catch (err: any) {
      const message = err.message || "Impossible de calculer les devis transporteur.";
      if (mode === "manual" || quotes.length === 0) {
        setDrawerError(message);
        setQuotes([]);
        setSelectedQuoteId("");
        setCarrierInsuranceValues({});
        setCarrierSignatureRequired({});
      } else {
        setQuoteErrorsByCarrier(Object.fromEntries(carrierKeys.map((carrier) => [carrier, message])));
      }
    } finally {
      if (mode === "manual") setDrawerLoading(false);
      setQuoteRefreshingByCarrier({});
    }
  };

  useEffect(() => {
    if (!drawerOpen || labelStep !== "form" || !order || hasZeroWeight) return;
    const timer = window.setTimeout(() => {
      calculateQuotes(quotes.length > 0 ? "auto" : "manual").catch(console.error);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [
    drawerOpen,
    labelStep,
    order?.id,
    selectedPackagingId,
    packageWeightG,
    JSON.stringify(carrierInsuranceValues),
    JSON.stringify(carrierSignatureRequired),
  ]);


  const purchaseLabel = async () => {
    if (!order || !selectedQuote) return;
    if (hasZeroWeight) {
      setDrawerError("Veuillez renseigner le poids des articles");
      return;
    }
    if (!selectedQuote.purchasable) {
      setDrawerError(selectedQuote.configurationError || "Ce devis transporteur ne peut pas être acheté.");
      return;
    }
    setDrawerLoading(true);
    setDrawerError("");
    try {
      const selectedInsuranceValueCents = parseEuroToCents(carrierInsuranceValues[selectedQuote.id]);
      const result = await purchaseLogisticsLabel(order.id, {
        carrier: selectedQuote.carrier,
        offerId: selectedQuote.id,
        insuranceValueCents: selectedInsuranceValueCents,
        signatureRequired: selectedQuote.carrier !== "mondial_relay" ? Boolean(carrierSignatureRequired[selectedQuote.id]) : false,
        packagingId: selectedPackagingId,
        sendTrackingEmail: sendEmailToCustomer,
      });
      setShipment(result.shipment);
      setLabelUrl(result.label?.downloadUrl || (result.shipment?.id ? getShipmentLabelPdfUrl(result.shipment.id) : getLogisticsLabelUrl(order.id)));
      if (result.order) setOrder(result.order);
      setLabelStep("confirmation");
      await loadOrder();
    } catch (err: any) {
      setDrawerError(err.message || "Impossible d’acheter l’étiquette.");
    } finally {
      setDrawerLoading(false);
    }
  };

  const downloadLabel = async (fileNameSuffix = "etiquette") => {
    if (!order || !activeLabelUrl) return;
    const token = getAdminToken();
    const response = await fetch(activeLabelUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error("Téléchargement impossible");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileNameSuffix}-${order.orderNumber}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const printLabel = () => {
    if (!activeLabelUrl) return;
    window.open(activeLabelUrl, "_blank", "noopener,noreferrer");
  };

  const cancelLabel = async () => {
    if (!activeShipment?.id) return;
    const confirmed = window.confirm("Annuler cette étiquette ? Cette action est possible uniquement si le colis n’a pas encore été scanné par le transporteur.");
    if (!confirmed) return;
    setDrawerLoading(true);
    setDrawerError("");
    try {
      const result = await cancelShipmentLabel(activeShipment.id);
      setShipment(result.shipment);
      setLabelStep("confirmation");
      alert(result.message || "L’étiquette a été annulée. Le remboursement sera crédité sous 48h.");
      await loadOrder();
    } catch (err: any) {
      setDrawerError(err.message || "Impossible d’annuler l’étiquette.");
    } finally {
      setDrawerLoading(false);
    }
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
  const labelBlockerMessage = hasZeroWeight ? "Veuillez renseigner le poids des articles" : "";
  const totalItemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

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
                  ...(order.shipment?.labelGeneratedAt ? [{ label: `Étiquette ${carrierLabel(order.shipment.carrier)} achetée${order.shipment.trackingNumber ? ` — Suivi ${order.shipment.trackingNumber}` : ""}`, date: order.shipment.labelGeneratedAt, icon: Truck }] : []),
                  ...(order.shipment?.labelStatus === "cancelled" ? [{ label: "Étiquette annulée — remboursement sous 48h", date: order.shipment.updatedAt || order.shipment.labelGeneratedAt || order.updatedAt, icon: AlertCircle }] : []),
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-950/45 p-0 sm:p-4" onClick={() => setDrawerOpen(false)}>
          <section className="min-h-screen bg-gray-50 text-gray-900 shadow-2xl sm:mx-auto sm:min-h-0 sm:max-w-7xl sm:rounded-3xl" onClick={(event) => event.stopPropagation()}>
            <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 px-4 py-4 backdrop-blur sm:rounded-t-3xl sm:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <span className={labelStep === "form" ? "text-gray-950" : "text-gray-400"}>1. Formulaire</span>
                    <span>→</span>
                    <span className={labelStep === "confirmation" ? "text-gray-950" : "text-gray-400"}>2. Confirmation</span>
                  </div>
                  <h2 className="mt-1 text-xl font-semibold text-gray-950 sm:text-2xl">{labelStep === "confirmation" ? "1 étiquette achetée" : "Créer une étiquette d’expédition"}</h2>
                  <p className="text-sm text-gray-500">{order.orderNumber} · {totalItemCount} article{totalItemCount > 1 ? "s" : ""}</p>
                </div>
                <button onClick={() => setDrawerOpen(false)} className="self-start rounded-xl p-2 text-gray-500 hover:bg-gray-100 lg:self-auto"><X className="h-5 w-5" /></button>
              </div>
            </div>

            {labelStep === "form" ? (
              <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-5">
                  {drawerError && (
                    <div className="flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                      <p>{drawerError}</p>
                    </div>
                  )}

                  <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center gap-2"><MapPin className="h-5 w-5 text-gray-500" /><h3 className="font-semibold text-gray-950">Adresse de livraison</h3></div>
                    {activeShipment?.carrier === "mondial_relay" ? (
                      <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><span className="mr-2 rounded bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white">MR</span>Point relais {activeShipment.relayPointId ? `· ${activeShipment.relayPointId}` : ""}</div>
                    ) : (
                      <div className="mb-4 inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">Colissimo à domicile</div>
                    )}
                    {renderAddress(order.shippingAddress)}
                  </section>

                  <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="border-b border-gray-200 px-5 py-4">
                      <h3 className="font-semibold text-gray-950">Articles et poids</h3>
                      <p className="mt-1 text-sm text-gray-500">Renseignez le poids unitaire en kilogrammes. Le bouton d’achat reste bloqué si le poids total vaut 0.</p>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {drawerLoading && !logistics ? (
                        <div className="flex items-center gap-2 px-5 py-6 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement de la préparation…</div>
                      ) : (logistics?.items || []).map((item) => (
                        <div key={item.id} className="grid gap-4 px-5 py-4 md:grid-cols-[minmax(0,1fr)_190px] md:items-center">
                          <div className="flex gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">{item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : <Package className="h-5 w-5 text-gray-300" />}</div>
                            <div className="min-w-0"><p className="font-medium text-gray-950">{item.name}</p><p className="mt-1 text-sm text-gray-500">Quantité : {item.quantity}</p>{(item.isFragile || item.isLiquid || item.isAerosol) && <p className="mt-2 text-xs font-medium text-amber-700">Précaution logistique</p>}</div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-600">Poids unitaire (kg)</label>
                            <input type="number" min="0" step="0.001" value={itemWeightsKg[item.id] || ""} onChange={(event) => setItemWeightsKg((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="0,000" className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10" />
                            <label className="flex items-start gap-2 text-xs text-gray-500"><input type="checkbox" checked={saveProductWeights[item.id] || false} onChange={(event) => setSaveProductWeights((current) => ({ ...current, [item.id]: event.target.checked }))} className="mt-0.5 rounded border-gray-300" />Enregistrer le poids dans les détails du produit</label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="grid gap-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:grid-cols-2">
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-3"><label className="text-sm font-semibold text-gray-950">Emballage</label><Link href="/admin/logistique/emballages" className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 hover:text-gray-950">Ajouter un emballage <ExternalLink className="h-3.5 w-3.5" /></Link></div>
                      <select value={selectedPackagingId || ""} onChange={(event) => handlePackagingChange(event.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10">
                        <option value="">Aucun emballage</option>
                        {(logistics?.packagings || []).map((packaging: Packaging) => <option key={packaging.id} value={packaging.id}>{packaging.name} · {packaging.lengthCm}×{packaging.widthCm}×{packaging.heightCm} cm · max {packaging.maxWeightG} g</option>)}
                      </select>
                      {selectedPackaging && <p className="mt-2 text-xs text-gray-500">Poids emballage : {formatWeight(selectedPackaging.selfWeightG)} · Stock : {selectedPackaging.stock}</p>}
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-950">Poids total du colis</label>
                      <div className="mt-2 flex rounded-xl border border-gray-300 bg-white focus-within:border-gray-900 focus-within:ring-2 focus-within:ring-gray-900/10"><span className="flex items-center border-r border-gray-200 px-3 text-gray-500"><Scale className="h-4 w-4" /></span><input type="number" min="0" step="0.001" value={totalWeightOverrideKg} onChange={(event) => setTotalWeightOverrideKg(event.target.value)} placeholder={calculatedPackageWeightG ? gramsToKgInput(calculatedPackageWeightG) : "0,000"} className="w-full rounded-r-xl px-3 py-2.5 text-sm outline-none" /></div>
                      <p className="mt-2 text-xs text-gray-500">Calculé : articles {formatWeight(articleWeightG)} + emballage {formatWeight(selectedPackaging?.selfWeightG)} = {formatWeight(calculatedPackageWeightG)}.</p>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold text-gray-950">Devis transporteurs</h3><p className="mt-1 text-sm text-gray-500">Comparez les services disponibles, leurs options et la base tarifaire HT/TTC avant achat.</p></div><button onClick={() => calculateQuotes()} disabled={drawerLoading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50">{drawerLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Calculer les devis</button></div>
                    <div className="mt-4 grid gap-3">
                      {quotes.length === 0 ? <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">Aucun devis calculé pour le moment.</div> : quotes.map((quote) => {
                        const isSelected = quote.id === selectedQuoteId;
                        const isCheapest = quote.id === cheapestQuoteId;
                        const cardRefreshing = Boolean(quoteRefreshingByCarrier[quote.carrier]);
                        const cardError = quoteErrorsByCarrier[quote.carrier];
                        const hasCarrierError = !quote.purchasable || quote.configurationError || cardError;
                        const quoteTax = getQuoteTaxDetails(quote);
                        const insuranceValue = carrierInsuranceValues[quote.id] ?? centsToEuroInput(quote.insuranceValueCents);
                        return (
                          <div key={quote.id} role="button" tabIndex={0} onClick={() => setSelectedQuoteId(quote.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedQuoteId(quote.id); }} className={`cursor-pointer rounded-2xl border p-4 text-left transition ${cardRefreshing ? "opacity-60" : ""} ${isSelected ? "border-gray-950 bg-gray-50 ring-2 ring-gray-950/10" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-gray-950">{quote.carrierLabel}</p><span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">{quote.serviceLabel}</span>{isCheapest && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Le moins cher</span>}{quote.id === purchasableQuotes[0]?.id && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">Suggéré</span>}</div><div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500"><span>Livraison : {quote.estimatedDeliveryDays}</span><span>Suivi ✓</span><span>Assurance {parseEuroToCents(insuranceValue) > 0 ? "✓" : "—"}</span>{quote.signatureAvailable && <span>Signature {carrierSignatureRequired[quote.id] ? "✓" : "—"}</span>}{quote.carrier !== "mondial_relay" && <span>{quote.contractNumberApplied ? `Contrat Colissimo appliqué${quote.contractNumberSuffix ? ` · ****${quote.contractNumberSuffix}` : ""}` : "Contrat Colissimo non configuré"}</span>}</div>{cardRefreshing && <p className="mt-2 inline-flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-700"><Loader2 className="h-4 w-4 animate-spin" /> Recalcul du devis…</p>}{hasCarrierError && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{cardError || quote.configurationError || "Ce service n’est pas achetable pour cette commande."}</p>}</div><div className="text-left sm:text-right"><p className="text-xl font-semibold text-gray-950">{formatPrice(quote.amountCents / 100, quote.currency)} {quoteTax.label}</p>{quoteTax.label === "HT" ? <p className="text-xs text-gray-500">TVA {formatPrice(quoteTax.taxAmountCents / 100, quote.currency)} · total {formatPrice(quoteTax.totalWithTaxCents / 100, quote.currency)} TTC</p> : <p className="text-xs text-gray-500">Prix transporteur TTC</p>}<p className="mt-1 text-xs text-gray-500">{quote.requiresRelayPoint ? "Point relais requis" : "Livraison domicile"}</p></div></div>
                            <div className="mt-4 grid gap-3 border-t border-gray-200 pt-4 md:grid-cols-2">
                              <label className="text-sm font-medium text-gray-700" onClick={(event) => event.stopPropagation()}>Montant déclaré assurance (€)<input type="number" min="0" step="0.01" value={insuranceValue} onChange={(event) => { const nextValue = event.target.value; setCarrierInsuranceValues((current) => ({ ...current, [quote.id]: nextValue === "" ? "0" : nextValue })); }} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10" placeholder="0,00" /></label>
                              {quote.carrier !== "mondial_relay" ? <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700" onClick={(event) => event.stopPropagation()}><span>Livraison avec signature</span><input type="checkbox" checked={Boolean(carrierSignatureRequired[quote.id])} onChange={(event) => setCarrierSignatureRequired((current) => ({ ...current, [quote.id]: event.target.checked }))} className="h-4 w-4 rounded border-gray-300" /></label> : <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-500">Signature non applicable à Mondial Relay.</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </div>

                <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
                  <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <h3 className="font-semibold text-gray-950">Résumé de l’achat</h3>
                    <div className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3"><span className="text-gray-500">Commande</span><span className="font-medium text-gray-950">{order.orderNumber}</span></div><div className="flex justify-between gap-3"><span className="text-gray-500">Articles</span><span>{totalItemCount}</span></div><div className="flex justify-between gap-3"><span className="text-gray-500">Emballage</span><span className="text-right">{selectedPackaging?.name || "Aucun"}</span></div><div className="flex justify-between gap-3"><span className="text-gray-500">Poids total</span><span className="font-medium text-gray-950">{formatWeight(packageWeightG)}</span></div><div className="flex justify-between gap-3"><span className="text-gray-500">Transporteur</span><span className="text-right">{selectedQuote ? `${selectedQuote.carrierLabel} · ${selectedQuote.serviceLabel}` : "À choisir"}</span></div><div className="border-t border-gray-200 pt-3"><div className="flex justify-between gap-3 text-base font-semibold"><span>Coût étiquette</span><span>{selectedQuote ? `${formatPrice(selectedQuoteTax.amountCents / 100, selectedQuoteTax.currency)} ${selectedQuoteTax.label}` : "—"}</span></div>{selectedQuote && selectedQuoteTax.label === "HT" && <div className="mt-2 space-y-1 text-xs text-gray-500"><div className="flex justify-between"><span>TVA calculée</span><span>{formatPrice(selectedQuoteTax.taxAmountCents / 100, selectedQuoteTax.currency)}</span></div><div className="flex justify-between font-semibold text-gray-700"><span>Total TTC</span><span>{formatPrice(selectedQuoteTax.totalWithTaxCents / 100, selectedQuoteTax.currency)}</span></div></div>}</div></div>
                    <div className="mt-5 space-y-4"><label className="block text-sm font-medium text-gray-700">Date d’expédition<input type="date" value={shipDate} onChange={(event) => setShipDate(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10" /></label><label className="flex items-start gap-2 text-sm text-gray-600"><input type="checkbox" checked={sendEmailToCustomer} onChange={(event) => setSendEmailToCustomer(event.target.checked)} className="mt-1 rounded border-gray-300" />Envoyer un email de suivi au client après l’achat</label>{labelBlockerMessage && <p className="rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-800">{labelBlockerMessage}</p>}<button onClick={purchaseLabel} disabled={drawerLoading || !selectedQuote || hasZeroWeight || !selectedQuote.purchasable} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50">{drawerLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />} Acheter l’étiquette</button></div>
                  </section>
                </aside>
              </div>
            ) : (
              <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-5">
                  <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900 shadow-sm"><div className="flex gap-3"><CheckCircle2 className="mt-1 h-6 w-6 shrink-0" /><div><h3 className="text-lg font-semibold">1 étiquette achetée</h3><p className="mt-1 text-sm">{totalItemCount} article{totalItemCount > 1 ? "s" : ""} · expéditeur Barber Paradise.</p>{activeShipment?.trackingNumber && <p className="mt-2 text-sm font-medium">Numéro de suivi : {activeShipment.trackingNumber}</p>}</div></div></section>
                  <section className="rounded-2xl border border-gray-200 bg-white shadow-sm"><div className="border-b border-gray-200 px-5 py-4"><h3 className="font-semibold text-gray-950">Récapitulatif commande</h3></div><div className="divide-y divide-gray-100 text-sm"><div className="grid gap-2 px-5 py-4 sm:grid-cols-3"><span className="text-gray-500">Commande</span><span className="font-medium text-gray-950 sm:col-span-2">{order.orderNumber}</span></div><div className="grid gap-2 px-5 py-4 sm:grid-cols-3"><span className="text-gray-500">Service</span><span className="sm:col-span-2">{selectedQuote ? `${selectedQuote.carrierLabel} · ${selectedQuote.serviceLabel}` : carrierLabel(activeShipment?.carrier)}</span></div><div className="grid gap-2 px-5 py-4 sm:grid-cols-3"><span className="text-gray-500">Coût</span><span className="font-semibold text-gray-950 sm:col-span-2">{activeShipmentTax.amountCents ? `${formatPrice(activeShipmentTax.amountCents / 100, activeShipmentTax.currency)} ${activeShipmentTax.label}` : "—"}{activeShipmentTax.label === "HT" && activeShipmentTax.amountCents > 0 ? ` · TVA ${formatPrice(activeShipmentTax.taxAmountCents / 100, activeShipmentTax.currency)} · total ${formatPrice(activeShipmentTax.totalWithTaxCents / 100, activeShipmentTax.currency)} TTC` : ""}</span></div></div></section>
                  <section className="rounded-2xl border border-gray-200 bg-white shadow-sm"><div className="border-b border-gray-200 px-5 py-4"><h3 className="font-semibold text-gray-950">Détail du colis</h3></div><div className="divide-y divide-gray-100">{(logistics?.items || []).map((item) => <div key={item.id} className="flex gap-4 px-5 py-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">{item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : <Package className="h-5 w-5 text-gray-300" />}</div><div className="min-w-0 flex-1"><p className="font-medium text-gray-950">{item.name}</p><p className="text-sm text-gray-500">Quantité {item.quantity} · {formatWeight(parseKgToGrams(itemWeightsKg[item.id]) * item.quantity)}</p></div></div>)}</div><div className="grid gap-3 border-t border-gray-200 px-5 py-4 text-sm sm:grid-cols-3"><div><p className="text-gray-500">Emballage</p><p className="font-medium text-gray-950">{selectedPackaging?.name || activeShipment?.packaging?.name || "—"}</p></div><div><p className="text-gray-500">Poids</p><p className="font-medium text-gray-950">{formatWeight(activeShipment?.totalWeightG || packageWeightG)}</p></div><div><p className="text-gray-500">Services</p><p className="font-medium text-gray-950">Suivi ✓ · Assurance {selectedQuote ? (parseEuroToCents(carrierInsuranceValues[selectedQuote.id]) > 0 ? "✓" : "—") : activeShipment?.insuranceValueCents ? "✓" : "—"}{selectedQuote?.carrier !== "mondial_relay" && (selectedQuote || activeShipment?.carrier !== "mondial_relay") ? ` · Signature ${selectedQuote && carrierSignatureRequired[selectedQuote.id] ? "✓" : "—"}` : ""}</p></div></div></section>
                </div>
                <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
                  <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h3 className="font-semibold text-gray-950">Documents</h3><div className="mt-4 space-y-4"><label className="block text-sm font-medium text-gray-700">Format étiquette<select value={labelPrintFormat} onChange={(event) => setLabelPrintFormat(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"><option value="100x150">100×150 mm</option><option value="a4">A4</option></select></label><label className="block text-sm font-medium text-gray-700">Format bordereau<select value={packingSlipFormat} onChange={(event) => setPackingSlipFormat(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"><option value="a4">A4</option><option value="compact">Compact</option></select></label><label className="flex items-start gap-2 text-sm text-gray-600"><input type="checkbox" checked={includePackingSlip} onChange={(event) => setIncludePackingSlip(event.target.checked)} className="mt-1 rounded border-gray-300" />Inclure le bordereau dans le colis</label><button onClick={() => downloadLabel("etiquette")} disabled={!hasGeneratedLabel} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"><Download className="h-4 w-4" /> Télécharger l’étiquette</button><button onClick={printLabel} disabled={!hasGeneratedLabel} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"><ExternalLink className="h-4 w-4" /> Imprimer</button><button onClick={() => downloadLabel("bordereau")} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"><FileText className="h-4 w-4" /> Télécharger le bordereau</button></div></section>
                  <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h3 className="font-semibold text-gray-950">Résumé achat</h3><div className="mt-4 space-y-3 text-sm"><div className="flex justify-between"><span className="text-gray-500">Étiquette</span><span>{activeShipmentTax.amountCents ? `${formatPrice(activeShipmentTax.amountCents / 100, activeShipmentTax.currency)} ${activeShipmentTax.label}` : "—"}</span></div>{activeShipmentTax.label === "HT" && activeShipmentTax.amountCents > 0 && <><div className="flex justify-between"><span className="text-gray-500">TVA</span><span>{formatPrice(activeShipmentTax.taxAmountCents / 100, activeShipmentTax.currency)}</span></div><div className="flex justify-between font-semibold text-gray-950"><span>Total TTC</span><span>{formatPrice(activeShipmentTax.totalWithTaxCents / 100, activeShipmentTax.currency)}</span></div></>}<div className="flex justify-between"><span className="text-gray-500">Email client</span><span>{sendEmailToCustomer ? "Activé" : "Désactivé"}</span></div><div className="flex justify-between"><span className="text-gray-500">Format</span><span>{labelPrintFormat === "100x150" ? "100×150 mm" : "A4"}</span></div></div><div className="mt-5 space-y-2"><button type="button" onClick={cancelLabel} disabled={!canCancelLabel || drawerLoading} className="inline-flex w-full items-center justify-center rounded-xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50">Annuler l’étiquette</button>{!canCancelLabel && hasGeneratedLabel && <p className="text-xs text-gray-500">Annulation indisponible après scan transporteur.</p>}<button onClick={() => setDrawerOpen(false)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800"><ShieldCheck className="h-4 w-4" /> Terminé</button></div></section>
                </aside>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
