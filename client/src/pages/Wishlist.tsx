// ============================================================
// BARBER PARADISE — Page Wishlist
// Couleurs: Primary #4EAADB | Secondary #252525
// ============================================================

import { Link } from "wouter";
import { Heart, ArrowRight, ShoppingCart } from "lucide-react";
import { useWishlist } from "@/contexts/WishlistContext";
import { useCart } from "@/contexts/CartContext";
import ProductCard from "@/components/products/ProductCard";
import { toast } from "sonner";

export default function Wishlist() {
  const { items, removeItem } = useWishlist();
  const { addItem, openCart } = useCart();

  const handleAddAllToCart = () => {
    items.forEach((product) => addItem(product));
    toast.success(`${items.length} produit${items.length > 1 ? "s" : ""} ajouté${items.length > 1 ? "s" : ""} au panier`, {
      action: { label: "Voir le panier", onClick: openCart },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-secondary text-white py-8">
        <div className="container">
          <h1 className="text-3xl md:text-4xl font-black uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            Ma Wishlist
          </h1>
          <p className="text-gray-400 text-sm mt-1">{items.length} article{items.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="container py-8">
        {items.length === 0 ? (
          <div className="text-center py-20 bg-white border border-gray-200">
            <Heart size={64} className="text-gray-200 mx-auto mb-4" />
            <h2 className="text-2xl font-black text-gray-400 mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              WISHLIST VIDE
            </h2>
            <p className="text-gray-500 mb-6">Ajoutez des produits à votre liste de souhaits</p>
            <Link href="/catalogue" className="btn-primary inline-flex items-center gap-2">
              Découvrir les produits <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{items.length} article{items.length !== 1 ? "s" : ""}</span>
              <button onClick={handleAddAllToCart} className="btn-primary flex items-center gap-2 text-sm">
                <ShoppingCart size={14} /> Ajouter tout au panier
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
