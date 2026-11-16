"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Lock, ChevronDown, ShoppingBag, CreditCard, Landmark, WalletCards, ReceiptText, AlertCircle, Smartphone, MapPin, Search, Loader2, CheckCircle2, Clock, X } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { getCustomerAddresses, type CustomerAddress } from "@/lib/customer-api";
import { formatPrice } from "@/lib/utils";
import { getVariantImage } from "@/lib/product-images";
import { validatePromotionCode, type PromotionValidationResult } from "@/lib/api";
import { getCheckoutPricingQuote, getPricingQuoteItem, getPricingQuoteStockConstraints, type CheckoutPricingQuote } from "@/lib/checkout-pricing";
import { formatRelayDistance, formatShippingDisplayLabel } from "@/lib/checkout-display";
import { DRAFT_STOCK_NOTICE, PAYMENT_AMOUNT_UPDATED_MESSAGE, checkoutLineKey, getAvailableDisplayQuantity, getCheckoutFeeQuote, getCheckoutStockIssue, getDraftStockIssues, stockIssueMessage, withCheckoutTimeout, type CheckoutFeeQuote, type CheckoutStockIssue } from "@/lib/checkout-stockfees";
import PaymentBrandLogo, { hasPaymentBrandLogo } from "@/components/PaymentBrandLogo";
import type { CartItem, Product } from "@/types";

type Step = "contact" | "livraison" | "paiement";
type PaymentMethod =
  | "card"
  | "paybybank"
  | "pay_by_bank"
  | "sepa"
  | "paypal"
  | "paypal_4x"
  | "apple_pay"
  | "google_pay"
  | "bancontact"
  | "ideal"
  | "blik"
  | "mb_way"
  | "multibanco";

type DraftCheckoutItem = {
  id: string;
  productId?: string | null;
  variantId?: string | null;
  variantLabel?: string | null;
  name: string;
  price: number;
  quantity: number;
  discountAmount?: number;
  lineDiscountType?: string | null;
  lineDiscountValue?: number | null;
  discountedLineTotal?: number;
  image?: string;
  slug?: string;
  brand?: string;
  images?: string[];
  variants?: Product["variants"];
  availableStock?: number | null;
  realStockCount?: number | null;
  stockCount?: number | null;
  inStock?: boolean;
  /** Article personnalisé hors catalogue */
  isCustomSale?: boolean;
};

type DraftPricingSnapshot = {
  orderNumber: string;
  subtotal: number;
  shipping: number;
  total: number;
  totalHT: number;
  vatRate: number;
  vatAmount: number;
  totalTTC: number;
  discountAmount: number;
  orderDiscountType?: string | null;
  orderDiscountValue?: number | null;
  discountTotal: number;
  isB2B: boolean;
  cartSignature: string;
};

type DraftCheckoutResponse = {
  draft?: {
    orderNumber: string;
    email?: string | null;
    expiresAt?: string;
    isB2B?: boolean;
    noShipping?: boolean;
    subtotal?: number;
    shipping?: number;
    total?: number;
    totalHT?: number;
    vatRate?: number;
    vatAmount?: number;
    totalTTC?: number;
    discountAmount?: number;
    orderDiscountType?: string | null;
    orderDiscountValue?: number | null;
    discountTotal?: number;
    stockIssues?: CheckoutStockIssue[];
    items: DraftCheckoutItem[];
  };
  error?: string;
};

type ShippingOption = {
  id: string;
  label: string;
  price: number;
  carrier: string;
  days: string;
  isFree: boolean;
  zoneId?: string;
  zoneName?: string;
  minAmount?: number;
  maxAmount?: number | null;
};

