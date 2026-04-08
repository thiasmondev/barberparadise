// ============================================================
// BARBER PARADISE — Page Checkout
// Couleurs: Primary #4EAADB | Secondary #252525
// ============================================================

import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Check, Lock, Truck } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface FormData {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  billingDifferent: boolean;
  billingStreet?: string;
  billingCity?: string;
  billingPostalCode?: string;
  billingCountry?: string;
  paymentMethod: "card" | "paypal" | "transfer";
  terms: boolean;
}

export default function Checkout() {
  const [, navigate] = useLocation();
  const { state: cartState, totalPrice, clearCart } = useCart();
  const { user, isAuthenticated } = useAuth();
  const [step, setStep] = useState<"shipping" | "payment" | "confirmation">("shipping");
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    email: user?.email || "",
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    phone: user?.phone || "",
    street: user?.address?.street || "",
    city: user?.address?.city || "",
    postalCode: user?.address?.postalCode || "",
    country: user?.address?.country || "France",
    billingDifferent: false,
    paymentMethod: "card",
    terms: false,
  });

  if (cartState.items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-black text-gray-400 mb-4" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            PANIER VIDE
          </h1>
          <p className="text-gray-500 mb-6">Veuillez ajouter des produits avant de commander</p>
          <button onClick={() => navigate("/catalogue")} className="btn-primary">
            Retour au catalogue
          </button>
        </div>
      </div>
    );
  }

  const shipping = totalPrice >= 54 ? 0 : 4.99;
  const total = totalPrice + shipping;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmitShipping = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.firstName || !formData.lastName || !formData.street || !formData.city || !formData.postalCode) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }
    setStep("payment");
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.terms) {
      toast.error("Veuillez accepter les conditions générales");
      return;
    }

    setIsProcessing(true);
    await new Promise((r) => setTimeout(r, 1500));

    toast.success("Commande confirmée !");
    clearCart();
    setStep("confirmation");
    setTimeout(() => navigate("/compte/commandes"), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-secondary text-white py-8">
        <div className="container">
          <h1 className="text-3xl md:text-4xl font-black uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            Passer la Commande
          </h1>
        </div>
      </div>

      <div className="container py-8">
        {/* Progress */}
        <div className="flex items-center justify-between mb-8 max-w-2xl">
          {(["shipping", "payment", "confirmation"] as const).map((s, idx) => (
            <div key={s} className="flex items-center flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                  step === s || (step === "payment" && s === "shipping") || step === "confirmation"
                    ? "bg-primary text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                {step === s || (step === "payment" && s === "shipping") || step === "confirmation" ? (
                  step === s ? idx + 1 : <Check size={16} />
                ) : (
                  idx + 1
                )}
              </div>
              <div className={`flex-1 h-1 mx-2 transition-colors ${idx < 2 && (step === "payment" || step === "confirmation") ? "bg-primary" : "bg-gray-200"}`} />
            </div>
          ))}
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-gray-200 text-gray-500" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            3
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-2">
            {step === "shipping" && (
              <form onSubmit={handleSubmitShipping} className="bg-white border border-gray-200 p-6 space-y-6">
                <h2 className="text-2xl font-black uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  Adresse de Livraison
                </h2>

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="input-bp w-full"
                    required
                  />
                </div>

                {/* Nom / Prénom */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Prénom *</label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="input-bp w-full"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Nom *</label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="input-bp w-full"
                      required
                    />
                  </div>
                </div>

                {/* Téléphone */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Téléphone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="input-bp w-full"
                  />
                </div>

                {/* Adresse */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Adresse *</label>
                  <input
                    type="text"
                    name="street"
                    value={formData.street}
                    onChange={handleInputChange}
                    className="input-bp w-full"
                    required
                  />
                </div>

                {/* Ville / Code postal */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Ville *</label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      className="input-bp w-full"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Code postal *</label>
                    <input
                      type="text"
                      name="postalCode"
                      value={formData.postalCode}
                      onChange={handleInputChange}
                      className="input-bp w-full"
                      required
                    />
                  </div>
                </div>

                {/* Pays */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Pays *</label>
                  <select name="country" value={formData.country} onChange={handleInputChange} className="input-bp w-full">
                    <option>France</option>
                    <option>Belgique</option>
                    <option>Suisse</option>
                    <option>Luxembourg</option>
                  </select>
                </div>

                {/* Adresse facturation */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="billingDifferent"
                    checked={formData.billingDifferent}
                    onChange={handleInputChange}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm text-gray-700">Mon adresse de facturation est différente</span>
                </label>

                <button type="submit" className="btn-primary w-full py-3 text-base">
                  Continuer vers le paiement
                </button>
              </form>
            )}

            {step === "payment" && (
              <form onSubmit={handleSubmitPayment} className="bg-white border border-gray-200 p-6 space-y-6">
                <h2 className="text-2xl font-black uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  Mode de Paiement
                </h2>

                <div className="space-y-3">
                  {[
                    { value: "card", label: "Carte bancaire", icon: "💳" },
                    { value: "paypal", label: "PayPal", icon: "🅿️" },
                    { value: "transfer", label: "Virement bancaire", icon: "🏦" },
                  ].map((method) => (
                    <label key={method.value} className="flex items-center gap-3 p-4 border border-gray-200 cursor-pointer hover:border-primary transition-colors">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={method.value}
                        checked={formData.paymentMethod === method.value}
                        onChange={handleInputChange}
                        className="w-4 h-4 accent-primary"
                      />
                      <span className="text-xl">{method.icon}</span>
                      <span className="text-sm font-semibold text-gray-700">{method.label}</span>
                    </label>
                  ))}
                </div>

                {/* Conditions */}
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="terms"
                    checked={formData.terms}
                    onChange={handleInputChange}
                    className="w-4 h-4 accent-primary mt-1 flex-shrink-0"
                  />
                  <span className="text-sm text-gray-700">
                    J'accepte les <a href="/cgv" className="text-primary hover:underline">conditions générales de vente</a> et la <a href="/confidentialite" className="text-primary hover:underline">politique de confidentialité</a>
                  </span>
                </label>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep("shipping")}
                    className="flex-1 btn-secondary py-3 text-base flex items-center justify-center gap-2"
                  >
                    <ArrowLeft size={16} /> Retour
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="flex-1 btn-primary py-3 text-base flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Lock size={16} /> {isProcessing ? "Traitement..." : "Confirmer la commande"}
                  </button>
                </div>
              </form>
            )}

            {step === "confirmation" && (
              <div className="bg-white border border-gray-200 p-6 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check size={32} className="text-green-600" />
                </div>
                <h2 className="text-2xl font-black uppercase mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  Commande Confirmée !
                </h2>
                <p className="text-gray-600 mb-4">Un email de confirmation a été envoyé à {formData.email}</p>
                <p className="text-sm text-gray-500 mb-6">Vous allez être redirigé vers votre compte...</p>
              </div>
            )}
          </div>

          {/* Résumé */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-gray-200 p-6 sticky top-24 space-y-4">
              <h3 className="font-black uppercase text-lg" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                Résumé
              </h3>

              <div className="space-y-2 max-h-64 overflow-y-auto border-b border-gray-200 pb-4">
                {cartState.items.map(({ product, quantity }) => (
                  <div key={product.id} className="flex justify-between text-sm">
                    <span className="text-gray-600 truncate">{product.name} x{quantity}</span>
                    <span className="font-semibold flex-shrink-0">{(product.price * quantity).toFixed(2)} €</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Sous-total</span>
                  <span className="font-semibold">{totalPrice.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Livraison</span>
                  <span className={`font-semibold ${shipping === 0 ? "text-green-600" : ""}`}>
                    {shipping === 0 ? "Gratuite" : `${shipping.toFixed(2)} €`}
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="flex justify-between items-center">
                  <span className="font-black uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Total</span>
                  <span className="font-black text-xl text-secondary" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    {total.toFixed(2)} €
                  </span>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 p-3 rounded text-xs text-blue-700 flex items-start gap-2">
                <Truck size={14} className="flex-shrink-0 mt-0.5" />
                <span>Livraison gratuite en points relais dès 54€</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
