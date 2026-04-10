"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getProduct, getProducts } from "@/lib/api";
import ProductDetail from "@/components/ProductDetail";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/types";
import Link from "next/link";

export default function ProductPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!slug) return;
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const p = await getProduct(slug);
        setProduct(p);
        // Fetch related
        try {
          const data = await getProducts({ category: p.category, limit: 5 });
          setRelated(data.products.filter((r) => r.id !== p.id).slice(0, 4));
        } catch {
          // ignore
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-2 gap-12">
          <div className="animate-pulse bg-gray-100 rounded-2xl aspect-square" />
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-100 rounded w-24" />
            <div className="h-8 bg-gray-100 rounded w-3/4" />
            <div className="h-6 bg-gray-100 rounded w-32" />
            <div className="h-20 bg-gray-100 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h1 className="font-heading font-bold text-2xl text-dark-800 mb-3">
          Produit non trouvé
        </h1>
        <p className="text-gray-500 mb-8">
          Ce produit n&apos;existe pas ou a été retiré du catalogue.
        </p>
        <Link href="/catalogue" className="btn-primary">
          Voir le catalogue
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
      <ProductDetail product={product} />

      {related.length > 0 && (
        <section className="mt-16 pt-12 border-t border-gray-100">
          <h2 className="section-title mb-8">Produits similaires</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
