"use client";

import { Suspense } from "react";
import CatalogueContent from "@/components/CatalogueContent";

export default function CataloguePage() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-gray-100 rounded-xl aspect-square" />
            ))}
          </div>
        </div>
      </div>
    }>
      <CatalogueContent />
    </Suspense>
  );
}
