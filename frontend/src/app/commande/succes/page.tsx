"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, ArrowRight, PackageCheck } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

export default function OrderSuccessPage() {
  const { clearCart } = useCart();

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  return (
    <div className="min-h-screen bg-[#131313] text-[#e5e2e1] flex items-center justify-center px-4 py-24">
      <div className="max-w-xl w-full bg-[#1c1b1b] border border-white/10 p-8 md:p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-8 border border-emerald-400/40 text-emerald-300 flex items-center justify-center">
          <CheckCircle2 size={30} />
        </div>

        <p className="text-[10px] font-black tracking-[0.35em] uppercase text-[#ff4a8d] mb-4">
          Paiement confirmé
        </p>
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter italic uppercase mb-5">
          Merci pour votre commande
        </h1>
        <p className="text-sm text-gray-400 leading-relaxed mb-8">
          Votre paiement a été transmis au prestataire sélectionné. Dès validation définitive, la commande passe en préparation et le stock est ajusté automatiquement.
        </p>

        <div className="border border-white/10 bg-[#131313] p-5 text-left mb-8 flex gap-4">
          <PackageCheck size={20} className="text-[#ff4a8d] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black tracking-widest uppercase mb-2">Suivi de commande</p>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Conservez l’email de confirmation du prestataire de paiement. Le suivi détaillé sera également disponible depuis votre compte client lorsque la commande sera associée à votre adresse email.
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Link href="/catalogue" className="bg-[#ff4a8d] hover:bg-[#ff1f70] text-white py-4 px-5 text-xs font-black tracking-widest uppercase flex items-center justify-center gap-2 transition-colors">
            Continuer les achats
            <ArrowRight size={14} />
          </Link>
          <Link href="/compte" className="border border-white/10 hover:border-white/30 py-4 px-5 text-xs font-black tracking-widest uppercase transition-colors">
            Mon compte
          </Link>
        </div>
      </div>
    </div>
  );
}
