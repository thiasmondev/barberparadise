"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Truck, Shield, Headphones, Star } from "lucide-react";
import { getProducts } from "@/lib/api";
import type { Product } from "@/types";
import ProductCard from "@/components/ProductCard";

export default function HomePage() {
  const [featured, setFeatured] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getProducts({ limit: 8, sort: "newest" });
        setFeatured(data.products);
      } catch {
        // API might be cold-starting
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <>
      {/* Hero Section */}
      <section className="relative bg-dark-800 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-dark-900/95 via-dark-800/80 to-transparent z-10" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=1920&q=80')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="relative z-20 max-w-7xl mx-auto px-4 py-20 sm:py-28 lg:py-36">
          <div className="max-w-2xl">
            <span className="inline-block bg-primary/20 text-primary text-xs font-semibold px-3 py-1 rounded-full mb-6 uppercase tracking-wider">
              Matériel professionnel
            </span>
            <h1 className="font-heading font-bold text-4xl sm:text-5xl lg:text-6xl text-white leading-tight mb-6">
              L&apos;excellence pour les{" "}
              <span className="text-primary">barbiers</span> professionnels
            </h1>
            <p className="text-gray-300 text-lg mb-8 leading-relaxed max-w-lg">
              Découvrez notre sélection de plus de 400 produits professionnels :
              tondeuses, ciseaux, rasoirs, soins et accessoires des meilleures marques.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/catalogue" className="btn-primary text-base px-8 py-4">
                Voir le catalogue
                <ArrowRight size={18} />
              </Link>
              <Link href="/catalogue?sort=newest" className="btn-outline border-white text-white hover:bg-white hover:text-dark-800 text-base px-8 py-4">
                Nouveautés
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust badges */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Truck, title: "Livraison gratuite", desc: "Dès 49€ d'achat" },
              { icon: Shield, title: "Paiement sécurisé", desc: "CB, Visa, Mastercard" },
              { icon: Headphones, title: "Service client", desc: "À votre écoute" },
              { icon: Star, title: "Qualité pro", desc: "+400 références" },
            ].map((item) => (
              <div key={item.title} className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center shrink-0">
                  <item.icon size={20} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-dark-800">{item.title}</p>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-14 sm:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="section-title">Nos catégories</h2>
            <p className="section-subtitle mx-auto mt-3">
              Trouvez tout ce dont vous avez besoin pour votre salon
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { name: "Tondeuses", slug: "Tondeuses", emoji: "💈" },
              { name: "Ciseaux", slug: "Ciseaux", emoji: "✂️" },
              { name: "Rasoirs", slug: "Rasoirs", emoji: "🪒" },
              { name: "Soins cheveux", slug: "Soins+cheveux", emoji: "🧴" },
              { name: "Soins barbe", slug: "Soins+barbe", emoji: "🧔" },
              { name: "Accessoires", slug: "Accessoires", emoji: "🎯" },
            ].map((cat) => (
              <Link
                key={cat.slug}
                href={`/catalogue?category=${cat.slug}`}
                className="group bg-white rounded-xl p-6 text-center border border-gray-100 hover:border-primary-200 hover:shadow-md transition-all"
              >
                <span className="text-3xl block mb-3">{cat.emoji}</span>
                <h3 className="text-sm font-semibold text-dark-800 group-hover:text-primary transition-colors">
                  {cat.name}
                </h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-14 sm:py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="section-title">Nos derniers produits</h2>
              <p className="section-subtitle mt-2">
                Les nouveautés fraîchement ajoutées à notre catalogue
              </p>
            </div>
            <Link
              href="/catalogue?sort=newest"
              className="hidden sm:flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-600 transition-colors"
            >
              Tout voir <ArrowRight size={16} />
            </Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-gray-100 rounded-xl aspect-square mb-3" />
                  <div className="h-3 bg-gray-100 rounded w-16 mb-2" />
                  <div className="h-4 bg-gray-100 rounded w-full mb-1" />
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                </div>
              ))}
            </div>
          ) : featured.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p>Les produits sont en cours de chargement depuis le serveur...</p>
              <Link href="/catalogue" className="btn-primary mt-4 inline-flex">
                Voir le catalogue
              </Link>
            </div>
          )}
          <div className="sm:hidden text-center mt-8">
            <Link href="/catalogue?sort=newest" className="btn-outline">
              Voir tous les produits
            </Link>
          </div>
        </div>
      </section>

      {/* Promo banner */}
      <section className="bg-primary">
        <div className="max-w-7xl mx-auto px-4 py-12 sm:py-16 text-center">
          <h2 className="font-heading font-bold text-2xl sm:text-3xl text-white mb-4">
            Profitez de nos promotions
          </h2>
          <p className="text-primary-100 text-base mb-8 max-w-lg mx-auto">
            Des réductions exclusives sur une sélection de produits professionnels.
            Offres limitées !
          </p>
          <Link
            href="/catalogue?promo=true"
            className="inline-flex items-center gap-2 bg-white text-primary font-semibold px-8 py-3.5 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            Voir les promotions
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Newsletter */}
      <section className="py-14 sm:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="section-title mb-3">Restez informé</h2>
            <p className="section-subtitle mx-auto mb-8">
              Inscrivez-vous à notre newsletter pour recevoir nos offres exclusives
              et les dernières nouveautés.
            </p>
            <form className="flex gap-3 max-w-md mx-auto" onSubmit={(e) => e.preventDefault()}>
              <input
                type="email"
                placeholder="Votre adresse email"
                className="flex-1 px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <button type="submit" className="btn-primary shrink-0">
                S&apos;inscrire
              </button>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}
