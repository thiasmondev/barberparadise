// ============================================================
// BARBER PARADISE — Fiche Produit
// Couleurs: Primary #4EAADB | Secondary #252525
// ============================================================

import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  Star, ShoppingCart, Heart, Share2, Truck, Shield, RotateCcw,
  ChevronRight, Minus, Plus, Check, Package
} from "lucide-react";
import { getProductBySlug, getFeaturedProducts, reviews } from "@/lib/data";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import ProductCard from "@/components/products/ProductCard";
import { toast } from "sonner";

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const product = getProductBySlug(slug || "");
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [activeTab, setActiveTab] = useState<"description" | "features" | "reviews">("description");
  const { addItem, openCart } = useCart();
  const { toggleItem, isWishlisted } = useWishlist();

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-black text-gray-200 mb-4" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>PRODUIT INTROUVABLE</h1>
          <Link href="/catalogue" className="btn-primary">Retour au catalogue</Link>
        </div>
      </div>
    );
  }

  const wishlisted = isWishlisted(product.id);
  const productReviews = reviews.filter((r) => r.productId === product.id);
  const relatedProducts = getFeaturedProducts().filter((p) => p.id !== product.id && p.category === product.category).slice(0, 4);
  const discount = product.originalPrice ? Math.round((1 - product.price / product.originalPrice) * 100) : 0;

  const handleAddToCart = () => {
    addItem(product, quantity);
    toast.success(`${product.name} ajouté au panier`, {
      action: { label: "Voir le panier", onClick: openCart },
    });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Breadcrumb */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="container py-3">
          <nav className="flex items-center gap-2 text-xs text-gray-500">
            <Link href="/" className="hover:text-primary">Accueil</Link>
            <ChevronRight size={12} />
            <Link href="/catalogue" className="hover:text-primary">Catalogue</Link>
            <ChevronRight size={12} />
            <Link href={`/catalogue?category=${product.category}`} className="hover:text-primary capitalize">{product.category}</Link>
            <ChevronRight size={12} />
            <span className="text-gray-800 font-medium truncate max-w-[200px]">{product.name}</span>
          </nav>
        </div>
      </div>

      <div className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* ── GALERIE ──────────────────────────────────── */}
          <div>
            <div className="relative aspect-square bg-gray-50 border border-gray-200 overflow-hidden mb-3">
              <img
                src={product.images[activeImage]}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              {product.isNew && <span className="badge-new absolute top-3 left-3">Nouveau</span>}
              {discount > 0 && <span className="badge-promo absolute top-3 left-3 mt-6">-{discount}%</span>}
            </div>
            {product.images.length > 1 && (
              <div className="flex gap-2">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImage(idx)}
                    className={`w-16 h-16 border-2 overflow-hidden transition-colors ${idx === activeImage ? "border-primary" : "border-gray-200 hover:border-gray-400"}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── INFOS PRODUIT ────────────────────────────── */}
          <div>
            <p className="text-sm text-primary font-bold uppercase tracking-wider mb-1">{product.brand}</p>
            <h1 className="text-3xl md:text-4xl font-black text-secondary mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              {product.name}
            </h1>

            {/* Rating */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex">
                {[1,2,3,4,5].map((s) => (
                  <Star key={s} size={16} className={s <= Math.round(product.rating) ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-200"} />
                ))}
              </div>
              <span className="text-sm text-gray-600">{product.rating}/5 ({product.reviewCount} avis)</span>
            </div>

            {/* Prix */}
            <div className="flex items-baseline gap-3 mb-6 pb-6 border-b border-gray-200">
              <span className="text-4xl font-black text-secondary" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                {product.price.toFixed(2)} €
              </span>
              {product.originalPrice && (
                <>
                  <span className="text-xl text-gray-400 line-through">{product.originalPrice.toFixed(2)} €</span>
                  <span className="badge-promo">-{discount}%</span>
                </>
              )}
            </div>

            {/* Description courte */}
            <p className="text-gray-600 mb-6 leading-relaxed" style={{ fontFamily: "'Barlow', sans-serif", textTransform: "none", letterSpacing: "normal" }}>
              {product.shortDescription}
            </p>

            {/* Stock */}
            <div className="flex items-center gap-2 mb-6">
              {product.inStock ? (
                <>
                  <Check size={16} className="text-green-500" />
                  <span className="text-sm text-green-600 font-semibold">En stock ({product.stockCount} disponibles)</span>
                </>
              ) : (
                <span className="text-sm text-red-500 font-semibold">Rupture de stock</span>
              )}
            </div>

            {/* Quantité + Ajout panier */}
            <div className="flex gap-3 mb-4">
              <div className="flex items-center border border-gray-300">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-12 flex items-center justify-center hover:bg-gray-100 transition-colors"
                >
                  <Minus size={16} />
                </button>
                <span className="w-12 text-center font-bold text-lg">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(product.stockCount, quantity + 1))}
                  className="w-10 h-12 flex items-center justify-center hover:bg-gray-100 transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={!product.inStock}
                className="flex-1 btn-primary flex items-center justify-center gap-2 text-base h-12 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShoppingCart size={18} />
                Ajouter au panier
              </button>

              <button
                onClick={() => { toggleItem(product); toast(wishlisted ? "Retiré de la wishlist" : "Ajouté à la wishlist", { icon: wishlisted ? "💔" : "❤️" }); }}
                className={`w-12 h-12 border flex items-center justify-center transition-colors ${wishlisted ? "bg-red-50 border-red-300 text-red-500" : "border-gray-300 text-gray-500 hover:border-red-300 hover:text-red-500"}`}
                aria-label="Wishlist"
              >
                <Heart size={18} fill={wishlisted ? "currentColor" : "none"} />
              </button>
            </div>

            {/* Share */}
            <button className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors mb-6">
              <Share2 size={14} />
              Partager ce produit
            </button>

            {/* Garanties */}
            <div className="bg-gray-50 border border-gray-200 p-4 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Truck size={18} className="text-primary flex-shrink-0" />
                <span className="text-gray-700"><strong>Livraison gratuite</strong> dès 54€ en points relais</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Shield size={18} className="text-primary flex-shrink-0" />
                <span className="text-gray-700"><strong>Paiement 100% sécurisé</strong> — SSL</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <RotateCcw size={18} className="text-primary flex-shrink-0" />
                <span className="text-gray-700"><strong>Retours sous 30 jours</strong></span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Package size={18} className="text-primary flex-shrink-0" />
                <span className="text-gray-700"><strong>Expédition sous 24-48h</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* ── TABS ─────────────────────────────────────── */}
        <div className="mt-12">
          <div className="flex border-b border-gray-200">
            {(["description", "features", "reviews"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${
                  activeTab === tab
                    ? "border-b-2 border-primary text-primary"
                    : "text-gray-500 hover:text-gray-800"
                }`}
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                {tab === "description" ? "Description" : tab === "features" ? "Caractéristiques" : `Avis (${productReviews.length})`}
              </button>
            ))}
          </div>

          <div className="py-8">
            {activeTab === "description" && (
              <div className="max-w-2xl">
                <p className="text-gray-700 leading-relaxed" style={{ fontFamily: "'Barlow', sans-serif", textTransform: "none", letterSpacing: "normal" }}>
                  {product.description}
                </p>
              </div>
            )}

            {activeTab === "features" && (
              <ul className="max-w-lg space-y-2">
                {product.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <Check size={16} className="text-primary flex-shrink-0" />
                    <span className="text-gray-700 text-sm">{f}</span>
                  </li>
                ))}
              </ul>
            )}

            {activeTab === "reviews" && (
              <div className="space-y-4 max-w-2xl">
                {productReviews.length === 0 ? (
                  <p className="text-gray-500 text-sm">Aucun avis pour ce produit.</p>
                ) : (
                  productReviews.map((review) => (
                    <div key={review.id} className="bg-gray-50 border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-800">{review.author}</span>
                          {review.verified && (
                            <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 font-medium">✓ Achat vérifié</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">{new Date(review.date).toLocaleDateString("fr-FR")}</span>
                      </div>
                      <div className="flex mb-2">
                        {[1,2,3,4,5].map((s) => (
                          <Star key={s} size={13} className={s <= review.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200"} />
                        ))}
                      </div>
                      <p className="text-sm text-gray-700">{review.comment}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── PRODUITS LIÉS ────────────────────────────── */}
        {relatedProducts.length > 0 && (
          <div className="mt-12">
            <h2 className="section-title mb-6">Vous aimerez aussi</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
