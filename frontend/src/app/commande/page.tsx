"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Lock, ChevronDown, ShoppingBag } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { parseImages, formatPrice } from "@/lib/utils";

type Step = "contact" | "livraison" | "paiement";

export default function CheckoutPage() {
  const { items, total } = useCart();
  const [step, setStep] = useState<Step>("contact");
  const [orderSummaryOpen, setOrderSummaryOpen] = useState(false);

  const shipping = total >= 49 ? 0 : 5.90;
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

  const updateForm = (key: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  if (items.length === 0) {
    return (
      <div className="bg-[#131313] min-h-screen text-[#e5e2e1] flex flex-col items-center justify-center px-4 py-32">
        <ShoppingBag size={48} className="text-gray-700 mb-8" />
        <h1 className="text-3xl font-black tracking-tighter italic uppercase mb-4">Votre panier est vide</h1>
        <Link
          href="/catalogue"
          className="bg-[#ff4a8d] text-white px-8 py-4 text-xs font-black tracking-widest uppercase hover:bg-[#ff1f70] transition-colors"
        >
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

        {/* ─── FORMULAIRE ─── */}
        <div>
          {/* Logo + retour */}
          <div className="flex items-center justify-between mb-10">
            <Link href="/" className="text-xl font-black italic tracking-tighter uppercase">
              BARBER PARADISE
            </Link>
            <Link
              href="/panier"
              className="flex items-center gap-2 text-xs font-black tracking-widest uppercase text-gray-500 hover:text-white transition-colors"
            >
              <ArrowLeft size={12} />
              PANIER
            </Link>
          </div>

          {/* Récapitulatif mobile */}
          <button
            onClick={() => setOrderSummaryOpen(!orderSummaryOpen)}
            className="lg:hidden w-full flex items-center justify-between bg-[#1c1b1b] px-5 py-4 mb-8"
          >
            <div className="flex items-center gap-3">
              <ShoppingBag size={16} className="text-[#ff4a8d]" />
              <span className="text-xs font-black tracking-widest uppercase">
                {orderSummaryOpen ? "MASQUER" : "VOIR"} LE RÉCAPITULATIF
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-black">{formatPrice(grandTotal)}</span>
              <ChevronDown size={14} className={`transition-transform ${orderSummaryOpen ? "rotate-180" : ""}`} />
            </div>
          </button>

          {/* Récapitulatif mobile ouvert */}
          {orderSummaryOpen && (
            <div className="lg:hidden bg-[#1c1b1b] p-5 mb-8 space-y-4">
              {items.map((item) => {
                const images = parseImages(item.product.images);
                const img = images[0] || "";
                return (
                  <div key={item.product.id} className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-[#2a2a2a] flex-shrink-0 relative">
                      {img && <Image src={img} alt={item.product.name} fill className="object-contain p-1" />}
                      <span className="absolute -top-2 -right-2 w-5 h-5 bg-[#ff4a8d] text-white text-[10px] font-black flex items-center justify-center">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black truncate">{item.product.name}</p>
                    </div>
                    <span className="text-xs font-black">{formatPrice(item.product.price * item.quantity)}</span>
                  </div>
                );
              })}
              <div className="border-t border-white/5 pt-4 flex justify-between">
                <span className="text-xs uppercase tracking-widest text-gray-400">Total</span>
                <span className="font-black">{formatPrice(grandTotal)}</span>
              </div>
            </div>
          )}

          {/* Étapes */}
          <div className="flex items-center gap-3 mb-10">
            {(["contact", "livraison", "paiement"] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (s === "livraison" && step === "paiement") setStep(s);
                    if (s === "contact") setStep(s);
                  }}
                  className={`text-[10px] font-black tracking-[0.3em] uppercase transition-colors ${
                    step === s ? "text-white" : "text-gray-600 hover:text-gray-400"
                  }`}
                >
                  {s.toUpperCase()}
                </button>
                {i < 2 && <span className="text-gray-700 text-xs">›</span>}
              </div>
            ))}
          </div>

          {/* ─── ÉTAPE CONTACT ─── */}
          {step === "contact" && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-black tracking-tighter italic uppercase mb-6">Contact</h2>
                <div className="space-y-6">
                  <div>
                    <label className={labelClass}>Adresse email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => updateForm("email", e.target.value)}
                      placeholder="votre@email.com"
                      className={inputClass}
                    />
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.newsletter}
                      onChange={(e) => updateForm("newsletter", e.target.checked)}
                      className="w-4 h-4 bg-transparent border border-white/20 text-[#ff4a8d] focus:ring-[#ff4a8d] focus:ring-offset-[#131313]"
                    />
                    <span className="text-xs text-gray-400">Recevoir les offres et nouveautés par email</span>
                  </label>
                </div>
              </div>

              <button
                onClick={() => setStep("livraison")}
                disabled={!form.email}
                className="w-full bg-[#ff4a8d] hover:bg-[#ff1f70] disabled:bg-white/5 disabled:text-gray-600 disabled:cursor-not-allowed text-white py-5 text-xs font-black tracking-widest uppercase transition-colors"
              >
                CONTINUER VERS LA LIVRAISON
              </button>
            </div>
          )}

          {/* ─── ÉTAPE LIVRAISON ─── */}
          {step === "livraison" && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-black tracking-tighter italic uppercase mb-6">Adresse de livraison</h2>
                <div className="space-y-6">
                  <div>
                    <label className={labelClass}>Pays</label>
                    <div className="relative">
                      <select
                        value={form.pays}
                        onChange={(e) => updateForm("pays", e.target.value)}
                        className={`${inputClass} appearance-none pr-8`}
                      >
                        <option value="France">France</option>
                        <option value="Belgique">Belgique</option>
                        <option value="Suisse">Suisse</option>
                        <option value="Luxembourg">Luxembourg</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-0 top-3.5 text-gray-500 pointer-events-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className={labelClass}>Prénom</label>
                      <input type="text" value={form.prenom} onChange={(e) => updateForm("prenom", e.target.value)} placeholder="Jean" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Nom</label>
                      <input type="text" value={form.nom} onChange={(e) => updateForm("nom", e.target.value)} placeholder="Dupont" className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Adresse</label>
                    <input type="text" value={form.adresse} onChange={(e) => updateForm("adresse", e.target.value)} placeholder="12 rue de la Paix" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Complément (optionnel)</label>
                    <input type="text" value={form.complement} onChange={(e) => updateForm("complement", e.target.value)} placeholder="Appartement, bâtiment..." className={inputClass} />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className={labelClass}>Code postal</label>
                      <input type="text" value={form.codePostal} onChange={(e) => updateForm("codePostal", e.target.value)} placeholder="75001" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Ville</label>
                      <input type="text" value={form.ville} onChange={(e) => updateForm("ville", e.target.value)} placeholder="Paris" className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Téléphone</label>
                    <input type="tel" value={form.telephone} onChange={(e) => updateForm("telephone", e.target.value)} placeholder="+33 6 12 34 56 78" className={inputClass} />
                  </div>
                </div>
              </div>

              <button
                onClick={() => setStep("paiement")}
                disabled={!form.prenom || !form.nom || !form.adresse || !form.ville || !form.codePostal}
                className="w-full bg-[#ff4a8d] hover:bg-[#ff1f70] disabled:bg-white/5 disabled:text-gray-600 disabled:cursor-not-allowed text-white py-5 text-xs font-black tracking-widest uppercase transition-colors"
              >
                CONTINUER VERS LE PAIEMENT
              </button>

              <button onClick={() => setStep("contact")} className="w-full text-center text-xs text-gray-500 hover:text-white transition-colors uppercase tracking-widest font-black">
                ← Retour au contact
              </button>
            </div>
          )}

          {/* ─── ÉTAPE PAIEMENT ─── */}
          {step === "paiement" && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-black tracking-tighter italic uppercase mb-2">Paiement</h2>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <Lock size={10} />
                  Toutes les transactions sont sécurisées et chiffrées
                </p>

                <div className="border border-white/5 p-6 text-center">
                  <div className="text-gray-600 mb-4">
                    <Lock size={32} className="mx-auto mb-3 text-gray-700" />
                    <p className="text-xs font-black tracking-widest uppercase text-gray-500 mb-2">Paiement Stripe</p>
                    <p className="text-[10px] text-gray-600">
                      Le système de paiement sécurisé sera disponible prochainement.
                    </p>
                  </div>
                  <div className="flex justify-center gap-4 mt-4">
                    {["VISA", "MC", "AMEX", "CB"].map((card) => (
                      <span key={card} className="text-[10px] font-black tracking-widest text-gray-700 border border-white/5 px-2 py-1">
                        {card}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <button
                disabled
                className="w-full bg-white/5 text-gray-600 cursor-not-allowed py-5 text-xs font-black tracking-widest uppercase flex items-center justify-center gap-2"
              >
                <Lock size={12} />
                PAYER {formatPrice(grandTotal)} — BIENTÔT DISPONIBLE
              </button>

              <button onClick={() => setStep("livraison")} className="w-full text-center text-xs text-gray-500 hover:text-white transition-colors uppercase tracking-widest font-black">
                ← Retour à la livraison
              </button>
            </div>
          )}
        </div>

        {/* ─── RÉCAPITULATIF DESKTOP ─── */}
        <div className="hidden lg:block">
          <div className="bg-[#1c1b1b] p-8 sticky top-24">
            <h2 className="text-xs font-black tracking-[0.3em] uppercase text-gray-500 mb-8">VOTRE COMMANDE</h2>

            <div className="space-y-6 mb-8">
              {items.map((item) => {
                const images = parseImages(item.product.images);
                const img = images[0] || "";
                return (
                  <div key={item.product.id} className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-[#2a2a2a] flex-shrink-0 relative overflow-hidden">
                      {img && <Image src={img} alt={item.product.name} fill className="object-contain p-2 opacity-90" />}
                      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#ff4a8d] text-white text-[10px] font-black flex items-center justify-center">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black tracking-widest uppercase text-[#ff4a8d] mb-0.5">{item.product.brand}</p>
                      <p className="text-xs font-black truncate">{item.product.name}</p>
                    </div>
                    <span className="text-sm font-black">{formatPrice(item.product.price * item.quantity)}</span>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-white/5 pt-6 space-y-3">
              <div className="flex justify-between">
                <span className="text-xs text-gray-400 uppercase tracking-widest">Sous-total</span>
                <span className="text-sm font-black">{formatPrice(total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-400 uppercase tracking-widest">Livraison</span>
                {shipping === 0 ? (
                  <span className="text-xs font-black text-green-400 uppercase tracking-widest">GRATUITE</span>
                ) : (
                  <span className="text-sm font-black">{formatPrice(shipping)}</span>
                )}
              </div>
              <div className="border-t border-white/5 pt-4 flex justify-between">
                <span className="text-xs font-black tracking-widest uppercase">TOTAL</span>
                <span className="text-2xl font-black">{formatPrice(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
