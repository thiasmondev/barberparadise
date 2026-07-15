"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Package,
  Pencil,
  Phone,
  RefreshCw,
  RotateCcw,
  Scale,
  Save,
  Send,
  ShieldCheck,
  StickyNote,
  Trash2,
  Truck,
  User,
  X,
  ShoppingCart,
  Plus,
  Minus,
  Search,
} from "lucide-react";
import {
  getAdminOrder,
  getAdminToken,
  cancelShipmentLabel,
  deleteAdminOrder,
  duplicateAdminOrder,
  generateAdminOrderInvoice,
  getCustomerExtraEmails,
  sendAdminOrderInvoice,
  toggleAdminOrderB2B,
  type CustomerExtraEmail,
  getLogisticsCarrierQuotes,
  getLogisticsLabelUrl,
  getLogisticsOrder,
  getShipmentLabelPdfUrl,
  purchaseLogisticsLabel,
  refundAdminOrder,
  resendOrderConfirmation,
  resendOrderTracking,
  updateAdminOrder,
  updateOrderStatus,
  modifyOrderItems,
  createPaymentAdjustment,
  getAdminProducts,
  getProductVariants,
  type LogisticsCarrierQuote,
  type LogisticsPreparationDetail,
  type LogisticsPreparationItem,
  type ShipmentRecord,
} from "@/lib/admin-api";
import type { Order, Packaging, ShippingAddress, Product, ProductVariant } from "@/types";
import { EmailPickerModal, type EmailOption } from "@/components/admin/EmailPickerModal";

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
  if (order.channel === "pos") {
    return { label: "Remise immédiate", className: "bg-violet-50 text-violet-700 ring-violet-200" };
  }
  const treated = ["processing", "shipped", "delivered"].includes(order.status);
  return treated
    ? { label: "Traité", className: "bg-sky-50 text-sky-700 ring-sky-200" }
    : { label: "Non traité", className: "bg-gray-100 text-gray-700 ring-gray-200" };
}

