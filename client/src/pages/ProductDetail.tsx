// ============================================================
// BARBER PARADISE — Fiche Produit (API dynamique)
// Couleurs: Primary #4EAADB | Secondary #252525
// ============================================================
import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  Star, ShoppingCart, Heart, Share2, Truck, Shield, RotateCcw,
  ChevronRight, Minus, Plus, Check, Package, Loader2, AlertCircle
} from "lucide-react";
import { useProduct } from "@/hooks/useApi";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import ProductCard from "@/components/products/ProductCard";
import { toast } from "sonner";
import { products as allProducts } from "@/lib/data";

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { product, loading, error } = useProduct(slug || null);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [activeTab, setActiveTab] = useState<"description" | "features" | "reviews">("description");
  const { addItem, openCart } = useCart();
  const { toggleItem, isWishlisted } = useWishlist();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  if (error || !product) {
    // Fallback sur les données mockées si l'API n'est pas disponible
    const mockProduct = allProducts.find(p => p.slug === slug);
    if (!mockProduct) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="text-gray-400 mx-auto mb-4" size={48} />
            <h2 className="text-2xl font-bold text-secondary mb-2">Produit introuvable</h2>
            <p className="text-gray-500 mb-6">Ce produit n'existe pas ou a été supprimé.</p>
            <Link href="/catalogue" className="bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary/90">
              Voir le catalogue
            </Link>
          </div>
        </div>
      );
    }
    // Utiliser les données mockées comme fallback
    return <ProductDetailContent product={mockProduct as any} quantity={quantity} setQuantity={setQuantity} activeImage={activeImage} setActiveImage={setActiveImage} activeTab={activeTab} setActiveTab={setActiveTab} addItem={addItem} openCart={openCart} toggleItem={toggleItem} isWishlisted={isWishlisted} />;
  }

  return <ProductDetailContent product={product as any} quantity={quantity} setQuantity={setQuantity} activeImage={activeImage} setActiveImage={setActiveImage} activeTab={activeTab} setActiveTab={setActiveTab} addItem={addItem} openCart={openCart} toggleItem={toggleItem} isWishlisted={isWishlisted} />;
}

