"use client";

import Link from "next/link";
import Image from "next/image";
import { Trash2, Minus, Plus, ArrowLeft, ArrowRight, ShoppingBag } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { parseImages, formatPrice } from "@/lib/utils";

export default function CartPage() {
  const { items, removeItem, updateQuantity, total, itemCount } = useCart();

  const shipping = total >= 49 ? 0 : 5.90;
  const grandTotal = total + shipping;

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
                      <span className="w-8 text-center text-xs font-black">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
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
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400 uppercase tracking-widest">Livraison</span>
                  {shipping === 0 ? (
                    <span className="text-xs font-black text-green-400 uppercase tracking-widest">GRATUITE</span>
                  ) : (
                    <span className="text-sm font-black">{formatPrice(shipping)}</span>
                  )}
                </div>
                {shipping > 0 && (
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest">
                    Plus que {formatPrice(49 - total)} pour la livraison gratuite
                  </p>
                )}
                <div className="border-t border-white/5 pt-4 flex justify-between items-center">
                  <span className="text-xs font-black tracking-widest uppercase">TOTAL</span>
                  <span className="text-2xl font-black">{formatPrice(grandTotal)}</span>
                </div>
              </div>

              <Link
                href="/commande"
                className="w-full flex items-center justify-center gap-3 bg-[#ff4a8d] hover:bg-[#ff1f70] text-white py-5 text-xs font-black tracking-widest uppercase transition-colors"
              >
                PASSER LA COMMANDE
                <ArrowRight size={14} />
              </Link>

              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-3 text-[10px] text-gray-600 uppercase tracking-widest">
                  <span className="text-[#ff4a8d]">✓</span>
                  Paiement 100% sécurisé
                </div>
                <div className="flex items-center gap-3 text-[10px] text-gray-600 uppercase tracking-widest">
                  <span className="text-[#ff4a8d]">✓</span>
                  Retours sous 30 jours
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
