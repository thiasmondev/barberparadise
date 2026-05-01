"use client";

import Link from "next/link";
import { AlertCircle, ArrowLeft, ShoppingCart } from "lucide-react";

export default function OrderCancellationPage() {
  return (
    <div className="min-h-screen bg-[#131313] text-[#e5e2e1] flex items-center justify-center px-4 py-24">
      <div className="max-w-xl w-full bg-[#1c1b1b] border border-white/10 p-8 md:p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-8 border border-amber-400/40 text-amber-300 flex items-center justify-center">
          <AlertCircle size={30} />
        </div>

        <p className="text-[10px] font-black tracking-[0.35em] uppercase text-[#ff4a8d] mb-4">
          Paiement annulé
        </p>
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter italic uppercase mb-5">
          Paiement annulé
        </h1>
        <p className="text-sm text-gray-400 leading-relaxed mb-8">
          Aucun paiement n’a été confirmé. Votre panier reste disponible et vous pouvez reprendre la commande quand vous le souhaitez.
        </p>

        <div className="border border-white/10 bg-[#131313] p-5 text-left mb-8 flex gap-4">
          <ShoppingCart size={20} className="text-[#ff4a8d] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black tracking-widest uppercase mb-2">Votre panier est conservé</p>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Vous pouvez modifier vos articles, choisir un autre moyen de paiement ou retenter la validation depuis le panier.
            </p>
          </div>
        </div>

        <Link href="/panier" className="w-full bg-[#ff4a8d] hover:bg-[#ff1f70] text-white py-5 px-5 text-xs font-black tracking-widest uppercase flex items-center justify-center gap-2 transition-colors">
          <ArrowLeft size={14} />
          Retourner au panier
        </Link>
      </div>
    </div>
  );
}
