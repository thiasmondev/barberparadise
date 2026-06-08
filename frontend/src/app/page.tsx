"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowRight, Star, ChevronLeft, ChevronRight } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import Carousel from "@/components/Carousel";
import { getBrands, getProducts } from "@/lib/api";
import type { Brand, Product } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://barberparadise-backend.onrender.com";

interface Review {
  id: string;
  author: string;
  rating: number;
  comment: string;
  product?: { name: string; brand: string };
}

export default function HomePage() {
  const [featured, setFeatured] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewIndex, setReviewIndex] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const [productsData, brandsData] = await Promise.all([
          getProducts({ limit: 8, sort: "newest" }),
          getBrands(),
        ]);
        setFeatured(productsData.products.slice(0, 8));
        setBrands(brandsData.filter((brand) => brand.productCount > 0));

        // Avis publics
        try {
          const res = await fetch(`${API_URL}/api/products/reviews/public`);
          if (res.ok) {
            const data = await res.json();
            setReviews(data);
          }
        } catch {
          // Pas d'avis en base — on garde le tableau vide
        }
      } catch (err) {
        console.error("Failed to load homepage data", err);
      } finally {
        setLoading(false);
      }
    }
    load();

  }, []);


  // Pagination avis (3 par page)
  const reviewsPerPage = 3;
  const totalReviewPages = Math.max(1, Math.ceil(reviews.length / reviewsPerPage));
  const visibleReviews = reviews.slice(reviewIndex * reviewsPerPage, reviewIndex * reviewsPerPage + reviewsPerPage);

  return (
    <div className="bg-[#131313] text-[#e5e2e1] min-h-screen font-sans selection:bg-[#ff4a8d] selection:text-white">

      {/* ─── CARROUSEL DYNAMIQUE ─── */}
      <Carousel />

      {/* ─── THE PARADISE — Produits phares ─── */}
      <section className="py-24 bg-[#131313]">
        <div className="max-w-[1440px] mx-auto px-8">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-4xl font-black tracking-tighter uppercase italic mb-2">THE PARADISE</h2>
              <p className="text-gray-500 tracking-widest text-xs uppercase">La meilleure sélection du marché.</p>
            </div>
            <Link href="/catalogue" className="text-[#ff4a8d] text-[10px] font-black tracking-[0.2em] uppercase hover:underline flex items-center gap-2">
              ACHETER AU MEILLEUR PRIX <ArrowRight size={12} />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-[#1c1b1b] aspect-[4/5] animate-pulse" />
              ))
            ) : featured.length > 0 ? (
              featured.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))
            ) : (
              <div className="col-span-full text-center py-20 border border-white/5">
                <p className="text-gray-500 uppercase tracking-widest text-xs">Aucun produit trouvé.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── LES AVIS DE NOS CLIENTS ─── */}
      <section className="py-24 bg-[#0e0e0e] border-y border-white/5">
        <div className="max-w-[1440px] mx-auto px-8">
          <div className="flex justify-between items-center mb-16">
            <div>
              <h2 className="text-4xl font-black tracking-tighter uppercase italic mb-2">LES AVIS DE NOS CLIENTS</h2>
              <p className="text-gray-500 tracking-widest text-xs uppercase">Ils savent de quoi ils parlent.</p>
            </div>
            {reviews.length > reviewsPerPage && (
              <div className="flex gap-2">
                <button
                  onClick={() => setReviewIndex((prev) => Math.max(0, prev - 1))}
                  disabled={reviewIndex === 0}
                  className="w-10 h-10 border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors disabled:opacity-30"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() => setReviewIndex((prev) => Math.min(totalReviewPages - 1, prev + 1))}
                  disabled={reviewIndex >= totalReviewPages - 1}
                  className="w-10 h-10 border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors disabled:opacity-30"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </div>

          {reviews.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {visibleReviews.map((review) => (
                <div key={review.id} className="bg-[#131313] p-10 border border-white/5 relative group hover:border-[#ff4a8d]/30 transition-colors">
                  <div className="flex gap-1 mb-6">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star
                        key={j}
                        size={12}
                        className={j < review.rating ? "fill-[#ff4a8d] text-[#ff4a8d]" : "text-white/20"}
                      />
                    ))}
                  </div>
                  <p className="text-gray-300 italic leading-relaxed mb-8 text-sm">
                    "{review.comment}"
                  </p>
                  <div>
                    <h4 className="font-black tracking-widest text-[10px] uppercase mb-1">{review.author}</h4>
                    {review.product && (
                      <p className="text-[9px] text-gray-500 uppercase tracking-widest">
                        {review.product.name.slice(0, 40)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Pas encore d'avis en base — message d'invitation */
            <div className="text-center py-16 border border-white/5">
              <p className="text-gray-500 uppercase tracking-widest text-xs mb-4">Soyez le premier à laisser un avis</p>
              <Link href="/catalogue" className="text-[#ff4a8d] text-[10px] font-black tracking-[0.2em] uppercase hover:underline">
                DÉCOUVRIR NOS PRODUITS →
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ─── NOS MARQUES ─── */}
      <section className="py-16 bg-[#131313] overflow-hidden border-b border-white/5">
        <div className="max-w-[1440px] mx-auto px-8 mb-8">
          <p className="text-center text-[10px] font-black tracking-[0.3em] text-gray-600 uppercase">NOS MARQUES</p>
        </div>
        <div className="relative flex overflow-x-hidden">
          <div className="animate-marquee whitespace-nowrap flex items-center gap-16 py-4">
            {brands.map((brand) => (
              <Link
                key={brand.id}
                href={`/marques/${brand.slug}`}
                className="flex items-center justify-center h-16 opacity-40 hover:opacity-100 transition-opacity"
              >
                {brand.logo ? (
                  <Image
                    src={brand.logo}
                    alt={brand.name}
                    width={120}
                    height={60}
                    className="object-contain max-h-16 max-w-[120px]"
                  />
                ) : (
                  <span className="text-sm font-black text-white/40 uppercase">{brand.name}</span>
                )}
              </Link>
            ))}
          </div>
          <div className="absolute top-0 animate-marquee2 whitespace-nowrap flex items-center gap-16 py-4">
            {brands.map((brand) => (
              <Link
                key={`duplicate-${brand.id}`}
                href={`/marques/${brand.slug}`}
                className="flex items-center justify-center h-16 opacity-40 hover:opacity-100 transition-opacity"
              >
                {brand.logo ? (
                  <Image
                    src={brand.logo}
                    alt={brand.name}
                    width={120}
                    height={60}
                    className="object-contain max-h-16 max-w-[120px]"
                  />
                ) : (
                  <span className="text-sm font-black text-white/40 uppercase">{brand.name}</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-100%); }
        }
        @keyframes marquee2 {
          0% { transform: translateX(100%); }
          100% { transform: translateX(0%); }
        }
        .animate-marquee { animation: marquee 35s linear infinite; }
        .animate-marquee2 { animation: marquee2 35s linear infinite; }
      `}</style>
    </div>
  );
}