function ProductDetailContent({ product, quantity, setQuantity, activeImage, setActiveImage, activeTab, setActiveTab, addItem, openCart, toggleItem, isWishlisted }: any) {
  const images = product.images?.length > 0 ? product.images : ["https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&q=85"];
  const related = allProducts.filter(p => p.category === product.category && p.id !== product.id).slice(0, 4);

  const handleAddToCart = () => {
    addItem(product, quantity);
    toast.success(`${product.name} ajouté au panier`, {
      action: { label: "Voir le panier", onClick: openCart },
    });
  };

  const handleWishlist = () => {
    toggleItem(product);
    toast.success(isWishlisted(product.id) ? "Retiré des favoris" : "Ajouté aux favoris");
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Breadcrumb */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="container py-3">
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <Link href="/" className="hover:text-primary">Accueil</Link>
            <ChevronRight size={14} />
            <Link href="/catalogue" className="hover:text-primary">Catalogue</Link>
            <ChevronRight size={14} />
            <Link href={`/catalogue?category=${product.category}`} className="hover:text-primary capitalize">{product.category}</Link>
            <ChevronRight size={14} />
            <span className="text-secondary font-medium truncate max-w-xs">{product.name}</span>
          </nav>
        </div>
      </div>

      <div className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Images */}
          <div>
            <div className="aspect-square bg-gray-50 rounded-2xl overflow-hidden mb-4">
              <img
                src={images[activeImage]}
                alt={product.name}
                className="w-full h-full object-contain p-4"
                onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&q=85"; }}
              />
            </div>
            {images.length > 1 && (
              <div className="flex gap-3">
                {images.map((img: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={`w-20 h-20 rounded-lg overflow-hidden border-2 ${activeImage === i ? "border-primary" : "border-gray-200"}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-contain p-1"
                      onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=200&q=80"; }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Infos produit */}
          <div>
            <div className="flex items-start justify-between mb-2">
              <span className="text-sm font-semibold text-primary uppercase tracking-wide">{product.brand}</span>
              <div className="flex gap-2">
                {product.isNew && <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">NOUVEAU</span>}
                {product.isPromo && <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full">PROMO</span>}
              </div>
            </div>

            <h1 className="text-2xl md:text-3xl font-black text-secondary mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              {product.name}
            </h1>

            {/* Note */}
            {product.rating > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <div className="flex">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} size={16} className={s <= Math.round(product.rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"} />
                  ))}
                </div>
                <span className="text-sm text-gray-500">({product.reviewCount || 0} avis)</span>
              </div>
            )}

            {/* Prix */}
            <div className="flex items-baseline gap-3 mb-6">
              <span className="text-3xl font-black text-secondary">{product.price?.toFixed(2)}€</span>
              {product.originalPrice && product.originalPrice > product.price && (
                <>
                  <span className="text-lg text-gray-400 line-through">{product.originalPrice.toFixed(2)}€</span>
                  <span className="bg-red-100 text-red-700 text-sm font-bold px-2 py-0.5 rounded">
                    -{Math.round((1 - product.price / product.originalPrice) * 100)}%
                  </span>
                </>
              )}
            </div>

            <p className="text-gray-600 mb-6 leading-relaxed">{product.shortDescription || product.description?.slice(0, 200)}</p>

            {/* Stock */}
            <div className="flex items-center gap-2 mb-6">
              {product.inStock !== false ? (
                <>
                  <Check size={16} className="text-green-500" />
                  <span className="text-sm text-green-600 font-medium">En stock</span>
                </>
              ) : (
                <>
                  <Package size={16} className="text-red-400" />
                  <span className="text-sm text-red-500 font-medium">Rupture de stock</span>
                </>
              )}
            </div>

            {/* Quantité + Ajout panier */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-3 py-3 hover:bg-gray-100">
                  <Minus size={16} />
                </button>
                <span className="px-4 py-3 font-semibold min-w-[3rem] text-center">{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)} className="px-3 py-3 hover:bg-gray-100">
                  <Plus size={16} />
                </button>
              </div>
              <button
                onClick={handleAddToCart}
                disabled={product.inStock === false}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-3 px-6 rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ShoppingCart size={20} />
                Ajouter au panier
              </button>
            </div>

            <div className="flex gap-3 mb-8">
              <button
                onClick={handleWishlist}
                className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium transition-colors ${
                  isWishlisted(product.id) ? "border-red-300 text-red-500 bg-red-50" : "border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Heart size={16} className={isWishlisted(product.id) ? "fill-red-500" : ""} />
                {isWishlisted(product.id) ? "Dans les favoris" : "Ajouter aux favoris"}
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Lien copié !"); }}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                <Share2 size={16} />
                Partager
              </button>
            </div>

            {/* Garanties */}
            <div className="grid grid-cols-3 gap-3 border-t border-gray-100 pt-6">
              {[
                { icon: Truck, label: "Livraison gratuite", sub: "dès 54€" },
                { icon: Shield, label: "Paiement sécurisé", sub: "SSL 256-bit" },
                { icon: RotateCcw, label: "Retours gratuits", sub: "30 jours" },
              ].map(({ icon: Icon, label, sub }) => (
                <div key={label} className="text-center">
                  <Icon size={20} className="text-primary mx-auto mb-1" />
                  <p className="text-xs font-semibold text-secondary">{label}</p>
                  <p className="text-xs text-gray-400">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Onglets description */}
        <div className="mt-16 border-t border-gray-200 pt-8">
          <div className="flex gap-6 border-b border-gray-200 mb-6">
            {(["description", "features", "reviews"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-sm font-semibold capitalize border-b-2 transition-colors ${
                  activeTab === tab ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-secondary"
                }`}
              >
                {tab === "description" ? "Description" : tab === "features" ? "Caractéristiques" : "Avis clients"}
              </button>
            ))}
          </div>

          {activeTab === "description" && (
            <div className="prose max-w-none text-gray-600 leading-relaxed">
              <p>{product.description || product.shortDescription}</p>
            </div>
          )}

          {activeTab === "features" && (
            <ul className="space-y-2">
              {(product.features || []).map((f: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-gray-600">
                  <Check size={16} className="text-primary mt-0.5 flex-shrink-0" />
                  {f}
                </li>
              ))}
              {(!product.features || product.features.length === 0) && (
                <p className="text-gray-400">Aucune caractéristique disponible.</p>
              )}
            </ul>
          )}

          {activeTab === "reviews" && (
            <div className="text-center py-8 text-gray-400">
              <Star size={32} className="mx-auto mb-2 text-gray-300" />
              <p>Aucun avis pour le moment.</p>
            </div>
          )}
        </div>

        {/* Produits similaires */}
        {related.length > 0 && (
          <div className="mt-16">
            <h2 className="text-2xl font-black text-secondary mb-6" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              PRODUITS SIMILAIRES
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {related.map((p: any) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