type RelayPoint = {
  id: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  distance: number | null;
  openingHours: {
    monday: string;
    tuesday: string;
    wednesday: string;
    thursday: string;
    friday: string;
    saturday: string;
    sunday: string;
  };
  fullAddress: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://barberparadise-backend.onrender.com";
const PICKUP_LOCATION_LABEL = "RETRAIT SUR PLACE — 31 RUE DE PONT-À-MOUSSON";

const EU_COUNTRIES = ["FR", "BE", "NL", "DE", "IT", "ES", "PT", "AT", "LU", "IE", "GR", "FI", "SE", "DK", "PL", "CZ", "HU", "RO", "SK", "SI", "HR", "BG", "LT", "LV", "EE", "CY", "MT"];

const COUNTRY_CODE_BY_NAME: Record<string, string> = {
  France: "FR",
  Belgique: "BE",
  Suisse: "CH",
  Luxembourg: "LU",
  "Pays-Bas": "NL",
  Allemagne: "DE",
  Espagne: "ES",
  Italie: "IT",
  Portugal: "PT",
  Pologne: "PL",
  "États-Unis": "US",
  Canada: "CA",
  Maroc: "MA",
  // DOM-TOM : codes ISO distincts pour le calcul des frais de port
  Guadeloupe: "GP",
  Martinique: "MQ",
  "Guyane française": "GF",
  "La Réunion": "RE",
  Mayotte: "YT",
  "Saint-Pierre-et-Miquelon": "PM",
  "Polynésie française": "PF",
  "Nouvelle-Calédonie": "NC",
  "Wallis-et-Futuna": "WF",
};

const METHOD_CONFIG: Record<PaymentMethod, { label: string; badge?: string; icon: typeof CreditCard }> = {
  card: { label: "Carte bancaire", icon: CreditCard },
  paybybank: { label: "Virement instantané", badge: "Recommandé", icon: Landmark },
  pay_by_bank: { label: "VIREMENT BANCAIRE", badge: "BANK", icon: Landmark },
  sepa: { label: "PRÉLÈVEMENT SEPA", badge: "SEPA", icon: ReceiptText },
  paypal: { label: "PayPal", icon: WalletCards },
  paypal_4x: { label: "PayPal en 4x", icon: WalletCards },
  apple_pay: { label: "Apple Pay", icon: Smartphone },
  google_pay: { label: "Google Pay", icon: Smartphone },
  bancontact: { label: "BANCONTACT", badge: "BE", icon: Landmark },
  ideal: { label: "IDEAL", badge: "NL", icon: Landmark },
  blik: { label: "BLIK", badge: "PL", icon: Smartphone },
  mb_way: { label: "MB WAY", badge: "PT", icon: Smartphone },
  multibanco: { label: "MULTIBANCO", badge: "PT", icon: Landmark },
};

function getCountryCode(countryName: string): string {
  return COUNTRY_CODE_BY_NAME[countryName] || countryName.toUpperCase().slice(0, 2) || "FR";
}

function isValidCustomerEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function getEstimatedVatRate(country: string, isB2B: boolean, vatNumber: string): number {
  const normalizedCountry = country.toUpperCase();
  if (!EU_COUNTRIES.includes(normalizedCountry)) return 0;
  if (isB2B && vatNumber.trim() && normalizedCountry !== "FR") return 0;
  return 20;
}

function supportsApplePay(): boolean {
  if (typeof window === "undefined") return false;
  const applePaySession = (window as unknown as { ApplePaySession?: { canMakePayments?: () => boolean } }).ApplePaySession;
  return Boolean(applePaySession?.canMakePayments?.());
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getCartSignature(items: Array<{ product: { id: string }; quantity: number; variantId?: string | null; variant?: { id: string } | null }>): string {
  return items
    .map((item) => ({ productId: item.product.id, variantId: item.variantId || item.variant?.id || "product", quantity: item.quantity }))
    .filter((item) => item.productId && item.quantity > 0)
    .sort((a, b) => `${a.productId}:${a.variantId}`.localeCompare(`${b.productId}:${b.variantId}`))
    .map((item) => `${item.productId}:${item.variantId}:${item.quantity}`)
    .join("|");
}

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const requestedDraftToken = searchParams.get("draftToken")?.trim() || "";
  const { items, cartSessionId, replaceItems, reconcileStock, stockAdjustments } = useCart();
  const { customer, isAuthenticated, isLoading: customerLoading, isApprovedPro } = useCustomerAuth();
  const [step, setStep] = useState<Step>("contact");
  const [guestCheckout, setGuestCheckout] = useState(false);
  const [orderSummaryOpen, setOrderSummaryOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [hasExplicitPaymentSelection, setHasExplicitPaymentSelection] = useState(false);
  const [feeQuoteState, setFeeQuoteState] = useState<{ key: string; quote: CheckoutFeeQuote } | null>(null);
  const [feeQuoteLoading, setFeeQuoteLoading] = useState(false);
  const [feeQuoteError, setFeeQuoteError] = useState("");
  const [feeQuoteRetry, setFeeQuoteRetry] = useState(0);
  const [availableMethods, setAvailableMethods] = useState<PaymentMethod[]>([]);
  const [b2bSurchargePercents, setB2BSurchargePercents] = useState<Partial<Record<"card" | "paypal", number>>>({});
  const [methodsLoading, setMethodsLoading] = useState(false);
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState("");
  const [selectedShippingOptionId, setSelectedShippingOptionId] = useState("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [isB2B, setIsB2B] = useState(false);
  const [vatNumber, setVatNumber] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoResult, setPromoResult] = useState<PromotionValidationResult | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [draftToken, setDraftToken] = useState("");
  const [draftPricing, setDraftPricing] = useState<DraftPricingSnapshot | null>(null);
  const [draftContractItems, setDraftContractItems] = useState<CartItem[] | null>(null);
  const [draftOriginalLines, setDraftOriginalLines] = useState<DraftCheckoutItem[]>([]);
  const [draftStockIssues, setDraftStockIssues] = useState<CheckoutStockIssue[]>([]);
  const [draftRetry, setDraftRetry] = useState(0);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [draftNotice, setDraftNotice] = useState("");
  const [draftNoShipping, setDraftNoShipping] = useState(false);
  const [pricingQuote, setPricingQuote] = useState<CheckoutPricingQuote | null>(null);
  const [pricingQuoteLoading, setPricingQuoteLoading] = useState(false);
  const [pricingQuoteError, setPricingQuoteError] = useState("");
  const [pricingQuoteRetry, setPricingQuoteRetry] = useState(0);
  const [pricingQuoteKey, setPricingQuoteKey] = useState("");
  const paymentGuardRef = useRef("");
  const paymentRequestKeyRef = useRef("");

  // États Mondial Relay
  const [relayPoints, setRelayPoints] = useState<RelayPoint[]>([]);
  const [relayLoading, setRelayLoading] = useState(false);
  const [relayError, setRelayError] = useState("");
  const [relayPointId, setRelayPointId] = useState("");
  const [relayPointName, setRelayPointName] = useState("");
  const [relayPointAddress, setRelayPointAddress] = useState("");
  const [relaySearchCp, setRelaySearchCp] = useState("");
  const [relaySearched, setRelaySearched] = useState(false);
  const [expandedRelayId, setExpandedRelayId] = useState<string | null>(null);

  // ─── PayPal Advanced Checkout v2 (popup SDK JS) ───────────────────────────
  const [paypalV2Config, setPaypalV2Config] = useState<{ v2Enabled: boolean; clientId: string; payLaterEnabled: boolean } | null>(null);
  const [paypalPayLaterDisplayEnabled, setPaypalPayLaterDisplayEnabled] = useState(false);
  const [paypalSdkLoaded, setPaypalSdkLoaded] = useState(false);
  const [paypalButtonsRendered, setPaypalButtonsRendered] = useState(false);
  const paypalContainerRef = (typeof window !== 'undefined' ? { current: null } : { current: null }) as React.MutableRefObject<HTMLDivElement | null>;
  const paypalButtonsRef = { current: null as unknown };

  const [form, setForm] = useState({
    email: "",
    newsletter: false,
    prenom: "",
    nom: "",
    adresse: "",
    complement: "",
    ville: "",
    codePostal: "",
    pays: "France",
    telephone: "",
  });

  const selectedShippingOption = useMemo(
    () => shippingOptions.find((option) => option.id === selectedShippingOptionId) || shippingOptions[0],
    [selectedShippingOptionId, shippingOptions],
  );
  const cartSignature = useMemo(() => getCartSignature(items), [items]);
  // Availability adjustments must never invalidate an administrator’s financial offer.
  const draftPricingActive = Boolean(draftPricing && draftContractItems && draftToken);
  const checkoutItems = draftPricingActive && draftContractItems ? draftContractItems : items;
  const draftCartChanged = Boolean(draftPricingActive && draftPricing?.cartSignature !== cartSignature);
  const shipping = draftPricingActive ? draftPricing?.shipping || 0 : selectedShippingOption?.price ?? 0;
  const countryCode = useMemo(() => getCountryCode(form.pays), [form.pays]);
  const hasValidCustomerEmail = useMemo(() => isValidCustomerEmail(form.email), [form.email]);
  const effectiveIsB2B = isB2B || isApprovedPro;
  const pricingQuoteCartItems = useMemo(() => items
    .filter((item) => !item.isCustomSale)
    .map((item) => ({
      productId: item.product.id,
      variantId: item.variantId || item.variant?.id || null,
      quantity: item.quantity,
    })), [items]);
  const retailSubtotalTTC = useMemo(() => {
    const rawSubtotalTTC = items.reduce((sum, item) => {
      const publicTtcPrice = item.isCustomSale
        ? item.customPriceTTC ?? item.product.price
        : typeof item.product.pricePublic === "number" ? item.product.pricePublic : item.product.price;
      return sum + publicTtcPrice * item.quantity;
    }, 0);
    return money(rawSubtotalTTC);
  }, [items]);
  const hasPricingQuote = !draftPricingActive && Boolean(pricingQuote);
  const hasProfessionalPricing = hasPricingQuote && effectiveIsB2B && pricingQuote?.pricingTier === "pro";
  const showProfessionalPriceBreakdown = draftPricingActive ? Boolean(draftPricing?.isB2B) : hasProfessionalPricing;
  const vatRate = draftPricingActive && draftPricing
    ? draftPricing.vatRate
    : pricingQuote?.vatRate ?? getEstimatedVatRate(countryCode, effectiveIsB2B, vatNumber);
  const subtotalHT = useMemo(() => {
    if (draftPricingActive && draftPricing) return draftPricing.totalHT;
    if (pricingQuote) return pricingQuote.subtotalHT;
    return money(retailSubtotalTTC / 1.2);
  }, [draftPricing, draftPricingActive, pricingQuote, retailSubtotalTTC]);
  const displaySubtotalTTC = draftPricingActive && draftPricing
    ? draftPricing.subtotal
    : pricingQuote?.subtotalTTC ?? retailSubtotalTTC;
  const shippingReferenceAmount = showProfessionalPriceBreakdown ? subtotalHT : displaySubtotalTTC;
  const vatAmount = useMemo(() => {
    if (draftPricingActive && draftPricing) return draftPricing.vatAmount;
    if (pricingQuote) return pricingQuote.vatAmount;
    return Math.round((subtotalHT * (vatRate / 100) + Number.EPSILON) * 100) / 100;
  }, [draftPricing, draftPricingActive, pricingQuote, subtotalHT, vatRate]);
  const merchandiseTotalTTC = draftPricingActive && draftPricing
    ? draftPricing.totalTTC
    : pricingQuote?.totalTTC ?? displaySubtotalTTC;
  const grandTotal = merchandiseTotalTTC + shipping;
  const promotionCartItems = useMemo(() => items.map((item) => {
    const publicTtcPrice = typeof item.product.pricePublic === "number" ? item.product.pricePublic : item.product.price;
    const quoteItem = getPricingQuoteItem(pricingQuote, item.product.id, item.variantId || item.variant?.id || null);
    return {
      productId: item.product.id,
      categoryId: typeof item.product.category === "string" ? item.product.category : null,
      quantity: item.quantity,
      price: hasProfessionalPricing
        ? quoteItem?.appliedUnitHT ?? publicTtcPrice / 1.2
        : quoteItem?.appliedUnitTTC ?? publicTtcPrice,
    };
  }), [hasProfessionalPricing, items, pricingQuote]);
  const promoDiscount = draftPricingActive ? 0 : promoResult?.valid ? Math.min(promoResult.discount || 0, grandTotal) : 0;
  const discountedGrandTotal = draftPricingActive && draftPricing ? draftPricing.totalTTC : Math.max(0, grandTotal - promoDiscount);
  const proThresholdHT = pricingQuote?.thresholdHT ?? 200;
  const proRemainingHT = pricingQuote?.remainingHT ?? proThresholdHT;
  const proProgressPercent = pricingQuote?.progressPercent ?? 0;
  const paymentPayload = useMemo(() => ({
    cartItems: checkoutItems.map((item) => item.isCustomSale
      ? { productId: null, variantId: null, quantity: item.quantity, isCustomItem: true, customName: item.customName || item.product.name, customPriceTTC: item.customPriceTTC ?? item.product.price, customVatRate: item.customVatRate ?? 20 }
      : { productId: item.product.id, variantId: item.variantId || item.variant?.id || null, quantity: item.quantity }),
    customerEmail: form.email,
    customerId: isAuthenticated && customer ? customer.id : undefined,
    cartSessionId,
    draftToken: draftToken || undefined,
    noShipping: draftNoShipping,
    shippingAddress: draftNoShipping
      ? { firstName: form.prenom || "Client", lastName: form.nom || "Barber Paradise", address: "Retrait en magasin", city: "Barber Paradise", postalCode: "00000", country: "FR" }
      : { firstName: form.prenom, lastName: form.nom, address: form.adresse, extension: form.complement, city: form.ville, postalCode: form.codePostal, country: countryCode, phone: form.telephone },
    paymentMethod,
    shippingOptionId: draftNoShipping ? undefined : selectedShippingOption?.id,
    isB2B: effectiveIsB2B,
    vatNumber: vatNumber.trim() || undefined,
    promoCode: draftPricingActive ? undefined : promoCode.trim() || undefined,
    relayPointId: draftNoShipping ? undefined : (relayPointId || undefined),
    relayPointName: draftNoShipping ? undefined : (relayPointName || undefined),
    relayPointAddress: draftNoShipping ? undefined : (relayPointAddress || undefined),
  }), [checkoutItems, form, isAuthenticated, customer, cartSessionId, draftToken, draftNoShipping, countryCode, paymentMethod, selectedShippingOption?.id, effectiveIsB2B, vatNumber, draftPricingActive, promoCode, relayPointId, relayPointName, relayPointAddress]);
  const feeRequestKey = JSON.stringify([paymentPayload, discountedGrandTotal, shipping, promoResult]);
  const feeQuote = hasExplicitPaymentSelection ? feeQuoteState?.quote : null;
  const paymentFeeTTC = feeQuote?.paymentFeeTTC ?? 0;
  const paymentBaseTTC = feeQuote?.baseTotalTTC ?? discountedGrandTotal;
  const totalWithPaymentFeeTTC = feeQuote?.totalTTC ?? discountedGrandTotal;
  const selectedPaymentSurchargePercent = feeQuote?.paymentFeePercent ?? 0;
  const pricingRequestKey = JSON.stringify([pricingQuoteCartItems, isApprovedPro]);
  const quoteStockIssues = (pricingQuote as (CheckoutPricingQuote & { stockIssues?: CheckoutStockIssue[] }) | null)?.stockIssues || [];
  const stockIssues = draftPricingActive ? draftStockIssues : [...quoteStockIssues, ...(feeQuote?.stockIssues || [])];
  const cartStockBlocked = !draftPricingActive && stockAdjustments.some((adjustment) => adjustment.blocked && !items.find((item) => item.product.id === adjustment.productId && (item.variantId || item.variant?.id || null) === (adjustment.variantId || null))?.isCustomSale);
  const stockPaymentBlocked = stockIssues.length > 0 || draftCartChanged || cartStockBlocked;
  const paymentGuardMessage = draftLoading || (requestedDraftToken && (!draftPricingActive || draftError))
    ? "Le brouillon doit être chargé et vérifié avant paiement."
    : stockPaymentBlocked
    ? draftPricingActive ? DRAFT_STOCK_NOTICE : "Certains articles dépassent le stock disponible. Corrigez votre panier et revérifiez les prix avant de payer."
    : !hasExplicitPaymentSelection ? "Choisissez votre moyen de paiement pour obtenir le total exact."
    : feeQuoteLoading || !feeQuoteState || feeQuoteState.key !== feeRequestKey || feeQuoteError ? "Vérifiez les frais de paiement avant de payer."
    : !draftPricingActive && (pricingQuoteLoading || pricingQuoteError || pricingQuoteKey !== pricingRequestKey) ? "Vérifiez les prix et les stocks avant de payer."
    : methodsLoading || shippingLoading || !displayMethodAvailable() ? "Vérifiez le moyen de paiement et la livraison."
    : "";
  function displayMethodAvailable() {
    return availableMethods.includes(paymentMethod) && !(effectiveIsB2B && paymentMethod === "sepa") && !(paymentMethod === "paypal_4x" && discountedGrandTotal < 30) && (draftPricingActive || Boolean(selectedShippingOption));
  }
  paymentGuardRef.current = paymentGuardMessage;
  paymentRequestKeyRef.current = feeRequestKey;

  function getLineStockIssue(item: CartItem) {
    const variantId = item.variantId || item.variant?.id || null;
    const issue = getCheckoutStockIssue(stockIssues, item.product.id, variantId);
    const adjustment = !draftPricingActive ? stockAdjustments.find((candidate) => checkoutLineKey(candidate.productId, candidate.variantId) === checkoutLineKey(item.product.id, variantId)) : undefined;
    return issue || (adjustment ? { productId: adjustment.productId, variantId: adjustment.variantId, requestedQuantity: adjustment.requestedQuantity, availableStock: adjustment.availableStock, message: adjustment.message } : undefined);
  }
  function getDraftLineTotal(item: CartItem): number {
    const original = draftOriginalLines.find((line) => checkoutLineKey(line.productId || line.id, line.variantId) === checkoutLineKey(item.product.id, item.variantId || item.variant?.id));
    return original?.discountedLineTotal ?? (original ? money(Math.max(0, original.price * original.quantity - (original.discountAmount || 0))) : money(item.product.price * item.quantity));
  }

  const displayMethods = useMemo(
    () => availableMethods.filter((method) => {
      if (effectiveIsB2B && method === "sepa") return false;
      // PayPal 4x : minimum 30€ requis (PayPal Pay Later)
      if (method === "paypal_4x" && discountedGrandTotal < 30) return false;
      return method !== "apple_pay" || supportsApplePay();
    }),
    [availableMethods, effectiveIsB2B, discountedGrandTotal],
  );

  // Si le brouillon est noShipping, on saute l'étape livraison
  const checkoutSteps: Step[] = draftNoShipping
    ? (isAuthenticated ? ["paiement"] : ["contact", "paiement"])
    : (isAuthenticated ? ["livraison", "paiement"] : ["contact", "livraison", "paiement"]);

  // Détecter si Mondial Relay est sélectionné
  const isMondialRelay = useMemo(() => {
    if (!selectedShippingOption) return false;
    const raw = [selectedShippingOption.carrier, selectedShippingOption.label, selectedShippingOption.id].join(" ").toLowerCase();
    return raw.includes("mondial");
  }, [selectedShippingOption]);

  // Réinitialiser le point relais quand on change de transporteur
  useEffect(() => {
    if (!isMondialRelay) {
      setRelayPointId("");
      setRelayPointName("");
      setRelayPointAddress("");
      setRelayPoints([]);
      setRelaySearched(false);
      setRelayError("");
    }
  }, [isMondialRelay]);

  // Pré-remplir le CP de recherche avec le CP de l'adresse de livraison
  useEffect(() => {
    if (isMondialRelay && form.codePostal && !relaySearchCp) {
      setRelaySearchCp(form.codePostal);
    }
  }, [isMondialRelay, form.codePostal, relaySearchCp]);

  const searchRelayPoints = async (cp: string) => {
    const cleanCp = cp.trim();
    if (cleanCp.length < 4) {
      setRelayError("Veuillez saisir un code postal valide (min. 4 chiffres)");
      return;
    }
    setRelayLoading(true);
    setRelayError("");
    setRelaySearched(false);
    try {
      const params = new URLSearchParams({ cp: cleanCp, country: countryCode, nb: "10" });
      const res = await fetch(`${API_URL}/api/mondialrelay/points?${params.toString()}`);
      const data = await res.json() as { points?: RelayPoint[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Impossible de récupérer les points relais");
      setRelayPoints(data.points || []);
      setRelaySearched(true);
      if ((data.points || []).length === 0) setRelayError("Aucun point relais trouvé pour ce code postal");
    } catch (err) {
      setRelayError(err instanceof Error ? err.message : "Erreur lors de la recherche des points relais");
      setRelayPoints([]);
    } finally {
      setRelayLoading(false);
    }
  };

  useEffect(() => {
    const token = requestedDraftToken;
    if (!token) return;

    const controller = new AbortController();
    setDraftToken(token);
    setDraftLoading(true);
    setDraftError("");
    setDraftNotice("");

    async function loadSharedDraft() {
      try {
        const data = await withCheckoutTimeout(async (signal) => {
          const res = await fetch(`${API_URL}/api/checkout/draft/${encodeURIComponent(token)}`, { signal });
          const result = (await res.json()) as DraftCheckoutResponse;
          if (!res.ok || !result.draft) throw new Error(result.error || "Impossible de charger la commande préparée");
          return result;
        }, { signal: controller.signal, timeoutMessage: "Le chargement du brouillon a pris trop de temps. Réessayez ; l’offre déjà chargée est conservée." });
        if (controller.signal.aborted || !data.draft) return;

        const nextItems: CartItem[] = data.draft.items.map((item) => {
          const images = item.images?.length ? item.images : item.image ? [item.image] : [];
          const discountedUnitPrice = item.quantity > 0 && typeof item.discountedLineTotal === "number"
            ? money(item.discountedLineTotal / item.quantity)
            : item.quantity > 0 && item.discountAmount
              ? money(Math.max(0, item.price * item.quantity - item.discountAmount) / item.quantity)
              : item.price;
          // Pour les brouillons B2B, item.price est stocké en HT par le backend.
          // hasPriceProEur=true indique au calcul frontend d'utiliser le prix tel quel (HT)
          // sans diviser par 1.2 — évite la double division qui causait un sous-total -20%.
          const product: Product = {
            id: item.productId || item.id,
            handle: item.slug || item.productId || item.id,
            name: item.name,
            slug: item.slug || item.productId || item.id,
            brand: item.brand || "Barber Paradise",
            category: "",
            subcategory: "",
            subsubcategory: "",
            price: discountedUnitPrice,
            pricePublic: discountedUnitPrice,
            hasPriceProEur: Boolean(data.draft?.isB2B), // true = price est déjà en HT, pas de division supplémentaire
            originalPrice: null,
            images,
            description: "",
            shortDescription: "",
            features: [],
            inStock: item.inStock ?? (item.availableStock == null || item.availableStock > 0),
            stockCount: item.availableStock ?? item.realStockCount ?? item.stockCount ?? item.quantity,
            rating: 0,
            reviewCount: 0,
            isNew: false,
            isPromo: false,
            tags: [],
            status: "active",
            createdAt: "",
            updatedAt: "",
            variants: item.variants || [],
          };
          const variant = item.variantId ? product.variants?.find((candidate) => candidate.id === item.variantId) || null : null;
          return {
            product,
            quantity: item.quantity,
            variantId: item.variantId ?? null,
            variant,
            isCustomSale: Boolean(item.isCustomSale),
            customName: item.isCustomSale ? item.name : undefined,
            customPriceTTC: item.isCustomSale ? item.price : undefined,
            customVatRate: undefined, // non exposé par la route GET draft, on laisse le backend utiliser 20% par défaut
            ...(Object.prototype.hasOwnProperty.call(item, "availableStock") ? { availableStock: item.availableStock } : {}),
          };
        });

        setDraftContractItems(nextItems);
        setDraftOriginalLines(data.draft.items);
        setDraftStockIssues(getDraftStockIssues(data.draft.items, data.draft.stockIssues));
        replaceItems(nextItems, { preserveDraftQuantities: true });
        const nextSignature = getCartSignature(nextItems);
        setDraftPricing({
          orderNumber: data.draft.orderNumber,
          subtotal: data.draft.subtotal ?? money(nextItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0)),
          shipping: data.draft.shipping ?? 0,
          total: data.draft.total ?? 0,
          totalHT: data.draft.totalHT ?? 0,
          vatRate: data.draft.vatRate ?? 20,
          vatAmount: data.draft.vatAmount ?? 0,
          totalTTC: data.draft.totalTTC ?? data.draft.total ?? 0,
          discountAmount: data.draft.discountAmount ?? 0,
          orderDiscountType: data.draft.orderDiscountType,
          orderDiscountValue: data.draft.orderDiscountValue,
          discountTotal: data.draft.discountTotal ?? 0,
          isB2B: Boolean(data.draft.isB2B),
          cartSignature: nextSignature,
        });
        setIsB2B(Boolean(data.draft.isB2B));
        setDraftNoShipping(Boolean(data.draft.noShipping));
        setPromoCode("");
        setPromoResult(null);
        setPromoError("");
        if (data.draft.email) {
          setForm((prev) => ({ ...prev, email: data.draft?.email || prev.email }));
          setGuestCheckout(true);
        }
        // Si pas de livraison, sauter directement à l'étape paiement pour les clients connectés
        if (data.draft.noShipping) {
          setStep("paiement");
        }
        setDraftNotice(`Commande préparée ${data.draft.orderNumber} chargée avec ses lignes, prix et remises figés. Pour modifier cette offre, demandez sa correction à Barber Paradise puis rechargez ce lien.`);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setDraftError(err instanceof Error ? err.message : "Lien de brouillon invalide ou expiré");
        }
      } finally {
        if (!controller.signal.aborted) setDraftLoading(false);
      }
    }

    loadSharedDraft();
    return () => controller.abort();
  }, [draftRetry, replaceItems, requestedDraftToken]);

  useEffect(() => {
    if ((requestedDraftToken && !draftError) || draftLoading || draftPricingActive || pricingQuoteCartItems.length === 0 || pricingQuoteCartItems.length !== items.length) {
      setPricingQuoteLoading(false);
      return;
    }
    const controller = new AbortController();
    setPricingQuoteLoading(true);
    setPricingQuoteError("");
    // Keep the last successful quote visible while updating, including on errors.
    withCheckoutTimeout((signal) => getCheckoutPricingQuote({ cartItems: pricingQuoteCartItems, isB2B: isApprovedPro, signal }), { signal: controller.signal })
      .then((quote) => {
        if (!controller.signal.aborted) {
          setPricingQuote(quote);
          setPricingQuoteKey(pricingRequestKey);
          reconcileStock(getPricingQuoteStockConstraints(quote));
        }
      }).catch((error) => {
        if (!controller.signal.aborted) setPricingQuoteError(error instanceof Error ? error.message : "Le calcul des prix est indisponible. Réessayez.");
      }).finally(() => {
        if (!controller.signal.aborted) setPricingQuoteLoading(false);
      });
    return () => controller.abort();
  }, [draftError, draftLoading, draftPricingActive, isApprovedPro, items.length, pricingQuoteCartItems, pricingQuoteRetry, pricingRequestKey, reconcileStock, requestedDraftToken]);

  useEffect(() => {
    if (!hasExplicitPaymentSelection || draftLoading || (requestedDraftToken && !draftPricingActive) || (!draftNoShipping && !selectedShippingOption) || pricingQuoteLoading || promoLoading || shippingLoading) {
      setFeeQuoteLoading(false);
      return;
    }
    const controller = new AbortController();
    setFeeQuoteLoading(true);
    setFeeQuoteError("");
    getCheckoutFeeQuote({ apiUrl: API_URL, payload: paymentPayload, customerToken: localStorage.getItem("bp_customer_token"), signal: controller.signal })
      .then((quote) => {
        if (controller.signal.aborted) return;
        setFeeQuoteState({ key: feeRequestKey, quote });
        if (!draftPricingActive && quote.items) reconcileStock(quote.items.filter((line) => line.productId && Object.prototype.hasOwnProperty.call(line, "availableStock")).map((line) => ({ productId: line.productId!, variantId: line.variantId, availableStock: line.availableStock ?? null })));
        // A draft shortage stays blocked until reloading an administrator-corrected offer.
        if (draftPricingActive && quote.stockIssues?.length) setDraftStockIssues((previous) => {
          const merged = new Map(previous.map((issue) => [checkoutLineKey(issue.productId, issue.variantId), issue]));
          for (const issue of quote.stockIssues || []) merged.set(checkoutLineKey(issue.productId, issue.variantId), issue);
          return Array.from(merged.values());
        });
      }).catch((error) => {
        if (!controller.signal.aborted) setFeeQuoteError(error instanceof Error ? error.message : "Les frais sont indisponibles. Réessayez.");
      }).finally(() => {
        if (!controller.signal.aborted) setFeeQuoteLoading(false);
      });
    return () => controller.abort();
  }, [hasExplicitPaymentSelection, draftLoading, requestedDraftToken, draftPricingActive, draftNoShipping, selectedShippingOption, pricingQuoteLoading, promoLoading, shippingLoading, feeRequestKey, feeQuoteRetry, paymentPayload, reconcileStock]);

  useEffect(() => {
    if (!methodsLoading && hasExplicitPaymentSelection && !availableMethods.includes(paymentMethod)) setHasExplicitPaymentSelection(false);
  }, [methodsLoading, availableMethods, hasExplicitPaymentSelection, paymentMethod]);

  useEffect(() => {
    if (customerLoading) return;
    if (isAuthenticated) {
      setStep(draftNoShipping ? "paiement" : "livraison");
      setGuestCheckout(false);
    } else if (!draftNoShipping) {
      setStep((current) => (current === "paiement" ? "livraison" : current));
    }
  }, [customerLoading, draftNoShipping, isAuthenticated]);

  // Garde-fou contre toute transition asynchrone (connexion ou profil)
  // qui tenterait de réafficher la livraison pour un retrait en boutique.
  useEffect(() => {
    if (draftNoShipping && step === "livraison") setStep("paiement");
  }, [draftNoShipping, step]);

  useEffect(() => {
    if (!customer) return;

    setForm((prev) => ({
      ...prev,
      email: customer.email || prev.email,
      prenom: customer.firstName || prev.prenom,
      nom: customer.lastName || prev.nom,
      telephone: customer.phone || prev.telephone,
    }));
  }, [customer]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    async function loadDefaultAddress() {
      try {
        const addresses = await getCustomerAddresses();
        const selectedAddress: CustomerAddress | undefined = addresses.find((address) => address.isDefault) || addresses[0];
        if (!selectedAddress || cancelled) return;
        setForm((prev) => ({
          ...prev,
          prenom: selectedAddress.firstName || prev.prenom,
          nom: selectedAddress.lastName || prev.nom,
          adresse: selectedAddress.address || prev.adresse,
          complement: selectedAddress.extension || prev.complement,
          ville: selectedAddress.city || prev.ville,
          codePostal: selectedAddress.postalCode || prev.codePostal,
          pays: selectedAddress.country || prev.pays,
          telephone: selectedAddress.phone || prev.telephone,
        }));
      } catch {
        // Le tunnel reste utilisable même si les adresses enregistrées ne peuvent pas être chargées.
      }
    }

    loadDefaultAddress();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (isApprovedPro) setIsB2B(true);
  }, [isApprovedPro]);

  // Charger la config PayPal v2 au montage
  useEffect(() => {
    fetch(`${API_URL}/api/checkout/paypal/v2/config`)
      .then((r) => r.json())
      .then((data: { v2Enabled?: boolean; clientId?: string; payLaterEnabled?: boolean }) => {
        // Display the server flag independently, without changing the SDK/payment configuration.
        setPaypalPayLaterDisplayEnabled(Boolean(data.payLaterEnabled));
        if (data.v2Enabled && data.clientId) {
          setPaypalV2Config({ v2Enabled: true, clientId: data.clientId, payLaterEnabled: Boolean(data.payLaterEnabled) });
        } else {
          setPaypalV2Config({ v2Enabled: false, clientId: "", payLaterEnabled: false });
        }
      })
      .catch(() => setPaypalV2Config({ v2Enabled: false, clientId: "", payLaterEnabled: false }));
  }, []);

  // Charger le SDK PayPal JS quand la config est disponible et que la méthode est PayPal
  useEffect(() => {
    if (!hasExplicitPaymentSelection || (paymentMethod !== "paypal" && paymentMethod !== "paypal_4x") || !paypalV2Config?.v2Enabled || !paypalV2Config.clientId) return;
    if (paypalSdkLoaded) return;
    if (typeof window === "undefined") return;

    const existing = document.getElementById("paypal-sdk-script");
    if (existing) { setPaypalSdkLoaded(true); return; }

    const components = "buttons";
    const enableFunding = paypalV2Config.payLaterEnabled ? "paylater" : "";
    const src = `https://www.paypal.com/sdk/js?client-id=${paypalV2Config.clientId}&currency=EUR&components=${components}${enableFunding ? `&enable-funding=${enableFunding}` : ""}`;

    const script = document.createElement("script");
    script.id = "paypal-sdk-script";
    script.src = src;
    script.async = true;
    script.onload = () => setPaypalSdkLoaded(true);
    script.onerror = () => console.error("[PayPal SDK] Échec du chargement");
    document.head.appendChild(script);
  }, [hasExplicitPaymentSelection, paymentMethod, paypalV2Config, paypalSdkLoaded]);

  // Rendre les Smart Buttons quand le SDK est chargé et la méthode PayPal est sélectionnée
  useEffect(() => {
    const isPaypalMethod = paymentMethod === "paypal" || paymentMethod === "paypal_4x";
    if (!hasExplicitPaymentSelection || paymentGuardMessage || !paypalV2Config?.v2Enabled || !paypalSdkLoaded || !isPaypalMethod || step !== "paiement") return;

    const container = document.getElementById("paypal-button-container");
    if (!container) return;

    // Nettoyer les boutons précédents
    container.innerHTML = "";
    setPaypalButtonsRendered(false);

    const win = window as unknown as { paypal?: { Buttons?: (opts: unknown) => { render: (el: HTMLElement) => Promise<void>; close?: () => void } } };
    if (!win.paypal?.Buttons) return;

    const buildPayload = () => ({ ...paymentPayload, expectedTotalTTC: feeQuote?.totalTTC });

    const buttons = win.paypal.Buttons({
      fundingSource: paymentMethod === "paypal_4x" ? "paylater" : "paypal",
      style: { layout: "vertical", color: "black", shape: "rect", label: "pay", height: 48 },
      createOrder: async () => {
        setPaymentError("");
        if (paymentGuardRef.current || paymentRequestKeyRef.current !== feeRequestKey) {
          const message = paymentGuardRef.current || "Le devis de paiement a changé. Vérifiez à nouveau le total.";
          setPaymentError(message);
          throw new Error(message);
        }
        if (!isValidCustomerEmail(form.email)) {
          const error = new Error("Veuillez renseigner une adresse e-mail valide avant de procéder au paiement.");
          setPaymentError(error.message);
          throw error;
        }
        setIsSubmittingPayment(true);
        try {
          const res = await fetch(`${API_URL}/api/checkout/paypal/v2/create-order`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildPayload()) });
          const data = await res.json() as { paypalOrderId?: string; orderId?: string; error?: string; code?: string; stockIssues?: CheckoutStockIssue[] };
          if (!res.ok) {
            recordPaymentRevalidationError(data);
            if (data.code === "PAYMENT_QUOTE_CHANGED" || data.code === "PRICE_CHANGED" || data.code === "QUOTE_CHANGED") {
              throw new Error(PAYMENT_AMOUNT_UPDATED_MESSAGE);
            }
            if (data.code === "PAYPAL_4X_INELIGIBLE") {
              setPaymentMethod("paypal");
              setPaymentError("Le paiement en 4 fois n'est pas disponible pour cette transaction. Vous avez été redirigé vers le paiement standard.");
              setIsSubmittingPayment(false);
              throw new Error("Le paiement en 4 fois n'est pas disponible pour cette transaction. Choisissez le paiement standard ou un autre moyen de paiement.");
            }
            throw new Error(data.error || "Impossible d'initialiser le paiement");
          }
          if (!data.paypalOrderId) throw new Error("ID de commande PayPal manquant");
          // Stocker l'orderId pour la capture
          sessionStorage.setItem("paypal-v2-order-id", data.orderId || "");
          return data.paypalOrderId;
        } catch (err) {
          setPaymentError(err instanceof Error ? err.message : "Erreur initialisation paiement");
          setIsSubmittingPayment(false);
          throw err;
        }
      },
      onApprove: async (approveData: { orderID: string }) => {
        const orderId = sessionStorage.getItem("paypal-v2-order-id") || "";
        try {
          const res = await fetch(`${API_URL}/api/checkout/paypal/v2/capture-order`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paypalOrderId: approveData.orderID, orderId }) });
          const data = await res.json() as { success?: boolean; orderId?: string; error?: string };
          if (!res.ok || !data.success) throw new Error(data.error || "Capture échouée");
          sessionStorage.removeItem("paypal-v2-order-id");
          window.location.href = `/commande/succes?orderId=${data.orderId || orderId}`;
        } catch (err) {
          setPaymentError(err instanceof Error ? err.message : "Erreur lors de la confirmation du paiement");
          setIsSubmittingPayment(false);
        }
      },
      onCancel: () => {
        sessionStorage.removeItem("paypal-v2-order-id");
        setIsSubmittingPayment(false);
        setPaymentError("Paiement annulé. Vous pouvez réessayer ou choisir un autre moyen de paiement.");
      },
      onError: (err: unknown) => {
        console.error("[PayPal SDK] Erreur:", err);
        sessionStorage.removeItem("paypal-v2-order-id");
        setIsSubmittingPayment(false);
        setPaymentError("Une erreur est survenue lors du paiement. Veuillez réessayer.");
      },
    });

    buttons.render(container).then(() => setPaypalButtonsRendered(true)).catch((err: unknown) => {
      console.error("[PayPal SDK] Erreur rendu boutons:", err);
    });

    return () => { container.innerHTML = ""; setPaypalButtonsRendered(false); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paypalV2Config, paypalSdkLoaded, paymentMethod, step, hasExplicitPaymentSelection, paymentGuardMessage, paymentPayload, feeRequestKey, totalWithPaymentFeeTTC]);

  useEffect(() => {
    setPromoCode(window.localStorage.getItem("barberparadise-promo-code") || "");
  }, []);

  useEffect(() => {
    const normalized = promoCode.trim().toUpperCase();
    if (draftPricingActive || !normalized || items.length === 0) {
      setPromoResult(null);
      setPromoError("");
      return;
    }

    let cancelled = false;
    setPromoLoading(true);
    setPromoError("");
    validatePromotionCode({
      code: normalized,
      cartTotal: shippingReferenceAmount,
      cartItems: promotionCartItems,
      customerType: effectiveIsB2B ? "b2b" : "b2c",
      shipping,
    }).then((result) => {
      if (cancelled) return;
      setPromoResult(result);
      setPromoError(result.valid ? "" : (result.message || "Ce code promo n’est plus applicable."));
    }).catch((error) => {
      if (cancelled) return;
      setPromoResult(null);
      setPromoError(error instanceof Error ? error.message : "Impossible de vérifier le code promo.");
    }).finally(() => {
      if (!cancelled) setPromoLoading(false);
    });

    return () => { cancelled = true; };
  }, [draftPricingActive, effectiveIsB2B, items.length, promoCode, promotionCartItems, shipping, shippingReferenceAmount]);

  useEffect(() => {
    if (!cartSessionId || !hasValidCustomerEmail || items.length === 0) return;
    const controller = new AbortController();
    const customerToken = localStorage.getItem("bp_customer_token");

    fetch(`${API_URL}/api/checkout/cart-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(customerToken ? { Authorization: `Bearer ${customerToken}` } : {}),
      },
      body: JSON.stringify({
        sessionId: cartSessionId,
        email: form.email,
        // CartContext owns the full snapshot (including variant IDs).
        // This request only enriches identity and must never replace those lines.
      }),
      signal: controller.signal,
    }).catch(() => {
      // Le suivi des paniers abandonnés reste non bloquant pour le tunnel de commande.
    });

    return () => controller.abort();
  }, [cartSessionId, form.email, hasValidCustomerEmail, items]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadMethods() {
      setMethodsLoading(true);
      setPaymentError("");
      try {
        const params = new URLSearchParams({ country: countryCode, isB2B: String(effectiveIsB2B), isPro: String(isApprovedPro) });
        const res = await fetch(`${API_URL}/api/checkout/available-methods?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as { methods?: PaymentMethod[]; surcharges?: Partial<Record<"card" | "paypal", number>>; error?: string };
        if (!res.ok) throw new Error(data.error || "Impossible de récupérer les moyens de paiement");
        const methods = data.methods || [];
        setAvailableMethods(methods);
        setB2BSurchargePercents(data.surcharges || {});
        setPaymentMethod((current) => (methods.includes(current) ? current : methods[0] || "card"));
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setAvailableMethods([]);
          setB2BSurchargePercents({});
          setPaymentError(err instanceof Error ? err.message : "Erreur lors du chargement des moyens de paiement");
        }
      } finally {
        if (!controller.signal.aborted) setMethodsLoading(false);
      }
    }
    loadMethods();
    return () => controller.abort();
  }, [countryCode, effectiveIsB2B, isApprovedPro]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadShippingOptions() {
      setShippingLoading(true);
      setShippingError("");
      try {
        const params = new URLSearchParams({ country: countryCode, total: String(shippingReferenceAmount), isB2B: String(effectiveIsB2B), isPro: String(isApprovedPro) });
        const res = await fetch(`${API_URL}/api/checkout/shipping-options?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as { options?: ShippingOption[]; error?: string };
        if (!res.ok) throw new Error(data.error || "Impossible de récupérer les options de livraison");
        const options = data.options || [];
        setShippingOptions(options);
        setSelectedShippingOptionId((current) => (options.some((option) => option.id === current) ? current : options[0]?.id || ""));
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setShippingOptions([]);
          setShippingError(err instanceof Error ? err.message : "Erreur lors du chargement de la livraison");
        }
      } finally {
        if (!controller.signal.aborted) setShippingLoading(false);
      }
    }
    loadShippingOptions();
    return () => controller.abort();
  }, [countryCode, shippingReferenceAmount, effectiveIsB2B, isApprovedPro]);

  const updateForm = (key: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    if (!effectiveIsB2B || countryCode === "FR") setVatNumber("");
  }, [countryCode, effectiveIsB2B]);

  function recordPaymentRevalidationError(data: { code?: string; error?: string; stockIssues?: CheckoutStockIssue[] }) {
    if (data.stockIssues?.length) {
      if (draftPricingActive) setDraftStockIssues((previous) => {
        const merged = new Map(previous.map((issue) => [checkoutLineKey(issue.productId, issue.variantId), issue]));
        for (const issue of data.stockIssues || []) merged.set(checkoutLineKey(issue.productId, issue.variantId), issue);
        return Array.from(merged.values());
      });
      else reconcileStock(data.stockIssues.filter((issue) => issue.productId).map((issue) => ({ ...issue, productId: issue.productId! })));
    }
    // A canonical amount drift is never accepted implicitly or retried automatically.
    if (data.code === "PAYMENT_QUOTE_CHANGED" || data.code === "PRICE_CHANGED" || data.code === "QUOTE_CHANGED") setFeeQuoteError(PAYMENT_AMOUNT_UPDATED_MESSAGE);
  }

  const handleCheckout = async () => {
    setPaymentError("");
    if (paymentGuardRef.current) { setPaymentError(paymentGuardRef.current); return; }
    if (!hasValidCustomerEmail) {
      setPaymentError("Veuillez renseigner une adresse e-mail valide avant de procéder au paiement.");
      return;
    }
    setIsSubmittingPayment(true);

    try {
      const res = await fetch(`${API_URL}/api/checkout/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...paymentPayload, expectedTotalTTC: feeQuote?.totalTTC }),
      });

      const data = await res.json();
      if (!res.ok) {
        recordPaymentRevalidationError(data);
        if (data.code === "PAYMENT_QUOTE_CHANGED" || data.code === "PRICE_CHANGED" || data.code === "QUOTE_CHANGED") {
          throw new Error(PAYMENT_AMOUNT_UPDATED_MESSAGE);
        }
        if (data?.code === "VARIANT_SELECTION_REQUIRED") {
          setPaymentError(`${data.error || "Un article de votre panier est incomplet."} Retournez au panier pour retirer cet article puis ajoutez-le à nouveau depuis sa fiche produit avec une variante.`);
          return;
        }
        if (data?.code === "PAYPAL_4X_INELIGIBLE") {
          // PayPal 4x non éligible pour cette transaction — basculer vers PayPal standard et afficher un message clair
          setPaymentMethod("paypal");
          setPaymentError("Le paiement en 4 fois n'est pas disponible pour cette transaction. Vous avez été redirigé vers le paiement standard. Vous pouvez également choisir un autre moyen de paiement.");
          setIsSubmittingPayment(false);
          return;
        }
        throw new Error(data?.error || "Impossible d'initialiser le paiement");
      }
      if (!data.checkoutUrl) throw new Error("URL de paiement indisponible");

      window.location.href = data.checkoutUrl;
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Erreur paiement inconnue");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  if (draftLoading) {
    return (
      <div className="bg-[#131313] min-h-screen text-[#e5e2e1] flex flex-col items-center justify-center px-4 py-32">
        <ShoppingBag size={48} className="text-[#ff4a8d] mb-8 animate-pulse" />
        <h1 className="text-3xl font-black tracking-tighter italic uppercase mb-4">Chargement de votre commande</h1>
        <p className="text-sm text-gray-500 text-center max-w-md">Nous récupérons le brouillon préparé par Barber Paradise pour remplir votre panier.</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-[#131313] min-h-screen text-[#e5e2e1] flex flex-col items-center justify-center px-4 py-32">
        <ShoppingBag size={48} className="text-gray-700 mb-8" />
        <h1 className="text-3xl font-black tracking-tighter italic uppercase mb-4">Votre panier est vide</h1>
        {draftError && <div className="text-sm text-red-300 text-center max-w-md mb-6"><p>{draftError}</p><button type="button" onClick={() => setDraftRetry((value) => value + 1)} className="mt-3 underline">Réessayer le chargement</button></div>}
        <Link href="/catalogue" className="bg-[#ff4a8d] text-white px-8 py-4 text-xs font-black tracking-widest uppercase hover:bg-[#ff1f70] transition-colors">
          EXPLORER LE CATALOGUE
        </Link>
      </div>
    );
  }

  const inputClass = "w-full bg-transparent border-0 border-b border-white/10 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#ff4a8d] transition-colors";
  const labelClass = "block text-[10px] font-black tracking-[0.3em] uppercase text-gray-500 mb-2";

  return (
    <div className="bg-[#131313] min-h-screen text-[#e5e2e1]">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-10 grid lg:grid-cols-2 gap-16">
        <div>
          <div className="flex items-center justify-between mb-10">
            <Link href="/" className="text-xl font-black italic tracking-tighter uppercase">BARBER PARADISE</Link>
            <Link href="/panier" className="flex items-center gap-2 text-xs font-black tracking-widest uppercase text-gray-500 hover:text-white transition-colors">
              <ArrowLeft size={12} />PANIER
            </Link>
          </div>

          {draftNotice && (
            <div className="mb-8 border border-emerald-400/20 bg-emerald-400/10 px-5 py-4 text-sm text-emerald-100">
              {draftNotice}
            </div>
          )}
          {draftError && (
            <div className="mb-8 border border-red-400/20 bg-red-400/10 px-5 py-4 text-sm text-red-100">
              {draftError}
              <button type="button" onClick={() => setDraftRetry((value) => value + 1)} className="ml-3 underline">Réessayer le chargement</button>
            </div>
          )}
          {stockPaymentBlocked && (
            <div role="alert" className="mb-8 border border-amber-400/30 bg-amber-400/10 px-5 py-4 text-sm text-amber-100">
              {draftPricingActive ? DRAFT_STOCK_NOTICE : "Le stock de certains articles est insuffisant : vérifiez les lignes de votre panier. Aucun paiement partiel ne sera lancé."}
              {draftPricingActive ? <button type="button" onClick={() => setDraftRetry((value) => value + 1)} className="mt-3 block underline">Recharger l’offre corrigée</button> : <Link href="/panier" className="mt-3 block underline">Corriger le panier</Link>}
            </div>
          )}
          {!draftPricingActive && pricingQuoteError && (
            <div role="alert" className="mb-8 border border-amber-400/30 p-4 text-sm text-amber-100">
              {pricingQuote ? "Derniers prix conservés, paiement suspendu. " : "Prix non vérifiés, paiement suspendu. "}{pricingQuoteError}
              <button type="button" onClick={() => setPricingQuoteRetry((value) => value + 1)} className="ml-3 underline">Réessayer le calcul</button>
            </div>
          )}
          {isApprovedPro && !draftPricingActive && (
            <div className={`mb-8 border p-5 ${hasProfessionalPricing ? "border-emerald-400/30 bg-emerald-400/10" : "border-[#ff4a8d]/40 bg-[#ff4a8d]/10"}`}>
              <div className="flex items-center justify-between gap-4">
                <p className={`text-xs font-black uppercase tracking-[0.18em] ${hasProfessionalPricing ? "text-emerald-300" : "text-[#ff4a8d]"}`}>
                  Tarif pro dès {formatPrice(proThresholdHT)} HT
                </p>
                <span className="text-[10px] font-black text-gray-300">{pricingQuote ? `${Math.min(100, Math.max(0, proProgressPercent))}%` : pricingQuoteLoading ? "Calcul..." : "À vérifier"}</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden bg-white/10" aria-label={pricingQuote ? `Progression vers le tarif professionnel : ${Math.min(100, Math.max(0, proProgressPercent))}%` : "Calcul de la progression vers le tarif professionnel"}>
                <div className={`h-full transition-all ${hasProfessionalPricing ? "bg-emerald-400" : "bg-[#ff4a8d]"}`} style={{ width: `${Math.min(100, Math.max(0, proProgressPercent))}%` }} />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-gray-300">
                {pricingQuote && hasProfessionalPricing
                  ? "Les articles éligibles sont au prix pro HT ; les articles sans prix pro restent au tarif public TTC."
                  : pricingQuote
                    ? `Votre panier est payable au prix public TTC. Ajoutez encore ${formatPrice(proRemainingHT)} HT d’articles éligibles pour bénéficier des prix pro.`
                    : "Les prix et le stock doivent être vérifiés avant paiement. Aucun tarif professionnel n’est abandonné en cas d’erreur de calcul."}
              </p>
              {pricingQuoteLoading && <p className="mt-3 text-[10px] uppercase tracking-widest text-gray-500">Mise à jour de votre tarification...</p>}

            </div>
          )}

          <button onClick={() => setOrderSummaryOpen(!orderSummaryOpen)} className="lg:hidden w-full flex items-center justify-between bg-[#1c1b1b] px-5 py-4 mb-8">
            <div className="flex items-center gap-3"><ShoppingBag size={16} className="text-[#ff4a8d]" /><span className="text-xs font-black tracking-widest uppercase">{orderSummaryOpen ? "MASQUER" : "VOIR"} LE RÉCAPITULATIF</span></div>
            <div className="flex items-center gap-3"><span className="font-black">{formatPrice(totalWithPaymentFeeTTC)}</span><ChevronDown size={14} className={`transition-transform ${orderSummaryOpen ? "rotate-180" : ""}`} /></div>
          </button>

          {orderSummaryOpen && (
            <div className="lg:hidden bg-[#1c1b1b] p-5 mb-8 space-y-4">
              {checkoutItems.map((item) => {
                const img = getVariantImage(item.product, item.variant);
                const quoteItem = getPricingQuoteItem(pricingQuote, item.product.id, item.variantId || item.variant?.id || null);
                const publicUnitTTC = item.isCustomSale
                  ? item.customPriceTTC ?? item.product.price
                  : typeof item.product.pricePublic === "number" ? item.product.pricePublic : item.product.price;
                const usesDraftPrice = draftPricingActive;
                const usesProfessionalPrice = hasProfessionalPricing && quoteItem?.priceSource === "pro";
                const displayedLineTotal = usesDraftPrice ? getDraftLineTotal(item) : (usesProfessionalPrice ? quoteItem.appliedUnitHT : quoteItem?.appliedUnitTTC ?? publicUnitTTC) * item.quantity;
                const lineStockIssue = getLineStockIssue(item);
                const displayedQuantity = getAvailableDisplayQuantity(item.quantity, lineStockIssue);
                const linePriceLabel = usesDraftPrice ? "Prix brouillon" : usesProfessionalPrice ? "Prix pro HT" : "Public TTC";
                const lineTaxLabel = usesDraftPrice ? draftPricing?.isB2B ? "HT" : "TTC" : usesProfessionalPrice ? "HT" : "TTC";
                return (
                  <div key={`${item.product.id}-${item.variantId || item.variant?.id || "product"}`} className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-[#2a2a2a] flex-shrink-0 relative">{img && <Image src={img} alt={item.product.name} fill className="object-contain p-1" />}<span className="absolute -top-2 -right-2 w-5 h-5 bg-[#ff4a8d] text-white text-[10px] font-black flex items-center justify-center">{displayedQuantity}</span></div>
                    <div className="flex-1 min-w-0"><p className="text-xs font-black truncate">{item.product.name}</p><p className={`mt-1 text-[9px] font-black uppercase tracking-widest ${usesProfessionalPrice ? "text-emerald-300" : "text-gray-500"}`}>{linePriceLabel}</p>{lineStockIssue && <p role="alert" className="mt-2 text-[10px] text-amber-200">{!usesDraftPrice && lineStockIssue.message ? lineStockIssue.message : stockIssueMessage(lineStockIssue, usesDraftPrice)}</p>}</div>
                    <div className="text-right"><span className="block text-xs font-black">{formatPrice(displayedLineTotal)}</span><span className="mt-1 block text-[9px] uppercase tracking-widest text-gray-500">{lineTaxLabel}</span></div>
                  </div>
                );
              })}
              <div className="border-t border-white/5 pt-4 space-y-3">
                {showProfessionalPriceBreakdown ? (
                  <>
                    <div className="flex justify-between"><span className="text-xs uppercase tracking-widest text-gray-400">Sous-total HT</span><span className="font-black">{formatPrice(subtotalHT)}</span></div>
                    <div className="flex justify-between"><span className="text-xs uppercase tracking-widest text-gray-400">TVA ({vatRate}%)</span><span className="font-black">{formatPrice(vatAmount)}</span></div>
                    <div className="flex justify-between"><span className="text-xs uppercase tracking-widest text-gray-400">{draftNoShipping ? "Retrait" : "Livraison"}</span>{draftNoShipping ? <span className="text-xs font-black text-amber-400 uppercase tracking-widest">{PICKUP_LOCATION_LABEL}</span> : (shipping === 0 ? <span className="text-xs font-black text-green-400 uppercase tracking-widest">GRATUITE</span> : <span className="font-black">{formatPrice(shipping)}</span>)}</div>
                    {promoDiscount > 0 && <div className="flex justify-between text-emerald-300"><span className="text-xs uppercase tracking-widest">Remise</span><span className="font-black">-{formatPrice(promoDiscount)}</span></div>}
                    {hasExplicitPaymentSelection && <div className="flex justify-between"><span className="text-xs uppercase tracking-widest text-gray-400">Base TTC avant frais</span><span className="font-black">{formatPrice(paymentBaseTTC)}</span></div>}
                    {hasExplicitPaymentSelection && feeQuote && <div className="flex justify-between text-amber-300"><span className="text-xs uppercase tracking-widest">Frais de paiement ({selectedPaymentSurchargePercent}%)</span><span className="font-black">+{formatPrice(paymentFeeTTC)}</span></div>}
                    <div className="border-t border-white/5 pt-3 flex justify-between"><span className="text-xs font-black tracking-widest uppercase">TOTAL TTC</span><span className="font-black">{formatPrice(totalWithPaymentFeeTTC)}</span></div>
                  </>
                ) : (
                  <>
                    {draftNoShipping && <div className="flex justify-between"><span className="text-xs uppercase tracking-widest text-gray-400">Retrait</span><span className="text-xs font-black text-amber-400 uppercase tracking-widest">{PICKUP_LOCATION_LABEL}</span></div>}
                    {promoDiscount > 0 && <div className="flex justify-between text-emerald-300"><span className="text-xs uppercase tracking-widest">Remise</span><span className="font-black">-{formatPrice(promoDiscount)}</span></div>}
                    {hasExplicitPaymentSelection && <div className="flex justify-between"><span className="text-xs uppercase tracking-widest text-gray-400">Base TTC avant frais</span><span className="font-black">{formatPrice(paymentBaseTTC)}</span></div>}
                    {hasExplicitPaymentSelection && feeQuote && <div className="flex justify-between text-amber-300"><span className="text-xs uppercase tracking-widest">Frais de paiement ({selectedPaymentSurchargePercent}%)</span><span className="font-black">+{formatPrice(paymentFeeTTC)}</span></div>}
                    <div className="flex justify-between"><span className="text-xs uppercase tracking-widest text-gray-400">Total</span><span className="font-black">{formatPrice(totalWithPaymentFeeTTC)}</span></div>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 mb-10">
            {checkoutSteps.map((s, i) => (
              <div key={s} className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (s === "livraison" && step === "paiement") setStep(s);
                    if (s === "contact" && !isAuthenticated) setStep(s);
                  }}
                  className={`text-[10px] font-black tracking-[0.3em] uppercase transition-colors ${step === s ? "text-white" : "text-gray-600 hover:text-gray-400"}`}
                >
                  {s.toUpperCase()}
                </button>
                {i < checkoutSteps.length - 1 && <span className="text-gray-700 text-xs">›</span>}
              </div>
            ))}
          </div>

          {!isAuthenticated && step === "contact" && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-black tracking-tighter italic uppercase mb-4">Contact</h2>
                <p className="text-sm text-gray-500 leading-7 mb-6">Connectez-vous pour utiliser vos informations enregistrées, ou continuez en invité avec votre email et votre adresse de livraison.</p>
                <div className="grid gap-3 sm:grid-cols-2 mb-8">
                  <Link href="/connexion?redirect=/commande" className="flex items-center justify-center border border-[#ff4a8d] bg-[#ff4a8d] px-5 py-4 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-[#ff1f70]">
                    Se connecter
                  </Link>
                  <button type="button" onClick={() => setGuestCheckout(true)} className="border border-white/10 px-5 py-4 text-xs font-black uppercase tracking-widest text-white transition-colors hover:border-white/30">
                    Continuer en tant qu'invité
                  </button>
                </div>
                {guestCheckout && (
                  <div className="space-y-6">
                    <div><label className={labelClass}>Adresse email</label><input type="email" value={form.email} onChange={(e) => updateForm("email", e.target.value)} placeholder="votre@email.com" aria-invalid={form.email.length > 0 && !hasValidCustomerEmail} className={inputClass} />{form.email.length > 0 && !hasValidCustomerEmail && <p className="mt-2 text-xs text-red-300">Saisissez une adresse e-mail complète, par exemple client@exemple.fr.</p>}</div>
                    <p className="text-[11px] text-gray-500 leading-6">Un compte client pourra être créé automatiquement à partir de ces informations à la finalisation de la commande.</p>
                  </div>
                )}
              </div>
              <button onClick={() => setStep(draftNoShipping ? "paiement" : "livraison")} disabled={!guestCheckout || !hasValidCustomerEmail} className="w-full bg-[#ff4a8d] hover:bg-[#ff1f70] disabled:bg-white/5 disabled:text-gray-600 disabled:cursor-not-allowed text-white py-5 text-xs font-black tracking-widest uppercase transition-colors">{draftNoShipping ? "CONTINUER VERS LE PAIEMENT" : "CONTINUER VERS LA LIVRAISON"}</button>
            </div>
          )}

          {step === "livraison" && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-black tracking-tighter italic uppercase mb-6">Adresse de livraison</h2>
                <div className="space-y-6">
                  <div>
                    <label className={labelClass}>Pays</label>
                    <div className="relative">
                      <select value={form.pays} onChange={(e) => updateForm("pays", e.target.value)} className={`${inputClass} appearance-none pr-8`}>
                        <optgroup label="Europe">
                          <option value="France">France métropolitaine</option>
                          <option value="Belgique">Belgique</option>
                          <option value="Luxembourg">Luxembourg</option>
                          <option value="Pays-Bas">Pays-Bas</option>
                          <option value="Allemagne">Allemagne</option>
                          <option value="Espagne">Espagne</option>
                          <option value="Italie">Italie</option>
                          <option value="Portugal">Portugal</option>
                          <option value="Pologne">Pologne</option>
                          <option value="Suisse">Suisse</option>
                        </optgroup>
                        <optgroup label="DOM-TOM">
                          <option value="Guadeloupe">Guadeloupe (971)</option>
                          <option value="Martinique">Martinique (972)</option>
                          <option value="Guyane française">Guyane (973)</option>
                          <option value="La Réunion">La Réunion (974)</option>
                          <option value="Saint-Pierre-et-Miquelon">Saint-Pierre-et-Miquelon (975)</option>
                          <option value="Mayotte">Mayotte (976)</option>
                          <option value="Polynésie française">Polynésie française (987)</option>
                          <option value="Nouvelle-Calédonie">Nouvelle-Calédonie (988)</option>
                          <option value="Wallis-et-Futuna">Wallis-et-Futuna (986)</option>
                        </optgroup>
                        <optgroup label="Autres">
                          <option value="États-Unis">États-Unis</option>
                          <option value="Canada">Canada</option>
                          <option value="Maroc">Maroc</option>
                        </optgroup>
                      </select>
                      <ChevronDown size={14} className="absolute right-0 top-3.5 text-gray-500 pointer-events-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6"><div><label className={labelClass}>Prénom</label><input type="text" value={form.prenom} onChange={(e) => updateForm("prenom", e.target.value)} placeholder="Jean" className={inputClass} /></div><div><label className={labelClass}>Nom</label><input type="text" value={form.nom} onChange={(e) => updateForm("nom", e.target.value)} placeholder="Dupont" className={inputClass} /></div></div>
                  <div><label className={labelClass}>Adresse</label><input type="text" value={form.adresse} onChange={(e) => updateForm("adresse", e.target.value)} placeholder="12 rue de la Paix" className={inputClass} /></div>
                  <div><label className={labelClass}>Complément (optionnel)</label><input type="text" value={form.complement} onChange={(e) => updateForm("complement", e.target.value)} placeholder="Appartement, bâtiment..." className={inputClass} /></div>
                  <div className="grid grid-cols-2 gap-6"><div><label className={labelClass}>Code postal</label><input type="text" value={form.codePostal} onChange={(e) => updateForm("codePostal", e.target.value)} placeholder="75001" className={inputClass} /></div><div><label className={labelClass}>Ville</label><input type="text" value={form.ville} onChange={(e) => updateForm("ville", e.target.value)} placeholder="Paris" className={inputClass} /></div></div>
                  <div><label className={labelClass}>Téléphone</label><input type="tel" value={form.telephone} onChange={(e) => updateForm("telephone", e.target.value)} placeholder="+33 6 12 34 56 78" className={inputClass} /></div>

                  {effectiveIsB2B && countryCode !== "FR" && EU_COUNTRIES.includes(countryCode) && (
                    <div className="vat-number-field">
                      <label className={labelClass}>Numéro TVA intracommunautaire</label>
                      <input type="text" placeholder="FR12345678901" value={vatNumber} onChange={(e) => setVatNumber(e.target.value.toUpperCase())} className={inputClass} />
                      <p className="mt-2 text-[11px] leading-5 text-gray-500">Si vous disposez d'un numéro TVA valide, la TVA ne sera pas appliquée.</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-[10px] font-black tracking-[0.3em] uppercase text-gray-500">Mode de livraison</h3>
                {shippingLoading && <div className="border border-white/10 bg-[#1c1b1b] p-5 text-xs text-gray-500 uppercase tracking-widest">Calcul des options de livraison...</div>}
                {!shippingLoading && shippingError && <div className="border border-red-500/30 bg-red-500/10 p-5 text-xs text-red-200 leading-relaxed">{shippingError}</div>}
                {!shippingLoading && !shippingError && shippingOptions.map((option) => {
                  const active = selectedShippingOptionId === option.id;
                  return (
                    <button key={option.id} type="button" onClick={() => setSelectedShippingOptionId(option.id)} className={`w-full border p-5 text-left transition-colors ${active ? "border-[#ff4a8d] bg-[#ff4a8d]/10" : "border-white/10 bg-[#1c1b1b] hover:border-white/25"}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-black tracking-widest text-white">{formatShippingDisplayLabel(option.label)}</p>
                          <p className="mt-2 text-[11px] tracking-widest text-gray-500">{formatShippingDisplayLabel(option.carrier)} · {option.days}</p>
                        </div>
                        {option.price === 0 ? <span className="text-xs font-black text-green-400 uppercase tracking-widest">GRATUITE</span> : <span className="text-sm font-black text-white">{formatPrice(option.price)}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Sélecteur de point relais Mondial Relay */}
              {isMondialRelay && (
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black tracking-[0.3em] uppercase text-gray-500 flex items-center gap-2">
                    <MapPin size={12} className="text-[#ff4a8d]" />
                    Sélectionner un point relais
                  </h3>

                  {/* Point relais sélectionné */}
                  {relayPointId && (
                    <div className="border border-[#ff4a8d] bg-[#ff4a8d]/10 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 size={16} className="text-[#ff4a8d] mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-black uppercase tracking-widest text-white">{relayPointName}</p>
                            <p className="mt-1 text-[11px] text-gray-400">{relayPointAddress}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setRelayPointId(""); setRelayPointName(""); setRelayPointAddress(""); }}
                          className="text-gray-500 hover:text-white transition-colors flex-shrink-0"
                          title="Changer de point relais"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Barre de recherche */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={relaySearchCp}
                        onChange={(e) => setRelaySearchCp(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchRelayPoints(relaySearchCp); } }}
                        placeholder={form.codePostal || "Code postal"}
                        maxLength={10}
                        className="w-full bg-transparent border border-white/10 px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#ff4a8d] transition-colors"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => searchRelayPoints(relaySearchCp || form.codePostal)}
                      disabled={relayLoading}
                      className="bg-[#ff4a8d] hover:bg-[#ff1f70] disabled:bg-white/10 disabled:cursor-not-allowed px-4 py-3 text-white transition-colors flex items-center gap-2"
                    >
                      {relayLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                      <span className="text-xs font-black uppercase tracking-widest hidden sm:inline">Rechercher</span>
                    </button>
                  </div>

                  {/* Erreur de recherche */}
                  {relayError && !relayLoading && (
                    <div className="border border-red-500/30 bg-red-500/10 p-4 flex gap-3 text-red-200">
                      <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                      <p className="text-xs leading-relaxed">{relayError}</p>
                    </div>
                  )}

                  {/* Liste des points relais */}
                  {relaySearched && !relayLoading && relayPoints.length > 0 && (
                    <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                      {relayPoints.map((point) => {
                        const isSelected = relayPointId === point.id;
                        const isExpanded = expandedRelayId === point.id;
                        const distanceLabel = formatRelayDistance(point.distance);
                        return (
                          <div
                            key={point.id}
                            className={`border transition-colors ${isSelected ? "border-[#ff4a8d] bg-[#ff4a8d]/10" : "border-white/10 bg-[#1c1b1b] hover:border-white/25"}`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setRelayPointId(point.id);
                                setRelayPointName(point.name);
                                setRelayPointAddress(point.fullAddress);
                              }}
                              className="w-full text-left p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0">
                                  <MapPin size={14} className={`mt-0.5 flex-shrink-0 ${isSelected ? "text-[#ff4a8d]" : "text-gray-500"}`} />
                                  <div className="min-w-0">
                                    <p className="text-xs font-black uppercase tracking-widest text-white truncate">{point.name}</p>
                                    <p className="mt-1 text-[11px] text-gray-400 truncate">{point.address}, {point.postalCode} {point.city}</p>
                                    {distanceLabel && (
                                      <p className="mt-0.5 text-[10px] text-gray-600 tracking-widest">{distanceLabel}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {isSelected && <CheckCircle2 size={14} className="text-[#ff4a8d]" />}
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setExpandedRelayId(isExpanded ? null : point.id); }}
                                    className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors border border-white/10 px-2 py-1"
                                  >
                                    {isExpanded ? "Masquer" : "Horaires"}
                                  </button>
                                </div>
                              </div>
                            </button>

                            {/* Horaires détaillés */}
                            {isExpanded && (
                              <div className="border-t border-white/5 px-4 pb-4 pt-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 flex items-center gap-1.5">
                                  <Clock size={10} />Horaires d'ouverture
                                </p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                  {([
                                    ["Lundi", point.openingHours.monday],
                                    ["Mardi", point.openingHours.tuesday],
                                    ["Mercredi", point.openingHours.wednesday],
                                    ["Jeudi", point.openingHours.thursday],
                                    ["Vendredi", point.openingHours.friday],
                                    ["Samedi", point.openingHours.saturday],
                                    ["Dimanche", point.openingHours.sunday],
                                  ] as [string, string][]).map(([day, hours]) => (
                                    <div key={day} className="flex justify-between gap-2">
                                      <span className="text-[10px] text-gray-500 uppercase tracking-widest">{day}</span>
                                      <span className={`text-[10px] font-black ${hours === "Fermé" ? "text-red-400" : "text-gray-300"}`}>{hours}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Alerte si Mondial Relay sélectionné mais aucun point relais choisi */}
                  {!relayPointId && relaySearched && relayPoints.length > 0 && (
                    <div className="border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3 text-amber-200">
                      <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                      <p className="text-xs leading-relaxed">Veuillez sélectionner un point relais dans la liste ci-dessus pour continuer.</p>
                    </div>
                  )}
                  {!relayPointId && !relaySearched && (
                    <div className="border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3 text-amber-200">
                      <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                      <p className="text-xs leading-relaxed">Saisissez un code postal et cliquez sur Rechercher pour trouver les points relais proches.</p>
                    </div>
                  )}
                </div>
              )}

              <button onClick={() => setStep("paiement")} disabled={!form.prenom || !form.nom || !form.adresse || !form.ville || !form.codePostal || shippingLoading || !selectedShippingOption || (isMondialRelay && !relayPointId)} className="w-full bg-[#ff4a8d] hover:bg-[#ff1f70] disabled:bg-white/5 disabled:text-gray-600 disabled:cursor-not-allowed text-white py-5 text-xs font-black tracking-widest uppercase transition-colors">CONTINUER VERS LE PAIEMENT</button>
              {!isAuthenticated && <button onClick={() => setStep("contact")} className="w-full text-center text-xs text-gray-500 hover:text-white transition-colors uppercase tracking-widest font-black">← Retour au contact</button>}
            </div>
          )}

          {step === "paiement" && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-black tracking-tighter italic uppercase mb-2">Paiement</h2>

                <div className="space-y-3">
                  {methodsLoading && <div className="border border-white/10 bg-[#1c1b1b] p-5 text-xs text-gray-500 uppercase tracking-widest">Chargement des moyens de paiement...</div>}
                  {!methodsLoading && displayMethods.length === 0 && <div className="border border-amber-500/30 bg-amber-500/10 p-5 text-xs text-amber-100 leading-relaxed">Aucun moyen de paiement disponible pour ce pays de livraison.</div>}
                  {!methodsLoading && displayMethods.map((method) => {
                    const config = METHOD_CONFIG[method];
                    const Icon = config.icon;
                    const branded = hasPaymentBrandLogo(method);
                    const showPayLater = method === "paypal_4x"
                      && paypalPayLaterDisplayEnabled && displayMethods.includes("paypal_4x");
                    const active = hasExplicitPaymentSelection && paymentMethod === method;
                    const surchargePercent = effectiveIsB2B && (method === "card" || method === "paypal")
                      ? b2bSurchargePercents[method] || 0
                      : 0;
                    const isRecommended = method === "paybybank";
                    return (
                      <button key={method} type="button" onClick={() => { setPaymentMethod(method); setHasExplicitPaymentSelection(true); setPaymentError(""); }} className={`w-full text-left border p-5 transition-colors ${active ? "border-[#ff4a8d] bg-[#ff4a8d]/10" : "border-white/10 bg-[#1c1b1b] hover:border-white/25"}`}>
                        <div className="flex items-center gap-4">
                          {branded ? <PaymentBrandLogo method={method} /> : (
                            <div className={`w-11 h-11 shrink-0 flex items-center justify-center border text-[10px] font-black ${active ? "border-[#ff4a8d] text-[#ff4a8d]" : "border-white/10 text-gray-500"}`}><Icon size={16} /></div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-sm font-black tracking-wide">{config.label}</span>
                              {config.badge && <span className={`shrink-0 text-[10px] font-black tracking-wide border px-2 py-1 ${isRecommended ? "text-emerald-300 border-emerald-400/30 bg-emerald-400/10" : "text-gray-500 border-white/10"}`}>{config.badge}</span>}
                            </div>
                            {showPayLater && <p className="mt-2 text-xs font-bold text-emerald-300">Payez en 4x sans frais<span className="block mt-1 text-[10px] font-normal text-gray-400">Sous réserve d’éligibilité et d’acceptation par PayPal.</span></p>}
                            {isRecommended ? <p className="mt-2 text-xs leading-relaxed text-gray-300">Simple et rapide : validez le paiement dans l’appli de votre banque, sans saisir de carte.{effectiveIsB2B && " Sans frais de paiement."}</p> : active && surchargePercent > 0 ? <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-amber-300">Frais de paiement : +{surchargePercent}%</p> : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {paymentError && <div className="mt-5 border border-red-500/30 bg-red-500/10 p-4 flex gap-3 text-red-200"><AlertCircle size={16} className="mt-0.5 flex-shrink-0" /><p className="text-xs leading-relaxed">{paymentError}</p></div>}
              </div>

              {promoCode && (
                <div className={`mb-3 text-[10px] font-black uppercase tracking-widest ${promoResult?.valid ? "text-emerald-300" : promoError ? "text-red-300" : "text-gray-500"}`}>
                  {promoLoading ? "Vérification du code promo..." : promoResult?.valid ? `Code ${promoCode} appliqué · -${formatPrice(promoDiscount)}` : promoError || `Code ${promoCode} transmis pour vérification serveur.`}
                </div>
              )}
              {!hasExplicitPaymentSelection && <p className="text-xs text-gray-400">Choisissez votre moyen de paiement. Aucun frais n’est ajouté avant votre choix explicite dans ce checkout.</p>}
              {feeQuoteLoading && <p role="status" className="text-xs text-gray-400">Vérification du total et des frais… Dernier devis conservé jusqu’à la réponse.</p>}
              {feeQuoteError && <div role="alert" className="text-xs text-amber-200">{feeQuoteError} Paiement suspendu ; dernier devis conservé.<button type="button" onClick={() => setFeeQuoteRetry((value) => value + 1)} className="ml-3 underline">Réessayer les frais</button></div>}
              {/* PayPal Advanced Checkout v2 : Smart Buttons popup */}
              {hasExplicitPaymentSelection && !paymentGuardMessage && paypalV2Config?.v2Enabled && (paymentMethod === "paypal" || paymentMethod === "paypal_4x") ? (
                <div>
                  {!paypalSdkLoaded && <div className="w-full bg-white/5 text-gray-600 py-5 text-xs font-black tracking-widest uppercase flex items-center justify-center gap-2"><Loader2 size={12} className="animate-spin" />CHARGEMENT...</div>}
                  <div id="paypal-button-container" className={paypalSdkLoaded ? "" : "hidden"} />
                  {paypalSdkLoaded && !paypalButtonsRendered && <div className="w-full bg-white/5 text-gray-600 py-5 text-xs font-black tracking-widest uppercase flex items-center justify-center gap-2"><Loader2 size={12} className="animate-spin" />INITIALISATION...</div>}
                </div>
              ) : (
                <button onClick={handleCheckout} disabled={Boolean(paymentGuardMessage) || !hasValidCustomerEmail || isSubmittingPayment || displayMethods.length === 0 || methodsLoading || shippingLoading || (!draftPricingActive && !selectedShippingOption)} className="w-full bg-[#ff4a8d] hover:bg-[#ff1f70] disabled:bg-white/5 disabled:text-gray-600 disabled:cursor-wait text-white py-5 text-xs font-black tracking-widest uppercase flex items-center justify-center gap-2 transition-colors"><Lock size={12} />{isSubmittingPayment ? "REDIRECTION EN COURS..." : `PAYER ${formatPrice(totalWithPaymentFeeTTC)}`}</button>
              )}
              <button onClick={() => setStep("livraison")} className="w-full text-center text-xs text-gray-500 hover:text-white transition-colors uppercase tracking-widest font-black">← Retour à la livraison</button>
            </div>
          )}
        </div>

        <div className="hidden lg:block">
          <div className="bg-[#1c1b1b] p-8 sticky top-24">
            <h2 className="text-xs font-black tracking-[0.3em] uppercase text-gray-500 mb-8">VOTRE COMMANDE</h2>
            <div className="space-y-6 mb-8">
              {checkoutItems.map((item) => {
                const img = getVariantImage(item.product, item.variant);
                const quoteItem = getPricingQuoteItem(pricingQuote, item.product.id, item.variantId || item.variant?.id || null);
                const publicUnitTTC = item.isCustomSale
                  ? item.customPriceTTC ?? item.product.price
                  : typeof item.product.pricePublic === "number" ? item.product.pricePublic : item.product.price;
                const usesDraftPrice = draftPricingActive;
                const usesProfessionalPrice = hasProfessionalPricing && quoteItem?.priceSource === "pro";
                const displayedLineTotal = usesDraftPrice ? getDraftLineTotal(item) : (usesProfessionalPrice ? quoteItem.appliedUnitHT : quoteItem?.appliedUnitTTC ?? publicUnitTTC) * item.quantity;
                const lineStockIssue = getLineStockIssue(item);
                const displayedQuantity = getAvailableDisplayQuantity(item.quantity, lineStockIssue);
                const linePriceLabel = usesDraftPrice ? "Prix brouillon" : usesProfessionalPrice ? "Prix pro HT" : "Public TTC";
                const lineTaxLabel = usesDraftPrice ? draftPricing?.isB2B ? "HT" : "TTC" : usesProfessionalPrice ? "HT" : "TTC";
                return (
                  <div key={`${item.product.id}-${item.variantId || item.variant?.id || "product"}`} className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-[#2a2a2a] flex-shrink-0 relative overflow-hidden">{img && <Image src={img} alt={item.product.name} fill className="object-contain p-2 opacity-90" />}<span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#ff4a8d] text-white text-[10px] font-black flex items-center justify-center">{displayedQuantity}</span></div>
                    <div className="flex-1 min-w-0"><p className="text-[10px] font-black tracking-widest uppercase text-[#ff4a8d] mb-0.5">{item.product.brand}</p><p className="text-xs font-black truncate">{item.product.name}</p><p className={`mt-1 text-[9px] font-black uppercase tracking-widest ${usesProfessionalPrice ? "text-emerald-300" : "text-gray-500"}`}>{linePriceLabel}</p>{lineStockIssue && <p role="alert" className="mt-2 text-[10px] text-amber-200">{!usesDraftPrice && lineStockIssue.message ? lineStockIssue.message : stockIssueMessage(lineStockIssue, usesDraftPrice)}</p>}</div>
                    <div className="text-right"><span className="block text-sm font-black">{formatPrice(displayedLineTotal)}</span><span className="mt-1 block text-[9px] uppercase tracking-widest text-gray-500">{lineTaxLabel}</span></div>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-white/5 pt-6 space-y-3">
              {showProfessionalPriceBreakdown ? (
                <>
                  <div className="flex justify-between"><span className="text-xs text-gray-400 uppercase tracking-widest">Sous-total HT</span><span className="text-sm font-black">{formatPrice(subtotalHT)}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-gray-400 uppercase tracking-widest">TVA ({vatRate}%)</span><span className="text-sm font-black">{formatPrice(vatAmount)}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-gray-400 uppercase tracking-widest">{draftNoShipping ? "Retrait" : "Livraison"}</span>{draftNoShipping ? <span className="text-xs font-black text-amber-400 uppercase tracking-widest">{PICKUP_LOCATION_LABEL}</span> : (shipping === 0 ? <span className="text-xs font-black text-green-400 uppercase tracking-widest">GRATUITE</span> : <span className="text-sm font-black">{formatPrice(shipping)}</span>)}</div>
                  {draftPricingActive && draftPricing && draftPricing.discountTotal > 0 && <div className="flex justify-between text-emerald-300"><span className="text-xs uppercase tracking-widest">Remise brouillon</span><span className="text-sm font-black">-{formatPrice(draftPricing.discountTotal)}</span></div>}
                  {promoDiscount > 0 && <div className="flex justify-between text-emerald-300"><span className="text-xs uppercase tracking-widest">Remise</span><span className="text-sm font-black">-{formatPrice(promoDiscount)}</span></div>}
                  {hasExplicitPaymentSelection && <div className="flex justify-between"><span className="text-xs uppercase tracking-widest text-gray-400">Base TTC avant frais</span><span className="text-sm font-black">{formatPrice(paymentBaseTTC)}</span></div>}
                  {hasExplicitPaymentSelection && feeQuote && <div className="flex justify-between text-amber-300"><span className="text-xs uppercase tracking-widest">Frais de paiement ({selectedPaymentSurchargePercent}%)</span><span className="text-sm font-black">+{formatPrice(paymentFeeTTC)}</span></div>}
                  <div className="border-t border-white/5 pt-4 flex justify-between"><span className="text-xs font-black tracking-widest uppercase">TOTAL TTC</span><span className="text-2xl font-black">{formatPrice(totalWithPaymentFeeTTC)}</span></div>
                </>
              ) : (
                <>
                  <div className="flex justify-between"><span className="text-xs text-gray-400 uppercase tracking-widest">Sous-total</span><span className="text-sm font-black">{formatPrice(displaySubtotalTTC)}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-gray-400 uppercase tracking-widest">{draftNoShipping ? "Retrait" : "Livraison"}</span>{draftNoShipping ? <span className="text-xs font-black text-amber-400 uppercase tracking-widest">{PICKUP_LOCATION_LABEL}</span> : (shipping === 0 ? <span className="text-xs font-black text-green-400 uppercase tracking-widest">GRATUITE</span> : <span className="text-sm font-black">{formatPrice(shipping)}</span>)}</div>
                  {draftPricingActive && draftPricing && draftPricing.discountTotal > 0 && <div className="flex justify-between text-emerald-300"><span className="text-xs uppercase tracking-widest">Remise brouillon</span><span className="text-sm font-black">-{formatPrice(draftPricing.discountTotal)}</span></div>}
                  {promoDiscount > 0 && <div className="flex justify-between text-emerald-300"><span className="text-xs uppercase tracking-widest">Remise</span><span className="text-sm font-black">-{formatPrice(promoDiscount)}</span></div>}
                  {hasExplicitPaymentSelection && <div className="flex justify-between"><span className="text-xs uppercase tracking-widest text-gray-400">Base TTC avant frais</span><span className="text-sm font-black">{formatPrice(paymentBaseTTC)}</span></div>}
                  {hasExplicitPaymentSelection && feeQuote && <div className="flex justify-between text-amber-300"><span className="text-xs uppercase tracking-widest">Frais de paiement ({selectedPaymentSurchargePercent}%)</span><span className="text-sm font-black">+{formatPrice(paymentFeeTTC)}</span></div>}
                  <div className="border-t border-white/5 pt-4 flex justify-between"><span className="text-xs font-black tracking-widest uppercase">TOTAL</span><span className="text-2xl font-black">{formatPrice(totalWithPaymentFeeTTC)}</span></div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
