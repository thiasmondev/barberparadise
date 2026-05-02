import type { MetadataRoute } from "next";
import { API_URL } from "@/lib/api";
import { absoluteUrl } from "@/lib/site";
import type { Category, Product } from "@/types";

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
    "",
    "/catalogue",
    "/contact",
    "/compte",
    "/connexion",
    "/inscription",
    "/panier",
    "/blog",
    "/cgv",
    "/mentions-legales",
    "/politique-de-confidentialite",
    "/cookies",
  ].map((path) => ({
    url: absoluteUrl(path || "/"),
    lastModified: now,
    changeFrequency: path === "" || path === "/catalogue" ? "daily" : "monthly",
    priority: path === "" ? 1 : path === "/catalogue" ? 0.9 : 0.5,
  }));

  const productsResponse = await safeFetch<{
    products: Product[];
    pagination?: { total: number; page: number; pages: number; limit: number };
  }>("/api/products?limit=500&sort=updated_desc");

  const categories = await safeFetch<Category[]>("/api/categories");

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

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
