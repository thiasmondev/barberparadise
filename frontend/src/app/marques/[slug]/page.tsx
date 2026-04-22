"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { getBrand } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import type { BrandDetail, Product } from "@/types";

const SORT_OPTIONS = [
  { value: "newest", label: "Nouveautés" },
  { value: "price-asc", label: "Prix croissant" },
  { value: "price-desc", label: "Prix décroissant" },
  { value: "rating", label: "Mieux notés" },
];

export default function BrandPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, page: 1, limit: 24 });
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    getBrand(slug, { page, limit: 24, sort })
      .then((data) => {
        setBrand(data.brand);
        setProducts(data.products);
        setPagination(data.pagination);
        setNotFound(false);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug, page, sort]);

  if (notFound) {
    return (
      <main className="min-h-screen bg-[#0e0e0e] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#ff4a8d] text-[11px] font-black tracking-[0.4em] uppercase mb-4">404</p>
          <h1 className="text-4xl font-black uppercase italic text-white mb-6">Marque introuvable</h1>
          <Link href="/marques" className="text-white/50 hover:text-white text-sm tracking-widest uppercase transition-colors">
            ← Retour aux marques
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0e0e0e]">
      {/* ─── Bannière marque ─── */}
      <section className="relative overflow-hidden">
        {/* Bannière image ou gradient */}
        {brand?.bannerImage ? (
          <div className="relative h-64 md:h-80">
            <Image
              src={brand.bannerImage}
              alt={brand?.name || ""}
              fill
              className="object-cover opacity-40"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-[#0e0e0e]/60 to-transparent" />
          </div>
        ) : (
          <div className="h-48 md:h-64 bg-gradient-to-br from-[#1a1a1a] to-[#0e0e0e] border-b border-white/5" />
        )}

        {/* Contenu hero */}
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-7xl mx-auto w-full px-6 pb-10">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] uppercase text-white/30 mb-6">
              <Link href="/" className="hover:text-white transition-colors">Accueil</Link>
              <span>—</span>
              <Link href="/marques" className="hover:text-white transition-colors">Marques</Link>
              <span>—</span>
              <span className="text-white/60">{brand?.name || slug}</span>
            </nav>

            <div className="flex items-end gap-6">
              {/* Logo */}
              {brand?.logo && (
                <div className="relative w-20 h-20 flex-shrink-0 bg-white/5 p-2">
                  <Image
                    src={brand.logo}
                    alt={brand.name}
                    fill
                    className="object-contain p-2"
                    unoptimized
                  />
                </div>
              )}

              <div>
                <p className="text-[11px] font-black tracking-[0.4em] uppercase text-[#ff4a8d] mb-2">
                  MARQUE
                </p>
                <h1 className="text-4xl md:text-6xl font-black tracking-tighter uppercase italic text-white leading-none">
                  {loading && !brand ? (
                    <span className="opacity-30">Chargement...</span>
                  ) : (
                    brand?.name
                  )}
                </h1>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Description + actions ─── */}
      {(brand?.description || brand?.website) && (
        <section className="border-b border-white/5">
          <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
            {brand.description && (
              <p className="text-white/50 text-sm leading-relaxed max-w-2xl">
                {brand.description}
              </p>
            )}
            {brand.website && (
              <a
                href={brand.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[11px] font-black tracking-[0.2em] uppercase text-white/40 hover:text-[#ff4a8d] transition-colors flex-shrink-0"
              >
                <ExternalLink size={14} />
                Site officiel
              </a>
            )}
          </div>
        </section>
      )}

      {/* ─── Produits ─── */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        {/* Header avec tri */}
        <div className="flex items-center justify-between mb-8">
          <p className="text-[11px] font-black tracking-[0.3em] uppercase text-white/30">
            {loading ? "..." : `${pagination.total} PRODUIT${pagination.total > 1 ? "S" : ""}`}
          </p>
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value); setPage(1); }}
            className="bg-[#1a1a1a] border border-white/10 text-white text-[11px] font-semibold tracking-[0.1em] uppercase px-4 py-2 focus:outline-none focus:border-[#ff4a8d] transition-colors"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Grille produits */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-px bg-white/5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-[#131313] aspect-[3/4] animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-white/30 text-sm tracking-widest uppercase">
              Aucun produit disponible
            </p>
            <Link
              href="/catalogue"
              className="mt-6 inline-block text-[11px] font-black tracking-[0.2em] uppercase text-[#ff4a8d] hover:text-white transition-colors"
            >
              Voir tout le catalogue →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-px bg-white/5">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-12">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 text-white/40 hover:text-white disabled:opacity-20 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>

            {Array.from({ length: Math.min(pagination.pages, 7) }, (_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-9 h-9 text-[12px] font-black tracking-wider transition-all ${
                    page === p
                      ? "bg-[#ff4a8d] text-white"
                      : "text-white/40 hover:text-white border border-white/10 hover:border-[#ff4a8d]"
                  }`}
                >
                  {p}
                </button>
              );
            })}

            <button
              onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
              disabled={page === pagination.pages}
              className="p-2 text-white/40 hover:text-white disabled:opacity-20 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </section>

      {/* ─── Footer CTA ─── */}
      <section className="border-t border-white/5 py-16">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-[11px] font-black tracking-[0.3em] uppercase text-[#ff4a8d] mb-2">
              DÉCOUVRIR
            </p>
            <p className="text-2xl font-black uppercase italic text-white">
              Toutes nos marques
            </p>
          </div>
          <Link
            href="/marques"
            className="bg-[#ff4a8d] text-white text-[11px] font-black tracking-[0.3em] uppercase px-8 py-4 hover:bg-[#ff1f70] transition-colors"
          >
            Voir toutes les marques →
          </Link>
        </div>
      </section>
    </main>
  );
}
