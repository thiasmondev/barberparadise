"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getBrands } from "@/lib/api";
import type { Brand } from "@/types";

export default function MarquesPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBrands()
      .then((data) => setBrands(data.filter((b) => b.productCount > 0)))
      .catch(() => setBrands([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-[#0e0e0e]">
      {/* ─── Hero ─── */}
      <section className="relative py-20 px-6 border-b border-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#ff4a8d]/5 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto relative">
          <p className="text-[11px] font-black tracking-[0.4em] uppercase text-[#ff4a8d] mb-4">
            BARBER PARADISE
          </p>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase italic text-white leading-none mb-6">
            NOS MARQUES
          </h1>
          <p className="text-white/50 text-base max-w-xl leading-relaxed">
            Les meilleures marques de matériel professionnel pour barbiers et coiffeurs, sélectionnées pour leur qualité et leur réputation.
          </p>
        </div>
      </section>

      {/* ─── Grille des marques ─── */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square bg-white/5 animate-pulse rounded-none"
              />
            ))}
          </div>
        ) : brands.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-white/30 text-sm tracking-widest uppercase">
              Aucune marque disponible
            </p>
          </div>
        ) : (
          <>
            <p className="text-[11px] font-black tracking-[0.3em] uppercase text-white/30 mb-8">
              {brands.length} MARQUES DISPONIBLES
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-px bg-white/5">
              {brands.map((brand) => (
                <BrandCard key={brand.id} brand={brand} />
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function BrandCard({ brand }: { brand: Brand }) {
  return (
    <Link
      href={`/marques/${brand.slug}`}
      className="group relative bg-[#131313] aspect-square flex flex-col items-center justify-center p-6 hover:bg-[#1a1a1a] transition-all duration-300 overflow-hidden"
    >
      {/* Hover accent */}
      <div className="absolute inset-0 border-2 border-transparent group-hover:border-[#ff4a8d] transition-all duration-300 pointer-events-none" />

      {/* Logo ou initiales */}
      <div className="relative w-20 h-20 mb-4 flex items-center justify-center">
        {brand.logo ? (
          <Image
            src={brand.logo}
            alt={brand.name}
            fill
            className="object-contain filter brightness-90 group-hover:brightness-110 transition-all duration-300"
            sizes="80px"
            unoptimized
          />
        ) : (
          <div className="w-full h-full bg-white/5 flex items-center justify-center">
            <span className="text-2xl font-black text-white/30 group-hover:text-[#ff4a8d] transition-colors uppercase tracking-tighter">
              {brand.name.slice(0, 2)}
            </span>
          </div>
        )}
      </div>

      {/* Nom */}
      <p className="text-[11px] font-black tracking-[0.15em] uppercase text-white/70 group-hover:text-white transition-colors text-center leading-tight">
        {brand.name}
      </p>

      {/* Compteur produits */}
      <p className="text-[10px] font-semibold tracking-widest uppercase text-white/25 group-hover:text-[#ff4a8d] transition-colors mt-1">
        {brand.productCount} produit{brand.productCount > 1 ? "s" : ""}
      </p>
    </Link>
  );
}
