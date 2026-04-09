// ============================================================
// BARBER PARADISE — Page d'accueil
// Couleurs: Primary #4EAADB | Secondary #252525 | BG #FFFFFF
// ============================================================

import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ArrowRight, ChevronLeft, ChevronRight, Star, Truck, Shield, Headphones, RotateCcw } from "lucide-react";
import { getFeaturedProducts, getPromoProducts, getNewProducts, categories } from "@/lib/data";
import ProductCard from "@/components/products/ProductCard";
import { useProducts } from "@/hooks/useApi";

// Hero slides
const heroSlides = [
  {
    id: 1,
    tag: "NOUVEAUTÉ",
    title: "StyleCraft\nSaber II",
    subtitle: "Lame Echo DLC, zéro-gap, USB-C — La référence absolue",
    cta: "Découvrir",
    href: "/produit/stylecraft-saber-ii",
    bg: "from-gray-900 to-gray-700",
    image: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=1200&q=85",
  },
  {
    id: 2,
    tag: "EXCLUSIVITÉ",
    title: "Osaka\nCurvy 6\"",
    subtitle: "Ciseaux incurvés exclusifs Barber Paradise — Acier japonais VG-10",
    cta: "Commander",
    href: "/produit/osaka-curvy-6-pouces",
    bg: "from-slate-900 to-slate-700",
    image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=1200&q=85",
  },
  {
    id: 3,
    tag: "PROMO",
    title: "Wahl Magic\nClip Cordless",
    subtitle: "La tondeuse légendaire — Jusqu'à -15% sur une sélection",
    cta: "Voir les promos",
    href: "/catalogue?filter=promo",
    bg: "from-blue-900 to-blue-700",
    image: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=1200&q=85",
  },
];