function channelBadge(order: Order) {
  if (order.channel === "pos") return { label: "Caisse POS", className: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200" };
  if (order.isB2B) return { label: "B2B", className: "bg-indigo-50 text-indigo-700 ring-indigo-200" };
  return { label: "Boutique web", className: "bg-gray-100 text-gray-700 ring-gray-200" };
}

function paymentMethodLabel(method?: string | null, provider?: string | null): string {
  const m = (method || "").toLowerCase();
  const p = (provider || "").toLowerCase();
  if (m === "cash" || m === "especes" || m === "espèces") return "Espèces";
  if (m === "manual") return "Encaissement manuel";
  if (m === "paypal" || p === "paypal") return "PayPal";
  if (m === "paybybank") return "Paiement bancaire instantané";
  if (["pay_by_bank", "banktransfer", "bank_transfer", "bank-transfer", "virement"].includes(m)) return "Virement bancaire";
  if (["creditcard", "credit_card", "card", "carte", "ideal", "bancontact"].includes(m)) return "Carte bancaire";
  if (m === "applepay" || m === "apple_pay") return "Apple Pay";
  if (m === "googlepay" || m === "google_pay") return "Google Pay";
  if (!m && !p) return "Paiement non initié";
  return method || provider || "Non renseigné";
}

function carrierLabel(carrier?: string | null) {
  if (carrier === "mondial_relay") return "Mondial Relay";
  if (carrier === "colissimo_international") return "Colissimo International";
  if (carrier === "colissimo") return "Colissimo";
  if (carrier === "livraison_standard") return "Livraison standard";
  if (!carrier || carrier === "non_defini") return "Transporteur à vérifier";
  return carrier;
}

function shipmentSummary(order: Order) {
  const carrier = carrierLabel(order.shipment?.carrier);
  const weight = order.shipment?.totalWeightG ? ` · ${order.shipment.totalWeightG} g` : " · poids à calculer";
  return `Expédition (${carrier}${weight})`;
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

type EditableAddress = Pick<ShippingAddress, "firstName" | "lastName" | "address" | "city" | "postalCode" | "country" | "extension" | "phone">;

type EditOrderForm = {
  notes: string;
  shippingAddress: EditableAddress;
  billingAddress: EditableAddress;
};

const EMPTY_ADDRESS_FORM: EditableAddress = {
  firstName: "",
  lastName: "",
  address: "",
  city: "",
  postalCode: "",
  country: "France",
  extension: "",
  phone: "",
};

const ADDRESS_FIELDS: { key: keyof EditableAddress; label: string; required?: boolean; placeholder?: string }[] = [
  { key: "firstName", label: "Prénom", required: true },
  { key: "lastName", label: "Nom", required: true },
  { key: "address", label: "Adresse", required: true, placeholder: "Numéro et rue" },
  { key: "extension", label: "Complément", placeholder: "Bâtiment, étage, société…" },
  { key: "postalCode", label: "Code postal", required: true },
  { key: "city", label: "Ville", required: true },
  { key: "country", label: "Pays", required: true },
  { key: "phone", label: "Téléphone" },
];

function normalizeEditableAddress(address?: Partial<ShippingAddress> | null): EditableAddress {
  return {
    firstName: address?.firstName || "",
    lastName: address?.lastName || "",
    address: address?.address || "",
    city: address?.city || "",
    postalCode: address?.postalCode || "",
    country: address?.country || "France",
    extension: address?.extension || "",
    phone: address?.phone || "",
  };
}

function buildEditForm(order: Order): EditOrderForm {
  const shippingAddress = normalizeEditableAddress(order.shippingAddress || null);
  const billingAddress = normalizeEditableAddress((order.billingAddress as Partial<ShippingAddress> | null) || order.shippingAddress || null);
  return {
    notes: order.notes || "",
    shippingAddress,
    billingAddress,
  };
}

function sanitizeEditableAddress(address: EditableAddress) {
  return {
    firstName: address.firstName.trim(),
    lastName: address.lastName.trim(),
    address: address.address.trim(),
    city: address.city.trim(),
    postalCode: address.postalCode.trim(),
    country: address.country.trim() || "France",
    extension: address.extension?.trim() || null,
    phone: address.phone?.trim() || null,
  };
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [resendingTracking, setResendingTracking] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundMode, setRefundMode] = useState<"real" | "manual">("real");
  const [refundError, setRefundError] = useState("");
  const [refundSuccess, setRefundSuccess] = useState("");
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [invoiceSentSuccess, setInvoiceSentSuccess] = useState(false);
  const [customerExtraEmails, setCustomerExtraEmails] = useState<CustomerExtraEmail[]>([]);
  const [showEmailPicker, setShowEmailPicker] = useState(false);
  const [selectedInvoiceEmail, setSelectedInvoiceEmail] = useState<string | null>(null);
  const [isTogglingB2B, setIsTogglingB2B] = useState(false);
  // Modal sélecteur d'email — confirmation et suivi
  const [emailPickerAction, setEmailPickerAction] = useState<"confirmation" | "tracking" | null>(null);
  const [emailPickerOrderOptions, setEmailPickerOrderOptions] = useState<EmailOption[]>([]);
  const [emailPickerOrderDefault, setEmailPickerOrderDefault] = useState<string>("");
  const [editMode, setEditMode] = useState(false);
  const [notes, setNotes] = useState("");
  const [editForm, setEditForm] = useState<EditOrderForm>({
    notes: "",
    shippingAddress: { ...EMPTY_ADDRESS_FORM },
    billingAddress: { ...EMPTY_ADDRESS_FORM },
  });
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
  const [drawerRelayPointId, setDrawerRelayPointId] = useState("");

  // ─── États : panel modification articles ───────────────────────────────────
  type EditableItem = {
    productId: string;
    variantId: string | null;
    name: string;
    variantLabel: string | null;
    image: string;
    price: number;
    quantity: number;
  };
  const [showModifyItemsPanel, setShowModifyItemsPanel] = useState(false);
  const [editableItems, setEditableItems] = useState<EditableItem[]>([]);
  const [modifyItemsStep, setModifyItemsStep] = useState<"edit" | "confirm" | "adjustment" | "done">("edit");
  const [modifyItemsLoading, setModifyItemsLoading] = useState(false);
  const [modifyItemsError, setModifyItemsError] = useState("");
  const [modifyItemsResult, setModifyItemsResult] = useState<{ oldTotal: number; newTotal: number; diff: number } | null>(null);
  const [modifyAdjustmentMode, setModifyAdjustmentMode] = useState<"real" | "internal" | "gift">("real");
  const [modifyGiftNotifyClient, setModifyGiftNotifyClient] = useState(false);
  const [modifyGiftEmailText, setModifyGiftEmailText] = useState("");
  const [modifyPaymentLinkUrl, setModifyPaymentLinkUrl] = useState("");
  const [modifyDoneMessage, setModifyDoneMessage] = useState("");
  // Cache des variantes par productId (pour le sélecteur de variante inline)
  const [productVariantsCache, setProductVariantsCache] = useState<Record<string, ProductVariant[]>>({});
  // Recherche produit pour ajout
  const [productSearch, setProductSearch] = useState("");
  const [productSearchResults, setProductSearchResults] = useState<Product[]>([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);

  const loadOrder = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getAdminOrder(id);
      setOrder(data);
      setShipment((data.shipment as ShipmentRecord | null) || null);
      setNotes(data.notes || "");
      setEditForm(buildEditForm(data));
      // Charger les emails secondaires du client si disponible
      if (data.customerId) {
        getCustomerExtraEmails(data.customerId)
          .then((emails) => {
            setCustomerExtraEmails(emails);
            // Pré-sélectionner l'email primaire s'il existe
            const primary = emails.find((e) => e.isPrimary);
            if (primary) setSelectedInvoiceEmail(primary.email);
          })
          .catch(() => { /* silencieux si pas d'emails secondaires */ });
      }
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
      // Pré-remplir le point relais depuis la commande (commandes Mondial Relay existantes)
      setDrawerRelayPointId(detail.order.relayPointId || order.relayPointId || "");
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
    if (selectedQuote.requiresRelayPoint && !drawerRelayPointId.trim()) {
      setDrawerError("Veuillez saisir l'identifiant du point relais Mondial Relay avant d'acheter l'étiquette.");
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
        relayPointId: selectedQuote.requiresRelayPoint ? drawerRelayPointId.trim() || null : null,
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
    const printWindow = window.open(activeLabelUrl, "_blank");
    if (!printWindow) {
      setDrawerError("Veuillez autoriser les pop-ups pour imprimer l'étiquette");
      return;
    }

    let hasTriggeredPrint = false;
    const triggerPrint = () => {
      if (hasTriggeredPrint || printWindow.closed) return;
      hasTriggeredPrint = true;
      printWindow.focus();
      printWindow.print();
    };

    printWindow.onload = triggerPrint;
    window.setTimeout(triggerPrint, 1000);
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

  const startEditOrder = () => {
    if (!order) return;
    setEditForm(buildEditForm(order));
    setEditMode(true);
  };

  const cancelEditOrder = () => {
    if (!order) return;
    setEditForm(buildEditForm(order));
    setNotes(order.notes || "");
    setEditMode(false);
  };

  const updateEditAddress = (type: "shippingAddress" | "billingAddress", field: keyof EditableAddress, value: string) => {
    setEditForm((current) => ({
      ...current,
      [type]: {
        ...current[type],
        [field]: value,
      },
    }));
  };

  const handleSaveOrder = async () => {
    if (!order) return;
    setSaving(true);
    try {
      const payload = {
        customerId: order.customerId,
        email: order.customer?.email || order.customerEmail || order.email,
        status: order.status,
        paymentMethod: order.paymentMethod || null,
        paymentProvider: order.paymentProvider || null,
        isB2B: Boolean(order.isB2B),
        vatNumber: (order as Order & { vatNumber?: string | null }).vatNumber || undefined,
        shipping: order.shipping,
        notes: editForm.notes,
        shippingAddress: sanitizeEditableAddress(editForm.shippingAddress),
        billingAddress: sanitizeEditableAddress(editForm.billingAddress),
        items: order.items.map((item) => ({ productId: item.productId, variantId: item.variantId ?? null, quantity: item.quantity })),
      };
      const updated = await updateAdminOrder(order.id, payload);
      setOrder(updated);
      setShipment((updated.shipment as ShipmentRecord | null) || null);
      setNotes(updated.notes || "");
      setEditForm(buildEditForm(updated));
      setEditMode(false);
    } catch (err: any) {
      alert(err.message || "Impossible d’enregistrer la commande.");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateInvoice = async (force = false) => {
    if (!order) return;
    setIsGeneratingInvoice(true);
    try {
      const result = await generateAdminOrderInvoice(order.id, force);
      // Mettre à jour l'objet order localement pour afficher le lien sans recharger
      setOrder((prev) => {
        if (!prev) return prev;
        if (result.isB2B) {
          return { ...prev, proInvoiceNumber: result.invoiceNumber, proInvoiceUrl: result.invoiceUrl };
        }
        return { ...prev, invoiceNumber: result.invoiceNumber, invoiceUrl: result.invoiceUrl };
      });
    } catch (err: any) {
      alert(err.message || "Impossible de générer la facture.");
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  const handleSendInvoice = async () => {
    if (!order) return;
    setIsSendingInvoice(true);
    setInvoiceSentSuccess(false);
    setShowEmailPicker(false);
    try {
      // Utiliser l'email sélectionné si différent de l'email principal de la commande
      const overrideEmail = selectedInvoiceEmail || undefined;
      const result = await sendAdminOrderInvoice(order.id, overrideEmail);
      setInvoiceSentSuccess(true);
      setTimeout(() => setInvoiceSentSuccess(false), 4000);
      console.log("[send-invoice]", result.message);
    } catch (err: any) {
      alert(err.message || "Impossible d'envoyer la facture.");
    } finally {
      setIsSendingInvoice(false);
    }
  };

  const handleToggleB2B = async () => {
    if (!order) return;
    const newIsB2B = !order.isB2B;
    const label = newIsB2B ? "B2B (professionnel)" : "B2C (particulier)";
    const confirmed = window.confirm(
      `Changer le type de cette commande en ${label} ?\n\nCela affecte la génération de facture (B2C ou B2B). Si une facture a déjà été générée, elle ne sera pas supprimée automatiquement — utilisez "Régénérer la facture" ensuite.`
    );
    if (!confirmed) return;
    setIsTogglingB2B(true);
    try {
      await toggleAdminOrderB2B(order.id, newIsB2B);
      setOrder((prev) => prev ? { ...prev, isB2B: newIsB2B } : prev);
    } catch (err: any) {
      alert(err.message || "Impossible de modifier le type de commande.");
    } finally {
      setIsTogglingB2B(false);
    }
  };

  const handleDuplicateOrder = async () => {
    if (!order) return;
    const confirmed = window.confirm(
      `Dupliquer la commande ${order.orderNumber} ?\n\nUn brouillon identique sera créé avec les mêmes articles, le même client et la même adresse. Vous serez redirigé vers les brouillons.`
    );
    if (!confirmed) return;
    setIsDuplicating(true);
    try {
      const result = await duplicateAdminOrder(order.id);
      router.push(`/admin/commandes/brouillons?highlight=${result.draft.id}`);
    } catch (err: any) {
      alert(err.message || "Impossible de dupliquer la commande.");
      setIsDuplicating(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!order) return;
    const confirmed = window.confirm(`Supprimer définitivement la commande ${order.orderNumber} ? Cette action est irréversible.`);
    if (!confirmed) return;
    setDeleting(true);
    try {
      await deleteAdminOrder(order.id);
      router.push("/admin/commandes");
    } catch (err: any) {
      alert(err.message || "Impossible de supprimer la commande.");
      setDeleting(false);
    }
  };

  const doResendConfirmation = async (overrideEmail?: string) => {
    if (!order) return;
    setResendingConfirmation(true);
    try {
      const result = await resendOrderConfirmation(order.id, overrideEmail);
      alert(result.message || "Email de confirmation renvoyé avec succès.");
    } catch (err: any) {
      alert(err.message || "Impossible de renvoyer l'email de confirmation.");
    } finally {
      setResendingConfirmation(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!order) return;
    const baseEmail = order.customer?.email || order.customerEmail || order.email || "";
    if (customerExtraEmails.length > 0) {
      const options: EmailOption[] = [
        { email: baseEmail, label: "Email principal" },
        ...customerExtraEmails.map((e) => ({ email: e.email, label: e.label, isPrimary: e.isPrimary })),
      ];
      const primaryExtra = customerExtraEmails.find((e) => e.isPrimary);
      setEmailPickerOrderDefault(primaryExtra?.email || baseEmail);
      setEmailPickerOrderOptions(options);
      setEmailPickerAction("confirmation");
      return;
    }
    const confirmed = window.confirm(`Renvoyer l'email de confirmation à ${baseEmail} ?`);
    if (!confirmed) return;
    doResendConfirmation();
  };

  const doResendTracking = async (overrideEmail?: string) => {
    if (!order) return;
    setResendingTracking(true);
    try {
      const result = await resendOrderTracking(order.id, overrideEmail);
      alert(result.message || "Email de suivi renvoyé avec succès.");
    } catch (err: any) {
      alert(err.message || "Impossible de renvoyer l'email de suivi.");
    } finally {
      setResendingTracking(false);
    }
  };

  const handleResendTracking = async () => {
    if (!order) return;
    const baseEmail = order.customer?.email || order.customerEmail || order.email || "";
    if (customerExtraEmails.length > 0) {
      const options: EmailOption[] = [
        { email: baseEmail, label: "Email principal" },
        ...customerExtraEmails.map((e) => ({ email: e.email, label: e.label, isPrimary: e.isPrimary })),
      ];
      const primaryExtra = customerExtraEmails.find((e) => e.isPrimary);
      setEmailPickerOrderDefault(primaryExtra?.email || baseEmail);
      setEmailPickerOrderOptions(options);
      setEmailPickerAction("tracking");
      return;
    }
    const confirmed = window.confirm(`Renvoyer l'email de suivi d'expédition à ${baseEmail} ?`);
    if (!confirmed) return;
    doResendTracking();
  };

  // ─── Handlers : modification articles ─────────────────────────────────────
  const openModifyItemsPanel = () => {
    if (!order) return;
    // Initialiser les articles éditables depuis la commande actuelle
    const items: EditableItem[] = order.items.map((item) => ({
      productId: item.productId || "",
      variantId: item.variantId || null,
      name: item.name,
      variantLabel: item.variantLabel || null,
      image: item.image || "",
      price: item.price,
      quantity: item.quantity,
    }));
    setEditableItems(items);
    setModifyItemsStep("edit");
    setModifyItemsError("");
    setModifyItemsResult(null);
    setModifyPaymentLinkUrl("");
    setModifyDoneMessage("");
    setProductSearch("");
    setProductSearchResults([]);
    setShowModifyItemsPanel(true);
    // Charger les variantes disponibles pour chaque produit (en arrière-plan)
    const productIds = Array.from(new Set(order.items.map((i) => i.productId).filter(Boolean)));
    productIds.forEach(async (productId) => {
      if (!productId || productVariantsCache[productId]) return; // Déjà en cache
      try {
        const variants = await getProductVariants(productId);
        if (variants.length > 0) {
          setProductVariantsCache((prev) => ({ ...prev, [productId]: variants }));
        }
      } catch {
        // Silencieux : si les variantes ne se chargent pas, le sélecteur n'apparaît pas
      }
    });
  };

  const handleProductSearch = async (query: string) => {
    setProductSearch(query);
    if (query.trim().length < 2) {
      setProductSearchResults([]);
      return;
    }
    setProductSearchLoading(true);
    try {
      const result = await getAdminProducts({ search: query.trim(), limit: 8, status: "active" });
      setProductSearchResults(result.products);
    } catch {
      setProductSearchResults([]);
    } finally {
      setProductSearchLoading(false);
    }
  };

  const addProductToEditableItems = (product: Product, variant?: ProductVariant) => {
    const key = `${product.id}:${variant?.id ?? ""}`;
    const existing = editableItems.find((i) => `${i.productId}:${i.variantId ?? ""}` === key);
    if (existing) {
      setEditableItems((prev) => prev.map((i) => `${i.productId}:${i.variantId ?? ""}` === key ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      const images = Array.isArray(product.images) ? product.images : (typeof product.images === "string" ? JSON.parse(product.images || "[]") : []);
      setEditableItems((prev) => [
        ...prev,
        {
          productId: product.id,
          variantId: variant?.id || null,
          name: variant ? `${product.name} - ${variant.name}` : product.name,
          variantLabel: variant?.name || null,
          image: variant?.image || images[0] || "",
          price: variant?.price ?? product.price,
          quantity: 1,
        },
      ]);
    }
    setProductSearch("");
    setProductSearchResults([]);
  };

  const updateEditableItemQty = (index: number, delta: number) => {
    setEditableItems((prev) => {
      const updated = [...prev];
      const newQty = updated[index].quantity + delta;
      if (newQty <= 0) {
        return updated.filter((_, i) => i !== index);
      }
      updated[index] = { ...updated[index], quantity: newQty };
      return updated;
    });
  };

  const removeEditableItem = (index: number) => {
    setEditableItems((prev) => prev.filter((_, i) => i !== index));
  };
  const changeEditableItemVariant = (index: number, variantId: string) => {
    const item = editableItems[index];
    const variants = productVariantsCache[item.productId] || [];
    const variant = variants.find((v) => v.id === variantId);
    if (!variant) return;
    setEditableItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        variantId: variant.id,
        variantLabel: variant.name,
        price: variant.price ?? updated[index].price,
        image: variant.image || updated[index].image,
      };
      return updated;
    });
  };

  const handleModifyItemsSubmit = async () => {
    if (!order || editableItems.length === 0) return;
    setModifyItemsLoading(true);
    setModifyItemsError("");
    try {
      const result = await modifyOrderItems(order.id, {
        items: editableItems.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })),
        adjustmentMode: modifyAdjustmentMode,
      });
      setModifyItemsResult({ oldTotal: result.oldTotal, newTotal: result.newTotal, diff: result.diff });
      setOrder(result.order);
      if (Math.abs(result.diff) < 0.01) {
        // Pas de différence — on passe directement à done
        setModifyDoneMessage("Articles modifiés avec succès. Le total de la commande est inchangé.");
        setModifyItemsStep("done");
      } else {
        setModifyItemsStep("adjustment");
      }
    } catch (err: unknown) {
      setModifyItemsError(err instanceof Error ? err.message : "Erreur lors de la modification des articles");
    } finally {
      setModifyItemsLoading(false);
    }
  };

  const handlePaymentAdjustment = async () => {
    if (!order || !modifyItemsResult) return;
    setModifyItemsLoading(true);
    setModifyItemsError("");
    try {
      const result = await createPaymentAdjustment(order.id, {
        diff: modifyItemsResult.diff,
        mode: modifyAdjustmentMode,
        ...(modifyAdjustmentMode === "gift" ? {
          notifyClient: modifyGiftNotifyClient,
          giftEmailText: modifyGiftNotifyClient ? modifyGiftEmailText : undefined,
        } : {}),
      });

      // Cas PayPal : complément de paiement non disponible — basculer automatiquement en interne
      if (!result.success && result.fallbackToInternal) {
        // Basculer en mode internal et notifier l'admin
        const internalResult = await createPaymentAdjustment(order.id, { diff: modifyItemsResult.diff, mode: "internal" });
        if (!internalResult.success) {
          setModifyItemsError(internalResult.error || "Erreur lors de l'ajustement interne");
          return;
        }
        setModifyDoneMessage(
          `⚠️ Complément de paiement automatique non disponible pour PayPal.\n` +
          `Un ajustement interne de ${formatPrice(modifyItemsResult.diff, order.currency)} a été enregistré dans les notes de la commande.\n` +
          `Vous devez gérer ce complément manuellement (lien PayPal.me, virement, etc.).`
        );
        setModifyItemsStep("done");
        return;
      }

      // Cas erreur non-fallback
      if (!result.success && result.error) {
        setModifyItemsError(result.error);
        return;
      }

      if (result.paymentLinkUrl) {
        setModifyPaymentLinkUrl(result.paymentLinkUrl);
        setModifyDoneMessage(`Lien de paiement complémentaire créé (${formatPrice(modifyItemsResult.diff, order.currency)}). Envoyez-le au client.`);
      } else if (result.giftApplied) {
        const absAmount = formatPrice(Math.abs(modifyItemsResult.diff), order.currency);
        setModifyDoneMessage(
          `Remise commerciale de ${absAmount} appliquée avec succès.` +
          (modifyGiftNotifyClient ? ` Un email a été envoyé au client.` : ` Aucun email envoyé au client.`)
        );
      } else if (result.newStatus) {
        setModifyDoneMessage(`Remboursement de ${formatPrice(Math.abs(modifyItemsResult.diff), order.currency)} effectué avec succès.`);
      } else {
        setModifyDoneMessage(`Ajustement interne enregistré (${formatPrice(modifyItemsResult.diff, order.currency)}).`);
      }
      setModifyItemsStep("done");
    } catch (err: unknown) {
      setModifyItemsError(err instanceof Error ? err.message : "Erreur lors de l'ajustement de paiement");
    } finally {
      setModifyItemsLoading(false);
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

  const handleRefund = async () => {
    if (!order) return;
    setRefundError("");
    setRefundSuccess("");
    const amount = parseFloat(refundAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      setRefundError("Veuillez saisir un montant valide.");
      return;
    }
    const totalPaid = order.totalTTC || order.total;
    const maxRefundable = totalPaid - (order.refundedAmount || 0);
    if (amount > maxRefundable + 0.01) {
      setRefundError(`Le montant dépasse le remboursable restant (${formatPrice(maxRefundable, order.currency)}).`);
      return;
    }
    const modeLabel = refundMode === "real" ? "réel (via " + (order.paymentProvider || "passerelle") + ")" : "manuel (enregistrement uniquement)";
    const confirmed = window.confirm(
      `Rembourser ${formatPrice(amount, order.currency)} sur la commande ${order.orderNumber} ?\n\nMode : ${modeLabel}\n\nCette action est irréversible.`
    );
    if (!confirmed) return;
    setIsRefunding(true);
    try {
      const result = await refundAdminOrder(order.id, { amount, mode: refundMode });
      setOrder((prev) => prev ? { ...prev, status: result.status, refundedAmount: result.refundedAmount } : prev);
      setRefundSuccess(`Remboursement de ${formatPrice(amount, order.currency)} enregistré avec succès.`);
      setRefundAmount("");
      setTimeout(() => setRefundSuccess(""), 6000);
    } catch (err: any) {
      setRefundError(err.message || "Impossible d'effectuer le remboursement.");
    } finally {
      setIsRefunding(false);
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
  const channelInfo = channelBadge(order);
  const isPosOrder = order.channel === "pos";
  const BANK_TRANSFER_METHODS = ["paybybank", "pay_by_bank", "banktransfer", "bank_transfer", "bank-transfer", "virement"];
  const isB2BBankTransferPending =
    order.isB2B &&
    BANK_TRANSFER_METHODS.includes((order.paymentMethod || "").toLowerCase()) &&
    ["pending", "pending_payment", "open"].includes(order.status);
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
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${channelInfo.className}`}>{channelInfo.label}</span>
                {/* Badge "Facture à régénérer" :
                     - itemsLastModifiedAt est mis à jour à chaque modification des articles
                     - Il est réinitialisé à null lors de la génération de facture
                     - Donc si itemsLastModifiedAt est non-null ET qu'une facture existe → badge */}
                {order.itemsLastModifiedAt && (order.isB2B ? Boolean(order.proInvoiceUrl) : Boolean(order.invoiceUrl)) && (
                  <span
                    title={`Articles modifiés le ${new Date(order.itemsLastModifiedAt).toLocaleDateString("fr-FR")}. Régénérez la facture depuis la section Facture ci-dessous.`}
                    className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-300"
                  >
                    ⚠️ Facture à régénérer
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-500">Créée le {formatDate(order.createdAt)}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <main className="space-y-6">
            <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                <h2 className="font-semibold text-gray-950">Articles</h2>
                {["paid", "processing", "shipped", "delivered", "partially_refunded"].includes(order.status) && !isPosOrder && (
                  <button
                    onClick={openModifyItemsPanel}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Modifier les articles
                  </button>
                )}
              </div>
              <div className="divide-y divide-gray-100">
                {order.items.map((item) => (
                  <div key={item.id} className="flex gap-4 px-5 py-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                      {item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : <Package className="h-5 w-5 text-gray-300" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-950">{item.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                        <span>{formatPrice(item.price, order.currency)} × {item.quantity}</span>
                        {item.variantLabel && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{item.variantLabel}</span>}
                        {item.isCustomSale && <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-xs font-semibold text-fuchsia-700">Vente rapide</span>}
                        {item.discountAmount ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Remise {formatPrice(item.discountAmount, order.currency)}</span> : null}
                      </div>
                    </div>
                    <div className="font-semibold text-gray-950">{formatPrice(item.price * item.quantity, order.currency)}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2 border-t border-gray-200 px-5 py-4 sm:flex-row">
                {isPosOrder ? (
                  <div className="rounded-xl bg-fuchsia-50 px-4 py-3 text-sm text-fuchsia-800">
                    Cette vente a été encaissée en caisse. Elle ne nécessite ni traitement logistique, ni étiquette d’expédition.
                  </div>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 font-semibold text-gray-950">Récapitulatif financier</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Sous-total</span><span>{formatPrice(order.subtotal, order.currency)}</span></div>
                {order.discountAmount ? <div className="flex justify-between text-emerald-700"><span>Remise caisse</span><span>-{formatPrice(order.discountAmount, order.currency)}</span></div> : null}
                <div className="flex justify-between"><span className="text-gray-500">{isPosOrder ? "Expédition" : shipmentSummary(order)}</span><span>{isPosOrder ? "Non applicable" : order.shipping === 0 ? "Gratuite" : formatPrice(order.shipping, order.currency)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Taxes</span><span>{formatPrice(totals.taxes, order.currency)}</span></div>
                <div className="flex justify-between border-t border-gray-200 pt-3 text-base font-semibold text-gray-950"><span>Total</span><span>{formatPrice(order.total, order.currency)}</span></div>
                {/* Payé à ce jour — utilise paidAmount si disponible, sinon fallback binaire */}
                <div className="flex justify-between text-sm font-medium text-emerald-700">
                  <span>Payé à ce jour</span>
                  <span>{order.paidAmount != null ? formatPrice(order.paidAmount, order.currency) : (paymentBadge(order).label === "Payée" ? formatPrice(order.total, order.currency) : formatPrice(0, order.currency))}</span>
                </div>
                {/* Complément en attente — affiché si un paiement complémentaire est en cours */}
                {order.pendingComplementAmount != null && (
                  <div className="flex justify-between text-sm font-medium text-amber-600">
                    <span>Complément en attente</span>
                    <span>{formatPrice(order.pendingComplementAmount, order.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-100 pt-3 text-sm"><span className="text-gray-500">Moyen de paiement</span><span className="font-medium text-gray-800">{paymentMethodLabel(order.paymentMethod, order.paymentProvider)}</span></div>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 font-semibold text-gray-950">Calendrier</h2>
              <div className="space-y-4">
                {[
                  { label: isPosOrder ? "Vente caisse créée" : "Commande créée", date: order.createdAt, icon: CalendarClock },
                  { label: paymentBadge(order).label === "Payée" ? (isPosOrder ? "Paiement terminal confirmé" : "Paiement confirmé") : "Paiement en attente", date: order.posPaidAt || order.updatedAt, icon: CheckCircle2 },
                  ...(!isPosOrder ? [{ label: "Email de confirmation envoyé", date: order.createdAt, icon: Mail }] : []),
                  ...(!isPosOrder && order.shipment?.labelGeneratedAt ? [{ label: `Étiquette ${carrierLabel(order.shipment.carrier)} achetée${order.shipment.trackingNumber ? ` — Suivi ${order.shipment.trackingNumber}` : ""}`, date: order.shipment.labelGeneratedAt, icon: Truck }] : []),
                  ...(!isPosOrder && order.shipment?.labelStatus === "cancelled" ? [{ label: "Étiquette annulée — remboursement sous 48h", date: order.shipment.updatedAt || order.shipment.labelGeneratedAt || order.updatedAt, icon: AlertCircle }] : []),
                  ...(!isPosOrder && order.shipment?.shippedAt ? [{ label: "Commande expédiée", date: order.shipment.shippedAt, icon: Truck }] : []),
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
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2"><Pencil className="h-4 w-4 text-gray-500" /><h2 className="font-semibold text-gray-950">Gestion de la commande</h2></div>
                  <p className="mt-1 text-xs text-gray-500">{isPosOrder ? "Les ventes caisse sont pilotées depuis le module POS." : "Modifiez les notes et les adresses, puis enregistrez."}</p>
                </div>
                {!editMode && !isPosOrder && (
                  <button onClick={startEditOrder} className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 transition hover:bg-gray-50">
                    <Pencil className="h-4 w-4" /> Modifier
                  </button>
                )}
              </div>

              {editMode ? (
                <div id="edit-address-section" className="mt-5 space-y-5">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Notes internes</label>
                    <textarea
                      value={editForm.notes}
                      onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))}
                      rows={4}
                      placeholder="Ajouter une note interne..."
                      className="w-full rounded-xl border border-gray-300 p-3 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                    />
                  </div>

                  {(["shippingAddress", "billingAddress"] as const).map((addressType) => (
                    <div key={addressType} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <h3 className="text-sm font-semibold text-gray-950">{addressType === "shippingAddress" ? "Adresse de livraison" : "Adresse de facturation"}</h3>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {ADDRESS_FIELDS.map((field) => (
                          <label key={`${addressType}-${field.key}`} className={field.key === "address" || field.key === "extension" ? "sm:col-span-2" : ""}>
                            <span className="mb-1 block text-xs font-medium text-gray-600">{field.label}{field.required ? " *" : ""}</span>
                            <input
                              value={editForm[addressType][field.key] || ""}
                              onChange={(event) => updateEditAddress(addressType, field.key, event.target.value)}
                              placeholder={field.placeholder}
                              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      onClick={handleSaveOrder}
                      disabled={saving}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer
                    </button>
                    <button
                      onClick={cancelEditOrder}
                      disabled={saving}
                      className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
                  <div className="mb-2 flex items-center gap-2"><StickyNote className="h-4 w-4 text-gray-500" /><p className="font-medium text-gray-950">Notes internes</p></div>
                  <p className="whitespace-pre-line">{notes || "Aucune note interne."}</p>
                </div>
              )}
            </section>

            {/* Bloc Emails — visible uniquement pour les commandes en ligne payées */}
            {!isPosOrder && ["paid", "processing", "shipped", "delivered"].includes(order.status) && (
              <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <Send className="h-4 w-4 text-gray-500" />
                  <h2 className="font-semibold text-gray-950">Emails transactionnels</h2>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={handleResendConfirmation}
                    disabled={resendingConfirmation}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {resendingConfirmation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    Renvoyer la confirmation
                  </button>
                  {activeShipment?.trackingNumber && (
                    <button
                      onClick={handleResendTracking}
                      disabled={resendingTracking}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {resendingTracking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                      Renvoyer le suivi
                    </button>
                  )}
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <Copy className="mt-0.5 h-5 w-5 text-indigo-600" />
                <div className="flex-1">
                  <h2 className="font-semibold text-indigo-950">Dupliquer la commande</h2>
                  <p className="mt-1 text-sm text-indigo-700">Crée un brouillon identique avec les mêmes articles, le même client et la même adresse. Les prix sont recalculés au tarif actuel.</p>
                  <button
                    onClick={handleDuplicateOrder}
                    disabled={isDuplicating}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isDuplicating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />} Dupliquer en brouillon
                  </button>
                </div>
              </div>
            </section>

            {/* Bloc Remboursement — visible uniquement si la commande a été payée et n'est pas encore totalement remboursée */}
            {["paid", "processing", "shipped", "delivered", "partially_refunded"].includes(order.status) && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <RotateCcw className="mt-0.5 h-5 w-5 text-amber-600" />
                  <div className="flex-1">
                    <h2 className="font-semibold text-amber-950">Remboursement</h2>
                    {order.refundedAmount && order.refundedAmount > 0 ? (
                      <p className="mt-1 text-sm text-amber-700">
                        Déjà remboursé : <strong>{formatPrice(order.refundedAmount, order.currency)}</strong> — Restant remboursable : <strong>{formatPrice((order.totalTTC || order.total) - order.refundedAmount, order.currency)}</strong>
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-amber-700">Remboursez tout ou partie du montant payé. Choisissez le mode selon la passerelle utilisée.</p>
                    )}

                    <div className="mt-4 space-y-3">
                      {/* Montant */}
                      <div>
                        <label className="mb-1 block text-xs font-medium text-amber-900">Montant à rembourser (€)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            max={(order.totalTTC || order.total) - (order.refundedAmount || 0)}
                            value={refundAmount}
                            onChange={(e) => setRefundAmount(e.target.value)}
                            placeholder={`Max. ${formatPrice((order.totalTTC || order.total) - (order.refundedAmount || 0), order.currency)}`}
                            className="flex-1 rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                          />
                          <button
                            type="button"
                            onClick={() => setRefundAmount(((order.totalTTC || order.total) - (order.refundedAmount || 0)).toFixed(2))}
                            className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100"
                          >
                            Tout
                          </button>
                        </div>
                      </div>

                      {/* Mode */}
                      <div>
                        <label className="mb-1 block text-xs font-medium text-amber-900">Mode de remboursement</label>
                        <select
                          value={refundMode}
                          onChange={(e) => setRefundMode(e.target.value as "real" | "manual")}
                          className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                        >
                          <option value="real">Réel — via {order.paymentProvider === "paypal" ? "PayPal" : "Mollie"}</option>
                          <option value="manual">Manuel — enregistrement uniquement</option>
                        </select>
                        {refundMode === "real" && !order.providerPaymentId && (
                          <p className="mt-1 text-xs text-amber-600">⚠️ Aucun ID de paiement — le remboursement réel sera impossible.</p>
                        )}
                      </div>

                      {/* Messages */}
                      {refundError && <p className="rounded-lg bg-rose-100 px-3 py-2 text-xs text-rose-700">{refundError}</p>}
                      {refundSuccess && <p className="rounded-lg bg-emerald-100 px-3 py-2 text-xs text-emerald-700">{refundSuccess}</p>}

                      {/* Bouton */}
                      <button
                        onClick={handleRefund}
                        disabled={isRefunding || !refundAmount}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isRefunding ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                        Effectuer le remboursement
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <Trash2 className="mt-0.5 h-5 w-5 text-rose-600" />
                <div className="flex-1">
                  <h2 className="font-semibold text-rose-950">Zone dangereuse</h2>
                  <p className="mt-1 text-sm text-rose-700">La suppression d’une commande est définitive. Une confirmation sera demandée avant l’action.</p>
                  <button
                    onClick={handleDeleteOrder}
                    disabled={deleting}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Supprimer la commande
                  </button>
                </div>
              </div>
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
              <div className="mb-3 flex items-center gap-2"><FileText className="h-4 w-4 text-gray-500" /><h2 className="font-semibold text-gray-950">Facture</h2></div>
              {(order.invoiceNumber && order.invoiceUrl) || (order.proInvoiceNumber && order.proInvoiceUrl) ? (
                (() => {
                  const isB2B = order.isB2B && order.proInvoiceNumber && order.proInvoiceUrl;
                  const invoiceNum = isB2B ? order.proInvoiceNumber : order.invoiceNumber;
                  const invoiceUrl = isB2B ? order.proInvoiceUrl : order.invoiceUrl;
                  const defaultEmail = order.customer?.email || order.customerEmail || order.email || "";
                  const allEmails: { email: string; label: string }[] = [
                    { email: defaultEmail, label: "Email principal" },
                    ...customerExtraEmails.map((e) => ({ email: e.email, label: e.label })),
                  ].filter((e) => e.email);
                  const activeEmail = selectedInvoiceEmail || defaultEmail;
                  return (
                    <div className="space-y-2 text-sm">
                      <p className="font-medium text-gray-950">{invoiceNum}</p>
                      <a href={invoiceUrl!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-blue-600 underline-offset-4 hover:underline">
                        <Download className="h-4 w-4" /> Télécharger le PDF {isB2B ? "Pro" : "B2C"}
                      </a>

                      {/* Sélecteur d'email destinataire */}
                      {allEmails.length > 1 && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => setShowEmailPicker((v) => !v)}
                            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            <span className="truncate max-w-[180px]">{activeEmail}</span>
                            <span className="text-gray-400">▾</span>
                          </button>
                          {showEmailPicker && (
                            <div className="mt-1.5 rounded-xl border border-gray-200 bg-white shadow-md overflow-hidden">
                              {allEmails.map((e) => (
                                <button
                                  key={e.email}
                                  type="button"
                                  onClick={() => { setSelectedInvoiceEmail(e.email); setShowEmailPicker(false); }}
                                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs hover:bg-gray-50 transition ${
                                    activeEmail === e.email ? "bg-primary/5 text-primary font-semibold" : "text-gray-700"
                                  }`}
                                >
                                  <Mail className="h-3 w-3 shrink-0" />
                                  <div>
                                    <div className="font-medium">{e.email}</div>
                                    <div className="text-gray-400">{e.label}</div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {allEmails.length === 1 && (
                        <p className="text-xs text-gray-400 flex items-center gap-1.5"><Mail className="h-3 w-3" /> {activeEmail}</p>
                      )}

                      <button
                        onClick={handleSendInvoice}
                        disabled={isSendingInvoice}
                        className={`mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
                          invoiceSentSuccess
                            ? "bg-emerald-600 text-white"
                            : "bg-gray-900 text-white hover:bg-gray-700"
                        }`}
                      >
                        {isSendingInvoice ? <Loader2 className="h-4 w-4 animate-spin" /> : invoiceSentSuccess ? <span>✓</span> : <Send className="h-4 w-4" />}
                        {invoiceSentSuccess ? "Envoyée !" : "Envoyer la facture"}
                      </button>
                      <button
                        onClick={() => handleGenerateInvoice(true)}
                        disabled={isGeneratingInvoice}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-60"
                      >
                        {isGeneratingInvoice ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Régénérer la facture
                      </button>
                    </div>
                  );
                })()
              ) : (
                <div>
                  <p className="text-sm text-gray-400">Aucune facture générée pour cette commande.</p>
                  <button
                    onClick={() => handleGenerateInvoice(false)}
                    disabled={isGeneratingInvoice}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:opacity-60"
                  >
                    {isGeneratingInvoice ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Générer la facture
                  </button>
                </div>
              )}
            </section>

            {isPosOrder ? (
              <>
              <section className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-fuchsia-600" /><h2 className="font-semibold text-fuchsia-950">Encaissement caisse</h2></div>
                <div className="space-y-2 text-sm text-fuchsia-800">
                  <p><span className="font-semibold">Statut POS :</span> {order.posPaymentStatus || "—"}</p>
                  <p><span className="font-semibold">Terminal :</span> {order.terminalId || "Terminal non renseigné"}</p>
                  <p><span className="font-semibold">Session :</span> {order.posSessionId || "Session non renseignée"}</p>
                  <p><span className="font-semibold">Caissier :</span> {order.posCashierEmail || "Non renseigné"}</p>
                </div>
              </section>
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm font-semibold text-amber-900">Type de commande</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${order.isB2B ? "bg-violet-100 text-violet-700 ring-violet-300" : "bg-gray-100 text-gray-600 ring-gray-300"}`}>{order.isB2B ? "B2B" : "B2C"}</span>
                </div>
                <p className="mb-3 text-xs text-amber-700">Correction pour les commandes POS créées avant la mise à jour automatique du type client.</p>
                <button
                  onClick={handleToggleB2B}
                  disabled={isTogglingB2B}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400 bg-white px-3 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-60"
                >
                  {isTogglingB2B ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {order.isB2B ? "Basculer en B2C" : "Basculer en B2B"}
                </button>
              </section>
              </>
            ) : (
              <>
                <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-gray-500" /><h2 className="font-semibold text-gray-950">Adresse de livraison</h2></div>
                    {!editMode && !isPosOrder && (
                      <button
                        onClick={() => { startEditOrder(); setTimeout(() => { document.getElementById("edit-address-section")?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 100); }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
                        <Pencil className="h-3 w-3" /> Modifier
                      </button>
                    )}
                  </div>
                  {order.shipment?.carrier === "mondial_relay" ? (
                    <div className="mb-3 space-y-2">
                      <div className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                        <span className="rounded bg-red-600 px-1.5 py-0.5 text-white">MR</span> Mondial Relay
                      </div>
                      {(order.relayPointName || order.relayPointId) ? (
                        <div className="rounded-xl border border-red-100 bg-red-50/60 p-3 text-sm">
                          {order.relayPointName && <p className="font-semibold text-gray-900">{order.relayPointName}</p>}
                          {order.relayPointAddress && <p className="text-gray-600">{order.relayPointAddress}</p>}
                          {order.relayPointId && <p className="mt-1 text-xs text-gray-400">Réf. : {order.relayPointId}</p>}
                        </div>
                      ) : (
                        <p className="text-xs text-amber-600">Point relais non renseigné</p>
                      )}
                      <p className="text-xs text-gray-400">Adresse personnelle du client :</p>
                      {renderAddress(order.shippingAddress)}
                    </div>
                  ) : (
                    renderAddress(order.shippingAddress)
                  )}
                </section>

                <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <h2 className="mb-3 font-semibold text-gray-950">Adresse de facturation</h2>
                  {renderBillingAddress(order)}
                </section>
              </>
            )}
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

                  {isB2BBankTransferPending && (
                    <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                      <div>
                        <p className="font-semibold">Virement bancaire en attente de réception</p>
                        <p className="mt-1">Cette commande B2B est en attente de virement. Vous pouvez créer l'étiquette dès maintenant — la décision d'expédition avant réception des fonds est sous votre responsabilité.</p>
                      </div>
                    </div>
                  )}

                  <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center gap-2"><MapPin className="h-5 w-5 text-gray-500" /><h3 className="font-semibold text-gray-950">Adresse de livraison</h3></div>
                    {activeShipment?.carrier === "mondial_relay" ? (
                      <div className="mb-4 space-y-2">
                        <div className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                          <span className="rounded bg-red-600 px-1.5 py-0.5 text-white">MR</span> Mondial Relay — Point relais
                        </div>
                        {(order.relayPointName || order.relayPointId) ? (
                          <div className="rounded-xl border border-red-100 bg-red-50/60 p-3 text-sm">
                            {order.relayPointName && <p className="font-semibold text-gray-900">{order.relayPointName}</p>}
                            {order.relayPointAddress && <p className="text-gray-600">{order.relayPointAddress}</p>}
                            {order.relayPointId && <p className="mt-1 text-xs text-gray-400">Réf. : {order.relayPointId}</p>}
                          </div>
                        ) : (
                          <p className="text-xs text-amber-600">Point relais non renseigné (commande antérieure)</p>
                        )}
                        <p className="text-xs text-gray-400">Adresse personnelle :</p>
                        {renderAddress(order.shippingAddress)}
                      </div>
                    ) : (
                      <>
                        <div className="mb-4 inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">Colissimo à domicile</div>
                        {renderAddress(order.shippingAddress)}
                      </>
                    )}
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
                    <div className="mt-5 space-y-4"><label className="block text-sm font-medium text-gray-700">Date d’expédition<input type="date" value={shipDate} onChange={(event) => setShipDate(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10" /></label><label className="flex items-start gap-2 text-sm text-gray-600"><input type="checkbox" checked={sendEmailToCustomer} onChange={(event) => setSendEmailToCustomer(event.target.checked)} className="mt-1 rounded border-gray-300" />Envoyer un email de suivi au client après l’achat</label>{selectedQuote?.requiresRelayPoint && (<div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><label className="block text-sm font-semibold text-amber-900"><MapPin className="mb-1 inline h-4 w-4" /> Identifiant point relais Mondial Relay<input type="text" value={drawerRelayPointId} onChange={(e) => setDrawerRelayPointId(e.target.value)} placeholder="Ex : 017653" className="mt-2 w-full rounded-xl border border-amber-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/30" /></label>{drawerRelayPointId.trim() && (<p className="mt-2 text-xs text-amber-700">Point relais : <span className="font-semibold">{drawerRelayPointId.trim()}</span></p>)}{!drawerRelayPointId.trim() && (<p className="mt-2 text-xs text-amber-700">Saisissez la référence du point relais (visible sur la fiche commande).</p>)}</div>)}{labelBlockerMessage && <p className="rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-800">{labelBlockerMessage}</p>}<button onClick={purchaseLabel} disabled={drawerLoading || !selectedQuote || hasZeroWeight || !selectedQuote.purchasable || (selectedQuote?.requiresRelayPoint && !drawerRelayPointId.trim())} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50">{drawerLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />} Acheter l’étiquette</button></div>
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

      {/* Modal sélecteur d'email — confirmation et suivi */}
      {/* Panel de modification des articles d'une commande payée */}
      {showModifyItemsPanel && order && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={(e) => { if (e.target === e.currentTarget) setShowModifyItemsPanel(false); }}>
          <div className="relative flex w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl" style={{ maxHeight: "90vh" }}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-gray-700" />
                <h2 className="font-semibold text-gray-950">Modifier les articles</h2>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">#{order.orderNumber}</span>
              </div>
              <button onClick={() => setShowModifyItemsPanel(false)} className="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* Étape 1 : Édition des articles */}
              {modifyItemsStep === "edit" && (
                <div className="space-y-4">
                  {/* Liste des articles éditables */}
                  <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                    {editableItems.length === 0 && (
                      <div className="px-4 py-6 text-center text-sm text-gray-400">Aucun article. Ajoutez des produits ci-dessous.</div>
                    )}
                    {editableItems.map((item, index) => (
                      <div key={`${item.productId}:${item.variantId ?? ""}:${index}`} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                          {item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : <Package className="h-4 w-4 text-gray-300" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-950">{item.name}</p>
                          {/* Sélecteur de variante inline si le produit a plusieurs variantes */}
                          {productVariantsCache[item.productId] && productVariantsCache[item.productId].length > 1 ? (
                            <select
                              value={item.variantId || ""}
                              onChange={(e) => changeEditableItemVariant(index, e.target.value)}
                              className="mt-0.5 w-full rounded-md border border-gray-200 bg-white py-0.5 pl-1.5 pr-6 text-xs text-gray-700 outline-none focus:border-gray-900"
                            >
                              {productVariantsCache[item.productId].map((v) => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                              ))}
                            </select>
                          ) : (
                            <p className="text-xs text-gray-500">{formatPrice(item.price, order.currency)}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateEditableItemQty(index, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-8 text-center text-sm font-semibold text-gray-950">{item.quantity}</span>
                          <button onClick={() => updateEditableItemQty(index, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button onClick={() => removeEditableItem(index)} className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-600">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Recherche produit */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-700">Ajouter un produit</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => handleProductSearch(e.target.value)}
                        placeholder="Rechercher un produit…"
                        className="w-full rounded-xl border border-gray-300 py-2.5 pl-9 pr-4 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                      />
                      {productSearchLoading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />}
                    </div>
                    {productSearchResults.length > 0 && (
                      <div className="mt-1 rounded-xl border border-gray-200 bg-white shadow-lg">
                        {productSearchResults.map((product) => (
                          <div key={product.id}>
                            {product.variants && product.variants.length > 0 ? (
                              product.variants.map((variant) => (
                                <button
                                  key={variant.id}
                                  onClick={() => addProductToEditableItems(product, variant)}
                                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50"
                                >
                                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                                    {variant.image ? <img src={variant.image} alt="" className="h-full w-full object-cover" /> : null}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-gray-950">{product.name} — {variant.name}</p>
                                    <p className="text-xs text-gray-500">{formatPrice(variant.price ?? product.price, "EUR")}</p>
                                  </div>
                                </button>
                              ))
                            ) : (
                              <button
                                onClick={() => addProductToEditableItems(product)}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50"
                              >
                                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                                  {(() => { const imgs = Array.isArray(product.images) ? product.images : []; return imgs[0] ? <img src={imgs[0]} alt="" className="h-full w-full object-cover" /> : null; })()}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-gray-950">{product.name}</p>
                                  <p className="text-xs text-gray-500">{formatPrice(product.price, "EUR")}</p>
                                </div>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {modifyItemsError && (
                    <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{modifyItemsError}</div>
                  )}
                </div>
              )}

              {/* Étape 2 : Ajustement de paiement */}
              {modifyItemsStep === "adjustment" && modifyItemsResult && (
                <div className="space-y-4">
                  <div className="rounded-xl bg-gray-50 p-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-gray-500">Ancien total</span><span className="font-medium">{formatPrice(modifyItemsResult.oldTotal, order.currency)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Nouveau total</span><span className="font-medium">{formatPrice(modifyItemsResult.newTotal, order.currency)}</span></div>
                      <div className="flex justify-between border-t border-gray-200 pt-2">
                        <span className="font-semibold text-gray-950">Différence</span>
                        <span className={`font-semibold ${modifyItemsResult.diff > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                          {modifyItemsResult.diff > 0 ? "+" : ""}{formatPrice(modifyItemsResult.diff, order.currency)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">
                      {modifyItemsResult.diff > 0 ? "Le client doit payer un complément. Comment souhaitez-vous le gérer ?" : "Un remboursement est dû au client. Comment souhaitez-vous le gérer ?"}
                    </p>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-3 hover:bg-gray-50 has-[:checked]:border-gray-950 has-[:checked]:bg-gray-50">
                      <input type="radio" name="adjustmentMode" value="real" checked={modifyAdjustmentMode === "real"} onChange={() => setModifyAdjustmentMode("real")} className="mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-gray-950">{modifyItemsResult.diff > 0 ? "Envoyer un lien de paiement complémentaire" : "Rembourser via le prestataire de paiement"}</p>
                        <p className="text-xs text-gray-500">{modifyItemsResult.diff > 0 ? "Un lien Mollie sera généré — à envoyer au client par email ou SMS." : "Remboursement réel via Mollie ou PayPal."}</p>
                      </div>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-3 hover:bg-gray-50 has-[:checked]:border-gray-950 has-[:checked]:bg-gray-50">
                      <input type="radio" name="adjustmentMode" value="internal" checked={modifyAdjustmentMode === "internal"} onChange={() => setModifyAdjustmentMode("internal")} className="mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-gray-950">Ajustement interne uniquement</p>
                        <p className="text-xs text-gray-500">La différence est notée dans la commande sans transaction de paiement.</p>
                      </div>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 hover:bg-amber-100 has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50">
                      <input type="radio" name="adjustmentMode" value="gift" checked={modifyAdjustmentMode === "gift"} onChange={() => {
                        setModifyAdjustmentMode("gift");
                        if (!modifyGiftEmailText) {
                          const addedNames = editableItems.map(i => i.name).join(", ");
                          setModifyGiftEmailText(`Nous avons ajouté ${addedNames} à votre commande à titre de geste commercial, sans frais supplémentaire pour vous.`);
                        }
                      }} className="mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-amber-900">Offrir la différence (remise commerciale)</p>
                        <p className="text-xs text-amber-700">La différence est offerte au client. Une ligne « Remise commerciale » apparaîtra sur la prochaine facture générée.</p>
                      </div>
                    </label>
                  </div>

                  {/* Section notification client pour le mode gift */}
                  {modifyAdjustmentMode === "gift" && (
                    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={modifyGiftNotifyClient}
                          onChange={e => setModifyGiftNotifyClient(e.target.checked)}
                          className="h-4 w-4 rounded border-amber-300"
                        />
                        <span className="text-sm font-medium text-amber-900">Envoyer un email au client</span>
                      </label>
                      {modifyGiftNotifyClient && (
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-amber-800">Texte de l’email (personnalisable)</label>
                          <textarea
                            value={modifyGiftEmailText}
                            onChange={e => setModifyGiftEmailText(e.target.value)}
                            rows={3}
                            className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-amber-400"
                            placeholder="Message à envoyer au client..."
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {modifyItemsError && (
                    <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{modifyItemsError}</div>
                  )}
                </div>
              )}

              {/* Étape 3 : Confirmation finale */}
              {modifyItemsStep === "done" && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <p className="text-sm text-emerald-800">{modifyDoneMessage}</p>
                  </div>
                  {modifyPaymentLinkUrl && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <p className="mb-2 text-sm font-medium text-amber-900">Lien de paiement complémentaire :</p>
                      <div className="flex items-center gap-2">
                        <input readOnly value={modifyPaymentLinkUrl} className="flex-1 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs text-gray-700 outline-none" />
                        <button onClick={() => { navigator.clipboard.writeText(modifyPaymentLinkUrl); }} className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100">
                          <Copy className="h-4 w-4" />
                        </button>
                        <a href={modifyPaymentLinkUrl} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer avec boutons d'action */}
            <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
              {modifyItemsStep === "edit" && (
                <>
                  <button onClick={() => setShowModifyItemsPanel(false)} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                    Annuler
                  </button>
                  <button
                    onClick={() => setModifyItemsStep("confirm")}
                    disabled={editableItems.length === 0 || modifyItemsLoading}
                    className="inline-flex items-center gap-2 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Continuer
                  </button>
                </>
              )}
              {modifyItemsStep === "confirm" && (
                <>
                  <button onClick={() => setModifyItemsStep("edit")} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                    Retour
                  </button>
                  <button
                    onClick={handleModifyItemsSubmit}
                    disabled={modifyItemsLoading}
                    className="inline-flex items-center gap-2 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {modifyItemsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Confirmer la modification
                  </button>
                </>
              )}
              {modifyItemsStep === "adjustment" && (
                <>
                  <button onClick={() => setModifyItemsStep("edit")} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                    Retour
                  </button>
                  <button
                    onClick={handlePaymentAdjustment}
                    disabled={modifyItemsLoading}
                    className="inline-flex items-center gap-2 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {modifyItemsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Valider
                  </button>
                </>
              )}
              {modifyItemsStep === "done" && (
                <button onClick={() => setShowModifyItemsPanel(false)} className="rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800">
                  Fermer
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {emailPickerAction && (
        <EmailPickerModal
          options={emailPickerOrderOptions}
          defaultEmail={emailPickerOrderDefault}
          actionLabel={emailPickerAction === "confirmation" ? "Renvoyer la confirmation" : "Renvoyer le suivi"}
          onConfirm={(email) => {
            const action = emailPickerAction;
            setEmailPickerAction(null);
            setEmailPickerOrderOptions([]);
            if (action === "confirmation") doResendConfirmation(email);
            else doResendTracking(email);
          }}
          onCancel={() => {
            setEmailPickerAction(null);
            setEmailPickerOrderOptions([]);
          }}
        />
      )}
    </div>
  );
}
