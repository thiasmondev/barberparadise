"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Lock, ChevronDown, ShoppingBag, CreditCard, Landmark, WalletCards, ReceiptText, AlertCircle, Smartphone } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { getCustomerAddresses, type CustomerAddress } from "@/lib/customer-api";
import { parseImages, formatPrice } from "@/lib/utils";

type Step = "contact" | "livraison" | "paiement";
type PaymentMethod =
  | "card"
  | "pay_by_bank"
  | "sepa"
  | "paypal_4x"
  | "apple_pay"
  | "google_pay"
  | "bancontact"
  | "ideal"
  | "blik"
  | "mb_way"
  | "multibanco"
  | "card_international";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://barberparadise-backend.onrender.com";

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
  pay_by_bank: { label: "VIREMENT BANCAIRE", badge: "BANK", icon: Landmark },
  sepa: { label: "PRÉLÈVEMENT SEPA", badge: "SEPA", icon: ReceiptText },
  paypal_4x: { label: "PAYPAL 4X SANS FRAIS", badge: "PP", icon: WalletCards },
  apple_pay: { label: "APPLE PAY", badge: "APPLE", icon: Smartphone },
  google_pay: { label: "GOOGLE PAY", badge: "GPAY", icon: Smartphone },
  bancontact: { label: "BANCONTACT", badge: "BE", icon: Landmark },
  ideal: { label: "IDEAL", badge: "NL", icon: Landmark },
  blik: { label: "BLIK", badge: "PL", icon: Smartphone },
  mb_way: { label: "MB WAY", badge: "PT", icon: Smartphone },
  multibanco: { label: "MULTIBANCO", badge: "PT", icon: Landmark },
  card_international: { label: "CARTE BANCAIRE", badge: "INT", icon: CreditCard },
};

function getCountryCode(countryName: string): string {
  return COUNTRY_CODE_BY_NAME[countryName] || countryName.toUpperCase().slice(0, 2) || "FR";
}

function supportsApplePay(): boolean {
  if (typeof window === "undefined") return false;
  const applePaySession = (window as unknown as { ApplePaySession?: { canMakePayments?: () => boolean } }).ApplePaySession;
  return Boolean(applePaySession?.canMakePayments?.());
}

