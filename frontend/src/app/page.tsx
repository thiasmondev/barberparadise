"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Star, ChevronLeft, ChevronRight, Search, User, ShoppingBag, Menu, Moon, Sun } from "lucide-react";
import { getProducts, getCategories } from "@/lib/api";
import type { Product, Category } from "@/types";
import ProductCard from "@/components/ProductCard";

export default function HomePage() {
  const [featured, setFeatured] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);

  const heroSlides = [
    {
      title: "MASTER YOUR CRAFT.",
      subtitle: "THE NOIR COLLECTION",
      description: "Premium, small-batch grooming essentials engineered for the modern gentleman. Forged in tradition, refined for today.",
      image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBZQYbGi78PWJQPcqgyK9KYdehlfjmpLBWWyB3Vfig1HI1bpjSLulat7qHjOjgP19n2oG9iZ-o5jf_UfGvNenDk_fzQDbZ8ozBlYcby3YWe0TiXOeS6fXIaMHYnOszA9hwUXcxHU5S3P3DeL3ReQSiA1QpEhczYAukQpOXGmqYp7Cv66P5QeWAc8CBYhBx9pTWJw9nnr2zdFGr2cWbIAycqQnU-PrRgnu2VFeLdAzgbvf0EzJ22hT9uPYgmkML66rQVzH_rgx3xYtc",
      cta1: "EXPLORE OILS",
      cta2: "VIEW LOOKBOOK"
    },
    {
      title: "PRECISION TOOLS.",
      subtitle: "PROFESSIONAL GRADE",
      description: "The ultimate arsenal for the master barber. High-performance clippers and scissors designed for absolute control.",
      image: "https://lh3.googleusercontent.com/aida-public/AB6AXuB8Y2LiXGlTBlbdjTIFKXs9yn9ThuZ2DAjo-nIMAGaSvLqarAt9b409XUFhWHyUEEmi3k4JiVwlueMkuTars_QDJNut2JvccybfLOqzjTpUHgpBG61AzdJnWrqnYsHYBO1g6PJHdu8-IGf2d-Qff9DngnRJ8yncm9_c3KZ83r6eOPfUl",
      cta1: "SHOP TOOLS",
      cta2: "LEARN MORE"
    }
  ];

  useEffect(() => {
    async function load() {
      try {
        const [productsData, categoriesData] = await Promise.all([
          getProducts({ limit: 4, sort: "newest" }),
          getCategories()
        ]);
        setFeatured(productsData.products);
        setCategories(categoriesData.filter(c => !c.parentSlug).slice(0, 8));
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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  return (
    <div className="bg-[#131313] text-[#e5e2e1] min-h-screen font-sans selection:bg-[#ff4a8d] selection:text-white">
      {/* Top Announcement Bar */}
      <div className="bg-[#1a1a1a] text-white text-[10px] sm:text-xs font-bold tracking-[0.2em] text-center py-2.5 uppercase w-full border-b border-white/5">
        LIVRAISON GRATUITE EN POINTS RELAIS DÈS 10€ !
      </div>

      {/* Hero Section */}
      <section className="relative h-[85vh] min-h-[600px] flex items-center overflow-hidden">
        {heroSlides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              index === currentHeroIndex ? "opacity-100 z-10" : "opacity-0 z-0"
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/40 to-transparent z-20" />
            <img
              src={slide.image}
              alt={slide.title}
              className="absolute inset-0 w-full h-full object-cover mix-blend-luminosity opacity-60"
            />
            <div className="relative z-30 max-w-[1440px] mx-auto px-8 h-full flex flex-col justify-center">
              <div className="max-w-2xl">
                <span className="inline-block text-[#ffb1c4] text-xs font-bold tracking-[0.3em] uppercase mb-4 animate-fade-in">
                  {slide.subtitle}
                </span>
                <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.9] mb-8 uppercase italic">
                  {slide.title.split(' ').map((word, i) => (
                    <span key={i} className="block">{word}</span>
                  ))}
                </h1>
                <p className="text-lg text-gray-400 mb-10 max-w-md leading-relaxed">
                  {slide.description}
                </p>
                <div className="flex flex-wrap gap-4">
                  <Link
                    href="/catalogue"
                    className="bg-[#ff4a8d] hover:bg-[#ff1f70] text-white px-8 py-4 text-xs font-black tracking-widest uppercase transition-all transform hover:scale-105"
                  >
                    {slide.cta1}
                  </Link>
                  <Link
                    href="/catalogue"
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
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                i === currentHeroIndex ? "bg-[#ff4a8d] w-8" : "bg-white/30"
              }`}
            />
          ))}
        </div>
      </section>

      {/* The Arsenal - Featured Products */}
      <section className="py-24 bg-[#131313]">
        <div className="max-w-[1440px] mx-auto px-8">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-4xl font-black tracking-tighter uppercase italic mb-2">THE ARSENAL</h2>
              <p className="text-gray-500 tracking-widest text-xs uppercase">Our most coveted formulations.</p>
            </div>
            <Link href="/catalogue" className="text-[#ff4a8d] text-[10px] font-black tracking-[0.2em] uppercase hover:underline flex items-center gap-2">
              SHOP ALL BESTSELLERS <ArrowRight size={12} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-[#1c1b1b] aspect-[4/5] animate-pulse rounded-sm" />
              ))
            ) : featured.length > 0 ? (
              featured.map((product) => (
                <Link key={product.id} href={`/produit/${product.slug}`} className="group relative bg-[#1c1b1b] overflow-hidden rounded-sm aspect-[4/5] flex flex-col">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent z-10 opacity-80 group-hover:opacity-100 transition-opacity" />
                  <img
                    src={product.images[0] || "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&q=80"}
                    alt={product.name}
                    className="absolute inset-0 w-full h-full object-cover mix-blend-luminosity group-hover:mix-blend-normal group-hover:scale-110 transition-all duration-700"
                  />
                  <div className="relative z-20 mt-auto p-6">
                    <h3 className="text-lg font-black tracking-tight leading-tight mb-1 group-hover:text-[#ffb1c4] transition-colors">
                      {product.name}
                    </h3>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-4">
                      {product.brand}
                    </p>
                    <div className="flex justify-between items-center">
                      <span className="bg-white/10 backdrop-blur-md px-3 py-1 text-[11px] font-bold rounded-full">
                        {formatPrice(product.price)}
                      </span>
                      <span className="text-[#ff4a8d] opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
                        <ArrowRight size={16} />
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="col-span-full text-center py-20 border border-white/5 rounded-sm">
                <p className="text-gray-500 uppercase tracking-widest text-xs">No products found in the arsenal.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Word on the Street - Testimonials */}
      <section className="py-24 bg-[#0e0e0e] border-y border-white/5">
        <div className="max-w-[1440px] mx-auto px-8">
          <div className="flex justify-between items-center mb-16">
            <div>
              <h2 className="text-4xl font-black tracking-tighter uppercase italic mb-2">WORD ON THE STREET</h2>
              <p className="text-gray-500 tracking-widest text-xs uppercase">What our patrons are saying.</p>
            </div>
            <div className="flex gap-2">
              <button className="w-10 h-10 border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors">
                <ChevronLeft size={20} />
              </button>
              <button className="w-10 h-10 border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors">
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: "MARCUS VANCE",
                role: "Verified Buyer",
                text: "The Master Kit completely changed my routine. The quality of the oils is unmatched, and the scent lingers perfectly all day without being overpowering."
              },
              {
                name: "JULIAN ROSSI",
                role: "Verified Buyer",
                text: "I've tried dozens of balms over the years. Paradise Noir's Styling Balm is the only one that gives me the hold I need while keeping my beard soft to the touch."
              },
              {
                name: "ELIAS THORNE",
                role: "Verified Buyer",
                text: "From the heavy glass bottles to the complex, sophisticated fragrances, every detail screams luxury. It's an investment in yourself."
              }
            ].map((t, i) => (
              <div key={i} className="bg-[#131313] p-10 border border-white/5 relative group hover:border-[#ff4a8d]/30 transition-colors">
                <div className="flex gap-1 mb-6">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} size={12} className="fill-[#ff4a8d] text-[#ff4a8d]" />
                  ))}
                </div>
                <p className="text-gray-300 italic leading-relaxed mb-8 text-sm">
                  "{t.text}"
                </p>
                <div>
                  <h4 className="font-black tracking-widest text-[10px] uppercase mb-1">{t.name}</h4>
                  <p className="text-[9px] text-gray-500 uppercase tracking-widest">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Brands Marquee */}
      <section className="py-16 bg-[#131313] overflow-hidden border-b border-white/5">
        <div className="max-w-[1440px] mx-auto px-8 mb-8">
          <p className="text-center text-[10px] font-black tracking-[0.3em] text-gray-600 uppercase">FEATURED BRANDS</p>
        </div>
        <div className="relative flex overflow-x-hidden">
          <div className="animate-marquee whitespace-nowrap flex items-center gap-20 py-4">
            {["ANDIS", "BABYLISS PRO", "GAMMA+", "HAIRCUT PRO", "HEY JOE!", "JACQUES SEBAN", "JRL", "KING BROWN"].map((brand, i) => (
              <span key={i} className="text-2xl md:text-4xl font-black tracking-tighter text-white/20 hover:text-white/60 transition-colors cursor-default uppercase italic">
                {brand}
              </span>
            ))}
          </div>
          <div className="absolute top-0 animate-marquee2 whitespace-nowrap flex items-center gap-20 py-4 ml-20">
             {["ANDIS", "BABYLISS PRO", "GAMMA+", "HAIRCUT PRO", "HEY JOE!", "JACQUES SEBAN", "JRL", "KING BROWN"].map((brand, i) => (
              <span key={i} className="text-2xl md:text-4xl font-black tracking-tighter text-white/20 hover:text-white/60 transition-colors cursor-default uppercase italic">
                {brand}
              </span>
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
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
        .animate-marquee2 {
          animation: marquee2 30s linear infinite;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.8s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
