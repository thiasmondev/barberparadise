"use client";

import ProductCard from "@/components/ProductCard";
import type { Product } from "@/types";

export default function HomeProducts({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>Chargement des produits...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
