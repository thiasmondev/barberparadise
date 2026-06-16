"use client";

import { type FormEvent, useEffect, useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingCart, Minus, Plus, Check, Truck, Shield, RotateCcw, ChevronLeft, Heart, Loader2 } from "lucide-react";
import { Product, ProductVariant } from "@/types";
import { parseImages, formatPrice, getDiscount } from "@/lib/utils";
import { useCart } from "@/contexts/CartContext";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { addCustomerWishlist, getCustomerWishlist, removeCustomerWishlist } from "@/lib/customer-api";
import { createStockAlert } from "@/lib/api";

export default function ProductDetail({ product }: { product: Product }) {
  const router = useRouter();
  const { addItem } = useCart();
  const { customer, isAuthenticated, isLoading: authLoading } = useCustomerAuth();
  const images = parseImages(product.images);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [descOpen, setDescOpen] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [wishlistMessage, setWishlistMessage] = useState("");
  const [stockAlertOpen, setStockAlertOpen] = useState(false);
  const [stockAlertEmail, setStockAlertEmail] = useState("");
  const [stockAlertLoading, setStockAlertLoading] = useState(false);
  const [stockAlertMessage, setStockAlertMessage] = useState("");
  const [stockAlertError, setStockAlertError] = useState("");
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const publicPrice = typeof product.pricePublic === "number" ? product.pricePublic : product.price;
  const proPrice = typeof product.priceProEur === "number" ? product.priceProEur : null;
  const selectedVariantPublicPrice = typeof selectedVariant?.pricePublic === "number" ? selectedVariant.pricePublic : selectedVariant?.price ?? publicPrice;
  const selectedVariantProPrice = selectedVariant && product.isPro && typeof selectedVariant.priceProEur === "number" ? selectedVariant.priceProEur : null;
  const showsProPrice = Boolean(product.isPro && (selectedVariant ? selectedVariantProPrice !== null : proPrice !== null));
  const referencePublicPrice = selectedVariant ? selectedVariantPublicPrice : publicPrice;
  const selectedVariantCompareAtPrice = selectedVariant
    ? selectedVariant.compareAtPrice ?? selectedVariant.originalPrice ?? null
    : null;
  const compareAtPrice = selectedVariantCompareAtPrice ?? product.compareAtPrice ?? product.originalPrice;

  const variants = product.variants ?? [];
  const colorVariants = variants.filter((v) => v.type === "color");
  const sizeVariants = variants.filter((v) => v.type === "size");
  const otherVariants = variants.filter((v) => v.type === "other");

  const displayPrice = selectedVariant ? selectedVariantProPrice ?? selectedVariant.price ?? product.price : showsProPrice ? proPrice! : product.price;
  const hasDiscount = !showsProPrice && Boolean(compareAtPrice && compareAtPrice > displayPrice);
  const discount = typeof (selectedVariant ?? product).automaticPromotionDiscountPercent === "number"
    ? (selectedVariant ?? product).automaticPromotionDiscountPercent
    : hasDiscount && compareAtPrice
      ? getDiscount(displayPrice, compareAtPrice)
      : 0;
  const discountPercent = discount ?? 0;
  const hasVariantStock = variants.some((variant) => variant.inStock && variant.stock > 0);
  const isSelectedVariantInStock = selectedVariant ? selectedVariant.inStock && selectedVariant.stock > 0 : false;
  const isInStock = selectedVariant ? isSelectedVariantInStock : variants.length > 0 ? hasVariantStock : product.inStock;
  const requiresVariantSelection = variants.length > 0 && !selectedVariant;
  const canSubmitCart = isInStock && !requiresVariantSelection;
  const canRequestStockAlert = !isInStock && !requiresVariantSelection;

  const displayImages = useMemo(() => {
    if (selectedVariant?.image) {
      return [selectedVariant.image, ...images.filter((img) => img !== selectedVariant.image)];
    }
    return images;
  }, [selectedVariant, images]);

  const hasMultipleImages = displayImages.length > 1;

  const closeLightbox = () => setIsLightboxOpen(false);

  const goToPreviousImage = () => {
    if (!hasMultipleImages) return;
    setSelectedImage((current) => (current - 1 + displayImages.length) % displayImages.length);
  };

  const goToNextImage = () => {
    if (!hasMultipleImages) return;
    setSelectedImage((current) => (current + 1) % displayImages.length);
  };

  useEffect(() => {
    setStockAlertEmail(customer?.email ?? "");
  }, [customer?.email]);

  useEffect(() => {
    setStockAlertOpen(false);
    setStockAlertMessage("");
    setStockAlertError("");
  }, [product.id, selectedVariant?.id, isInStock]);

  useEffect(() => {
    if (selectedImage >= displayImages.length) {
      setSelectedImage(0);
    }
  }, [displayImages.length, selectedImage]);

  useEffect(() => {
    if (!isLightboxOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsLightboxOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isLightboxOpen]);

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
    const productToAdd = selectedVariant
      ? {
          ...product,
          price: selectedVariant.price ?? product.price,
          pricePublic: selectedVariant.pricePublic ?? selectedVariant.price ?? product.pricePublic,
          priceProEur: selectedVariant.priceProEur ?? product.priceProEur,
          hasPriceProEur: selectedVariant.hasPriceProEur ?? product.hasPriceProEur,
          name: `${product.name} - ${selectedVariant.name}`,
          images: selectedVariant.image ? [selectedVariant.image, ...images.filter((img) => img !== selectedVariant.image)] : product.images,
          stockCount: selectedVariant.stock,
          inStock: selectedVariant.inStock && selectedVariant.stock > 0,
        }
      : product;
    addItem(productToAdd, quantity, selectedVariant ?? null);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleSelectVariant = (v: ProductVariant) => {
    setSelectedVariant(selectedVariant?.id === v.id ? null : v);
    setSelectedImage(0);
  };

  const handleStockAlertSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canRequestStockAlert || stockAlertLoading) return;

    const email = stockAlertEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setStockAlertError("Merci de saisir une adresse email valide.");
      setStockAlertMessage("");
      return;
    }

    setStockAlertLoading(true);
    setStockAlertError("");
    setStockAlertMessage("");
    try {
      const response = await createStockAlert({
        email,
        productId: product.id,
        variantId: selectedVariant?.id ?? null,
      });
      setStockAlertMessage(response.message || "Vous serez prévenu dès que cet article sera de nouveau disponible !");
      setStockAlertOpen(false);
    } catch (err) {
      setStockAlertError(err instanceof Error ? err.message : "Impossible d’enregistrer votre alerte pour le moment.");
    } finally {
      setStockAlertLoading(false);
    }
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
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#131313] text-[#e5e2e1]">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-8 md:py-10">

        {/* Breadcrumb */}
        <nav className="flex max-w-full min-w-0 items-center gap-2 overflow-hidden text-[10px] font-black uppercase tracking-[0.22em] text-gray-500 mb-8 md:gap-3 md:tracking-[0.3em] md:mb-10">
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

        <div className="grid w-full max-w-full min-w-0 gap-8 lg:grid-cols-2 lg:gap-20">

          {/* ─── GALERIE ─── */}
          <div className="min-w-0 w-full max-w-full">
            {/* Image principale */}
            <div className="group relative mb-4 aspect-square w-full max-w-full overflow-hidden rounded-2xl bg-white">
              {displayImages[selectedImage] ? (
                <button
                  type="button"
                  onClick={() => setIsLightboxOpen(true)}
                  className="relative block h-full w-full max-w-full cursor-zoom-in overflow-hidden"
                  aria-label="Agrandir l'image produit"
                >
                  <Image
                    src={displayImages[selectedImage]}
                    alt={product.name}
                    fill
                    className="max-h-full max-w-full object-contain p-4 transition-transform duration-300 ease-out sm:p-8"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    priority
                  />
                </button>
              ) : (
                <div className="flex h-full items-center justify-center text-xs uppercase tracking-widest text-gray-500">
                  Aucune image
                </div>
              )}

              {hasMultipleImages && (
                <>
                  <button
                    type="button"
                    onClick={goToPreviousImage}
                    className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-xl font-black text-white shadow-lg backdrop-blur transition-all duration-300 hover:bg-[#ff4a8d] md:opacity-0 md:group-hover:opacity-100"
                    aria-label="Image précédente"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={goToNextImage}
                    className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-xl font-black text-white shadow-lg backdrop-blur transition-all duration-300 hover:bg-[#ff4a8d] md:opacity-0 md:group-hover:opacity-100"
                    aria-label="Image suivante"
                  >
                    →
                  </button>
                </>
              )}

              {/* Badges */}
              <div className="absolute left-4 top-4 flex flex-col gap-2">
                {product.isNew && (
                  <span className="bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-black shadow-sm">
                    NOUVEAU
                  </span>
                )}
                {discountPercent > 0 && (
                  <span className="bg-[#ff4a8d] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-sm">
                    -{discountPercent}%
                  </span>
                )}
              </div>
            </div>

            {/* Miniatures */}
            {hasMultipleImages && (
              <div className="flex max-w-full gap-3 overflow-x-auto pb-2">
                {displayImages.map((img, i) => (
                  <button
                    key={`${img}-${i}`}
                    type="button"
                    onClick={() => setSelectedImage(i)}
                    className={`relative aspect-square h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-white transition-all duration-200 ${
                      i === selectedImage ? "border-[#ff4a8d] shadow-[0_0_0_3px_rgba(255,74,141,0.18)]" : "border-transparent hover:border-[#ff4a8d]/50"
                    }`}
                    aria-label={`Afficher l'image produit ${i + 1}`}
                    aria-current={i === selectedImage ? "true" : undefined}
                  >
                    <Image
                      src={img}
                      alt={`${product.name} - ${i + 1}`}
                      fill
                      className="object-contain p-2"
                      sizes="80px"
                    />
                  </button>
                ))}
              </div>
            )}

            {isLightboxOpen && displayImages[selectedImage] && (
              <div
                className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4"
                onClick={closeLightbox}
                role="dialog"
                aria-modal="true"
                aria-label="Galerie produit agrandie"
              >
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    closeLightbox();
                  }}
                  className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl font-black text-black transition-colors hover:bg-[#ff4a8d] hover:text-white"
                  aria-label="Fermer la galerie"
                >
                  ×
                </button>

                {hasMultipleImages && (
                  <>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        goToPreviousImage();
                      }}
                      className="absolute left-4 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-3xl font-black text-white backdrop-blur transition-colors hover:bg-[#ff4a8d]"
                      aria-label="Image précédente"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        goToNextImage();
                      }}
                      className="absolute right-4 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-3xl font-black text-white backdrop-blur transition-colors hover:bg-[#ff4a8d]"
                      aria-label="Image suivante"
                    >
                      →
                    </button>
                  </>
                )}

                <div className="relative h-full max-h-[90vh] w-full max-w-6xl">
                  <Image
                    src={displayImages[selectedImage]}
                    alt={product.name}
                    fill
                    className="object-contain"
                    sizes="100vw"
                    priority
                    onClick={(event) => event.stopPropagation()}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ─── INFOS PRODUIT ─── */}
          <div className="flex min-w-0 max-w-full flex-col">
            {/* Marque */}
            <p className="text-[10px] font-black tracking-[0.4em] text-[#ff4a8d] uppercase mb-4">
              {product.brand}
            </p>

            {/* Nom */}
            <h1 className="mb-6 break-words text-3xl font-black uppercase italic leading-none tracking-tighter md:text-4xl">
              {product.name}
            </h1>

            {/* Prix */}
            <div className="mb-8 max-w-full min-w-0">
              {showsProPrice && (
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span className="bg-blue-600 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-white">PRIX PRO</span>
                  <span className="text-xs font-bold uppercase tracking-widest text-blue-400">Tarif professionnel HT</span>
                </div>
              )}
              <div className="flex max-w-full flex-wrap items-baseline gap-3 sm:gap-4">
                <span className="break-words text-3xl font-black tracking-tighter sm:text-4xl">
                  {formatPrice(displayPrice)}{showsProPrice ? " HT" : ""}
                </span>
                {showsProPrice ? (
                  <span className="text-xl text-gray-600 line-through">
                    Public {formatPrice(referencePublicPrice)} TTC
                  </span>
                ) : hasDiscount && compareAtPrice ? (
                  <span className="text-xl text-gray-600 line-through">
                    {formatPrice(compareAtPrice)}
                  </span>
                ) : null}
                {discountPercent > 0 && !showsProPrice && (
                  <span className="text-sm font-black text-[#ff4a8d] bg-[#ff4a8d]/10 px-3 py-1">
                    -{discountPercent}%
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
                      title={v.name + (!(v.inStock && v.stock > 0) ? " (Rupture)" : "")}
                      className={`relative w-10 h-10 overflow-hidden border-2 transition-all focus:outline-none ${
                        selectedVariant?.id === v.id
                          ? "border-[#ff4a8d] scale-110"
                          : "border-white/10 hover:border-white/40"
                      } ${!(v.inStock && v.stock > 0) ? "cursor-pointer ring-1 ring-red-400/70" : "cursor-pointer"}`}
                      style={{ backgroundColor: v.colorHex || "#333" }}
                    >
                      {!(v.inStock && v.stock > 0) && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute left-1/2 top-1/2 h-[2px] w-[145%] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-red-400 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
                        />
                      )}
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
                <div className="flex max-w-full flex-wrap gap-2">
                  {sizeVariants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => handleSelectVariant(v)}
                      className={`max-w-full break-words border px-3 py-2 text-xs font-black uppercase tracking-widest transition-all sm:px-4 ${
                        selectedVariant?.id === v.id
                          ? "border-[#ff4a8d] bg-[#ff4a8d] text-white"
                          : "border-white/10 text-gray-400 hover:border-white/40 hover:text-white"
                      } ${!(v.inStock && v.stock > 0) ? "opacity-50 cursor-pointer line-through" : "cursor-pointer"}`}
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
                <div className="flex max-w-full flex-wrap gap-2">
                  {otherVariants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => handleSelectVariant(v)}
                      className={`max-w-full break-words border px-3 py-2 text-xs font-black uppercase tracking-widest transition-all sm:px-4 ${
                        selectedVariant?.id === v.id
                          ? "border-[#ff4a8d] bg-[#ff4a8d] text-white"
                          : "border-white/10 text-gray-400 hover:border-white/40 hover:text-white"
                      } ${!(v.inStock && v.stock > 0) ? "opacity-50 cursor-pointer grayscale" : "cursor-pointer"}`}
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
              <p className="text-[10px] font-black tracking-widest uppercase text-[#061923] bg-primary border border-primary/40 px-4 py-3 mb-4">
                Sélectionnez une option avant d&apos;ajouter au panier
              </p>
            )}

            {/* Quantité + CTA */}
            <div className="mb-8 flex max-w-full flex-col items-stretch gap-3 sm:flex-row sm:gap-4">
              <div className="flex w-full items-center justify-center border border-white/10 sm:w-auto">
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
                disabled={!canSubmitCart}
                className={`flex min-w-0 flex-1 items-center justify-center gap-2 px-3 py-4 text-center text-xs font-black uppercase tracking-widest transition-all sm:gap-3 ${
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

            {canRequestStockAlert && (
              <div className="mb-4 border border-[#ff4a8d]/30 bg-[#ff4a8d]/10 p-4">
                {!stockAlertOpen ? (
                  <button
                    type="button"
                    onClick={() => setStockAlertOpen(true)}
                    className="flex w-full items-center justify-center border border-[#ff4a8d] bg-[#ff4a8d] px-5 py-4 text-xs font-black uppercase tracking-widest text-white transition hover:bg-[#ff1f70]"
                  >
                    Me prévenir quand c'est en stock
                  </button>
                ) : (
                  <form onSubmit={handleStockAlertSubmit} className="space-y-3">
                    <label htmlFor="stock-alert-email" className="block text-[10px] font-black uppercase tracking-[0.25em] text-[#ff8fbd]">
                      Recevoir l’alerte par email
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        id="stock-alert-email"
                        type="email"
                        value={stockAlertEmail}
                        onChange={(event) => setStockAlertEmail(event.target.value)}
                        placeholder="votre@email.com"
                        className="min-w-0 flex-1 border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-[#ff4a8d]"
                        required
                      />
                      <button
                        type="submit"
                        disabled={stockAlertLoading}
                        className="border border-[#ff4a8d] bg-[#ff4a8d] px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-[#ff1f70] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {stockAlertLoading ? "Envoi..." : "M'alerter"}
                      </button>
                    </div>
                  </form>
                )}
                {stockAlertMessage && <p className="mt-3 text-xs font-semibold text-green-300">{stockAlertMessage}</p>}
                {stockAlertError && <p className="mt-3 text-xs font-semibold text-red-300">{stockAlertError}</p>}
              </div>
            )}

            {requiresVariantSelection && (
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-500">
                Sélectionnez une variante pour vérifier sa disponibilité.
              </p>
            )}

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
                <div className="min-w-0 w-full max-w-full">
                  <p className="text-xs font-black tracking-widest uppercase">
                    {product.isPro ? "Livraison gratuite dès 500€ HT" : "Livraison gratuite dès 49€"}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Expédition sous 24-48h</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Shield size={16} className="text-[#ff4a8d] shrink-0" />
                <div className="min-w-0 w-full max-w-full">
                  <p className="text-xs font-black tracking-widest uppercase">Paiement sécurisé</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Transactions chiffrées SSL</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <RotateCcw size={16} className="text-[#ff4a8d] shrink-0" />
                <div className="min-w-0 w-full max-w-full">
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
                    className="product-rich-content prose prose-sm prose-invert max-w-none overflow-x-auto break-words pb-6 text-sm leading-relaxed text-gray-400"
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
