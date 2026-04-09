/**
 * Hooks React pour les appels API — Barber Paradise
 */

import { useState, useEffect, useCallback } from "react";
import {
  productsApi,
  categoriesApi,
  blogApi,
  type ApiProduct,
  type ApiCategory,
  type ApiBlogPost,
} from "@/lib/api";

export interface ProductFilters {
  page?: number;
  limit?: number;
  category?: string;
  subcategory?: string;
  brand?: string;
  search?: string;
  sort?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  isNew?: boolean;
  isPromo?: boolean;
}

// ─── Hook produits ────────────────────────────────────────────────────────────

export function useProducts(filters: ProductFilters = {}) {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filtersKey = JSON.stringify(filters);

  const doFetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await productsApi.list(filters as Record<string, string | number>);
      setProducts(res.products || []);
      const pag = (res as { pagination?: { total: number; pages: number } }).pagination;
      setTotal(pag?.total ?? (res as { total?: number }).total ?? 0);
      setPages(pag?.pages ?? (res as { pages?: number }).pages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur chargement produits");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  useEffect(() => { doFetch(); }, [doFetch]);

  return { products, total, pages, loading, error, refetch: doFetch };
}

// ─── Hook produit unique ──────────────────────────────────────────────────────

export function useProduct(slug: string | null) {
  const [product, setProduct] = useState<ApiProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    productsApi.bySlug(slug)
      .then(setProduct)
      .catch(err => setError(err instanceof Error ? err.message : "Produit introuvable"))
      .finally(() => setLoading(false));
  }, [slug]);

  return { product, loading, error };
}

// ─── Hook produits vedettes ───────────────────────────────────────────────────

export function useFeaturedProducts() {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    productsApi.featured()
      .then(res => {
        const arr = Array.isArray(res) ? res : (res as { products: ApiProduct[] }).products || [];
        setProducts(arr);
      })
      .catch(err => setError(err instanceof Error ? err.message : "Erreur"))
      .finally(() => setLoading(false));
  }, []);

  return { products, loading, error };
}

// ─── Hook produits promo ──────────────────────────────────────────────────────

export function usePromoProducts() {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    productsApi.promo()
      .then(res => {
        const arr = Array.isArray(res) ? res : (res as { products: ApiProduct[] }).products || [];
        setProducts(arr);
      })
      .catch(err => setError(err instanceof Error ? err.message : "Erreur"))
      .finally(() => setLoading(false));
  }, []);

  return { products, loading, error };
}

// ─── Hook catégories ──────────────────────────────────────────────────────────

export function useCategories() {
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    categoriesApi.list()
      .then(res => {
        const arr = Array.isArray(res) ? res : (res as { categories: ApiCategory[] }).categories || [];
        setCategories(arr);
      })
      .catch(err => setError(err instanceof Error ? err.message : "Erreur"))
      .finally(() => setLoading(false));
  }, []);

  return { categories, loading, error };
}

// ─── Hook blog ────────────────────────────────────────────────────────────────

export function useBlogPosts(page = 1, limit = 10) {
  const [posts, setPosts] = useState<ApiBlogPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    blogApi.list({ page, limit })
      .then(res => {
        setPosts(res.posts || []);
        setTotal(res.total || 0);
      })
      .catch(err => setError(err instanceof Error ? err.message : "Erreur"))
      .finally(() => setLoading(false));
  }, [page, limit]);

  return { posts, total, loading, error };
}

export function useBlogPost(slug: string | null) {
  const [post, setPost] = useState<ApiBlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) { setLoading(false); return; }
    setLoading(true);
    blogApi.bySlug(slug)
      .then(setPost)
      .catch(err => setError(err instanceof Error ? err.message : "Article introuvable"))
      .finally(() => setLoading(false));
  }, [slug]);

  return { post, loading, error };
}
