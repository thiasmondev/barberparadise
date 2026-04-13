import { API_URL } from "./api";
import type { DashboardStats, Product, Order, Customer, Category } from "@/types";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin-token");
}

export function getAdminToken(): string | null {
  return getToken();
}

async function adminFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  if (!token) throw new Error("Non authentifié");

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    localStorage.removeItem("admin-token");
    localStorage.removeItem("admin-user");
    // Émettre un événement custom pour que le contexte React gère le logout
    // sans recharger la page (évite la boucle infinie)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("admin-session-expired"));
    }
    throw new Error("Session expirée");
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Erreur ${res.status}`);
  }

  return res.json();
}

// ─── Auth ────────────────────────────────────────────────────

export async function adminLogin(email: string, password: string) {
  const res = await fetch(`${API_URL}/api/auth/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Identifiants incorrects");
  }
  return res.json() as Promise<{ token: string; admin: { id: string; email: string; name: string; role: string } }>;
}

// ─── Dashboard ───────────────────────────────────────────────

export function getDashboardStats() {
  return adminFetch<DashboardStats>("/api/admin/stats");
}

// ─── Products ────────────────────────────────────────────────

export type CategorySuggestion = { slug: string; label: string; parent?: string };

export function getProductsMeta() {
  return adminFetch<{
    brands: string[];
    categories: string[];
    subcategories: string[];
    categoriesWithLabels: CategorySuggestion[];
    subcategoriesWithLabels: CategorySuggestion[];
  }>("/api/admin/products/meta");
}

export function getAdminProducts(params?: { page?: number; limit?: number; search?: string; category?: string; status?: string }) {
  const sp = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
    });
  }
  const q = sp.toString();
  return adminFetch<{ products: Product[]; total: number; page: number; pages: number }>(`/api/admin/products${q ? `?${q}` : ""}`);
}

export function createProduct(data: Record<string, unknown>) {
  return adminFetch<Product>("/api/admin/products", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateProduct(id: string, data: Record<string, unknown>) {
  return adminFetch<Product>(`/api/admin/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteProduct(id: string) {
  return adminFetch<{ success: boolean }>(`/api/admin/products/${id}`, {
    method: "DELETE",
  });
}

// ─── Orders ──────────────────────────────────────────────────

export function getAdminOrders(params?: { page?: number; limit?: number; status?: string }) {
  const sp = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
    });
  }
  const q = sp.toString();
  return adminFetch<{ orders: Order[]; total: number; page: number; pages: number }>(`/api/admin/orders${q ? `?${q}` : ""}`);
}

export function getAdminOrder(id: string) {
  return adminFetch<Order>(`/api/admin/orders/${id}`);
}

export function updateOrderStatus(id: string, status: string) {
  return adminFetch<Order>(`/api/admin/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// ─── Customers ───────────────────────────────────────────────

export function getAdminCustomers(params?: { page?: number; limit?: number; search?: string }) {
  const sp = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
    });
  }
  const q = sp.toString();
  return adminFetch<{ customers: Customer[]; total: number; page: number; pages: number }>(`/api/admin/customers${q ? `?${q}` : ""}`);
}

export function getAdminCustomer(id: string) {
  return adminFetch<Customer>(`/api/admin/customers/${id}`);
}

// ─── Categories ──────────────────────────────────────────────

export function getAdminCategories() {
  return adminFetch<Category[]>("/api/categories");
}

export function createCategory(data: Record<string, unknown>) {
  return adminFetch<Category>("/api/categories", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateCategory(id: string, data: Record<string, unknown>) {
  return adminFetch<Category>(`/api/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteCategory(id: string) {
  return adminFetch<{ success: boolean }>(`/api/categories/${id}`, {
    method: "DELETE",
  });
}

// ─── SEO Agent ──────────────────────────────────────────────

export interface SeoOptimization {
  optimizedTitle: string;
  metaDescription: string;
  seoDescription: string;
  suggestedTags: string[];
  imageAlts: string[];
  seoScore: number;
  suggestions: string[];
}

export interface SeoDashboardData {
  totalProducts: number;
  averageScore: number;
  distribution: { excellent: number; good: number; average: number; poor: number };
  priorityProducts: { id: string; name: string; brand: string; category: string; score: number; mainIssue: string }[];
  blogStats: { total: number; published: number };
}

export interface SeoScoredProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  seoScore: number;
  seoDetails: { criterion: string; score: number; max: number; tip: string }[];
}

export interface BlogArticleGenerated {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  metaDescription: string;
  tags: string[];
  category: string;
  readTime: number;
}

export function getSeoDashboard() {
  return adminFetch<SeoDashboardData>("/api/admin/seo/dashboard");
}

export function getSeoScores(params?: { page?: number; limit?: number; sort?: string; category?: string; minScore?: number; maxScore?: number }) {
  const sp = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
    });
  }
  const q = sp.toString();
  return adminFetch<{ products: SeoScoredProduct[]; total: number; page: number; pages: number }>(`/api/admin/seo/scores${q ? `?${q}` : ""}`);
}

export function analyzeSeoProduct(id: string) {
  return adminFetch<{ product: Product; score: number; details: { criterion: string; score: number; max: number; tip: string }[] }>(`/api/admin/seo/analyze/${id}`);
}

export function optimizeSeoProduct(id: string) {
  return adminFetch<{ product: Product; optimization: SeoOptimization }>(`/api/admin/seo/optimize/${id}`, {
    method: "POST",
  });
}

export function applySeoOptimization(id: string, data: { optimizedTitle?: string; metaDescription?: string; seoDescription?: string; suggestedTags?: string[] }) {
  return adminFetch<{ success: boolean; product: Product }>(`/api/admin/seo/apply/${id}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function bulkOptimizeSeo(productIds: string[], autoApply: boolean) {
  return adminFetch<{ total: number; success: number; failed: number; autoApplied: boolean; results: any[] }>("/api/admin/seo/bulk-optimize", {
    method: "POST",
    body: JSON.stringify({ productIds, autoApply }),
  });
}

export function generateSeoBlogArticle(data: { topic: string; type: string; relatedProductIds?: string[]; keywords?: string[] }) {
  return adminFetch<BlogArticleGenerated>("/api/admin/seo/blog/generate", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function saveSeoBlogArticle(data: { title: string; slug: string; excerpt: string; content: string; category: string; readTime: number; published: boolean }) {
  return adminFetch<{ success: boolean; article: any }>("/api/admin/seo/blog/save", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
