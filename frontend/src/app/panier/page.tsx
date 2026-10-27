"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Trash2, Minus, Plus, ArrowLeft, ArrowRight, ShoppingBag, CreditCard, Landmark, WalletCards } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { formatPrice } from "@/lib/utils";
import { getVariantImage } from "@/lib/product-images";
import { validatePromotionCode, type PromotionValidationResult } from "@/lib/api";
import { getCheckoutPricingQuote, getPricingQuoteItem, type CheckoutPricingQuote } from "@/lib/checkout-pricing";

type PaymentMethod = "card" | "paybybank" | "pay_by_bank" | "paypal" | "paypal_4x";

type ShippingOption = {
  id: string;
  label: string;
  price: number;
  carrier: string;
  days: string;
  isFree: boolean;
};

type ShippingEstimateResponse = {
  options?: ShippingOption[];
  freeShippingFrom?: number | null;
  freeShippingRemaining?: number;
  error?: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://barberparadise-backend.onrender.com";

export default function CartPage() {
  const { items, removeItem, updateQuantity, total, itemCount, removedInvalidVariantLines, clearRemovedInvalidVariantLines } = useCart();
  const { isApprovedPro } = useCustomerAuth();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoResult, setPromoResult] = useState<PromotionValidationResult | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [freeShippingRemaining, setFreeShippingRemaining] = useState(0);
  const [pricingQuote, setPricingQuote] = useState<CheckoutPricingQuote | null>(null);
  const [pricingQuoteLoading, setPricingQuoteLoading] = useState(false);
  const [pricingQuoteError, setPricingQuoteError] = useState("");

  const estimatedShippingOption = useMemo(() => shippingOptions[0], [shippingOptions]);
  const shipping = estimatedShippingOption?.price ?? 0;
  const pricingQuoteCartItems = useMemo(() => items
    .filter((item) => !item.isCustomSale)
    .map((item) => ({
      productId: item.product.id,
      variantId: item.variantId || item.variant?.id || null,
      quantity: item.quantity,
    })), [items]);
  const retailSubtotalTTC = useMemo(() => {
    const rawSubtotalTTC = items.reduce((sum, item) => {
      const publicTtcPrice = typeof item.product.pricePublic === "number" ? item.product.pricePublic : item.product.price;
      return sum + publicTtcPrice * item.quantity;
    }, 0);
    return Math.round((rawSubtotalTTC + Number.EPSILON) * 100) / 100;
  }, [items]);
  const hasProfessionalPricing = isApprovedPro && pricingQuote?.pricingTier === "pro";
  const subtotalHT = pricingQuote?.subtotalHT ?? Math.round((retailSubtotalTTC / 1.2 + Number.EPSILON) * 100) / 100;
  const displaySubtotalTTC = pricingQuote?.subtotalTTC ?? retailSubtotalTTC;
  const shippingReferenceAmount = hasProfessionalPricing ? subtotalHT : displaySubtotalTTC;
  const vatRate = pricingQuote?.vatRate ?? 20;
  const vatAmount = pricingQuote?.vatAmount ?? Math.round((subtotalHT * (vatRate / 100) + Number.EPSILON) * 100) / 100;
  const merchandiseTotalTTC = pricingQuote?.totalTTC ?? displaySubtotalTTC;
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
  const promoDiscount = promoResult?.valid ? Math.min(promoResult.discount || 0, grandTotal) : 0;
  const discountedGrandTotal = Math.max(0, grandTotal - promoDiscount);
  const proThresholdHT = pricingQuote?.thresholdHT ?? 200;
  const proRemaining = pricingQuote?.remainingHT ?? proThresholdHT;
  const proProgressPercent = pricingQuote?.progressPercent ?? 0;
  const paymentMethods = ([
    { id: "card", label: "CARTE BANCAIRE", icon: CreditCard },
    { id: "paypal", label: "PAYPAL", icon: WalletCards },
    ...(total >= 30 && !isApprovedPro ? [{ id: "paypal_4x" as PaymentMethod, label: "PAYPAL 4X SANS FRAIS", icon: WalletCards }] : []),
    { id: "paybybank", label: "PAIEMENT BANCAIRE INSTANTANÉ (B2B)", icon: Landmark },
  ] satisfies Array<{ id: PaymentMethod; label: string; icon: typeof CreditCard }>).filter((method) => !isApprovedPro || method.id === "paybybank");


  useEffect(() => {
    if (isApprovedPro && paymentMethod !== "paybybank") setPaymentMethod("paybybank");
    if (!isApprovedPro && paymentMethod === "paybybank") setPaymentMethod("card");
  }, [isApprovedPro, paymentMethod]);

  useEffect(() => {
    if (!isApprovedPro || pricingQuoteCartItems.length === 0 || pricingQuoteCartItems.length !== items.length) {
      setPricingQuote(null);
      setPricingQuoteLoading(false);
      setPricingQuoteError("");
      return;
    }

    const controller = new AbortController();
    setPricingQuote(null);
    setPricingQuoteLoading(true);
    setPricingQuoteError("");

    getCheckoutPricingQuote({
      cartItems: pricingQuoteCartItems,
      isB2B: true,
      signal: controller.signal,
    }).then((quote) => {
      if (!controller.signal.aborted) setPricingQuote(quote);
    }).catch((error) => {
      if (!controller.signal.aborted) {
        setPricingQuote(null);
        setPricingQuoteError(error instanceof Error ? error.message : "Le tarif professionnel est momentanément indisponible.");
      }
    }).finally(() => {
      if (!controller.signal.aborted) setPricingQuoteLoading(false);
    });

    return () => controller.abort();
  }, [isApprovedPro, items.length, pricingQuoteCartItems]);

  useEffect(() => {
    const storedPromo = window.localStorage.getItem("barberparadise-promo-code") || "";
    setPromoCode(storedPromo);
    setPromoResult(storedPromo ? { valid: true, code: storedPromo, message: "Code enregistré, validation au récapitulatif." } : null);
  }, []);

  const savePromoCode = async () => {
    const normalized = promoCode.trim().toUpperCase();
    setPromoCode(normalized);
    setPromoError("");
    setPromoResult(null);

    if (!normalized) {
      window.localStorage.removeItem("barberparadise-promo-code");
      return;
    }

    setPromoLoading(true);
    try {
      const result = await validatePromotionCode({
        code: normalized,
        cartTotal: shippingReferenceAmount,
        cartItems: promotionCartItems,
        customerType: isApprovedPro ? "b2b" : "b2c",
        shipping,
      });
      if (!result.valid) {
        window.localStorage.removeItem("barberparadise-promo-code");
        setPromoError(result.message || "Ce code promo n’est pas applicable à votre panier.");
        return;
      }
      window.localStorage.setItem("barberparadise-promo-code", normalized);
      setPromoResult(result);
    } catch (error) {
      window.localStorage.removeItem("barberparadise-promo-code");
      setPromoError(error instanceof Error ? error.message : "Impossible de valider ce code promo.");
    } finally {
      setPromoLoading(false);
    }
  };

  useEffect(() => {
    if (items.length === 0) return;
    const controller = new AbortController();

    async function loadEstimatedShipping() {
      setShippingLoading(true);
      setShippingError("");
      try {
        const params = new URLSearchParams({ country: "FR", total: String(shippingReferenceAmount), isB2B: String(isApprovedPro), isPro: String(isApprovedPro) });
        const res = await fetch(`${API_URL}/api/checkout/shipping-options?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as ShippingEstimateResponse;
        if (!res.ok) throw new Error(data.error || "Impossible d’estimer la livraison");
        setShippingOptions(data.options || []);
        setFreeShippingRemaining(Math.max(0, data.freeShippingRemaining ?? 0));
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setShippingOptions([]);
          setFreeShippingRemaining(0);
          setShippingError(err instanceof Error ? err.message : "Erreur d’estimation livraison");
        }
      } finally {
        if (!controller.signal.aborted) setShippingLoading(false);
      }
    }

    loadEstimatedShipping();
    return () => controller.abort();
  }, [items.length, shippingReferenceAmount, isApprovedPro]);

  if (items.length === 0) {
    return (
      <div className="bg-[#131313] min-h-screen text-[#e5e2e1] flex flex-col items-center justify-center px-4 py-32">
        <ShoppingBag size={48} className="text-gray-700 mb-8" />
        <h1 className="text-4xl font-black tracking-tighter italic uppercase mb-4">Votre panier est vide</h1>
        <p className="text-gray-500 text-xs tracking-widest uppercase mb-10">
          Découvrez notre catalogue de produits professionnels
        </p>
        <Link
          href="/catalogue"
          className="flex items-center gap-3 bg-[#ff4a8d] text-white px-8 py-4 text-xs font-black tracking-widest uppercase hover:bg-[#ff1f70] transition-colors"
        >
          EXPLORER LE CATALOGUE
          <ArrowRight size={14} />
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-[#131313] min-h-screen text-[#e5e2e1]">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-12">

        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter italic uppercase">MON PANIER</h1>
            <p className="text-gray-500 text-xs tracking-widest uppercase mt-2">
              {itemCount} article{itemCount > 1 ? "s" : ""}
            </p>
          </div>
          <Link
            href="/catalogue"
            className="flex items-center gap-2 text-xs font-black tracking-widest uppercase text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
            CONTINUER LES ACHATS
          </Link>
        </div>

        {removedInvalidVariantLines.length > 0 && (
          <div className="mb-8 border border-amber-400/30 bg-amber-400/10 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-100">
                  Panier mis à jour
                </p>
                <p className="mt-2 text-xs leading-relaxed text-amber-50/80">
                  Certains articles ajoutés avant la mise à jour des variantes ne contenaient pas de variante valide et ont été retirés du panier. Merci de les ajouter à nouveau depuis leur fiche produit en sélectionnant une variante.
                </p>
                <p className="mt-2 text-[10px] uppercase tracking-widest text-amber-100/70">
                  {removedInvalidVariantLines.join(" · ")}
                </p>
              </div>
              <button
                type="button"
                onClick={clearRemovedInvalidVariantLines}
                className="text-[10px] font-black uppercase tracking-widest text-amber-100 hover:text-white"
              >
                Masquer
              </button>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-12">

          {/* ─── LISTE DES ARTICLES ─── */}
          <div className="lg:col-span-2">
            <div className="hidden md:grid grid-cols-12 gap-4 pb-4 border-b border-white/5">
              <div className="col-span-6">
                <span className="text-[10px] font-black tracking-[0.3em] uppercase text-gray-500">PRODUIT</span>
              </div>
              <div className="col-span-2 text-center">
                <span className="text-[10px] font-black tracking-[0.3em] uppercase text-gray-500">PRIX</span>
              </div>
              <div className="col-span-2 text-center">
                <span className="text-[10px] font-black tracking-[0.3em] uppercase text-gray-500">QTÉ</span>
              </div>
              <div className="col-span-2 text-right">
                <span className="text-[10px] font-black tracking-[0.3em] uppercase text-gray-500">TOTAL</span>
              </div>
            </div>

            {items.map((item) => {
              const img = getVariantImage(item.product, item.variant);
              const selectedVariantId = item.variantId || item.variant?.id || null;
              const quoteItem = getPricingQuoteItem(pricingQuote, item.product.id, selectedVariantId);
              const publicUnitTTC = typeof item.product.pricePublic === "number" ? item.product.pricePublic : item.product.price;
              const usesProfessionalPrice = hasProfessionalPricing && quoteItem?.priceSource === "pro";
              const displayedUnitPrice = usesProfessionalPrice ? quoteItem.appliedUnitHT : quoteItem?.appliedUnitTTC ?? publicUnitTTC;
              const lineTotal = displayedUnitPrice * item.quantity;

              return (
                <div key={`${item.product.id}-${item.variantId || item.variant?.id || "product"}`} className="grid grid-cols-12 gap-4 py-6 border-b border-white/5 items-center">
                  <div className="col-span-12 md:col-span-6 flex items-center gap-4">
                    <div className="w-20 h-20 bg-[#1c1b1b] flex-shrink-0 overflow-hidden">
                      {img ? (
                        <Image
                          src={img}
                          alt={item.product.name}
                          width={80}
                          height={80}
                          className="w-full h-full object-contain p-2 opacity-90"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-700">
                          <ShoppingBag size={20} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black tracking-widest uppercase text-[#ff4a8d] mb-1">
                        {item.product.brand}
                      </p>
                      <h3 className="font-black text-sm tracking-tight leading-tight mb-2">
                        {item.product.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          onClick={() => removeItem(item.product.id, selectedVariantId)}
                          className="flex items-center gap-1.5 text-[10px] font-black tracking-widest uppercase text-gray-600 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={10} />
                          RETIRER
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-4 md:col-span-2 text-center">
                    <span className="block text-sm font-black">{formatPrice(displayedUnitPrice)}</span>
                    <span className={`mt-1 block text-[9px] font-black uppercase tracking-widest ${usesProfessionalPrice ? "text-emerald-300" : "text-gray-500"}`}>
                      {usesProfessionalPrice ? "Prix pro HT" : "Public TTC"}
                    </span>
                  </div>

                  <div className="col-span-4 md:col-span-2 flex items-center justify-center">
                    <div className="flex items-center border border-white/10">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1, selectedVariantId)}
                        className="px-3 py-2 text-gray-500 hover:text-white transition-colors"
                      >
                        <Minus size={12} />
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={item.quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val >= 1 && val <= 999) {
                            updateQuantity(item.product.id, val, selectedVariantId);
                          }
                        }}
                        onBlur={(e) => {
                          if (!e.target.value || parseInt(e.target.value) < 1) {
                            updateQuantity(item.product.id, 1, selectedVariantId);
                          }
                        }}
                        className="w-16 text-center bg-white border border-bp-border rounded text-black focus:border-bp-pink outline-none px-2 py-1"
                      />
                      <button
                        onClick={() => updateQuantity(item.product.id, Math.min(999, item.quantity + 1), selectedVariantId)}
                        className="px-3 py-2 text-gray-500 hover:text-white transition-colors"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="col-span-4 md:col-span-2 text-right">
                    <span className="text-sm font-black">{formatPrice(lineTotal)}</span>
                    <span className="mt-1 block text-[9px] uppercase tracking-widest text-gray-500">{usesProfessionalPrice ? "HT" : "TTC"}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ─── RÉCAPITULATIF ─── */}
          <div className="lg:col-span-1">
            <div className="bg-[#1c1b1b] p-8 sticky top-24">
              <h2 className="text-xs font-black tracking-[0.3em] uppercase text-gray-500 mb-8">RÉCAPITULATIF</h2>

              <div className="space-y-4 mb-8">
                {hasProfessionalPricing ? (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-400 uppercase tracking-widest">Sous-total HT</span>
                      <span className="text-sm font-black">{formatPrice(subtotalHT)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-400 uppercase tracking-widest">TVA ({vatRate}%)</span>
                      <span className="text-sm font-black">{formatPrice(vatAmount)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400 uppercase tracking-widest">Sous-total public TTC</span>
                    <span className="text-sm font-black">{formatPrice(displaySubtotalTTC)}</span>
                  </div>
                )}
                <div className="space-y-2 border border-white/10 bg-black/20 p-4">
                  <label className="text-[10px] font-black tracking-[0.25em] uppercase text-gray-500">Code promo</label>
                  <div className="flex gap-2">
                    <input
                      value={promoCode}
                      onChange={(event) => { setPromoCode(event.target.value.toUpperCase()); setPromoResult(null); setPromoError(""); }}
                      placeholder="WELCOME10"
                      className="min-w-0 flex-1 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-black outline-none"
                    />
                    <button type="button" onClick={savePromoCode} disabled={promoLoading} className="bg-[#ff4a8d] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-[#ff1f70] disabled:opacity-60">
                      {promoLoading ? "..." : "OK"}
                    </button>
                  </div>
                  {promoResult?.valid ? (
                    <p className="text-[10px] uppercase tracking-widest text-emerald-300">
                      {promoResult.name || promoResult.code || promoCode} appliqué · -{formatPrice(promoDiscount)}
                    </p>
                  ) : promoError ? (
                    <p className="text-[10px] uppercase tracking-widest text-red-300">{promoError}</p>
                  ) : (
                    <p className="text-[10px] uppercase tracking-widest text-gray-600">
                      Saisissez un code pour vérifier immédiatement sa remise.
                    </p>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400 uppercase tracking-widest">Livraison</span>
                  {shippingLoading ? (
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest">Calcul...</span>
                  ) : shipping === 0 ? (
                    <span className="text-xs font-black text-green-400 uppercase tracking-widest">GRATUITE</span>
                  ) : (
                    <span className="text-sm font-black">{formatPrice(shipping)}</span>
                  )}
                </div>
                {estimatedShippingOption && (
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest">
                    {estimatedShippingOption.carrier} · {estimatedShippingOption.days} · estimation France
                  </p>
                )}
                {shippingError && (
                  <p className="text-[10px] text-red-300 uppercase tracking-widest">{shippingError}</p>
                )}
                {isApprovedPro && (
                  <div className={`border p-4 ${hasProfessionalPricing ? "border-emerald-500/30 bg-emerald-500/10" : "border-[#ff4a8d]/40 bg-[#ff4a8d]/10"}`}>
                    <div className="flex items-center justify-between gap-4">
                      <p className={`text-sm font-black uppercase tracking-[0.14em] ${hasProfessionalPricing ? "text-emerald-300" : "text-[#ff4a8d]"}`}>Tarif pro dès {formatPrice(proThresholdHT)} HT</p>
                      <span className="text-[10px] font-black text-gray-300">{pricingQuote ? `${Math.min(100, Math.max(0, proProgressPercent))}%` : "Calcul..."}</span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden bg-white/10" aria-label={pricingQuote ? `Progression vers le tarif professionnel : ${Math.min(100, Math.max(0, proProgressPercent))}%` : "Calcul de la progression vers le tarif professionnel"}>
                      <div className={`h-full transition-all ${hasProfessionalPricing ? "bg-emerald-400" : "bg-[#ff4a8d]"}`} style={{ width: `${Math.min(100, Math.max(0, proProgressPercent))}%` }} />
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-gray-300">
                      {pricingQuote && hasProfessionalPricing
                        ? "Seuls les articles éligibles utilisent le prix pro HT ; les autres restent au tarif public TTC."
                        : pricingQuote
                          ? `Votre panier reste commandable au prix public TTC. Ajoutez encore ${formatPrice(proRemaining)} HT d’articles éligibles pour accéder aux prix pro.`
                          : "Votre panier reste commandable au prix public TTC. Le montant d’articles éligibles au tarif pro est en cours de vérification."}
                    </p>
                  </div>
                )}
                {isApprovedPro && pricingQuoteLoading && (
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest">Mise à jour de votre tarification...</p>
                )}
                {isApprovedPro && pricingQuoteError && (
                  <p className="text-[10px] text-amber-200 uppercase tracking-widest">Tarif public affiché temporairement · {pricingQuoteError}</p>
                )}
                {shipping > 0 && freeShippingRemaining > 0 && (
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest">
                    Plus que {formatPrice(freeShippingRemaining)}{hasProfessionalPricing ? " HT" : ""} pour la livraison gratuite
                  </p>
                )}
                {promoDiscount > 0 && (
                  <div className="flex justify-between items-center text-emerald-300">
                    <span className="text-xs text-emerald-300 uppercase tracking-widest">Remise</span>
                    <span className="text-sm font-black">-{formatPrice(promoDiscount)}</span>
                  </div>
                )}
                <div className="border-t border-white/5 pt-4 flex justify-between items-center">
                  <span className="text-xs font-black tracking-widest uppercase">TOTAL TTC</span>
                  <span className="text-2xl font-black">{formatPrice(discountedGrandTotal)}</span>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-[10px] font-black tracking-[0.3em] uppercase text-gray-500 mb-4">Paiement</h3>
                <div className="space-y-2">
                  {paymentMethods.map((method) => {
                    const Icon = method.icon;
                    const active = paymentMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPaymentMethod(method.id)}
                        className={`w-full border p-3 text-left transition-colors ${active ? "border-[#ff4a8d] bg-[#ff4a8d]/10" : "border-white/10 hover:border-white/25"}`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon size={15} className={active ? "text-[#ff4a8d]" : "text-gray-500"} />
                          <p className="text-[11px] font-black tracking-widest uppercase">{method.label}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Link
                href="/commande"
                onClick={() => {
                  sessionStorage.setItem("barberparadise-payment-method", paymentMethod);
                }}
                className="w-full flex items-center justify-center gap-3 bg-[#ff4a8d] hover:bg-[#ff1f70] text-white py-5 text-xs font-black tracking-widest uppercase transition-colors"
              >
                VALIDER LA COMMANDE
                <ArrowRight size={14} />
              </Link>

              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-3 text-[10px] text-gray-600 uppercase tracking-widest">
                  <span className="text-[#ff4a8d]">✓</span>
                  Paiement 100% sécurisé
                </div>
                <div className="flex items-center gap-3 text-[10px] text-gray-600 uppercase tracking-widest">
                  <span className="text-[#ff4a8d]">✓</span>
                  Retours sous 14 jours
                </div>
                <div className="flex items-center gap-3 text-[10px] text-gray-600 uppercase tracking-widest">
                  <span className="text-[#ff4a8d]">✓</span>
                  Expédition 24-48h
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
