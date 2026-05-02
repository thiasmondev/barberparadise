"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getProduct, getProducts } from "@/lib/api";
import ProductDetail from "@/components/ProductDetail";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/types";
import Link from "next/link";
import { absoluteUrl } from "@/lib/site";

interface FaqItem {
  question: string;
  answer: string;
}

function parseImages(images: unknown): string[] {
  if (!images) return [];
  if (Array.isArray(images)) return images as string[];
  if (typeof images === "string") {
    try { return JSON.parse(images); } catch { return [images]; }
  }
  return [];
}

function SchemaJsonLd({ product }: { product: Product }) {
  const images = parseImages(product.images);
  const price = product.price ?? 0;
  const comparePrice = product.comparePrice ?? 0;

  // Schéma Product de base
  const productSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.metaDescription || product.description?.replace(/<[^>]+>/g, "").slice(0, 300),
    image: images.length > 0 ? images : undefined,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    sku: product.id,
    offers: {
      "@type": "Offer",
      price: price.toFixed(2),
      priceCurrency: "EUR",
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: absoluteUrl(`/produit/${product.slug}`),
      seller: { "@type": "Organization", name: "Barber Paradise" },
      ...(comparePrice > price && {
        priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      }),
    },
  };

  // Schéma FAQ si disponible
  let faqSchema: Record<string, unknown> | null = null;
  const faqRaw = (product as Record<string, unknown>).faqItems;
  let faqItems: FaqItem[] = [];
  if (faqRaw) {
    try {
      faqItems = typeof faqRaw === "string" ? JSON.parse(faqRaw) : (faqRaw as FaqItem[]);
    } catch { /* ignore */ }
  }
  if (faqItems.length > 0) {
    faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    };
  }

  // JSON-LD personnalisé stocké en base (généré par l'agent GEO)
  const customJsonLd = (product as Record<string, unknown>).schemaJsonLd as string | undefined;
  let customSchema: Record<string, unknown> | null = null;
  if (customJsonLd) {
    try { customSchema = JSON.parse(customJsonLd); } catch { /* ignore */ }
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(customSchema || productSchema, null, 0) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema, null, 0) }}
        />
      )}
    </>
  );
}

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
        try {
          const data = await getProducts({ category: p.category, limit: 5 });
          setRelated(data.products.filter((r) => r.id !== p.id).slice(0, 4));
        } catch { /* ignore */ }
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

  // Récupérer la FAQ pour l'afficher sur la page
  const faqRaw = (product as Record<string, unknown>).faqItems;
  let faqItems: FaqItem[] = [];
  if (faqRaw) {
    try {
      faqItems = typeof faqRaw === "string" ? JSON.parse(faqRaw) : (faqRaw as FaqItem[]);
    } catch { /* ignore */ }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12">
      {/* JSON-LD Schema.org injecté dans le head */}
      <SchemaJsonLd product={product} />

      <ProductDetail product={product} />

      {/* Section FAQ si disponible */}
      {faqItems.length > 0 && (
        <section className="mt-12 pt-10 border-t border-gray-100">
          <h2 className="font-heading font-bold text-xl text-dark-800 mb-6">
            Questions fréquentes
          </h2>
          <div className="space-y-3 max-w-3xl">
            {faqItems.map((item, i) => (
              <details key={i} className="group border border-gray-200 rounded-xl overflow-hidden">
                <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 font-medium text-gray-900 text-sm">
                  {item.question}
                  <span className="ml-4 text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="px-4 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
                  {item.answer}
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

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
