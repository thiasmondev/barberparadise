// ============================================================
// BARBER PARADISE — Carte Produit
// Couleurs: Primary #4EAADB | Secondary #252525
// ============================================================

import { useState } from "react";
import { Link } from "wouter";
import { Heart, ShoppingCart, Star, Eye } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import type { Product } from "@/lib/data";
import { toast } from "sonner";

interface ProductCardProps {
  product: Product;
  className?: string;
}

export default function ProductCard({ product, className = "" }: ProductCardProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const { addItem, openCart } = useCart();
  const { toggleItem, isWishlisted } = useWishlist();

  const wishlisted = isWishlisted(product.id);
  const discount = product.originalPrice
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product);
    toast.success(`${product.name} ajouté au panier`, {
      action: { label: "Voir le panier", onClick: openCart },
    });
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleItem(product);
    toast(wishlisted ? "Retiré de la wishlist" : "Ajouté à la wishlist", {
      icon: wishlisted ? "💔" : "❤️",
    });
  };

  return (
    <div className={`product-card group ${className}`}>
      {/* Image container */}
      <div className="relative overflow-hidden bg-gray-50 aspect-square">
        <Link href={`/produit/${product.slug}`}>
          <img
            src={product.images[0]}
            alt={product.name}
            className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setImgLoaded(true)}
          />
          {!imgLoaded && (
            <div className="absolute inset-0 bg-gray-100 animate-pulse" />
          )}
        </Link>

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.isNew && <span className="badge-new">Nouveau</span>}
          {product.isPromo && discount > 0 && (
            <span className="badge-promo">-{discount}%</span>
          )}
          {!product.inStock && (
            <span className="bg-gray-700 text-white text-xs font-bold uppercase px-2 py-0.5">Épuisé</span>
          )}
        </div>

        {/* Actions overlay */}
        <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0">
          <button
            onClick={handleWishlist}
            className={`w-9 h-9 flex items-center justify-center shadow-md transition-colors ${
              wishlisted ? "bg-red-500 text-white" : "bg-white text-gray-700 hover:bg-red-50 hover:text-red-500"
            }`}
            aria-label="Wishlist"
          >
            <Heart size={16} fill={wishlisted ? "currentColor" : "none"} />
          </button>
          <Link
            href={`/produit/${product.slug}`}
            className="w-9 h-9 bg-white text-gray-700 hover:bg-primary hover:text-white flex items-center justify-center shadow-md transition-colors"
            aria-label="Voir le produit"
          >
            <Eye size={16} />
          </Link>
        </div>

        {/* Add to cart overlay (bottom) */}
        <div className="absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
          <button
            onClick={handleAddToCart}
            disabled={!product.inStock}
            className="w-full bg-secondary text-white py-2.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.08em" }}
          >
            <ShoppingCart size={14} />
            {product.inStock ? "Ajouter au panier" : "Épuisé"}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-0.5">{product.brand}</p>
        <Link href={`/produit/${product.slug}`}>
          <h3 className="text-sm font-semibold text-gray-800 hover:text-primary transition-colors leading-tight line-clamp-2 mb-2" style={{ fontFamily: "'Barlow', sans-serif", textTransform: "none", letterSpacing: "normal" }}>
            {product.name}
          </h3>
        </Link>

        {/* Rating */}
        <div className="flex items-center gap-1 mb-2">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={11}
                className={star <= Math.round(product.rating) ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-200"}
              />
            ))}
          </div>
          <span className="text-xs text-gray-500">({product.reviewCount})</span>
        </div>

        {/* Price */}
        <div className="flex items-center gap-2">
          <span className="text-base font-black text-secondary" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            {product.price.toFixed(2)} €
          </span>
          {product.originalPrice && (
            <span className="text-sm text-gray-400 line-through">
              {product.originalPrice.toFixed(2)} €
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
