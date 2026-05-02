import type { MetadataRoute } from "next";
import { API_URL } from "@/lib/api";
import { absoluteUrl } from "@/lib/site";
import type { Brand, Category, Product } from "@/types";

const now = new Date();

async function safeFetch<T>(endpoint: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      next: { revalidate: 3600 },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { path: "/", changeFrequency: "daily" as const, priority: 1 },
    { path: "/catalogue", changeFrequency: "daily" as const, priority: 0.9 },
    { path: "/marques", changeFrequency: "weekly" as const, priority: 0.8 },
    { path: "/nouveautes", changeFrequency: "daily" as const, priority: 0.8 },
    { path: "/blog", changeFrequency: "weekly" as const, priority: 0.7 },
    { path: "/contact", changeFrequency: "monthly" as const, priority: 0.5 },
    { path: "/cgv", changeFrequency: "monthly" as const, priority: 0.3 },
    { path: "/mentions-legales", changeFrequency: "monthly" as const, priority: 0.3 },
    { path: "/politique-de-confidentialite", changeFrequency: "monthly" as const, priority: 0.3 },
    { path: "/cookies", changeFrequency: "monthly" as const, priority: 0.3 },
  ].map(({ path, changeFrequency, priority }) => ({
    url: absoluteUrl(path),
    lastModified: now,
    changeFrequency,
    priority,
  }));

  const [productsResponse, categories, brands] = await Promise.all([
    safeFetch<{
      products: Product[];
      pagination?: { total: number; page: number; pages: number; limit: number };
    }>("/api/products?limit=500&sort=updated_desc"),
    safeFetch<Category[]>("/api/categories"),
    safeFetch<Brand[]>("/api/brands"),
  ]);

  const productRoutes: MetadataRoute.Sitemap = (productsResponse?.products || [])
    .filter((product) => product.slug)
    .map((product) => ({
      url: absoluteUrl(`/produit/${product.slug}`),
      lastModified: product.updatedAt ? new Date(product.updatedAt) : now,
      changeFrequency: "weekly",
      priority: 0.8,
    }));

  const categoryRoutes: MetadataRoute.Sitemap = (categories || [])
    .filter((category) => category.slug)
    .map((category) => ({
      url: absoluteUrl(`/catalogue?category=${encodeURIComponent(category.slug)}`),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    }));

  const brandRoutes: MetadataRoute.Sitemap = (brands || [])
    .filter((brand) => brand.slug)
    .map((brand) => ({
      url: absoluteUrl(`/marques/${brand.slug}`),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    }));

  return [...staticRoutes, ...productRoutes, ...categoryRoutes, ...brandRoutes];
}