export default function CheckoutPage() {
  const { items, total } = useCart();
  const { customer, isAuthenticated, isLoading: customerLoading } = useCustomerAuth();
  const [step, setStep] = useState<Step>("contact");
  const [guestCheckout, setGuestCheckout] = useState(false);
  const [orderSummaryOpen, setOrderSummaryOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [availableMethods, setAvailableMethods] = useState<PaymentMethod[]>([]);
  const [methodsLoading, setMethodsLoading] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  const shipping = total >= 49 ? 0 : 5.9;
  const grandTotal = total + shipping;

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

  const countryCode = useMemo(() => getCountryCode(form.pays), [form.pays]);
  const displayMethods = useMemo(
    () => availableMethods.filter((method) => method !== "apple_pay" || supportsApplePay()),
    [availableMethods],
  );

  const checkoutSteps: Step[] = isAuthenticated ? ["livraison", "paiement"] : ["contact", "livraison", "paiement"];

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
    const storedMethod = sessionStorage.getItem("barberparadise-payment-method") as PaymentMethod | null;
    if (storedMethod && Object.keys(METHOD_CONFIG).includes(storedMethod)) setPaymentMethod(storedMethod);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function loadMethods() {
      setMethodsLoading(true);
      setPaymentError("");
      try {
        const res = await fetch(`${API_URL}/api/checkout/available-methods?country=${countryCode}&isB2B=false`, {
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
  }, [countryCode]);

  const updateForm = (key: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleCheckout = async () => {
    setPaymentError("");
    setIsSubmittingPayment(true);

    try {
      const res = await fetch(`${API_URL}/api/checkout/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartItems: items.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
          customerEmail: form.email,
          customerId: isAuthenticated && customer ? customer.id : undefined,
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
          paymentMethod,
          isB2B: false,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Impossible d'initialiser le paiement");
      if (!data.checkoutUrl) throw new Error("URL de paiement indisponible");

      window.location.href = data.checkoutUrl;
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Erreur paiement inconnue");
      setIsSubmittingPayment(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="bg-[#131313] min-h-screen text-[#e5e2e1] flex flex-col items-center justify-center px-4 py-32">
        <ShoppingBag size={48} className="text-gray-700 mb-8" />
        <h1 className="text-3xl font-black tracking-tighter italic uppercase mb-4">Votre panier est vide</h1>
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

          <button onClick={() => setOrderSummaryOpen(!orderSummaryOpen)} className="lg:hidden w-full flex items-center justify-between bg-[#1c1b1b] px-5 py-4 mb-8">
            <div className="flex items-center gap-3"><ShoppingBag size={16} className="text-[#ff4a8d]" /><span className="text-xs font-black tracking-widest uppercase">{orderSummaryOpen ? "MASQUER" : "VOIR"} LE RÉCAPITULATIF</span></div>
            <div className="flex items-center gap-3"><span className="font-black">{formatPrice(grandTotal)}</span><ChevronDown size={14} className={`transition-transform ${orderSummaryOpen ? "rotate-180" : ""}`} /></div>
          </button>

          {orderSummaryOpen && (
            <div className="lg:hidden bg-[#1c1b1b] p-5 mb-8 space-y-4">
              {items.map((item) => {
                const img = parseImages(item.product.images)[0] || "";
                return (
                  <div key={item.product.id} className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-[#2a2a2a] flex-shrink-0 relative">{img && <Image src={img} alt={item.product.name} fill className="object-contain p-1" />}<span className="absolute -top-2 -right-2 w-5 h-5 bg-[#ff4a8d] text-white text-[10px] font-black flex items-center justify-center">{item.quantity}</span></div>
                    <div className="flex-1 min-w-0"><p className="text-xs font-black truncate">{item.product.name}</p></div>
                    <span className="text-xs font-black">{formatPrice(item.product.price * item.quantity)}</span>
                  </div>
                );
              })}
              <div className="border-t border-white/5 pt-4 flex justify-between"><span className="text-xs uppercase tracking-widest text-gray-400">Total</span><span className="font-black">{formatPrice(grandTotal)}</span></div>
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
                </div>
              </div>
              <button onClick={() => setStep("paiement")} disabled={!form.prenom || !form.nom || !form.adresse || !form.ville || !form.codePostal} className="w-full bg-[#ff4a8d] hover:bg-[#ff1f70] disabled:bg-white/5 disabled:text-gray-600 disabled:cursor-not-allowed text-white py-5 text-xs font-black tracking-widest uppercase transition-colors">CONTINUER VERS LE PAIEMENT</button>
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

              <button onClick={handleCheckout} disabled={isSubmittingPayment || displayMethods.length === 0 || methodsLoading} className="w-full bg-[#ff4a8d] hover:bg-[#ff1f70] disabled:bg-white/5 disabled:text-gray-600 disabled:cursor-wait text-white py-5 text-xs font-black tracking-widest uppercase flex items-center justify-center gap-2 transition-colors"><Lock size={12} />{isSubmittingPayment ? "REDIRECTION EN COURS..." : `PAYER ${formatPrice(grandTotal)}`}</button>
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
                  <div key={item.product.id} className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-[#2a2a2a] flex-shrink-0 relative overflow-hidden">{img && <Image src={img} alt={item.product.name} fill className="object-contain p-2 opacity-90" />}<span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#ff4a8d] text-white text-[10px] font-black flex items-center justify-center">{item.quantity}</span></div>
                    <div className="flex-1 min-w-0"><p className="text-[10px] font-black tracking-widest uppercase text-[#ff4a8d] mb-0.5">{item.product.brand}</p><p className="text-xs font-black truncate">{item.product.name}</p></div>
                    <span className="text-sm font-black">{formatPrice(item.product.price * item.quantity)}</span>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-white/5 pt-6 space-y-3"><div className="flex justify-between"><span className="text-xs text-gray-400 uppercase tracking-widest">Sous-total</span><span className="text-sm font-black">{formatPrice(total)}</span></div><div className="flex justify-between"><span className="text-xs text-gray-400 uppercase tracking-widest">Livraison</span>{shipping === 0 ? <span className="text-xs font-black text-green-400 uppercase tracking-widest">GRATUITE</span> : <span className="text-sm font-black">{formatPrice(shipping)}</span>}</div><div className="border-t border-white/5 pt-4 flex justify-between"><span className="text-xs font-black tracking-widest uppercase">TOTAL</span><span className="text-2xl font-black">{formatPrice(grandTotal)}</span></div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
