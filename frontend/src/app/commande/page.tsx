"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Lock, ChevronDown, ShoppingBag, CreditCard, Landmark, WalletCards, ReceiptText, AlertCircle, Smartphone, MapPin, Search, Loader2, CheckCircle2, Clock, X } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { getCustomerAddresses, type CustomerAddress } from "@/lib/customer-api";
import { parseImages, formatPrice } from "@/lib/utils";
import { validatePromotionCode, type PromotionValidationResult } from "@/lib/api";
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
};

const METHOD_CONFIG: Record<PaymentMethod, { label: string; badge: string; icon: typeof CreditCard }> = {
  card: { label: "CARTE BANCAIRE", badge: "CB", icon: CreditCard },
  paybybank: { label: "PAIEMENT BANCAIRE INSTANTANÉ", badge: "BANK", icon: Landmark },
  pay_by_bank: { label: "VIREMENT BANCAIRE", badge: "BANK", icon: Landmark },
  sepa: { label: "PRÉLÈVEMENT SEPA", badge: "SEPA", icon: ReceiptText },
  paypal: { label: "PAYPAL", badge: "PP", icon: WalletCards },
  paypal_4x: { label: "PAYPAL 4X SANS FRAIS", badge: "PP4X", icon: WalletCards },
  apple_pay: { label: "APPLE PAY", badge: "APPLE", icon: Smartphone },
  google_pay: { label: "GOOGLE PAY", badge: "GPAY", icon: Smartphone },
  bancontact: { label: "BANCONTACT", badge: "BE", icon: Landmark },
  ideal: { label: "IDEAL", badge: "NL", icon: Landmark },
  blik: { label: "BLIK", badge: "PL", icon: Smartphone },
  mb_way: { label: "MB WAY", badge: "PT", icon: Smartphone },
  multibanco: { label: "MULTIBANCO", badge: "PT", icon: Landmark },
};

