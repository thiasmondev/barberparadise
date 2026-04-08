// ============================================================
// BARBER PARADISE — Tiroir Panier (Cart Drawer)
// Couleurs: Primary #4EAADB | Secondary #252525
// ============================================================

import { X, ShoppingCart, Trash2, Plus, Minus, ArrowRight } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { Link } from "wouter";

export default function CartDrawer() {
  const { state, closeCart, removeItem, updateQuantity, totalPrice, totalItems } = useCart();

  if (!state.isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
        onClick={closeCart}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-secondary text-white">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} />
            <span className="font-bold uppercase tracking-wider" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1.1rem" }}>
              Mon Panier
            </span>
            {totalItems > 0 && (
              <span className="bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {totalItems}
              </span>
            )}
          </div>
          <button
            onClick={closeCart}
            className="p-1.5 hover:bg-white/20 rounded transition-colors"
            aria-label="Fermer le panier"
          >
            <X size={20} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto">
          {state.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
              <ShoppingCart size={64} className="text-gray-200" />
              <div>
                <p className="font-bold text-gray-800 text-lg" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  VOTRE PANIER EST VIDE
                </p>
                <p className="text-gray-500 text-sm mt-1">
                  Découvrez notre sélection de produits professionnels
                </p>
              </div>
              <Link
                href="/catalogue"
                onClick={closeCart}
                className="btn-primary inline-flex items-center gap-2 mt-2"
              >
                Voir les produits <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {state.items.map(({ product, quantity }) => (
                <div key={product.id} className="flex gap-4 p-4 hover:bg-gray-50 transition-colors">
                  {/* Image */}
                  <Link href={`/produit/${product.slug}`} onClick={closeCart}>
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-20 h-20 object-cover flex-shrink-0 border border-gray-100"
                    />
                  </Link>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <Link href={`/produit/${product.slug}`} onClick={closeCart}>
                      <p className="text-sm font-semibold text-gray-800 leading-tight hover:text-primary transition-colors line-clamp-2">
                        {product.name}
                      </p>
                    </Link>
                    <p className="text-xs text-gray-500 mt-0.5">{product.brand}</p>

                    <div className="flex items-center justify-between mt-2">
                      {/* Quantity controls */}
                      <div className="flex items-center border border-gray-200">
                        <button
                          onClick={() => updateQuantity(product.id, quantity - 1)}
                          className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-600"
                          aria-label="Diminuer"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold">{quantity}</span>
                        <button
                          onClick={() => updateQuantity(product.id, quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-600"
                          aria-label="Augmenter"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      {/* Price */}
                      <span className="text-sm font-bold text-primary">
                        {(product.price * quantity).toFixed(2)} €
                      </span>
                    </div>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => removeItem(product.id)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors self-start mt-1"
                    aria-label="Supprimer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {state.items.length > 0 && (
          <div className="border-t border-gray-200 p-6 space-y-4 bg-gray-50">
            {/* Livraison gratuite */}
            {totalPrice < 54 && (
              <div className="bg-primary/10 border border-primary/20 px-4 py-2.5 text-sm text-center">
                <span className="text-primary font-semibold">
                  Plus que {(54 - totalPrice).toFixed(2)} € pour la livraison gratuite !
                </span>
              </div>
            )}
            {totalPrice >= 54 && (
              <div className="bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-center text-green-700 font-semibold">
                ✓ Livraison gratuite en points relais !
              </div>
            )}

            {/* Total */}
            <div className="flex items-center justify-between text-lg">
              <span className="font-semibold text-gray-700">Sous-total</span>
              <span className="font-black text-secondary text-xl" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                {totalPrice.toFixed(2)} €
              </span>
            </div>

            {/* Buttons */}
            <div className="space-y-2">
              <Link
                href="/checkout"
                onClick={closeCart}
                className="btn-primary w-full flex items-center justify-center gap-2 text-base"
              >
                Commander <ArrowRight size={18} />
              </Link>
              <Link
                href="/panier"
                onClick={closeCart}
                className="block text-center text-sm text-gray-600 hover:text-primary transition-colors py-2 underline underline-offset-2"
              >
                Voir le panier complet
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
