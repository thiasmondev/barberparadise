"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowRight, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { getProducts, getCategories } from "@/lib/api";
import type { Product, Category } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://barberparadise-backend.onrender.com";

interface Review {
  id: string;
  author: string;
  rating: number;
  comment: string;
  product?: { name: string; brand: string };
}

const REAL_BRANDS = [
  "ANDIS", "BABYLISS PRO", "GAMMA+", "JRL", "HEY JOE!", "JACQUES SEBAN",
  "HAIRCUT PRO", "L3VEL3", "STYLE CRAFT", "VITOS", "DR K SOAP", "DENMAN",
  "DISICIDE", "DANDY", "EUROMAX", "OMEGA", "OSAKA"
];

export default function HomePage() {
  const [featured, setFeatured] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const [reviewIndex, setReviewIndex] = useState(0);

  const heroSlides = [
    {
      subtitle: "LA SÉLECTION PROFESSIONNELLE",
      title: "MASTER YOUR CRAFT.",
      description: "Le matériel professionnel pour les barbiers et coiffeurs exigeants. Livraison rapide, prix imbattables.",
      cta1: "VOIR LES PRODUITS",
      cta2: "NOUVEAUTÉS",
      href1: "/catalogue",
      href2: "/catalogue?sort=newest",
      image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBZQYbGi78PWJQPcqgyK9KYdehlfjmpLBWWyB3Vfig1HI1bpjSLulat7qHjOjgP19n2oG9iZ-o5jf_UfGvNenDk_fzQDbZ8ozBlYcby3YWe0TiXOeS6fXIaMHYnOszA9hwUXcxHU5S3P3DeL3ReQSiA1QpEhczYAukQpOXGmqYp7Cv66P5QeWAc8CBYhBx9pTWJw9nnr2zdFGr2cWbIAycqQnU-PrRgnu2VFeLdAzgbvf0EzJ22hT9uPYgmkML66rQVzH_rgx3xYtc",
    },
    {
      subtitle: "MATÉRIEL PROFESSIONNEL",
      title: "PRECISION TOOLS.",
      description: "Tondeuses, ciseaux, rasoirs — tout ce qu'il faut pour un résultat parfait à chaque coupe.",
      cta1: "VOIR LE MATÉRIEL",
      cta2: "NOS MARQUES",
      href1: "/catalogue?category=materiel",
      href2: "/catalogue?marques=true",
      image: "https://lh3.googleusercontent.com/aida-public/AB6AXuB8Y2LiXGlTBlbdjTIFKXs9yn9ThuZ2DAjo-nIMAGaSvLqarAt9b409XUFhWHyUEEmi3k4JiVwlueMkuTars_QDJNut2JvccybfLOqzjTpUHgpBG61AzdJnWrqnYsHYBO1g6PJHdu8-IGf2d-Qff9DngnRJ8yncm9_c3KZ83r6eOPfUl",
    }
  ];

  useEffect(() => {
    async function load() {
      try {
        const [productsData, categoriesData] = await Promise.all([
          getProducts({ limit: 8, sort: "newest" }),
          getCategories(),
        ]);
        setFeatured(productsData.products.slice(0, 8));
        setCategories(categoriesData.filter((c: Category) => !c.parentSlug).slice(0, 6));

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

    const timer = setInterval(() => {
      setCurrentHeroIndex((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(price);

  // Pagination avis (3 par page)
  const reviewsPerPage = 3;
  const totalReviewPages = Math.max(1, Math.ceil(reviews.length / reviewsPerPage));
  const visibleReviews = reviews.slice(reviewIndex * reviewsPerPage, reviewIndex * reviewsPerPage + reviewsPerPage);

  return (
    <div className="bg-[#131313] text-[#e5e2e1] min-h-screen font-sans selection:bg-[#ff4a8d] selection:text-white">

      {/* ─── HERO ─── */}
      <section className="relative h-[88vh] min-h-[600px] flex items-center overflow-hidden">
        {heroSlides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              index === currentHeroIndex ? "opacity-100 z-10" : "opacity-0 z-0"
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-black/85 via-black/50 to-transparent z-20" />
            <img
              src={slide.image}
              alt={slide.title}
              className="absolute inset-0 w-full h-full object-cover mix-blend-luminosity opacity-60"
            />
            <div className="relative z-30 max-w-[1440px] mx-auto px-8 h-full flex flex-col justify-center">
              <div className="max-w-2xl">
                {/* Logo officiel dans le Hero */}
                <div className="mb-8">
                  <Image
                    src="/logo-barberparadise.png"
                    alt="Barber Paradise"
                    width={200}
                    height={80}
                    className="object-contain h-16 w-auto"
                    priority
                  />
                </div>
                <span className="inline-block text-[#ffb1c4] text-xs font-bold tracking-[0.3em] uppercase mb-4">
                  {slide.subtitle}
                </span>
                <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.9] mb-8 uppercase italic">
                  {slide.title.split(" ").map((word, i) => (
                    <span key={i} className="block">{word}</span>
                  ))}
                </h1>
                <p className="text-lg text-gray-400 mb-10 max-w-md leading-relaxed">
                  {slide.description}
                </p>
                <div className="flex flex-wrap gap-4">
                  <Link
                    href={slide.href1}
                    className="bg-[#ff4a8d] hover:bg-[#ff1f70] text-white px-8 py-4 text-xs font-black tracking-widest uppercase transition-all transform hover:scale-105"
                  >
                    {slide.cta1}
                  </Link>
                  <Link
                    href={slide.href2}
                    className="border border-white/20 hover:border-white text-white px-8 py-4 text-xs font-black tracking-widest uppercase transition-all"
                  >
                    {slide.cta2}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Carousel Dots */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-40 flex gap-3">
          {heroSlides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentHeroIndex(i)}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                i === currentHeroIndex ? "bg-[#ff4a8d] w-8" : "bg-white/30 w-2.5"
              }`}
            />
          ))}
        </div>
      </section>

      {/* ─── CATÉGORIES ─── */}
      {categories.length > 0 && (
        <section className="py-12 bg-[#0e0e0e] border-y border-white/5">
          <div className="max-w-[1440px] mx-auto px-8">
            <div className="flex flex-wrap justify-center gap-3">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/catalogue?category=${cat.slug}`}
                  className="px-6 py-2.5 border border-white/10 text-[10px] font-black tracking-[0.25em] uppercase text-white/60 hover:border-[#ff4a8d] hover:text-white transition-all duration-200"
                >
                  {cat.name}
                </Link>
              ))}
              <Link
                href="/catalogue"
                className="px-6 py-2.5 border border-[#ff4a8d]/30 text-[10px] font-black tracking-[0.25em] uppercase text-[#ff4a8d] hover:border-[#ff4a8d] hover:bg-[#ff4a8d]/10 transition-all duration-200"
              >
                TOUT VOIR →
              </Link>
            </div>
          </div>
        </section>
      )}

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
              featured.map((product) => {
                const img = Array.isArray(product.images)
                  ? product.images[0]
                  : (typeof product.images === "string"
                    ? (JSON.parse(product.images || "[]")[0] || "")
                    : "");
                return (
                  <Link
                    key={product.id}
                    href={`/produit/${product.slug}`}
                    className="group relative bg-[#1c1b1b] overflow-hidden aspect-[4/5] flex flex-col"
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent z-10 opacity-80 group-hover:opacity-100 transition-opacity" />
                    <img
                      src={img || "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&q=80"}
                      alt={product.name}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-all duration-700"
                    />
                    <div className="relative z-20 mt-auto p-4 md:p-6">
                      <h3 className="text-sm md:text-base font-black tracking-tight leading-tight mb-1 group-hover:text-[#ffb1c4] transition-colors line-clamp-2">
                        {product.name}
                      </h3>
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-3">
                        {product.brand}
                      </p>
                      <div className="flex justify-between items-center">
                        <span className="bg-white/10 backdrop-blur-md px-3 py-1 text-[11px] font-bold">
                          {formatPrice(product.price)}
                        </span>
                        <span className="text-[#ff4a8d] opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
                          <ArrowRight size={14} />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })
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
            {REAL_BRANDS.map((brand, i) => (
              <Link
                key={i}
                href={`/catalogue?brand=${encodeURIComponent(brand)}`}
                className="text-2xl md:text-3xl font-black tracking-tighter text-white/20 hover:text-white/70 transition-colors uppercase italic"
              >
                {brand}
              </Link>
            ))}
          </div>
          <div className="absolute top-0 animate-marquee2 whitespace-nowrap flex items-center gap-16 py-4">
            {REAL_BRANDS.map((brand, i) => (
              <Link
                key={i}
                href={`/catalogue?brand=${encodeURIComponent(brand)}`}
                className="text-2xl md:text-3xl font-black tracking-tighter text-white/20 hover:text-white/70 transition-colors uppercase italic"
              >
                {brand}
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
