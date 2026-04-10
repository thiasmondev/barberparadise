"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShoppingCart, Heart, Minus, Plus, ChevronLeft, Check, Truck } from "lucide-react";
import { Product } from "@/types";
import { parseImages, formatPrice, getDiscount } from "@/lib/utils";
import { useCart } from "@/contexts/CartContext";

export default function ProductDetail({ product }: { product: Product }) {
  const { addItem } = useCart();
  const images = parseImages(product.images);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const discount = getDiscount(product.price, product.originalPrice);

  const handleAddToCart = () => {
    addItem(product, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
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
            {images[selectedImage] ? (
              <Image
                src={images[selectedImage]}
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
          {images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {images.map((img, i) => (
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
              {formatPrice(product.price)}
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

          {/* Description */}
          {product.shortDescription && (
            <p className="text-gray-600 text-sm leading-relaxed mb-6">
              {product.shortDescription}
            </p>
          )}

          {/* Stock */}
          <div className="flex items-center gap-2 mb-6">
            {product.inStock ? (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-sm text-green-600 font-medium">En stock</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                <span className="text-sm text-red-600 font-medium">Rupture de stock</span>
              </>
            )}
          </div>

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
              disabled={!product.inStock}
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
              <h2 className="font-heading font-semibold text-lg text-dark-800 mb-4">
                Description
              </h2>
              <div
                className="text-sm text-gray-600 leading-relaxed prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            </div>
          )}

          {/* Category & Tags */}
          <div className="mt-6 pt-6 border-t border-gray-100 space-y-2">
            <p className="text-xs text-gray-500">
              <span className="font-medium text-dark-600">Catégorie :</span>{" "}
              <Link href={`/catalogue?category=${product.category}`} className="hover:text-primary">
                {product.category}
              </Link>
              {product.subcategory && (
                <>
                  {" > "}
                  <Link href={`/catalogue?subcategory=${product.subcategory}`} className="hover:text-primary">
                    {product.subcategory}
                  </Link>
                </>
              )}
            </p>
            <p className="text-xs text-gray-500">
              <span className="font-medium text-dark-600">Marque :</span>{" "}
              <Link href={`/catalogue?brand=${product.brand}`} className="hover:text-primary">
                {product.brand}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
