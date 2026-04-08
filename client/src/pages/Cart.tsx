// ============================================================
// BARBER PARADISE — Page Panier
// Couleurs: Primary #4EAADB | Secondary #252525
// ============================================================

import { Link } from "wouter";
import { Trash2, Plus, Minus, ArrowRight, ShoppingCart, Tag } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

export default function Cart() {
  const { state, removeItem, updateQuantity, clearCart, totalPrice, totalItems } = useCart();

  const shipping = totalPrice >= 54 ? 0 : 4.99;
  const total = totalPrice + shipping;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-secondary text-white py-8">
        <div className="container">
          <h1 className="text-3xl md:text-4xl font-black uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            Mon Panier
          </h1>
          <p className="text-gray-400 text-sm mt-1">{totalItems} article{totalItems !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="container py-8">
        {state.items.length === 0 ? (
          <div className="text-center py-20 bg-white border border-gray-200">
            <ShoppingCart size={64} className="text-gray-200 mx-auto mb-4" />
            <h2 className="text-2xl font-black text-gray-400 mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>VOTRE PANIER EST VIDE</h2>
            <p className="text-gray-500 mb-6">Découvrez notre sélection de produits professionnels</p>
            <Link href="/catalogue" className="btn-primary inline-flex items-center gap-2">
              Voir les produits <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Items */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">{totalItems} article{totalItems !== 1 ? "s" : ""}</span>
                <button onClick={clearCart} className="text-sm text-red-500 hover:underline flex items-center gap-1">
                  <Trash2 size={14} /> Vider le panier
                </button>
              </div>

              {state.items.map(({ product, quantity }) => (
                <div key={product.id} className="bg-white border border-gray-200 p-4 flex gap-4 hover:border-primary/30 transition-colors">
                  <Link href={`/produit/${product.slug}`}>
                    <img src={product.images[0]} alt={product.name} className="w-24 h-24 object-cover flex-shrink-0 border border-gray-100" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-primary font-semibold uppercase">{product.brand}</p>
                        <Link href={`/produit/${product.slug}`}>
                          <h3 className="font-semibold text-gray-800 hover:text-primary transition-colors leading-tight" style={{ fontFamily: "'Barlow', sans-serif", textTransform: "none" }}>
                            {product.name}
                          </h3>
                        </Link>
                      </div>
                      <button
                        onClick={() => removeItem(product.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border border-gray-200">
                        <button
                          onClick={() => updateQuantity(product.id, quantity - 1)}
                          className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 transition-colors"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-10 text-center text-sm font-bold">{quantity}</span>
                        <button
                          onClick={() => updateQuantity(product.id, quantity + 1)}
                          className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 transition-colors"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      <div className="text-right">
                        <p className="font-black text-secondary text-lg" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                          {(product.price * quantity).toFixed(2)} €
                        </p>
                        {quantity > 1 && (
                          <p className="text-xs text-gray-400">{product.price.toFixed(2)} € / unité</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white border border-gray-200 p-6 sticky top-24">
                <h2 className="font-black uppercase text-lg mb-4 pb-4 border-b border-gray-200" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  Récapitulatif
                </h2>

                {/* Code promo */}
                <div className="mb-4">
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center border border-gray-200 px-3 gap-2">
                      <Tag size={14} className="text-gray-400" />
                      <input
                        type="text"
                        placeholder="Code promo"
                        className="flex-1 py-2 text-sm focus:outline-none"
                      />
                    </div>
                    <button className="bg-secondary text-white px-4 py-2 text-sm font-bold uppercase hover:bg-primary transition-colors" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                      OK
                    </button>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Sous-total</span>
                    <span className="font-semibold">{totalPrice.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Livraison</span>
                    <span className={`font-semibold ${shipping === 0 ? "text-green-600" : ""}`}>
                      {shipping === 0 ? "Gratuite" : `${shipping.toFixed(2)} €`}
                    </span>
                  </div>
                  {totalPrice < 54 && (
                    <p className="text-xs text-primary bg-primary/10 px-3 py-2">
                      Plus que {(54 - totalPrice).toFixed(2)} € pour la livraison gratuite !
                    </p>
                  )}
                </div>

                <div className="border-t border-gray-200 pt-4 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-lg uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Total</span>
                    <span className="font-black text-2xl text-secondary" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                      {total.toFixed(2)} €
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">TVA incluse</p>
                </div>

                <Link href="/checkout" className="btn-primary w-full flex items-center justify-center gap-2 text-base py-4">
                  Passer la commande <ArrowRight size={18} />
                </Link>

                <Link href="/catalogue" className="block text-center text-sm text-gray-500 hover:text-primary transition-colors mt-3 underline underline-offset-2">
                  Continuer mes achats
                </Link>

                {/* Paiement sécurisé */}
                <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                  <p className="text-xs text-gray-400 mb-2">Paiement 100% sécurisé</p>
                  <div className="flex justify-center gap-2">
                    {["VISA", "MC", "CB", "PP"].map((c) => (
                      <div key={c} className="bg-gray-100 px-2 py-1 text-xs font-bold text-gray-500 rounded-sm">{c}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