// Quick category links
const quickCategories = [
  { label: "Lockhart's", href: "/catalogue?brand=lockharts", image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=300&q=80" },
  { label: "Tondeuses", href: "/catalogue?subcategory=tondeuse", image: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=300&q=80" },
  { label: "Osaka", href: "/catalogue?brand=osaka", image: "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=300&q=80" },
  { label: "Y/S Park", href: "/catalogue?brand=ys-park", image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=300&q=80" },
  { label: "Trimmer", href: "/catalogue?subcategory=tondeuse", image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=300&q=80" },
  { label: "Barbe", href: "/catalogue?subcategory=barbe", image: "https://images.unsplash.com/photo-1621607512022-6aecc4fed814?w=300&q=80" },
  { label: "Brosses", href: "/catalogue?subcategory=brosse-peigne", image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=300&q=80" },
  { label: "Hey Joe!", href: "/catalogue?brand=hey-joe", image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=300&q=80" },
];

const features = [
  { icon: Truck, title: "Livraison gratuite", desc: "Dès 54€ en points relais" },
  { icon: Shield, title: "Paiement sécurisé", desc: "100% sécurisé, SSL" },
  { icon: Headphones, title: "Conseils experts", desc: "Équipe de barbiers professionnels" },
  { icon: RotateCcw, title: "Retours faciles", desc: "30 jours pour changer d'avis" },
];

const testimonials = [
  { author: "La mach", rating: 5, text: "Expérience d'achat réussie. Le vendeur a été de bon conseil pour m'orienter vers le bon produit." },
  { author: "Thomas M.", rating: 5, text: "Meilleur site pour le matériel et produit ! Top du top." },
  { author: "Karim B.", rating: 5, text: "Produit au top, livraison vraiment très rapide, très professionnel cette boutique." },
  { author: "Alexandre D.", rating: 5, text: "Une tondeuse très élégante reçue très rapidement. Merci Barber Paradise pour les conseils et le professionnalisme." },
];

export default function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);
  // Données API dynamiques avec fallback sur les données mockées
  const { products: apiFeatured } = useProducts({ sort: "popular", limit: 8 });
  const { products: apiPromo } = useProducts({ isPromo: true, limit: 8 });
  const { products: apiNew } = useProducts({ isNew: true, limit: 8 });
  const featuredProducts = apiFeatured.length > 0 ? apiFeatured as any[] : getFeaturedProducts();
  const promoProducts = apiPromo.length > 0 ? apiPromo as any[] : getPromoProducts();
  const newProducts = apiNew.length > 0 ? apiNew as any[] : getNewProducts();

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen">
      {/* ── HERO SLIDER ─────────────────────────────────── */}
      <section className="relative h-[500px] md:h-[600px] overflow-hidden bg-gray-900">
        {heroSlides.map((slide, idx) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-700 ${idx === currentSlide ? "opacity-100" : "opacity-0"}`}
          >
            <img
              src={slide.image}
              alt={slide.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-transparent" />
            <div className="absolute inset-0 flex items-center">
              <div className="container">
                <div className="max-w-xl">
                  <span className="inline-block bg-primary text-white text-xs font-black uppercase tracking-widest px-3 py-1 mb-4" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    {slide.tag}
                  </span>
                  <h1 className="text-5xl md:text-7xl font-black text-white leading-none mb-4 whitespace-pre-line" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    {slide.title}
                  </h1>
                  <p className="text-gray-300 text-base md:text-lg mb-6 font-normal" style={{ fontFamily: "'Barlow', sans-serif", textTransform: "none", letterSpacing: "normal" }}>
                    {slide.subtitle}
                  </p>
                  <Link href={slide.href} className="btn-primary inline-flex items-center gap-2">
                    {slide.cta} <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Controls */}
        <button
          onClick={() => setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length)}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
          aria-label="Précédent"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={() => setCurrentSlide((prev) => (prev + 1) % heroSlides.length)}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
          aria-label="Suivant"
        >
          <ChevronRight size={20} />
        </button>

        {/* Dots */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {heroSlides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={`w-2 h-2 rounded-full transition-all ${idx === currentSlide ? "bg-primary w-6" : "bg-white/50"}`}
              aria-label={`Slide ${idx + 1}`}
            />
          ))}
        </div>
      </section>

      {/* ── FEATURES BAR ────────────────────────────────── */}
      <section className="bg-secondary text-white">
        <div className="container">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-white/10">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-center gap-3 py-4 px-4">
                <Icon size={22} className="text-primary flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold uppercase tracking-wide" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{title}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── QUICK CATEGORIES ────────────────────────────── */}
      <section className="py-10 bg-white">
        <div className="container">
          <div className="flex items-center justify-between mb-6">
            <h2 className="section-title">Collections</h2>
            <Link href="/catalogue" className="text-sm text-primary font-semibold hover:underline flex items-center gap-1">
              Voir tout <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
            {quickCategories.map((cat) => (
              <Link key={cat.label} href={cat.href} className="group text-center">
                <div className="aspect-square overflow-hidden bg-gray-100 mb-2 border border-gray-200 group-hover:border-primary/40 transition-colors">
                  <img
                    src={cat.image}
                    alt={cat.label}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                </div>
                <span className="text-xs font-semibold text-gray-700 group-hover:text-primary transition-colors" style={{ fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {cat.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRODUITS POPULAIRES ─────────────────────────── */}
      <section className="py-12 bg-gray-50">
        <div className="container">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="section-title">Produits Populaires</h2>
              <p className="section-subtitle mt-1">La sélection préférée de nos barbiers</p>
            </div>
            <Link href="/catalogue" className="btn-secondary hidden md:inline-flex items-center gap-2 text-sm">
              Tous les produits <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {featuredProducts.slice(0, 8).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <div className="text-center mt-8 md:hidden">
            <Link href="/catalogue" className="btn-secondary inline-flex items-center gap-2">
              Voir tous les produits <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── BANNER PROMO ────────────────────────────────── */}
      <section className="relative py-20 overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=1400&q=80"
          alt="Promo"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-secondary/80" />
        <div className="relative container text-center text-white">
          <span className="inline-block bg-primary text-white text-xs font-black uppercase tracking-widest px-3 py-1 mb-4" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            Tarifs Professionnels
          </span>
          <h2 className="text-4xl md:text-6xl font-black text-white mb-4" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            Vous êtes professionnel ?
          </h2>
          <p className="text-gray-300 text-lg mb-8 max-w-xl mx-auto" style={{ fontFamily: "'Barlow', sans-serif", textTransform: "none", letterSpacing: "normal" }}>
            Contactez-nous par mail en précisant le nom de votre entreprise pour bénéficier des tarifs professionnels.
          </p>
          <Link href="/contact" className="btn-primary inline-flex items-center gap-2 text-base px-8 py-4">
            Nous contacter <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* ── NOUVEAUTÉS ──────────────────────────────────── */}
      {newProducts.length > 0 && (
        <section className="py-12 bg-white">
          <div className="container">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="section-title">Nouveautés</h2>
                <p className="section-subtitle mt-1">Les dernières arrivées dans notre boutique</p>
              </div>
              <Link href="/catalogue?filter=new" className="text-sm text-primary font-semibold hover:underline flex items-center gap-1">
                Voir tout <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {newProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── PROMOS ──────────────────────────────────────── */}
      {promoProducts.length > 0 && (
        <section className="py-12 bg-gray-50">
          <div className="container">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="section-title text-red-600">Promotions</h2>
                <p className="section-subtitle mt-1">Offres à durée limitée</p>
              </div>
              <Link href="/catalogue?filter=promo" className="text-sm text-red-600 font-semibold hover:underline flex items-center gap-1">
                Toutes les promos <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {promoProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── MARQUES ─────────────────────────────────────── */}
      <section className="py-12 bg-white border-t border-gray-100">
        <div className="container">
          <h2 className="section-title text-center mb-8">Nos Marques</h2>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            {["Andis", "Babyliss Pro", "Wahl", "JRL", "Style Craft", "Osaka", "Lockhart's", "Hey Joe!", "King Brown", "Dr K Soap", "Clubman", "Gamma+"].map((brand) => (
              <Link
                key={brand}
                href={`/catalogue?brand=${brand.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}`}
                className="border border-gray-200 hover:border-primary/40 hover:bg-primary/5 transition-all p-4 text-center group"
              >
                <span className="text-xs font-black uppercase tracking-wider text-gray-500 group-hover:text-primary transition-colors" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {brand}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── TÉMOIGNAGES ─────────────────────────────────── */}
      <section className="py-12 bg-gray-50">
        <div className="container">
          <div className="text-center mb-8">
            <h2 className="section-title">Ils nous font confiance</h2>
            <div className="flex items-center justify-center gap-2 mt-2">
              <div className="flex">
                {[1,2,3,4,5].map((s) => <Star key={s} size={16} className="text-yellow-400 fill-yellow-400" />)}
              </div>
              <span className="text-sm text-gray-600 font-medium">4.9/5 sur 43 avis</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {testimonials.map((t) => (
              <div key={t.author} className="bg-white border border-gray-200 p-5 hover:border-primary/30 transition-colors">
                <div className="flex mb-3">
                  {[1,2,3,4,5].map((s) => (
                    <Star key={s} size={13} className={s <= t.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200"} />
                  ))}
                </div>
                <p className="text-sm text-gray-700 leading-relaxed mb-3 italic">"{t.text}"</p>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  — {t.author}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── NEWSLETTER ──────────────────────────────────── */}
      <section className="py-12 bg-primary">
        <div className="container text-center text-white">
          <h2 className="text-3xl md:text-4xl font-black mb-2" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            RESTEZ INFORMÉ
          </h2>
          <p className="text-white/80 mb-6" style={{ fontFamily: "'Barlow', sans-serif", textTransform: "none" }}>
            Nouveautés, promotions exclusives et conseils de pros directement dans votre boîte mail.
          </p>
          <form className="flex gap-0 max-w-md mx-auto" onSubmit={(e) => { e.preventDefault(); }}>
            <input
              type="email"
              placeholder="Votre adresse email"
              className="flex-1 px-4 py-3 text-sm text-gray-800 focus:outline-none border-0"
            />
            <button type="submit" className="bg-secondary text-white px-6 py-3 text-sm font-bold uppercase tracking-wider hover:bg-black transition-colors" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              S'inscrire
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
