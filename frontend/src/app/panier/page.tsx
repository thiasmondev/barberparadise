"use client";

import Link from "next/link";
import Image from "next/image";
import { Trash2, Minus, Plus, ShoppingBag, ArrowLeft } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { parseImages, formatPrice } from "@/lib/utils";

export default function CartPage() {
  const { items, removeItem, updateQuantity, clearCart, total, itemCount } = useCart();

  const shipping = total >= 49 ? 0 : 5.90;
  const grandTotal = total + shipping;

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <ShoppingBag size={64} className="mx-auto text-gray-300 mb-6" />
        <h1 className="font-heading font-bold text-2xl text-dark-800 mb-3">
          Votre panier est vide
        </h1>
        <p className="text-gray-500 mb-8">
          Découvrez notre catalogue de produits professionnels pour barbiers.
        </p>
        <Link href="/catalogue" className="btn-primary">
          Voir le catalogue
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="section-title">
          Mon panier <span className="text-gray-400 text-xl">({itemCount})</span>
        </h1>
        <button
          onClick={clearCart}
          className="text-sm text-gray-500 hover:text-red-500 transition-colors"
        >
          Vider le panier
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Cart items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => {
            const images = parseImages(item.product.images);
            const mainImage = images[0] || "/placeholder.jpg";
            return (
              <div
                key={item.product.id}
                className="flex gap-4 p-4 bg-white rounded-xl border border-gray-100"
              >
                {/* Image */}
                <Link
                  href={`/produit/${item.product.slug}`}
                  className="w-24 h-24 sm:w-28 sm:h-28 bg-gray-50 rounded-lg overflow-hidden shrink-0"
                >
                  <Image
                    src={mainImage}
                    alt={item.product.name}
                    width={112}
                    height={112}
                    className="object-contain p-2 w-full h-full"
                  />
                </Link>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-primary font-medium">
                    {item.product.brand}
                  </p>
                  <Link href={`/produit/${item.product.slug}`}>
                    <h3 className="text-sm font-medium text-dark-800 line-clamp-2 hover:text-primary transition-colors">
                      {item.product.name}
                    </h3>
                  </Link>

                  <div className="flex items-center justify-between mt-3 gap-4">
                    {/* Quantity */}
                    <div className="flex items-center border border-gray-200 rounded-lg">
                      <button
                        onClick={() =>
                          updateQuantity(item.product.id, item.quantity - 1)
                        }
                        className="p-2 text-dark-600 hover:text-primary"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantity(item.product.id, item.quantity + 1)
                        }
                        className="p-2 text-dark-600 hover:text-primary"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    {/* Price + Remove */}
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-dark-800">
                        {formatPrice(item.product.price * item.quantity)}
                      </span>
                      <button
                        onClick={() => removeItem(item.product.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                        aria-label="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="bg-gray-50 rounded-xl p-6 sticky top-24">
            <h2 className="font-heading font-semibold text-lg text-dark-800 mb-4">
              Récapitulatif
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Sous-total</span>
                <span className="font-medium text-dark-800">{formatPrice(total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Livraison</span>
                <span className="font-medium text-dark-800">
                  {shipping === 0 ? (
                    <span className="text-green-600">Gratuite</span>
                  ) : (
                    formatPrice(shipping)
                  )}
                </span>
              </div>
              {shipping > 0 && (
                <p className="text-xs text-primary">
                  Plus que {formatPrice(49 - total)} pour la livraison gratuite !
                </p>
              )}
              <div className="border-t border-gray-200 pt-3 flex justify-between">
                <span className="font-semibold text-dark-800">Total</span>
                <span className="font-bold text-lg text-dark-800">
                  {formatPrice(grandTotal)}
                </span>
              </div>
            </div>
            <button className="btn-primary w-full mt-6 py-4">
              Passer commande
            </button>
            <Link
              href="/catalogue"
              className="flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-primary mt-4 transition-colors"
            >
              <ArrowLeft size={14} />
              Continuer mes achats
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
