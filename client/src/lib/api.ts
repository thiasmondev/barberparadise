// ============================================================
// BARBER PARADISE — API Client Service
// Couche d'abstraction pour tous les appels à l'API REST backend
// ============================================================

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

// ─── Helpers ─────────────────────────────────────────────────

function getAuthToken(): string | null {
  return localStorage.getItem("bp_token");
}

function getAdminToken(): string | null {
  return localStorage.getItem("bp_admin_token");
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  useAdminToken = false
): Promise<T> {
  const token = useAdminToken ? getAdminToken() : getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Erreur réseau" }));
    throw new Error(err.error || `Erreur ${res.status}`);
  }
  return res.json();
}

// ─── Types ───────────────────────────────────────────────────

export interface ApiProduct {
  id: string;
  handle: string;
  name: string;
  slug: string;
  brand: string;
  category: string;
  subcategory: string;
  subsubcategory: string;
  price: number;
  originalPrice: number | null;
  images: string[];
  description: string;
  shortDescription: string;
  features: string[];
  inStock: boolean;
  stockCount: number;
  rating: number;
  reviewCount: number;
  isNew: boolean;
  isPromo: boolean;
  tags: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiOrder {
  id: string;
  orderNumber: string;
  email: string;
  status: string;
  subtotal: number;
  shipping: number;
  total: number;
  notes: string | null;
  createdAt: string;
  items: ApiOrderItem[];
  shippingAddress: ApiShippingAddress;
  customer?: { firstName: string; lastName: string; email: string };
}

export interface ApiOrderItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

export interface ApiShippingAddress {
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface ApiCustomer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  createdAt: string;
}

export interface ApiCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  parentSlug: string;
  order: number;
}

export interface ApiPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ApiProductsResponse {
  products: ApiProduct[];
  pagination: ApiPagination;
}

export interface ApiAdminStats {
  totalProducts: number;
  totalOrders: number;
  totalCustomers: number;
  totalRevenue: number;
  recentOrders: ApiOrder[];
  ordersByStatus: { status: string; count: number; revenue: number }[];
}

// ─── Products API ─────────────────────────────────────────────

export const productsApi = {
  list: (params: Record<string, string | number> = {}): Promise<ApiProductsResponse> => {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
    return request<ApiProductsResponse>(`/products${qs ? `?${qs}` : ""}`);
  },
  featured: (): Promise<ApiProduct[]> => request<ApiProduct[]>("/products/featured"),
  promo: (): Promise<ApiProduct[]> => request<ApiProduct[]>("/products/promo"),
  bySlug: (slug: string): Promise<ApiProduct> => request<ApiProduct>(`/products/${slug}`),
  create: (data: Partial<ApiProduct>): Promise<ApiProduct> =>
    request<ApiProduct>("/products", { method: "POST", body: JSON.stringify(data) }, true),
  update: (id: string, data: Partial<ApiProduct>): Promise<ApiProduct> =>
    request<ApiProduct>(`/products/${id}`, { method: "PUT", body: JSON.stringify(data) }, true),
  delete: (id: string): Promise<void> =>
    request<void>(`/products/${id}`, { method: "DELETE" }, true),
};

// ─── Categories API ───────────────────────────────────────────

export const categoriesApi = {
  list: (): Promise<ApiCategory[]> => request<ApiCategory[]>("/categories"),
  products: (slug: string): Promise<ApiProduct[]> => request<ApiProduct[]>(`/categories/${slug}/products`),
};

// ─── Auth API ─────────────────────────────────────────────────

