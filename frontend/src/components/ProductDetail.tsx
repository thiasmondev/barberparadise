"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShoppingCart, Heart, Minus, Plus, ChevronLeft, Check, Truck } from "lucide-react";
import { Product, ProductVariant } from "@/types";
import { parseImages, formatPrice, getDiscount } from "@/lib/utils";
import { useCart } from "@/contexts/CartContext";

export default function ProductDetail({ product }: { product: Product }) {
  const { addItem } = useCart();
  const images = parseImages(product.images);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const discount = getDiscount(product.price, product.originalPrice);

  const variants = product.variants ?? [];

  // Grouper les variantes par type
  const colorVariants = variants.filter((v) => v.type === "color");
  const sizeVariants = variants.filter((v) => v.type === "size");
  const otherVariants = variants.filter((v) => v.type === "other");

  // Prix affiché : celui de la variante sélectionnée, ou le prix du produit
  const displayPrice = selectedVariant?.price != null ? selectedVariant.price : product.price;

  // Stock : celui de la variante sélectionnée, ou le stock du produit
  const isInStock = selectedVariant ? selectedVariant.inStock : product.inStock;

  // Image : si la variante a une image spécifique, on l'utilise
  const displayImages = useMemo(() => {
    if (selectedVariant?.image) {
      return [selectedVariant.image, ...images.filter((img) => img !== selectedVariant.image)];
    }
    return images;
  }, [selectedVariant, images]);

  const handleAddToCart = () => {
    // On passe le produit avec le prix de la variante si applicable
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

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
        <Link href="/" className="hover:text-primary">Accueil</Link>
        <span>/</span>
        <Link href="/catalogue" className="hover:text-primary">Catalogue</Link>
        <span>/</span>
        <Link href={`/catalogue?category=${product.category}`} className="hover:text-primary">
          {product.category}
        </Link>
        <span>/</span>
        <span className="text-dark-800 truncate">{product.name}</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Image gallery */}
        <div>
          {/* Main image */}
          <div className="relative aspect-square bg-gray-50 rounded-2xl overflow-hidden mb-4">
            {displayImages[selectedImage] ? (
              <Image
                src={displayImages[selectedImage]}
                alt={product.name}
                fill
                className="object-contain p-6"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                Pas d&apos;image
              </div>
            )}
            {/* Badges */}
            <div className="absolute top-4 left-4 flex flex-col gap-2">
              {product.isNew && (
                <span className="bg-primary text-white text-xs font-bold px-3 py-1 rounded-md">
                  NOUVEAU
                </span>
              )}
              {discount && (
                <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-md">
                  -{discount}%
                </span>
              )}
            </div>
          </div>
          {/* Thumbnails */}
          {displayImages.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {displayImages.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={`w-20 h-20 rounded-xl overflow-hidden border-2 shrink-0 bg-gray-50 transition-colors ${
                    i === selectedImage ? "border-primary" : "border-gray-100"
                  }`}
                >
                  <Image
                    src={img}
                    alt={`${product.name} - Image ${i + 1}`}
                    width={80}
                    height={80}
                    className="object-contain p-1 w-full h-full"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product info */}
        <div>
          <p className="text-xs uppercase tracking-wider text-primary font-semibold mb-2">
            {product.brand}
          </p>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-dark-800 mb-4 leading-tight">
            {product.name}
          </h1>

          {/* Price */}
          <div className="flex items-baseline gap-3 mb-6">
            <span className="text-3xl font-bold text-dark-800">
              {formatPrice(displayPrice)}
            </span>
            {product.originalPrice && product.originalPrice > product.price && (
              <span className="text-lg text-gray-400 line-through">
                {formatPrice(product.originalPrice)}
              </span>
            )}
            {discount && (
              <span className="text-sm font-semibold text-red-500">
                -{discount}%
              </span>
            )}
          </div>

          {/* Description courte */}
          {product.shortDescription && (
            <p className="text-gray-600 text-sm leading-relaxed mb-6">
              {product.shortDescription}
            </p>
          )}

          {/* ─── SÉLECTEUR DE VARIANTES COULEUR ─── */}
          {colorVariants.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-sm font-semibold text-dark-700">Couleur</span>
                {selectedVariant && selectedVariant.type === "color" && (
                  <span className="text-sm text-gray-500">— {selectedVariant.name}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2.5">
                {colorVariants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => handleSelectVariant(v)}
                    disabled={!v.inStock}
                    title={v.name + (!v.inStock ? " (Rupture)" : "")}
                    className={`relative w-9 h-9 rounded-full border-2 transition-all focus:outline-none ${
                      selectedVariant?.id === v.id
                        ? "border-primary scale-110 shadow-md"
                        : "border-gray-200 hover:border-gray-400"
                    } ${!v.inStock ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                    style={{ backgroundColor: v.colorHex || "#e5e7eb" }}
                  >
                    {selectedVariant?.id === v.id && (
                      <span
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ color: isLightColor(v.colorHex) ? "#1a1a1a" : "#ffffff" }}
                      >
                        <Check size={14} strokeWidth={3} />
                      </span>
                    )}
                    {!v.inStock && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="w-full h-0.5 bg-gray-400 rotate-45 absolute" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ─── SÉLECTEUR DE VARIANTES TAILLE ─── */}
          {sizeVariants.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-sm font-semibold text-dark-700">Taille</span>
                {selectedVariant && selectedVariant.type === "size" && (
                  <span className="text-sm text-gray-500">— {selectedVariant.name}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {sizeVariants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => handleSelectVariant(v)}
                    disabled={!v.inStock}
                    title={!v.inStock ? `${v.name} (Rupture)` : v.name}
                    className={`px-3.5 py-1.5 text-sm font-medium rounded-lg border-2 transition-all ${
                      selectedVariant?.id === v.id
                        ? "border-primary bg-primary text-white"
                        : "border-gray-200 text-dark-700 hover:border-primary hover:text-primary bg-white"
                    } ${!v.inStock ? "opacity-40 cursor-not-allowed line-through" : "cursor-pointer"}`}
                  >
                    {v.size || v.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ─── SÉLECTEUR AUTRES VARIANTES ─── */}
          {otherVariants.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-sm font-semibold text-dark-700">Options</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {otherVariants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => handleSelectVariant(v)}
                    disabled={!v.inStock}
                    className={`px-3.5 py-1.5 text-sm font-medium rounded-lg border-2 transition-all ${
                      selectedVariant?.id === v.id
                        ? "border-primary bg-primary text-white"
                        : "border-gray-200 text-dark-700 hover:border-primary hover:text-primary bg-white"
                    } ${!v.inStock ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    {v.name}
                    {v.price != null && v.price !== product.price && (
                      <span className="ml-1.5 text-xs opacity-75">({formatPrice(v.price)})</span>
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
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-sm text-green-600 font-medium">En stock</span>
                {selectedVariant && (
                  <span className="text-xs text-gray-400">({selectedVariant.stock} disponibles)</span>
                )}
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                <span className="text-sm text-red-600 font-medium">Rupture de stock</span>
              </>
            )}
          </div>

          {/* Alerte sélection variante requise */}
          {variants.length > 0 && !selectedVariant && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              Veuillez sélectionner une option avant d&apos;ajouter au panier
            </p>
          )}

          {/* Quantity + Add to cart */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center border border-gray-200 rounded-lg">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="p-3 text-dark-600 hover:text-primary transition-colors"
              >
                <Minus size={16} />
              </button>
              <span className="w-12 text-center text-sm font-medium text-dark-800">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="p-3 text-dark-600 hover:text-primary transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
            <button
              onClick={handleAddToCart}
              disabled={!isInStock || (variants.length > 0 && !selectedVariant)}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-lg font-medium text-sm transition-all ${
                added
                  ? "bg-green-500 text-white"
                  : "bg-primary hover:bg-primary-600 text-white"
              } disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed`}
            >
              {added ? (
                <>
                  <Check size={18} />
                  Ajouté au panier !
                </>
              ) : (
                <>
                  <ShoppingCart size={18} />
                  Ajouter au panier
                </>
              )}
            </button>
          </div>

          {/* Delivery info */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Truck size={18} className="text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium text-dark-800">Livraison gratuite dès 49€</p>
                <p className="text-xs text-gray-500">Expédition sous 24-48h</p>
              </div>
            </div>
          </div>

          {/* Full description */}
          {product.description && (
            <div className="mt-8 pt-8 border-t border-gray-100">
              <h2 className="font-heading font-bold text-lg text-dark-800 mb-4">Description</h2>
              <div
                className="prose prose-sm max-w-none text-gray-600"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Utilitaire : détecter si une couleur hex est claire (pour le texte du checkmark)
function isLightColor(hex: string): boolean {
  if (!hex || hex.length < 4) return true;
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}
