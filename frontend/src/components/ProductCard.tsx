"use client";

import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, Heart } from "lucide-react";
import { Product } from "@/types";
import { parseImages, formatPrice, getDiscount } from "@/lib/utils";
import { useCart } from "@/contexts/CartContext";

export default function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const images = parseImages(product.images);
  const mainImage = images[0] || "/placeholder.jpg";
  const discount = getDiscount(product.price, product.originalPrice);

  return (
    <div className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-primary-100 transition-all duration-300">
      {/* Image */}
      <Link href={`/produit/${product.slug}`} className="block relative aspect-square overflow-hidden bg-gray-50">
        <Image
          src={mainImage}
          alt={product.name}
          fill
          className="object-contain p-4 group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.isNew && (
            <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded">
              NOUVEAU
            </span>
          )}
          {discount && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">
              -{discount}%
            </span>
          )}
        </div>
        {/* Quick actions */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="w-8 h-8 bg-white rounded-full shadow flex items-center justify-center text-dark-400 hover:text-red-500 transition-colors"
            aria-label="Ajouter aux favoris"
          >
            <Heart size={14} />
          </button>
        </div>
      </Link>

      {/* Info */}
      <div className="p-3 sm:p-4">
        <p className="text-[10px] uppercase tracking-wider text-primary font-medium mb-1">
          {product.brand}
        </p>
        <Link href={`/produit/${product.slug}`}>
          <h3 className="text-sm font-medium text-dark-800 line-clamp-2 leading-snug hover:text-primary transition-colors min-h-[2.5em]">
            {product.name}
          </h3>
        </Link>

        {/* Price + Add to cart */}
        <div className="flex items-end justify-between mt-3 gap-2">
          <div>
            <span className="text-lg font-bold text-dark-800">
              {formatPrice(product.price)}
            </span>
            {product.originalPrice && product.originalPrice > product.price && (
              <span className="block text-xs text-gray-400 line-through">
                {formatPrice(product.originalPrice)}
              </span>
            )}
          </div>
          <button
            onClick={() => addItem(product)}
            className="w-9 h-9 bg-primary hover:bg-primary-600 text-white rounded-lg flex items-center justify-center transition-colors shrink-0"
            aria-label="Ajouter au panier"
          >
            <ShoppingCart size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
