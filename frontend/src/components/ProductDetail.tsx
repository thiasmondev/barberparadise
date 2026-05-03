"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingCart, Minus, Plus, Check, Truck, Shield, RotateCcw, ChevronLeft, Heart, Loader2 } from "lucide-react";
import { Product, ProductVariant } from "@/types";
import { parseImages, formatPrice, getDiscount } from "@/lib/utils";
import { useCart } from "@/contexts/CartContext";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { addCustomerWishlist, getCustomerWishlist, removeCustomerWishlist } from "@/lib/customer-api";

export default function ProductDetail({ product }: { product: Product }) {
  const router = useRouter();
  const { addItem } = useCart();
  const { isAuthenticated, isLoading: authLoading } = useCustomerAuth();
  const images = parseImages(product.images);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [descOpen, setDescOpen] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [wishlistMessage, setWishlistMessage] = useState("");
  const publicPrice = typeof product.pricePublic === "number" ? product.pricePublic : product.price;
  const proPrice = typeof product.priceProEur === "number" ? product.priceProEur : null;
  const showsProPrice = Boolean(product.isPro && proPrice !== null && !selectedVariant);
  const discount = getDiscount(publicPrice, product.originalPrice);

  const variants = product.variants ?? [];
  const colorVariants = variants.filter((v) => v.type === "color");
  const sizeVariants = variants.filter((v) => v.type === "size");
  const otherVariants = variants.filter((v) => v.type === "other");

  const displayPrice = selectedVariant?.price != null ? selectedVariant.price : showsProPrice ? proPrice! : product.price;
  const isInStock = selectedVariant ? selectedVariant.inStock : product.inStock;

  const displayImages = useMemo(() => {
    if (selectedVariant?.image) {
      return [selectedVariant.image, ...images.filter((img) => img !== selectedVariant.image)];
    }
    return images;
  }, [selectedVariant, images]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setIsWishlisted(false);
      return;
    }

    let cancelled = false;
    async function loadWishlistStatus() {
      try {
        const products = await getCustomerWishlist();
        if (!cancelled) setIsWishlisted(products.some((item) => item.id === product.id));
      } catch {
        if (!cancelled) setWishlistMessage("Impossible de vérifier votre wishlist pour le moment.");
      }
    }

    loadWishlistStatus();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, product.id]);

  const handleAddToCart = () => {
    const productToAdd = selectedVariant?.price != null
      ? { ...product, price: selectedVariant.price, name: `${product.name} - ${selectedVariant.name}` }
      : product;
    addItem(productToAdd, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleSelectVariant = (v: ProductVariant) => {
    setSelectedVariant(selectedVariant?.id === v.id ? null : v);
    setSelectedImage(0);
  };

  const handleWishlistToggle = async () => {
    if (authLoading || wishlistLoading) return;
    if (!isAuthenticated) {
      router.push("/connexion");
      return;
    }

    setWishlistLoading(true);
    setWishlistMessage("");
    try {
      if (isWishlisted) {
        await removeCustomerWishlist(product.id);
        setIsWishlisted(false);
        setWishlistMessage("Produit retiré de votre wishlist.");
      } else {
        await addCustomerWishlist(product.id);
        setIsWishlisted(true);
        setWishlistMessage("Produit ajouté à votre wishlist.");
      }
    } catch (err) {
      setWishlistMessage(err instanceof Error ? err.message : "Impossible de mettre à jour votre wishlist.");
    } finally {
      setWishlistLoading(false);
    }
  };

  return (
    <div className="bg-[#131313] text-[#e5e2e1] min-h-screen">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-10">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-3 text-[10px] font-black tracking-[0.3em] uppercase text-gray-500 mb-10">
          <Link href="/" className="hover:text-white transition-colors">Accueil</Link>
          <span className="text-gray-700">—</span>
          <Link href="/catalogue" className="hover:text-white transition-colors">Catalogue</Link>
          <span className="text-gray-700">—</span>
          <Link href={`/catalogue?category=${product.category}`} className="hover:text-white transition-colors">
            {product.category}
          </Link>
          <span className="text-gray-700">—</span>
          <span className="text-[#ff4a8d] truncate">{product.name}</span>
        </nav>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">

          {/* ─── GALERIE ─── */}
          <div>
            {/* Image principale */}
            <div className="relative aspect-square bg-[#1c1b1b] overflow-hidden mb-4">
              {displayImages[selectedImage] ? (
                <Image
                  src={displayImages[selectedImage]}
                  alt={product.name}
                  fill
                  className="object-contain p-8 opacity-90 hover:opacity-100 transition-opacity duration-300"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-600 text-xs tracking-widest uppercase">
                  Aucune image
                </div>
              )}
              {/* Badges */}
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                {product.isNew && (
                  <span className="bg-white text-black text-[10px] font-black tracking-widest px-3 py-1 uppercase">
                    NOUVEAU
                  </span>
                )}
                {discount && (
                  <span className="bg-[#ff4a8d] text-white text-[10px] font-black tracking-widest px-3 py-1 uppercase">
                    -{discount}%
                  </span>
                )}
              </div>
            </div>

            {/* Miniatures */}
            {displayImages.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {displayImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`w-20 h-20 bg-[#1c1b1b] overflow-hidden shrink-0 border-2 transition-colors ${
                      i === selectedImage ? "border-[#ff4a8d]" : "border-transparent hover:border-white/20"
                    }`}
                  >
                    <Image
                      src={img}
                      alt={`${product.name} - ${i + 1}`}
                      width={80}
                      height={80}
                      className="object-contain p-1 w-full h-full opacity-80 hover:opacity-100 transition-opacity"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ─── INFOS PRODUIT ─── */}
          <div className="flex flex-col">
            {/* Marque */}
            <p className="text-[10px] font-black tracking-[0.4em] text-[#ff4a8d] uppercase mb-4">
              {product.brand}
            </p>

            {/* Nom */}
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter italic uppercase leading-none mb-6">
              {product.name}
            </h1>

            {/* Prix */}
            <div className="mb-8">
              {showsProPrice && (
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span className="bg-blue-600 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-white">PRIX PRO</span>
                  <span className="text-xs font-bold uppercase tracking-widest text-blue-400">Tarif professionnel HT</span>
                </div>
              )}
              <div className="flex flex-wrap items-baseline gap-4">
                <span className="text-4xl font-black tracking-tighter">
                  {formatPrice(displayPrice)}{showsProPrice ? " HT" : ""}
                </span>
                {showsProPrice ? (
                  <span className="text-xl text-gray-600 line-through">
                    Public {formatPrice(publicPrice)} TTC
                  </span>
                ) : product.originalPrice && product.originalPrice > publicPrice ? (
                  <span className="text-xl text-gray-600 line-through">
                    {formatPrice(product.originalPrice)}
                  </span>
                ) : null}
                {discount && !showsProPrice && (
                  <span className="text-sm font-black text-[#ff4a8d] bg-[#ff4a8d]/10 px-3 py-1">
                    -{discount}%
                  </span>
                )}
              </div>
              {showsProPrice && (
                <p className="mt-3 text-xs uppercase tracking-widest text-gray-500">TVA calculée au checkout selon votre situation professionnelle.</p>
              )}
            </div>

            {/* Description courte */}
            {product.shortDescription && (
              <p className="text-sm text-gray-400 leading-relaxed mb-8 border-l-2 border-[#ff4a8d]/30 pl-4">
                {product.shortDescription}
              </p>
            )}

            {/* ─── VARIANTES COULEUR ─── */}
            {colorVariants.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[10px] font-black tracking-[0.3em] text-gray-500 uppercase">COULEUR</span>
                  {selectedVariant?.type === "color" && (
                    <span className="text-xs text-gray-300">— {selectedVariant.name}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  {colorVariants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => handleSelectVariant(v)}
                      disabled={!v.inStock}
                      title={v.name + (!v.inStock ? " (Rupture)" : "")}
                      className={`relative w-10 h-10 border-2 transition-all focus:outline-none ${
                        selectedVariant?.id === v.id
                          ? "border-[#ff4a8d] scale-110"
                          : "border-white/10 hover:border-white/40"
                      } ${!v.inStock ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
                      style={{ backgroundColor: v.colorHex || "#333" }}
                    >
                      {selectedVariant?.id === v.id && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <Check size={14} strokeWidth={3} className="text-white drop-shadow" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ─── VARIANTES TAILLE ─── */}
            {sizeVariants.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[10px] font-black tracking-[0.3em] text-gray-500 uppercase">TAILLE</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sizeVariants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => handleSelectVariant(v)}
                      disabled={!v.inStock}
                      className={`px-4 py-2 text-xs font-black tracking-widest uppercase border transition-all ${
                        selectedVariant?.id === v.id
                          ? "border-[#ff4a8d] bg-[#ff4a8d] text-white"
                          : "border-white/10 text-gray-400 hover:border-white/40 hover:text-white"
                      } ${!v.inStock ? "opacity-30 cursor-not-allowed line-through" : "cursor-pointer"}`}
                    >
                      {v.size || v.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ─── AUTRES VARIANTES ─── */}
            {otherVariants.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[10px] font-black tracking-[0.3em] text-gray-500 uppercase">OPTIONS</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {otherVariants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => handleSelectVariant(v)}
                      disabled={!v.inStock}
                      className={`px-4 py-2 text-xs font-black tracking-widest uppercase border transition-all ${
                        selectedVariant?.id === v.id
                          ? "border-[#ff4a8d] bg-[#ff4a8d] text-white"
                          : "border-white/10 text-gray-400 hover:border-white/40 hover:text-white"
                      } ${!v.inStock ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      {v.name}
                      {v.price != null && v.price !== product.price && (
                        <span className="ml-1 opacity-60">({formatPrice(v.price)})</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stock */}
            <div className="flex items-center gap-2 mb-6">
              {isInStock ? (
                <>
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                  <span className="text-xs font-black tracking-widest uppercase text-green-400">En stock</span>
                  {selectedVariant && (
                    <span className="text-xs text-gray-600 ml-1">({selectedVariant.stock} disponibles)</span>
                  )}
                </>
              ) : (
                <>
                  <div className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                  <span className="text-xs font-black tracking-widest uppercase text-red-400">Rupture de stock</span>
                </>
              )}
            </div>

            {/* Alerte variante requise */}
            {variants.length > 0 && !selectedVariant && (
              <p className="text-[10px] font-black tracking-widest uppercase text-amber-400 bg-amber-400/10 border border-amber-400/20 px-4 py-3 mb-4">
                Sélectionnez une option avant d&apos;ajouter au panier
              </p>
            )}

            {/* Quantité + CTA */}
            <div className="flex items-stretch gap-4 mb-8">
              <div className="flex items-center border border-white/10">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-4 py-4 text-gray-400 hover:text-white transition-colors"
                >
                  <Minus size={14} />
                </button>
                <span className="w-10 text-center text-sm font-black">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-4 py-4 text-gray-400 hover:text-white transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
              <button
                onClick={handleAddToCart}
                disabled={!isInStock || (variants.length > 0 && !selectedVariant)}
                className={`flex-1 flex items-center justify-center gap-3 py-4 text-xs font-black tracking-widest uppercase transition-all ${
                  added
                    ? "bg-green-500 text-white"
                    : "bg-[#ff4a8d] hover:bg-[#ff1f70] text-white"
                } disabled:bg-white/5 disabled:text-gray-600 disabled:cursor-not-allowed`}
              >
                {added ? (
                  <>
                    <Check size={16} />
                    AJOUTÉ !
                  </>
                ) : (
                  <>
                    <ShoppingCart size={16} />
                    AJOUTER AU PANIER
                  </>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={handleWishlistToggle}
              disabled={authLoading || wishlistLoading}
              className={`mb-3 flex w-full items-center justify-center gap-3 border px-5 py-4 text-xs font-black uppercase tracking-widest transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isWishlisted
                  ? "border-[#ff4a8d] bg-[#ff4a8d]/10 text-[#ff8fbd] hover:bg-[#ff4a8d]/20"
                  : "border-white/10 text-gray-300 hover:border-[#ff4a8d] hover:text-white"
              }`}
              aria-pressed={isWishlisted}
            >
              {wishlistLoading ? <Loader2 size={16} className="animate-spin" /> : <Heart size={16} fill={isWishlisted ? "currentColor" : "none"} />}
              {isWishlisted ? "Retirer de ma wishlist" : "Ajouter à ma wishlist"}
            </button>
            {wishlistMessage && <p className="mb-6 text-xs font-semibold text-[#ff8fbd]">{wishlistMessage}</p>}

            {/* Garanties */}
            <div className="border border-white/5 p-5 space-y-4">
              <div className="flex items-center gap-4">
                <Truck size={16} className="text-[#ff4a8d] shrink-0" />
                <div>
                  <p className="text-xs font-black tracking-widest uppercase">
                    {product.isPro ? "Livraison gratuite dès 500€ HT" : "Livraison gratuite dès 49€"}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Expédition sous 24-48h</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Shield size={16} className="text-[#ff4a8d] shrink-0" />
                <div>
                  <p className="text-xs font-black tracking-widest uppercase">Paiement sécurisé</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Transactions chiffrées SSL</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <RotateCcw size={16} className="text-[#ff4a8d] shrink-0" />
                <div>
                  <p className="text-xs font-black tracking-widest uppercase">Retours 14 jours</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Satisfait ou remboursé</p>
                </div>
              </div>
            </div>

            {/* Description complète (accordéon) */}
            {product.description && (
              <div className="mt-6 border-t border-white/5">
                <button
                  onClick={() => setDescOpen(!descOpen)}
                  className="w-full flex items-center justify-between py-5 text-[10px] font-black tracking-[0.3em] uppercase text-gray-400 hover:text-white transition-colors"
                >
                  DESCRIPTION COMPLÈTE
                  <span className={`transition-transform ${descOpen ? "rotate-180" : ""}`}>▼</span>
                </button>
                {descOpen && (
                  <div
                    className="prose prose-sm prose-invert max-w-none text-gray-400 pb-6 text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: product.description }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
