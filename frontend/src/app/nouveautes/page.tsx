"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { getProducts } from "@/lib/api";
import type { Product } from "@/types";

export default function NouveautesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadNewProducts() {
      setLoading(true);
      setError("");
      try {
        const data = await getProducts({ isNew: true, sort: "updated_desc", limit: 48 });
        if (mounted) setProducts(data.products);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Impossible de charger les nouveautés.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadNewProducts();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#131313] text-white">
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,74,141,0.18),transparent_34%),linear-gradient(135deg,#181617_0%,#0d0d0d_100%)]">
        <div className="mx-auto max-w-[1440px] px-6 py-20 md:px-8 md:py-28">
          <div className="max-w-3xl">
            <span className="mb-4 inline-flex rounded-full border border-[#ff4a8d]/30 bg-[#ff4a8d]/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-[#ffb1c4]">
              Sélection mise à jour
            </span>
            <h1 className="text-5xl font-black uppercase italic tracking-tighter md:text-7xl">
              Nouveautés
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-gray-400 md:text-base">
              Retrouvez ici les produits explicitement mis en avant par l’équipe Barber Paradise. La sélection est triée par date de mise à jour décroissante afin de présenter les nouveautés les plus récentes en premier.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-6 py-14 md:px-8 md:py-20">
        <div className="mb-8 flex flex-col gap-3 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#ff4a8d]">Produits</p>
            <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-white">
              {loading ? "Chargement" : `${products.length} nouveauté${products.length > 1 ? "s" : ""}`}
            </h2>
          </div>
          <Link href="/catalogue" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#ffb1c4] hover:text-white">
            Voir tout le catalogue <ArrowRight size={13} />
          </Link>
        </div>

        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center rounded-3xl border border-white/10 bg-white/[0.03]">
            <Loader2 className="h-8 w-8 animate-spin text-[#ff4a8d]" />
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-400/30 bg-red-500/10 p-8 text-sm text-red-100">
            {error}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center">
            <h3 className="text-xl font-black uppercase tracking-tight text-white">Aucune nouveauté pour le moment</h3>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-gray-400">
              Activez le toggle “Mettre en avant dans Nouveautés” depuis la fiche produit admin pour alimenter cette page.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
