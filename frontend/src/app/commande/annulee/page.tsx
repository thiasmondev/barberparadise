"use client";

import Link from "next/link";
import { ArrowLeft, RefreshCcw, ShieldAlert } from "lucide-react";

export default function OrderCancelledPage() {
  return (
    <div className="min-h-screen bg-[#131313] text-[#e5e2e1] flex items-center justify-center px-4 py-24">
      <div className="max-w-xl w-full bg-[#1c1b1b] border border-white/10 p-8 md:p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-8 border border-amber-400/40 text-amber-300 flex items-center justify-center">
          <ShieldAlert size={30} />
        </div>

        <p className="text-[10px] font-black tracking-[0.35em] uppercase text-[#ff4a8d] mb-4">
          Paiement interrompu
        </p>
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter italic uppercase mb-5">
          Commande non finalisée
        </h1>
        <p className="text-sm text-gray-400 leading-relaxed mb-8">
          Aucun paiement validé n’a été confirmé pour cette tentative. Votre panier reste disponible afin de choisir un autre moyen de paiement ou de réessayer.
        </p>

        <div className="grid sm:grid-cols-2 gap-3">
          <Link href="/commande" className="bg-[#ff4a8d] hover:bg-[#ff1f70] text-white py-4 px-5 text-xs font-black tracking-widest uppercase flex items-center justify-center gap-2 transition-colors">
            <RefreshCcw size={14} />
            Réessayer
          </Link>
          <Link href="/panier" className="border border-white/10 hover:border-white/30 py-4 px-5 text-xs font-black tracking-widest uppercase flex items-center justify-center gap-2 transition-colors">
            <ArrowLeft size={14} />
            Retour panier
          </Link>
        </div>
      </div>
    </div>
  );
}
