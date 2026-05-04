"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Trash2, Minus, Plus, ArrowLeft, ArrowRight, ShoppingBag, CreditCard, Landmark, WalletCards } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { getProStatus } from "@/lib/customer-api";
import { parseImages, formatPrice } from "@/lib/utils";

type PaymentMethod = "card" | "pay_by_bank" | "paypal_4x";

type ShippingOption = {
  id: string;
  label: string;
  price: number;
  carrier: string;
  days: string;
  isFree: boolean;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://barberparadise-backend.onrender.com";

export default function CartPage() {
  const { items, removeItem, updateQuantity, total, itemCount } = useCart();
  const { isAuthenticated, customer } = useCustomerAuth();
  const [isApprovedPro, setIsApprovedPro] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoSaved, setPromoSaved] = useState(false);

  const estimatedShippingOption = useMemo(() => shippingOptions[0], [shippingOptions]);
  const shipping = estimatedShippingOption?.price ?? 0;
  const grandTotal = total + shipping;
  const minimumProOrder = 200;
  const freeShippingThreshold = isApprovedPro ? 500 : 49;
  const freeShippingRemaining = Math.max(0, freeShippingThreshold - total);
  const proRemaining = Math.max(0, minimumProOrder - total);
  const isProMinimumBlocked = isApprovedPro && total < minimumProOrder;
  const paymentMethods = ([
    { id: "card", label: "CARTE BANCAIRE", icon: CreditCard },
    { id: "paypal_4x", label: "PAYPAL 4X SANS FRAIS", icon: WalletCards },
    { id: "pay_by_bank", label: "VIREMENT BANCAIRE", icon: Landmark },
  ] satisfies Array<{ id: PaymentMethod; label: string; icon: typeof CreditCard }>).filter((method) => !isApprovedPro || method.id === "pay_by_bank");

  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated) {
      setIsApprovedPro(false);
      return;
    }
    getProStatus()
      .then((status) => { if (!cancelled) setIsApprovedPro(status.isApprovedPro); })
      .catch(() => { if (!cancelled) setIsApprovedPro(false); });
    return () => { cancelled = true; };
  }, [isAuthenticated, customer?.id]);

  useEffect(() => {
    if (isApprovedPro && paymentMethod !== "pay_by_bank") setPaymentMethod("pay_by_bank");
  }, [isApprovedPro, paymentMethod]);

  useEffect(() => {
    const storedPromo = window.localStorage.getItem("barberparadise-promo-code") || "";
    setPromoCode(storedPromo);
    setPromoSaved(Boolean(storedPromo));
  }, []);

  const savePromoCode = () => {
    const normalized = promoCode.trim().toUpperCase();
    setPromoCode(normalized);
    if (normalized) {
      window.localStorage.setItem("barberparadise-promo-code", normalized);
      setPromoSaved(true);
    } else {
      window.localStorage.removeItem("barberparadise-promo-code");
      setPromoSaved(false);
    }
  };

  useEffect(() => {
    if (items.length === 0) return;
    const controller = new AbortController();

    async function loadEstimatedShipping() {
      setShippingLoading(true);
      setShippingError("");
      try {
        const params = new URLSearchParams({ country: "FR", total: String(total), isPro: String(isApprovedPro) });
        const res = await fetch(`${API_URL}/api/checkout/shipping-options?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as { options?: ShippingOption[]; error?: string };
        if (!res.ok) throw new Error(data.error || "Impossible d’estimer la livraison");
        setShippingOptions(data.options || []);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setShippingOptions([]);
          setShippingError(err instanceof Error ? err.message : "Erreur d’estimation livraison");
        }
      } finally {
        if (!controller.signal.aborted) setShippingLoading(false);
      }
    }

    loadEstimatedShipping();
    return () => controller.abort();
  }, [items.length, total, isApprovedPro]);

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
              const images = parseImages(item.product.images);
              const img = images[0] || "";
              const lineTotal = item.product.price * item.quantity;

              return (
                <div key={item.product.id} className="grid grid-cols-12 gap-4 py-6 border-b border-white/5 items-center">
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
                      <button
                        onClick={() => removeItem(item.product.id)}
                        className="flex items-center gap-1.5 text-[10px] font-black tracking-widest uppercase text-gray-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={10} />
                        RETIRER
                      </button>
                    </div>
                  </div>

                  <div className="col-span-4 md:col-span-2 text-center">
                    <span className="text-sm font-black">{formatPrice(item.product.price)}</span>
                  </div>

                  <div className="col-span-4 md:col-span-2 flex items-center justify-center">
                    <div className="flex items-center border border-white/10">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
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
                            updateQuantity(item.product.id, val);
                          }
                        }}
                        onBlur={(e) => {
                          if (!e.target.value || parseInt(e.target.value) < 1) {
                            updateQuantity(item.product.id, 1);
                          }
                        }}
                        className="w-16 text-center bg-white border border-bp-border rounded text-black focus:border-bp-pink outline-none px-2 py-1"
                      />
                      <button
                        onClick={() => updateQuantity(item.product.id, Math.min(999, item.quantity + 1))}
                        className="px-3 py-2 text-gray-500 hover:text-white transition-colors"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="col-span-4 md:col-span-2 text-right">
                    <span className="text-sm font-black">{formatPrice(lineTotal)}</span>
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
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400 uppercase tracking-widest">Sous-total</span>
                  <span className="text-sm font-black">{formatPrice(total)}</span>
                </div>
                <div className="space-y-2 border border-white/10 bg-black/20 p-4">
                  <label className="text-[10px] font-black tracking-[0.25em] uppercase text-gray-500">Code promo</label>
                  <div className="flex gap-2">
                    <input
                      value={promoCode}
                      onChange={(event) => { setPromoCode(event.target.value.toUpperCase()); setPromoSaved(false); }}
                      placeholder="WELCOME10"
                      className="min-w-0 flex-1 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-black outline-none"
                    />
                    <button type="button" onClick={savePromoCode} className="bg-[#ff4a8d] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-[#ff1f70]">
                      OK
                    </button>
                  </div>
                  <p className="text-[10px] uppercase tracking-widest text-gray-600">
                    {promoSaved ? `Code ${promoCode} enregistré, il sera vérifié au paiement.` : "Le code sera appliqué et contrôlé à l’étape paiement."}
                  </p>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400 uppercase tracking-widest">Livraison estimée</span>
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
                  <div className={`border p-4 ${isProMinimumBlocked ? "border-[#ff4a8d] bg-[#ff4a8d]/10" : "border-emerald-500/30 bg-emerald-500/10"}`}>
                    <p className={`text-sm font-black uppercase tracking-[0.14em] ${isProMinimumBlocked ? "text-[#ff4a8d]" : "text-emerald-300"}`}>Commande minimum pro : 200€ HT</p>
                    <p className="mt-2 text-xs text-gray-400">
                      {isProMinimumBlocked ? `Il vous manque ${formatPrice(proRemaining)} HT pour valider votre commande professionnelle.` : "Minimum de commande professionnel atteint. Prix affichés en HT."}
                    </p>
                  </div>
                )}
                {shipping > 0 && freeShippingRemaining > 0 && (
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest">
                    Plus que {formatPrice(freeShippingRemaining)}{isApprovedPro ? " HT" : ""} pour la livraison gratuite
                  </p>
                )}
                <div className="border-t border-white/5 pt-4 flex justify-between items-center">
                  <span className="text-xs font-black tracking-widest uppercase">TOTAL</span>
                  <span className="text-2xl font-black">{formatPrice(grandTotal)}</span>
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

              {isProMinimumBlocked ? (
                <button
                  type="button"
                  disabled
                  className="w-full flex items-center justify-center gap-3 bg-[#ff4a8d]/50 text-white/70 py-5 text-xs font-black tracking-widest uppercase cursor-not-allowed"
                >
                  VALIDER LA COMMANDE
                  <ArrowRight size={14} />
                </button>
              ) : (
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
              )}

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