function getCountryCode(countryName: string): string {
  return COUNTRY_CODE_BY_NAME[countryName] || countryName.toUpperCase().slice(0, 2) || "FR";
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
  const { items, total, cartSessionId, replaceItems } = useCart();
  const { customer, isAuthenticated, isLoading: customerLoading, isApprovedPro } = useCustomerAuth();
  const [step, setStep] = useState<Step>("contact");
  const [guestCheckout, setGuestCheckout] = useState(false);
  const [orderSummaryOpen, setOrderSummaryOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [availableMethods, setAvailableMethods] = useState<PaymentMethod[]>([]);
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
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [draftNotice, setDraftNotice] = useState("");

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
  const draftPricingActive = Boolean(draftPricing && draftPricing.cartSignature === cartSignature);
  const shipping = draftPricingActive ? draftPricing?.shipping || 0 : selectedShippingOption?.price ?? 0;
  const countryCode = useMemo(() => getCountryCode(form.pays), [form.pays]);
  const effectiveIsB2B = isB2B || isApprovedPro;
  const vatRate = useMemo(() => getEstimatedVatRate(countryCode, effectiveIsB2B, vatNumber), [countryCode, effectiveIsB2B, vatNumber]);
  const subtotalHT = useMemo(() => {
    if (draftPricingActive && draftPricing) return draftPricing.totalHT;
    const rawSubtotalHT = items.reduce((sum, item) => {
      const unitPrice = item.product.price;
      const publicTtcPrice = typeof item.product.pricePublic === "number" ? item.product.pricePublic : unitPrice;
      const unitHT = effectiveIsB2B && item.product.hasPriceProEur ? unitPrice : publicTtcPrice / 1.2;
      return sum + unitHT * item.quantity;
    }, 0);
    return Math.round((rawSubtotalHT + Number.EPSILON) * 100) / 100;
  }, [draftPricing, draftPricingActive, effectiveIsB2B, items]);
  const displaySubtotalTTC = draftPricingActive && draftPricing ? draftPricing.subtotal : total;
  const shippingReferenceAmount = effectiveIsB2B ? subtotalHT : displaySubtotalTTC;
  const vatAmount = useMemo(() => {
    if (draftPricingActive && draftPricing) return draftPricing.vatAmount;
    return Math.round((subtotalHT * (vatRate / 100) + Number.EPSILON) * 100) / 100;
  }, [draftPricing, draftPricingActive, subtotalHT, vatRate]);
  const grandTotal = draftPricingActive && draftPricing ? draftPricing.totalTTC : subtotalHT + vatAmount + shipping;
  const promotionCartItems = useMemo(() => items.map((item) => {
    const publicTtcPrice = typeof item.product.pricePublic === "number" ? item.product.pricePublic : item.product.price;
    const proUnitPrice = item.product.hasPriceProEur ? item.product.price : publicTtcPrice / 1.2;
    return {
      productId: item.product.id,
      categoryId: typeof item.product.category === "string" ? item.product.category : null,
      quantity: item.quantity,
      price: effectiveIsB2B ? proUnitPrice : publicTtcPrice,
    };
  }), [effectiveIsB2B, items]);
  const promoDiscount = draftPricingActive ? 0 : promoResult?.valid ? Math.min(promoResult.discount || 0, grandTotal) : 0;
  const discountedGrandTotal = draftPricingActive && draftPricing ? draftPricing.totalTTC : Math.max(0, grandTotal - promoDiscount);

  const displayMethods = useMemo(
    () => availableMethods.filter((method) => {
      if (effectiveIsB2B && method === "sepa") return false;
      // PayPal 4x : minimum 30€ requis (PayPal Pay Later)
      if (method === "paypal_4x" && discountedGrandTotal < 30) return false;
      return method !== "apple_pay" || supportsApplePay();
    }),
    [availableMethods, effectiveIsB2B, discountedGrandTotal],
  );

  const checkoutSteps: Step[] = isAuthenticated ? ["livraison", "paiement"] : ["contact", "livraison", "paiement"];

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
    const token = searchParams.get("draftToken")?.trim() || "";
    if (!token) return;

    const controller = new AbortController();
    setDraftToken(token);
    setDraftLoading(true);
    setDraftError("");
    setDraftNotice("");

    async function loadSharedDraft() {
      try {
        const res = await fetch(`${API_URL}/api/checkout/draft/${encodeURIComponent(token)}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as DraftCheckoutResponse;
        if (!res.ok || !data.draft) throw new Error(data.error || "Impossible de charger la commande préparée");

        const nextItems: CartItem[] = data.draft.items.map((item) => {
          const images = item.images?.length ? item.images : item.image ? [item.image] : [];
          const discountedUnitPrice = item.quantity > 0 && typeof item.discountedLineTotal === "number"
            ? money(item.discountedLineTotal / item.quantity)
            : item.quantity > 0 && item.discountAmount
              ? money(Math.max(0, item.price * item.quantity - item.discountAmount) / item.quantity)
              : item.price;
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
            originalPrice: null,
            images,
            description: "",
            shortDescription: "",
            features: [],
            inStock: true,
            stockCount: item.quantity,
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
          return { product, quantity: item.quantity, variantId: item.variantId ?? null, variant };
        });

        replaceItems(nextItems);
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
        setPromoCode("");
        setPromoResult(null);
        setPromoError("");
        if (data.draft.email) {
          setForm((prev) => ({ ...prev, email: data.draft?.email || prev.email }));
          setGuestCheckout(true);
        }
        setDraftNotice(`Commande préparée ${data.draft.orderNumber} chargée dans votre panier avec ses prix et remises figés. Vous pouvez la modifier avant paiement, ce qui recalculera alors les totaux au tarif catalogue.`);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setDraftToken("");
          setDraftError(err instanceof Error ? err.message : "Lien de brouillon invalide ou expiré");
        }
      } finally {
        if (!controller.signal.aborted) setDraftLoading(false);
      }
    }

    loadSharedDraft();
    return () => controller.abort();
  }, [replaceItems, searchParams]);

  useEffect(() => {
    if (draftPricing && draftPricing.cartSignature !== cartSignature) {
      setDraftPricing(null);
      setDraftToken("");
      setDraftNotice("Le panier a été modifié : les totaux sont recalculés au tarif catalogue.");
    }
  }, [cartSignature, draftPricing]);

  useEffect(() => {
    if (customerLoading) return;
    if (isAuthenticated) {
      setStep("livraison");
      setGuestCheckout(false);
    } else {
      setStep((current) => (current === "paiement" ? "livraison" : current));
    }
  }, [customerLoading, isAuthenticated]);

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
    if (!paypalV2Config?.v2Enabled || !paypalV2Config.clientId) return;
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
  }, [paypalV2Config, paypalSdkLoaded]);

  // Rendre les Smart Buttons quand le SDK est chargé et la méthode PayPal est sélectionnée
  useEffect(() => {
    const isPaypalMethod = paymentMethod === "paypal" || paymentMethod === "paypal_4x";
    if (!paypalV2Config?.v2Enabled || !paypalSdkLoaded || !isPaypalMethod || step !== "paiement") return;

    const container = document.getElementById("paypal-button-container");
    if (!container) return;

    // Nettoyer les boutons précédents
    container.innerHTML = "";
    setPaypalButtonsRendered(false);

    const win = window as unknown as { paypal?: { Buttons?: (opts: unknown) => { render: (el: HTMLElement) => Promise<void>; close?: () => void } } };
    if (!win.paypal?.Buttons) return;

    const buildPayload = () => ({
      cartItems: items.map((item) => ({ productId: item.product.id, variantId: item.variantId || item.variant?.id || null, quantity: item.quantity })),
      customerEmail: form.email,
      customerId: isAuthenticated && customer ? customer.id : undefined,
      cartSessionId,
      draftToken: draftToken || undefined,
      shippingAddress: { firstName: form.prenom, lastName: form.nom, address: form.adresse, extension: form.complement, city: form.ville, postalCode: form.codePostal, country: countryCode, phone: form.telephone },
      paymentMethod,
      shippingOptionId: selectedShippingOption?.id,
      isB2B: effectiveIsB2B,
      vatNumber: vatNumber.trim() || undefined,
      promoCode: promoCode.trim() || undefined,
      relayPointId: relayPointId || undefined,
      relayPointName: relayPointName || undefined,
      relayPointAddress: relayPointAddress || undefined,
    });

    const buttons = win.paypal.Buttons({
      fundingSource: paymentMethod === "paypal_4x" ? "paylater" : "paypal",
      style: { layout: "vertical", color: "black", shape: "rect", label: "pay", height: 48 },
      createOrder: async () => {
        setPaymentError("");
        setIsSubmittingPayment(true);
        try {
          const res = await fetch(`${API_URL}/api/checkout/paypal/v2/create-order`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildPayload()) });
          const data = await res.json() as { paypalOrderId?: string; orderId?: string; error?: string; code?: string };
          if (!res.ok) {
            if (data.code === "PAYPAL_4X_INELIGIBLE") {
              setPaymentMethod("paypal");
              setPaymentError("Le paiement en 4 fois n'est pas disponible pour cette transaction. Vous avez été redirigé vers le paiement standard.");
              setIsSubmittingPayment(false);
              throw new Error(data.error || "PAYPAL_4X_INELIGIBLE");
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
  }, [paypalV2Config, paypalSdkLoaded, paymentMethod, step, discountedGrandTotal]);

  useEffect(() => {
    const storedMethod = sessionStorage.getItem("barberparadise-payment-method") as PaymentMethod | null;
    if (storedMethod && Object.keys(METHOD_CONFIG).includes(storedMethod)) setPaymentMethod(storedMethod);
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
    if (!cartSessionId || !form.email.includes("@") || items.length === 0) return;
    const controller = new AbortController();

    fetch(`${API_URL}/api/checkout/cart-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: cartSessionId,
        email: form.email,
        cartItems: items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
      }),
      signal: controller.signal,
    }).catch(() => {
      // Le suivi des paniers abandonnés reste non bloquant pour le tunnel de commande.
    });

    return () => controller.abort();
  }, [cartSessionId, form.email, items]);

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
        const data = (await res.json()) as { methods?: PaymentMethod[]; error?: string };
        if (!res.ok) throw new Error(data.error || "Impossible de récupérer les moyens de paiement");
        const methods = data.methods || [];
        setAvailableMethods(methods);
        setPaymentMethod((current) => (methods.includes(current) ? current : methods[0] || "card"));
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setAvailableMethods([]);
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

  const handleCheckout = async () => {
    setPaymentError("");
    setIsSubmittingPayment(true);

    const checkoutPaymentMethod: PaymentMethod = paymentMethod;

    try {
      const res = await fetch(`${API_URL}/api/checkout/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartItems: items.map((item) => ({ productId: item.product.id, variantId: item.variantId || item.variant?.id || null, quantity: item.quantity })),
          customerEmail: form.email,
          customerId: isAuthenticated && customer ? customer.id : undefined,
          cartSessionId,
          draftToken: draftToken || undefined,
          shippingAddress: {
            firstName: form.prenom,
            lastName: form.nom,
            address: form.adresse,
            extension: form.complement,
            city: form.ville,
            postalCode: form.codePostal,
            country: countryCode,
            phone: form.telephone,
          },
          paymentMethod: checkoutPaymentMethod,
          shippingOptionId: selectedShippingOption?.id,
          isB2B: effectiveIsB2B,
          vatNumber: vatNumber.trim() || undefined,
          promoCode: promoCode.trim() || undefined,
          relayPointId: relayPointId || undefined,
          relayPointName: relayPointName || undefined,
          relayPointAddress: relayPointAddress || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data?.code === "VARIANT_SELECTION_REQUIRED") {
          setPaymentError(`${data.error || "Un article de votre panier est incomplet."} Retournez au panier pour retirer cet article puis ajoutez-le à nouveau depuis sa fiche produit avec une variante.`);
          return;
        }
        if (data?.code === "PAYPAL_4X_INELIGIBLE") {
          // PayPal 4x non éligible pour cette transaction — basculer vers PayPal standard et afficher un message clair
          setPaymentMethod("paypal");
          setPaymentError("Le paiement en 4 fois PayPal n'est pas disponible pour cette transaction (compte PayPal non éligible ou conditions non remplies). Vous avez été redirigé vers le paiement PayPal standard. Vous pouvez également choisir un autre moyen de paiement.");
          setIsSubmittingPayment(false);
          return;
        }
        throw new Error(data?.error || "Impossible d'initialiser le paiement");
      }
      if (!data.checkoutUrl) throw new Error("URL de paiement indisponible");

      window.location.href = data.checkoutUrl;
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Erreur paiement inconnue");
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
        {draftError && <p className="text-sm text-red-300 text-center max-w-md mb-6">{draftError}</p>}
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
            </div>
          )}

          <button onClick={() => setOrderSummaryOpen(!orderSummaryOpen)} className="lg:hidden w-full flex items-center justify-between bg-[#1c1b1b] px-5 py-4 mb-8">
            <div className="flex items-center gap-3"><ShoppingBag size={16} className="text-[#ff4a8d]" /><span className="text-xs font-black tracking-widest uppercase">{orderSummaryOpen ? "MASQUER" : "VOIR"} LE RÉCAPITULATIF</span></div>
            <div className="flex items-center gap-3"><span className="font-black">{formatPrice(discountedGrandTotal)}</span><ChevronDown size={14} className={`transition-transform ${orderSummaryOpen ? "rotate-180" : ""}`} /></div>
          </button>

          {orderSummaryOpen && (
            <div className="lg:hidden bg-[#1c1b1b] p-5 mb-8 space-y-4">
              {items.map((item) => {
                const img = parseImages(item.product.images)[0] || "";
                return (
                  <div key={`${item.product.id}-${item.variantId || item.variant?.id || "product"}`} className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-[#2a2a2a] flex-shrink-0 relative">{img && <Image src={img} alt={item.product.name} fill className="object-contain p-1" />}<span className="absolute -top-2 -right-2 w-5 h-5 bg-[#ff4a8d] text-white text-[10px] font-black flex items-center justify-center">{item.quantity}</span></div>
                    <div className="flex-1 min-w-0"><p className="text-xs font-black truncate">{item.product.name}</p></div>
                    <span className="text-xs font-black">{formatPrice(item.product.price * item.quantity)}</span>
                  </div>
                );
              })}
              <div className="border-t border-white/5 pt-4 space-y-3">
                {effectiveIsB2B ? (
                  <>
                    <div className="flex justify-between"><span className="text-xs uppercase tracking-widest text-gray-400">Sous-total HT</span><span className="font-black">{formatPrice(subtotalHT)}</span></div>
                    <div className="flex justify-between"><span className="text-xs uppercase tracking-widest text-gray-400">TVA ({vatRate}%)</span><span className="font-black">{formatPrice(vatAmount)}</span></div>
                    <div className="flex justify-between"><span className="text-xs uppercase tracking-widest text-gray-400">Livraison</span>{shipping === 0 ? <span className="text-xs font-black text-green-400 uppercase tracking-widest">GRATUITE</span> : <span className="font-black">{formatPrice(shipping)}</span>}</div>
                    {promoDiscount > 0 && <div className="flex justify-between text-emerald-300"><span className="text-xs uppercase tracking-widest">Remise</span><span className="font-black">-{formatPrice(promoDiscount)}</span></div>}
                    <div className="border-t border-white/5 pt-3 flex justify-between"><span className="text-xs font-black tracking-widest uppercase">TOTAL TTC</span><span className="font-black">{formatPrice(discountedGrandTotal)}</span></div>
                  </>
                ) : (
                  <>
                    {promoDiscount > 0 && <div className="flex justify-between text-emerald-300"><span className="text-xs uppercase tracking-widest">Remise</span><span className="font-black">-{formatPrice(promoDiscount)}</span></div>}
                    <div className="flex justify-between"><span className="text-xs uppercase tracking-widest text-gray-400">Total</span><span className="font-black">{formatPrice(discountedGrandTotal)}</span></div>
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
                    <div><label className={labelClass}>Adresse email</label><input type="email" value={form.email} onChange={(e) => updateForm("email", e.target.value)} placeholder="votre@email.com" className={inputClass} /></div>
                    <p className="text-[11px] text-gray-500 leading-6">Un compte client pourra être créé automatiquement à partir de ces informations à la finalisation de la commande.</p>
                  </div>
                )}
              </div>
              <button onClick={() => setStep("livraison")} disabled={!guestCheckout || !form.email} className="w-full bg-[#ff4a8d] hover:bg-[#ff1f70] disabled:bg-white/5 disabled:text-gray-600 disabled:cursor-not-allowed text-white py-5 text-xs font-black tracking-widest uppercase transition-colors">CONTINUER VERS LA LIVRAISON</button>
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
                        <option value="France">France</option><option value="Belgique">Belgique</option><option value="Suisse">Suisse</option><option value="Luxembourg">Luxembourg</option><option value="Pays-Bas">Pays-Bas</option><option value="Allemagne">Allemagne</option><option value="Espagne">Espagne</option><option value="Italie">Italie</option><option value="Portugal">Portugal</option><option value="Pologne">Pologne</option><option value="États-Unis">États-Unis</option><option value="Canada">Canada</option><option value="Maroc">Maroc</option>
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
                          <p className="text-sm font-black uppercase tracking-widest text-white">{option.label}</p>
                          <p className="mt-2 text-[11px] uppercase tracking-widest text-gray-500">{option.carrier} · {option.days}</p>
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
                                    {point.distance !== null && (
                                      <p className="mt-0.5 text-[10px] text-gray-600 uppercase tracking-widest">{point.distance < 1000 ? `${point.distance} m` : `${(point.distance / 1000).toFixed(1)} km`}</p>
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
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-2"><Lock size={10} />Méthodes calculées selon {countryCode}</p>

                <div className="space-y-3">
                  {methodsLoading && <div className="border border-white/10 bg-[#1c1b1b] p-5 text-xs text-gray-500 uppercase tracking-widest">Chargement des moyens de paiement...</div>}
                  {!methodsLoading && displayMethods.length === 0 && <div className="border border-amber-500/30 bg-amber-500/10 p-5 text-xs text-amber-100 leading-relaxed">Aucun moyen de paiement disponible pour ce pays de livraison.</div>}
                  {!methodsLoading && displayMethods.map((method) => {
                    const config = METHOD_CONFIG[method];
                    const Icon = config.icon;
                    const active = paymentMethod === method;
                    return (
                      <button key={method} type="button" onClick={() => setPaymentMethod(method)} className={`w-full text-left border p-5 transition-colors ${active ? "border-[#ff4a8d] bg-[#ff4a8d]/10" : "border-white/10 bg-[#1c1b1b] hover:border-white/25"}`}>
                        <div className="flex items-center gap-4"><div className={`w-11 h-11 flex items-center justify-center border text-[10px] font-black ${active ? "border-[#ff4a8d] text-[#ff4a8d]" : "border-white/10 text-gray-500"}`}><Icon size={16} /></div><div className="flex-1 min-w-0"><div className="flex items-center justify-between gap-3"><span className="text-sm font-black tracking-widest uppercase">{config.label}</span><span className="text-[10px] font-black tracking-widest text-gray-500 border border-white/10 px-2 py-1">{config.badge}</span></div></div></div>
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
              {/* PayPal Advanced Checkout v2 : Smart Buttons popup */}
              {paypalV2Config?.v2Enabled && (paymentMethod === "paypal" || paymentMethod === "paypal_4x") ? (
                <div>
                  {!paypalSdkLoaded && <div className="w-full bg-white/5 text-gray-600 py-5 text-xs font-black tracking-widest uppercase flex items-center justify-center gap-2"><Loader2 size={12} className="animate-spin" />CHARGEMENT...</div>}
                  <div id="paypal-button-container" className={paypalSdkLoaded ? "" : "hidden"} />
                  {paypalSdkLoaded && !paypalButtonsRendered && <div className="w-full bg-white/5 text-gray-600 py-5 text-xs font-black tracking-widest uppercase flex items-center justify-center gap-2"><Loader2 size={12} className="animate-spin" />INITIALISATION...</div>}
                </div>
              ) : (
                <button onClick={handleCheckout} disabled={isSubmittingPayment || displayMethods.length === 0 || methodsLoading || shippingLoading || (!draftPricingActive && !selectedShippingOption)} className="w-full bg-[#ff4a8d] hover:bg-[#ff1f70] disabled:bg-white/5 disabled:text-gray-600 disabled:cursor-wait text-white py-5 text-xs font-black tracking-widest uppercase flex items-center justify-center gap-2 transition-colors"><Lock size={12} />{isSubmittingPayment ? "REDIRECTION EN COURS..." : `PAYER ${formatPrice(discountedGrandTotal)}`}</button>
              )}
              <button onClick={() => setStep("livraison")} className="w-full text-center text-xs text-gray-500 hover:text-white transition-colors uppercase tracking-widest font-black">← Retour à la livraison</button>
            </div>
          )}
        </div>

        <div className="hidden lg:block">
          <div className="bg-[#1c1b1b] p-8 sticky top-24">
            <h2 className="text-xs font-black tracking-[0.3em] uppercase text-gray-500 mb-8">VOTRE COMMANDE</h2>
            <div className="space-y-6 mb-8">
              {items.map((item) => {
                const img = parseImages(item.product.images)[0] || "";
                return (
                  <div key={`${item.product.id}-${item.variantId || item.variant?.id || "product"}`} className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-[#2a2a2a] flex-shrink-0 relative overflow-hidden">{img && <Image src={img} alt={item.product.name} fill className="object-contain p-2 opacity-90" />}<span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#ff4a8d] text-white text-[10px] font-black flex items-center justify-center">{item.quantity}</span></div>
                    <div className="flex-1 min-w-0"><p className="text-[10px] font-black tracking-widest uppercase text-[#ff4a8d] mb-0.5">{item.product.brand}</p><p className="text-xs font-black truncate">{item.product.name}</p></div>
                    <span className="text-sm font-black">{formatPrice(item.product.price * item.quantity)}</span>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-white/5 pt-6 space-y-3">
              {effectiveIsB2B ? (
                <>
                  <div className="flex justify-between"><span className="text-xs text-gray-400 uppercase tracking-widest">Sous-total HT</span><span className="text-sm font-black">{formatPrice(subtotalHT)}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-gray-400 uppercase tracking-widest">TVA ({vatRate}%)</span><span className="text-sm font-black">{formatPrice(vatAmount)}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-gray-400 uppercase tracking-widest">Livraison</span>{shipping === 0 ? <span className="text-xs font-black text-green-400 uppercase tracking-widest">GRATUITE</span> : <span className="text-sm font-black">{formatPrice(shipping)}</span>}</div>
                  {draftPricingActive && draftPricing && draftPricing.discountTotal > 0 && <div className="flex justify-between text-emerald-300"><span className="text-xs uppercase tracking-widest">Remise brouillon</span><span className="text-sm font-black">-{formatPrice(draftPricing.discountTotal)}</span></div>}
                  {promoDiscount > 0 && <div className="flex justify-between text-emerald-300"><span className="text-xs uppercase tracking-widest">Remise</span><span className="text-sm font-black">-{formatPrice(promoDiscount)}</span></div>}
                  <div className="border-t border-white/5 pt-4 flex justify-between"><span className="text-xs font-black tracking-widest uppercase">TOTAL TTC</span><span className="text-2xl font-black">{formatPrice(discountedGrandTotal)}</span></div>
                </>
              ) : (
                <>
                  <div className="flex justify-between"><span className="text-xs text-gray-400 uppercase tracking-widest">Sous-total</span><span className="text-sm font-black">{formatPrice(displaySubtotalTTC)}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-gray-400 uppercase tracking-widest">Livraison</span>{shipping === 0 ? <span className="text-xs font-black text-green-400 uppercase tracking-widest">GRATUITE</span> : <span className="text-sm font-black">{formatPrice(shipping)}</span>}</div>
                  {draftPricingActive && draftPricing && draftPricing.discountTotal > 0 && <div className="flex justify-between text-emerald-300"><span className="text-xs uppercase tracking-widest">Remise brouillon</span><span className="text-sm font-black">-{formatPrice(draftPricing.discountTotal)}</span></div>}
                  {promoDiscount > 0 && <div className="flex justify-between text-emerald-300"><span className="text-xs uppercase tracking-widest">Remise</span><span className="text-sm font-black">-{formatPrice(promoDiscount)}</span></div>}
                  <div className="border-t border-white/5 pt-4 flex justify-between"><span className="text-xs font-black tracking-widest uppercase">TOTAL</span><span className="text-2xl font-black">{formatPrice(discountedGrandTotal)}</span></div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
