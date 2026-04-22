const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://barberparadise-backend.onrender.com";

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
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
  sort?: string;
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

export { API_URL };