export const authApi = {
  register: (data: { email: string; password: string; firstName: string; lastName: string; phone?: string }) =>
    request<{ token: string; user: ApiCustomer }>("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  login: (email: string, password: string) =>
    request<{ token: string; user: ApiCustomer }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  adminLogin: (email: string, password: string) =>
    request<{ token: string; admin: { id: string; email: string; name: string; role: string } }>(
      "/auth/admin/login",
      { method: "POST", body: JSON.stringify({ email, password }) }
    ),
};

// ─── Customers API ────────────────────────────────────────────

export const customersApi = {
  me: (): Promise<ApiCustomer> => request<ApiCustomer>("/customers/me"),
  update: (data: Partial<ApiCustomer>) =>
    request<ApiCustomer>("/customers/me", { method: "PUT", body: JSON.stringify(data) }),
  wishlist: (): Promise<ApiProduct[]> => request<ApiProduct[]>("/customers/me/wishlist"),
  addToWishlist: (productId: string) =>
    request<{ success: boolean }>(`/customers/me/wishlist/${productId}`, { method: "POST" }),
  removeFromWishlist: (productId: string) =>
    request<{ success: boolean }>(`/customers/me/wishlist/${productId}`, { method: "DELETE" }),
};

// ─── Orders API ───────────────────────────────────────────────

export interface CreateOrderPayload {
  items: { productId: string; quantity: number }[];
  shippingAddress: ApiShippingAddress;
  email: string;
  customerId?: string;
  notes?: string;
}

export const ordersApi = {
  create: (data: CreateOrderPayload): Promise<ApiOrder> =>
    request<ApiOrder>("/orders", { method: "POST", body: JSON.stringify(data) }),
  myOrders: (): Promise<ApiOrder[]> => request<ApiOrder[]>("/orders/my"),
  byId: (id: string): Promise<ApiOrder> => request<ApiOrder>(`/orders/${id}`),
};

// ─── Blog API ─────────────────────────────────────────────────

export interface ApiBlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  image: string;
  category: string;
  author: string;
  published: boolean;
  createdAt: string;
}

export const blogApi = {
  list: (params: Record<string, string | number> = {}): Promise<{ posts: ApiBlogPost[]; total: number }> => {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
    return request<{ posts: ApiBlogPost[]; total: number }>(`/blog${qs ? `?${qs}` : ""}`);
  },
  bySlug: (slug: string): Promise<ApiBlogPost> => request<ApiBlogPost>(`/blog/${slug}`),
};

// ─── Admin API ────────────────────────────────────────────────

export const adminApi = {
  stats: (): Promise<ApiAdminStats> => request<ApiAdminStats>("/admin/stats", {}, true),
  products: (params: Record<string, string | number> = {}): Promise<{ products: ApiProduct[]; total: number; pages: number }> => {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
    return request<{ products: ApiProduct[]; total: number; pages: number }>(`/admin/products${qs ? `?${qs}` : ""}`, {}, true);
  },
  orders: (params: Record<string, string | number> = {}): Promise<{ orders: ApiOrder[]; total: number; pages: number }> => {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
    return request<{ orders: ApiOrder[]; total: number; pages: number }>(`/admin/orders${qs ? `?${qs}` : ""}`, {}, true);
  },
  customers: (params: Record<string, string | number> = {}): Promise<{ customers: ApiCustomer[]; total: number; pages: number }> => {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
    return request<{ customers: ApiCustomer[]; total: number; pages: number }>(`/admin/customers${qs ? `?${qs}` : ""}`, {}, true);
  },
  updateOrderStatus: (id: string, status: string): Promise<ApiOrder> =>
    request<ApiOrder>(`/orders/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }, true),
  updateProduct: (id: string, data: Partial<ApiProduct>): Promise<ApiProduct> =>
    request<ApiProduct>(`/products/${id}`, { method: "PUT", body: JSON.stringify(data) }, true),
  deleteProduct: (id: string): Promise<void> =>
    request<void>(`/products/${id}`, { method: "DELETE" }, true),
  createProduct: (data: Partial<ApiProduct>): Promise<ApiProduct> =>
    request<ApiProduct>("/products", { method: "POST", body: JSON.stringify(data) }, true),
  reviews: (): Promise<{ id: string; rating: number; comment: string; author: string; product: { name: string; slug: string }; createdAt: string }[]> =>
    request<{ id: string; rating: number; comment: string; author: string; product: { name: string; slug: string }; createdAt: string }[]>("/admin/reviews", {}, true),
  approveReview: (id: string) =>
    request<{ success: boolean }>(`/admin/reviews/${id}/approve`, { method: "PUT" }, true),
  blogPosts: (params: Record<string, string | number> = {}): Promise<{ posts: ApiBlogPost[]; total: number }> => {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
    return request<{ posts: ApiBlogPost[]; total: number }>(`/blog${qs ? `?${qs}` : ""}`, {}, true);
  },
  createBlogPost: (data: Partial<ApiBlogPost>): Promise<ApiBlogPost> =>
    request<ApiBlogPost>("/blog", { method: "POST", body: JSON.stringify(data) }, true),
  updateBlogPost: (id: string, data: Partial<ApiBlogPost>): Promise<ApiBlogPost> =>
    request<ApiBlogPost>(`/blog/${id}`, { method: "PUT", body: JSON.stringify(data) }, true),
  deleteBlogPost: (id: string): Promise<void> =>
    request<void>(`/blog/${id}`, { method: "DELETE" }, true),
};
