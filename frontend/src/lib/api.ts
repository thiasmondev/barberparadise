export const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://barberparadise-backend.onrender.com";

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(typeof window !== "undefined" && localStorage.getItem("bp_customer_token") ? { Authorization: `Bearer ${localStorage.getItem("bp_customer_token")}` } : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`API Error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export async function getProducts(params?: {
  page?: number;
  limit?: number;
  category?: string;
  subcategory?: string;
  brand?: string;
  search?: string;
  sort?: "name_asc" | "price_asc" | "price_desc" | "rating_desc" | "newest" | "updated_desc" | string;
  isNew?: boolean;
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        searchParams.set(key, String(value));
      }
    });
  }
  const query = searchParams.toString();
  const raw = await fetchAPI<{
    products: import("@/types").Product[];
    pagination: { total: number; page: number; pages: number; limit: number };
  }>(`/api/products${query ? `?${query}` : ""}`);
  return {
    products: raw.products,
    total: raw.pagination.total,
    page: raw.pagination.page,
    totalPages: raw.pagination.pages,
  };
}

export async function getProduct(slug: string) {
  return fetchAPI<import("@/types").Product>(`/api/products/${slug}`);
}

export async function getCategories() {
  return fetchAPI<import("@/types").Category[]>("/api/categories");
}

export async function searchProducts(query: string) {
  return fetchAPI<import("@/types").Product[]>(`/api/products/search?q=${encodeURIComponent(query)}`);
}

export async function getBrands() {
  return fetchAPI<import("@/types").Brand[]>("/api/brands");
}

export async function getBrand(slug: string, params?: { page?: number; limit?: number; sort?: string }) {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.sort) query.set("sort", params.sort);
  const qs = query.toString();
  return fetchAPI<{
    brand: import("@/types").BrandDetail;
    products: import("@/types").Product[];
    pagination: { total: number; pages: number; page: number; limit: number };
  }>(`/api/brands/${slug}${qs ? `?${qs}` : ""}`);
}

export type CarouselSlide = {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  imageUrl: string;
  imageMobileUrl?: string | null;
  imageAlt?: string | null;
  ctaText?: string | null;
  ctaLink?: string | null;
  ctaStyle?: "primary" | "secondary" | "outline" | string | null;
  textPosition: "left" | "center" | "right" | string;
  textColor: string;
  overlayOpacity: number;
  isActive: boolean;
  startDate?: string | null;
  endDate?: string | null;
  position: number;
  category: string;
  createdBy?: string | null;
  metadata?: unknown;
  createdAt: string;
  updatedAt: string;
};

export async function getActiveCarouselSlides() {
  const raw = await fetchAPI<{ slides: CarouselSlide[] } | CarouselSlide[]>("/api/carousel/active", {
    cache: "no-store",
  });
  return Array.isArray(raw) ? raw : raw.slides;
}

export type PromotionCartItemPayload = {
  productId: string;
  categoryId?: string | null;
  quantity: number;
  price: number;
};

export type PromotionValidationResult = {
  valid: boolean;
  discount?: number;
  discountType?: string;
  promotionId?: string;
  code?: string | null;
  name?: string;
  message?: string;
};

export type PromotionValidationPayload = {
  code?: string;
  cartTotal: number;
  cartItems: PromotionCartItemPayload[];
  customerId?: string;
  customerEmail?: string;
  customerType?: "b2c" | "b2b";
  shipping?: number;
};

export async function validatePromotionCode(payload: PromotionValidationPayload) {
  return fetchAPI<PromotionValidationResult>("/api/promotions/validate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getAutomaticPromotions(payload: Omit<PromotionValidationPayload, "code">) {
  return fetchAPI<PromotionValidationResult[]>("/api/promotions/automatic", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
