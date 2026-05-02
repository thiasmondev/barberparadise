import { API_URL } from "./api";
import type { DashboardStats, Product, Order, Customer, Category, Packaging } from "@/types";

const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "dopr7tgf8";
const CLOUDINARY_UPLOAD_PRESET = "barberparadise_unsigned";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin-token");
}

export function getAdminToken(): string | null {
  return getToken();
}

export async function adminFetch<T = unknown>(endpoint: string, options?: RequestInit): Promise<T> {
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
    subsubcategoriesWithLabels: CategorySuggestion[];
    level3ByParent: Record<string, { slug: string; label: string }[]>;
    level2ByParent: Record<string, { slug: string; label: string }[]>;
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

// ─── Packaging ───────────────────────────────────────────────
export function getAdminPackaging() {
  return adminFetch<{ packaging: Packaging[] }>("/api/admin/packaging");
}

export function createPackaging(data: Record<string, unknown>) {
  return adminFetch<Packaging>("/api/admin/packaging", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updatePackaging(id: number, data: Record<string, unknown>) {
  return adminFetch<Packaging>(`/api/admin/packaging/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deletePackaging(id: number) {
  return adminFetch<{ success: boolean }>(`/api/admin/packaging/${id}`, {
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

//// ─── Brands ────────────────────────────────────────────────────

export interface AdminBrand {
  id:           number;
  name:         string;
  slug:         string;
  logo:         string | null;
  bannerImage:  string | null;
  description:  string | null;
  website:      string | null;
  productCount: number;
}

export interface AdminBrandStats {
  brand: Pick<AdminBrand, "id" | "name" | "slug" | "logo">;
  productsCount: number;
  reviewsCount: number;
  variantsCount: number;
  imagesCount: number;
}

export interface AdminBrandDeleteResult {
  deleted: true;
  productsDeleted: number;
  brandName: string;
}

export function getAdminBrands() {
  return adminFetch<AdminBrand[]>("/api/admin/brands");
}

export function getAdminBrandStats(id: number) {
  return adminFetch<AdminBrandStats>(`/api/admin/brands/${id}/stats`);
}

export function deleteAdminBrand(id: number) {
  return adminFetch<AdminBrandDeleteResult>(`/api/admin/brands/${id}?confirm=true`, {
    method: "DELETE",
  });
}

export function updateAdminBrand(id: number, data: Partial<Omit<AdminBrand, "id" | "slug" | "productCount">>) {
  return adminFetch<AdminBrand>(`/api/admin/brands/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

async function uploadBrandMediaToCloudinary(file: File, kind: "logo" | "banner"): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Seules les images sont acceptées (JPG, PNG, WebP, GIF, SVG)");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("L'image ne doit pas dépasser 10 Mo");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "barberparadise/brands");
  formData.append("tags", `brand,${kind}`);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message = (data as any)?.error?.message || `Erreur Cloudinary (${res.status})`;
    throw new Error(message);
  }

  const data = await res.json();
  if (typeof data.secure_url !== "string" || !data.secure_url) {
    throw new Error("Cloudinary n'a pas retourné d'URL sécurisée");
  }
  return data.secure_url;
}

export async function uploadBrandLogo(_id: number, file: File): Promise<{ logo: string }> {
  const logo = await uploadBrandMediaToCloudinary(file, "logo");
  return { logo };
}

export async function uploadBrandBanner(_id: number, file: File): Promise<{ bannerImage: string }> {
  const bannerImage = await uploadBrandMediaToCloudinary(file, "banner");
  return { bannerImage };
}

// ─── Categories ────────────────────────────────────────────────────

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

export function reorderCategories(items: { id: string; order: number }[]) {
  return adminFetch<{ success: boolean }>("/api/categories/reorder", {
    method: "PATCH",
    body: JSON.stringify({ items }),
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

// ─── Variantes produit ───────────────────────────────────────

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  type: string; // "color" | "size" | "other"
  color: string;
  colorHex: string;
  size: string;
  price: number | null;
  stock: number;
  inStock: boolean;
  sku: string;
  image: string;
  order: number;
}

export function getProductVariants(productId: string): Promise<ProductVariant[]> {
  return adminFetch<ProductVariant[]>(`/api/admin/products/${productId}/variants`);
}

export function createProductVariant(productId: string, data: Partial<ProductVariant>): Promise<ProductVariant> {
  return adminFetch<ProductVariant>(`/api/admin/products/${productId}/variants`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateProductVariant(variantId: string, data: Partial<ProductVariant>): Promise<ProductVariant> {
  return adminFetch<ProductVariant>(`/api/admin/variants/${variantId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteProductVariant(variantId: string): Promise<void> {
  return adminFetch<void>(`/api/admin/variants/${variantId}`, { method: "DELETE" });
}

export function reorderProductVariants(productId: string, items: { id: string; order: number }[]): Promise<void> {
  return adminFetch<void>(`/api/admin/products/${productId}/variants/reorder`, {
    method: "PUT",
    body: JSON.stringify({ items }),
  });
}

// ─── GEO Agent ──────────────────────────────────────────────

export interface GeoOptimization {
  schemaJsonLd: string;
  faqItems: { question: string; answer: string }[];
  geoScore: number;
  geoDetails: { criterion: string; score: number; max: number; tip: string }[];
  directAnswerIntro: string;
  geoSuggestions: string[];
}

export interface GeoDashboardData {
  totalProducts: number;
  averageGeoScore: number;
  distribution: { excellent: number; good: number; average: number; poor: number };
  productsWithSchema: number;
  productsWithFaq: number;
  priorityProducts: { id: string; name: string; brand: string; category: string; geoScore: number; hasSchema: boolean; hasFaq: boolean }[];
}

export function getGeoDashboard() {
  return adminFetch<GeoDashboardData>("/api/admin/seo/geo-dashboard");
}

export function optimizeProductGeo(id: string) {
  return adminFetch<{ product: Product; geoOptimization: GeoOptimization }>(`/api/admin/seo/geo-optimize/${id}`, {
    method: "POST",
  });
}

export function applyGeoOptimization(id: string, data: { schemaJsonLd?: string; faqItems?: { question: string; answer: string }[]; directAnswerIntro?: string }) {
  return adminFetch<{ success: boolean; product: Product }>(`/api/admin/seo/geo-apply/${id}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getGeoScore(id: string) {
  return adminFetch<{ product: Product; geoScore: number; geoDetails: { criterion: string; score: number; max: number; tip: string }[] }>(`/api/admin/seo/geo-score/${id}`);
}

export function generateLlmsTxt() {
  return adminFetch<{ content: string }>("/api/admin/seo/generate-llms-txt", {
    method: "POST",
  });
}

export function deployLlmsTxt(content: string) {
  return adminFetch<{ success: boolean; message: string }>("/api/admin/seo/deploy-llms-txt", {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

// ─── GEO Enrichi ────────────────────────────────────────────

export interface GeoEnrichedContent {
  voiceSnippet: string;
  eeaatContent: string;
  longTailQuestions: { question: string; answer: string; intent: string }[];
  competitorComparison: { feature: string; ourProduct: string; competitor1: string; competitor2: string }[];
  useCases: { profile: string; useCase: string; benefit: string }[];
  buyingGuideSnippet: string;
  entityKeywords: string[];
}

export interface GeoAuditResult {
  globalScore: number;
  totalProducts: number;
  productsWithSchema: number;
  productsWithFaq: number;
  productsWithDirectAnswer: number;
  productsWithVoiceSnippet: number;
  llmsTxtExists: boolean;
  checks: {
    id: string;
    label: string;
    status: "ok" | "warning" | "error";
    detail: string;
    priority: "haute" | "moyenne" | "basse";
  }[];
  topOpportunities: { productId: string; productName: string; geoScore: number; missingElements: string[] }[];
}

export function enrichProductGeo(id: string) {
  return adminFetch<{ product: Product; enriched: GeoEnrichedContent }>(`/api/admin/seo/geo-enrich/${id}`, {
    method: "POST",
  });
}

export function applyGeoEnrichedContent(id: string, data: Partial<GeoEnrichedContent>) {
  return adminFetch<{ success: boolean; product: Product }>(`/api/admin/seo/geo-enrich-apply/${id}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function runGeoAudit() {
  return adminFetch<GeoAuditResult>("/api/admin/seo/geo-audit");
}

export function generateBuyingGuide(category: string) {
  return adminFetch<{ title: string; content: string; slug: string; excerpt: string; tags: string[]; readTime: number }>("/api/admin/seo/generate-buying-guide", {
    method: "POST",
    body: JSON.stringify({ category }),
  });
}

// ─── Paramètres admin ────────────────────────────────────────

export async function changeAdminPassword(currentPassword: string, newPassword: string): Promise<void> {
  await adminFetch("/api/admin/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

// ─── Image Alts SEO ──────────────────────────────────────────

export async function generateImageAltsSeo(productId: string): Promise<{ alts: string[]; saved: boolean }> {
  return adminFetch(`/api/admin/seo/image-alts/generate/${productId}`, { method: "POST" });
}

export async function saveImageAltsSeo(productId: string, alts: string[]): Promise<{ alts: string[]; saved: boolean }> {
  return adminFetch(`/api/admin/seo/image-alts/${productId}`, {
    method: "PUT",
    body: JSON.stringify({ alts }),
  });
}

export async function bulkGenerateImageAlts(): Promise<{
  processed: number;
  total: number;
  remaining: number;
  errors?: string[];
  message: string;
}> {
  return adminFetch("/api/admin/seo/image-alts/bulk", { method: "POST" });
}
