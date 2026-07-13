import { API_URL } from "./api";

import type {
  DashboardStats,
  Product,
  Order,
  Customer,
  Category,
  Packaging,
} from "@/types";

const CLOUDINARY_CLOUD_NAME =
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "dopr7tgf8";
const CLOUDINARY_UPLOAD_PRESET = "barberparadise_unsigned";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin-token");
}

export function getAdminToken(): string | null {
  return getToken();
}

export async function adminFetch<T = unknown>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
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
  return res.json() as Promise<{
    token: string;
    admin: { id: string; email: string; name: string; role: string };
  }>;
}

// ─── Dashboard ───────────────────────────────────────────────

export function getDashboardStats() {
  return adminFetch<DashboardStats>("/api/admin/stats");
}

// ─── SEO Product URL Drafts ───────────────────────────────────

export interface ProductUrlDraft {
  sourceUrl: string;
  sourceDomain: string;
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  subsubcategory: string;
  price: number | null;
  originalPrice: number | null;
  shortDescription: string;
  seoDescription: string;
  suggestedTags: string[];
  imageUrls: string[];
  imageAlts: string[];
  features: string[];
  schemaJsonLd: string;
  faqItems: { question: string; answer: string }[];
  directAnswerIntro: string;
  geoSuggestions: string[];
  weightG: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  isFragile: boolean;
  isLiquid: boolean;
  isAerosol: boolean;
  requiresGlass: boolean;
  logisticNote: string | null;
  confidenceWarnings: string[];
  extractedSource: {
    title: string;
    metaDescription: string;
    imageCount: number;
    bodyLength: number;
  };
}

export function generateProductDraftFromUrl(url: string) {
  return adminFetch<{ draft: ProductUrlDraft }>(
    "/api/admin/seo/product-url/draft",
    {
      method: "POST",
      body: JSON.stringify({ url }),
    }
  );
}

export function createProductFromUrlDraft(draft: ProductUrlDraft) {
  return adminFetch<{ success: boolean; product: Product }>(
    "/api/admin/seo/product-url/create",
    {
      method: "POST",
      body: JSON.stringify({ draft }),
    }
  );
}

// ─── Products ────────────────────────────────────────────────

export type CategorySuggestion = {
  slug: string;
  label: string;
  parent?: string;
};

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

export function getAdminProducts(params?: {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  status?: string;
}) {
  const sp = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
    });
  }
  const q = sp.toString();
  return adminFetch<{
    products: Product[];
    total: number;
    page: number;
    pages: number;
  }>(`/api/admin/products${q ? `?${q}` : ""}`);
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


export type ProductRecommendationSuggestion = {
  id: string;
  reason: string;
  product: Product | null;
};

export function generateProductRecommendations(productId: string) {
  return adminFetch<{ recommendations: ProductRecommendationSuggestion[] }>(
    `/api/admin/products/${productId}/recommendations/generate`,
    { method: "POST" }
  );
}

export function saveProductRecommendations(productId: string, recommendedProductIds: string[]) {
  return adminFetch<{ success: boolean; recommendedProductIds: string[] }>(
    `/api/admin/products/${productId}/recommendations`,
    {
      method: "PUT",
      body: JSON.stringify({ recommendedProductIds }),
    }
  );
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


// ─── Shipping Zones ─────────────────────────────────────────
export interface ShippingRate {
  id: string;
  zoneId: string;
  name: string;
  minAmount: number;
  maxAmount: number | null;
  price: number;
  carrier: string | null;
  freeThreshold: number | null;
  isFree: boolean;
  deliveryTime: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShippingZone {
  id: string;
  name: string;
  countries: string[];
  rates: ShippingRate[];
  createdAt: string;
  updatedAt: string;
}

export function getShippingZones() {
  return adminFetch<{ zones: ShippingZone[] }>("/api/admin/shipping/zones");
}

export function createShippingZone(data: { name: string; countries: string[] }) {
  return adminFetch<ShippingZone>("/api/admin/shipping/zones", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateShippingZone(id: string, data: { name: string; countries: string[] }) {
  return adminFetch<ShippingZone>(`/api/admin/shipping/zones/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteShippingZone(id: string) {
  return adminFetch<{ success: boolean }>(`/api/admin/shipping/zones/${id}`, {
    method: "DELETE",
  });
}

export function createShippingRate(zoneId: string, data: Record<string, unknown>) {
  return adminFetch<ShippingRate>(`/api/admin/shipping/zones/${zoneId}/rates`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateShippingRate(id: string, data: Record<string, unknown>) {
  return adminFetch<ShippingRate>(`/api/admin/shipping/rates/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteShippingRate(id: string) {
  return adminFetch<{ success: boolean }>(`/api/admin/shipping/rates/${id}`, {
    method: "DELETE",
  });
}

// ─── Orders ──────────────────────────────────────────────────

export function getAdminOrders(params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  channel?: string;
}) {
  const sp = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
    });
  }
  const q = sp.toString();
  return adminFetch<{
    orders: Order[];
    total: number;
    page: number;
    pages: number;
    summary?: {
      ordersToday: number;
      itemsOrdered: number;
      processedOrders: number;
      deliveredOrders: number;
    };
  }>(`/api/admin/orders${q ? `?${q}` : ""}`);
}

export function getAdminOrder(id: string) {
  return adminFetch<Order>(`/api/admin/orders/${id}`);
}

export interface AdminOrderInvoice {
  id: string;
  orderNumber: string;
  type: "B2C" | "B2B";
  invoiceNumber: string | null;
  invoiceUrl: string | null;
  customerName: string;
  customerEmail: string;
  totalHT?: number | null;
  vatAmount?: number | null;
  totalTTC: number;
  currency?: string | null;
  issuedAt: string;
  createdAt: string;
}

export function getAdminOrderInvoices(params?: { page?: number; limit?: number; search?: string; type?: "B2C" | "B2B" | "" }) {
  const sp = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
    });
  }
  const q = sp.toString();
  return adminFetch<{ invoices: AdminOrderInvoice[]; total: number; page: number; pages: number }>(`/api/admin/orders/invoices${q ? `?${q}` : ""}`);
}

export function updateOrderStatus(id: string, status: string) {
  return adminFetch<Order>(`/api/admin/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function updateAdminOrder(id: string, payload: Record<string, unknown>) {
  return adminFetch<Order>(`/api/admin/orders/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteAdminOrder(id: string) {
  return adminFetch<{ success: boolean }>(`/api/admin/orders/${id}`, { method: "DELETE" });
}

export function modifyOrderItems(
  id: string,
  payload: {
    items: { productId: string; variantId?: string | null; quantity: number }[];
    adjustmentMode: "real" | "internal" | "gift";
    notifyClient?: boolean;
  }
) {
  return adminFetch<{
    order: Order;
    oldTotal: number;
    newTotal: number;
    diff: number;
    adjustmentMode: string;
    notifyClient: boolean;
  }>(`/api/admin/orders/${id}/items`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function createPaymentAdjustment(
  id: string,
  payload: { diff: number; mode: "real" | "internal" | "gift"; notifyClient?: boolean; giftEmailText?: string }
): Promise<{
  success: boolean;
  mode: string;
  diff: number;
  paymentLinkUrl?: string;
  paymentId?: string;
  newStatus?: string;
  refundedAmount?: number;
  giftApplied?: boolean;
  fallbackToInternal?: boolean;
  error?: string;
}> {
  const token = getToken();
  if (!token) throw new Error("Non authentifié");
  const res = await fetch(`${API_URL}/api/admin/orders/${id}/payment-adjustment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) {
    // Préserver fallbackToInternal même en cas d'erreur 400
    return {
      success: false,
      mode: payload.mode,
      diff: payload.diff,
      fallbackToInternal: Boolean(data.fallbackToInternal),
      error: (data.error as string) || `Erreur ${res.status}`,
    };
  }
  return data as {
    success: boolean;
    mode: string;
    diff: number;
    paymentLinkUrl?: string;
    paymentId?: string;
    newStatus?: string;
    refundedAmount?: number;
    fallbackToInternal?: boolean;
  };
}

export function refundAdminOrder(id: string, payload: { amount: number; mode: "real" | "manual" }) {
  return adminFetch<{ success: boolean; status: string; refundedAmount: number }>(`/api/admin/orders/${id}/refund`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface AdminShipmentLabelItem {
  id: string;
  orderId: string;
  orderNumber: string;
  carrier: string;
  trackingNumber: string | null;
  labelStatus: string | null;
  labelGeneratedAt: string | null;
  shippedAt: string | null;
  downloadUrl: string;
}

export function getAdminShipmentLabels() {
  return adminFetch<{ labels: AdminShipmentLabelItem[] }>(
    "/api/admin/orders/shipment-labels"
  );
}

export interface AdminAbandonedCartItem {
  id: string;
  email: string;
  itemCount: number;
  total: number;
  abandonedAt: string;
  reminderStage: number;
  lastReminderAt: string | null;
  convertedAt: string | null;
  unsubscribed: boolean;
  reminderStatus: "Aucune" | "Email 1 envoyé" | "Email 2 envoyé" | "Email 3 envoyé" | "Converti" | "Désinscrit";
  products: string[];
}

export interface AdminDraftAddressPayload {
  firstName: string;
  lastName: string;
  address: string;
  extension?: string;
  city: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export type DiscountType = "percent" | "fixed";

export interface AdminOrderDraftPayload {
  customerId?: string | null;
  email: string;
  isB2B: boolean;
  paymentLater: boolean;
  vatNumber?: string | null;
  shipping?: number;
  notes?: string;
  orderDiscountType?: DiscountType | null;
  orderDiscountValue?: number | null;
  items: Array<{
    productId: string;
    quantity: number;
    lineDiscountType?: DiscountType | null;
    lineDiscountValue?: number | null;
  }>;
  shippingAddress: AdminDraftAddressPayload;
  billingAddress?: AdminDraftAddressPayload;
}

export type AdminOrderDraft = Order & {
  vatNumber?: string | null;
  draftShareUrl?: string | null;
  draftShareExpiresAt?: string | null;
  draftShareSentAt?: string | null;
  draftShareLastAccessedAt?: string | null;
  draftShareConvertedAt?: string | null;
  customer?: (Order["customer"] & {
    proAccount?: { id: string; companyName: string; status: string; vatNumber?: string | null } | null;
    addresses?: Array<AdminDraftAddressPayload & { id: string; isDefault?: boolean }>;
  }) | null;
};

export function getAdminAbandonedCarts() {
  return adminFetch<{ carts: AdminAbandonedCartItem[] }>(
    "/api/admin/orders/abandoned-carts"
  );
}

export function getAdminOrderDrafts(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  const sp = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
    });
  }
  const q = sp.toString();
  return adminFetch<{
    drafts: AdminOrderDraft[];
    total: number;
    page: number;
    pages: number;
  }>(`/api/admin/orders/drafts${q ? `?${q}` : ""}`);
}

export function getAdminOrderDraft(id: string) {
  return adminFetch<{ draft: AdminOrderDraft }>(`/api/admin/orders/drafts/${id}`);
}

export function createAdminOrderDraft(payload: AdminOrderDraftPayload) {
  return adminFetch<{ draft: AdminOrderDraft }>("/api/admin/orders/drafts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAdminOrderDraft(id: string, payload: AdminOrderDraftPayload) {
  return adminFetch<{ draft: AdminOrderDraft }>(`/api/admin/orders/drafts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function confirmAdminOrderDraft(id: string, paymentMethod?: string | null) {
  return adminFetch<{ order: Order }>(`/api/admin/orders/drafts/${id}/confirm`, {
    method: "POST",
    body: JSON.stringify({ paymentMethod }),
  });
}

export function sendAdminOrderDraftEmail(id: string, overrideEmail?: string) {
  return adminFetch<{ ok: boolean; draft: AdminOrderDraft; shareUrl: string; expiresAt: string; sentAt: string; skippedEmail?: boolean }>(`/api/admin/orders/drafts/${id}/send`, {
    method: "POST",
    body: JSON.stringify(overrideEmail ? { overrideEmail } : {}),
  });
}

export function exportAbandonedCartToDraft(id: string, options?: { isB2B?: boolean; email?: string }) {
  return adminFetch<{ draft: AdminOrderDraft }>(
    `/api/admin/orders/abandoned-carts/${id}/to-draft`,
    {
      method: "POST",
      body: JSON.stringify(options || {}),
    }
  );
}

export function generateAdminOrderInvoice(id: string, force = false) {
  return adminFetch<{ invoiceNumber: string; invoiceUrl: string; isB2B: boolean }>(
    `/api/admin/orders/${id}/generate-invoice`,
    { method: "POST", body: JSON.stringify({ force }) }
  );
}

export function duplicateAdminOrder(id: string) {
  return adminFetch<{ draft: AdminOrderDraft; message?: string }>(
    `/api/admin/orders/${id}/duplicate`,
    { method: "POST" }
  );
}

export function toggleAdminOrderB2B(id: string, isB2B: boolean) {
  return adminFetch<{ id: string; isB2B: boolean }>(
    `/api/admin/orders/${id}/toggle-b2b`,
    { method: "PATCH", body: JSON.stringify({ isB2B }) }
  );
}

export function sendAdminOrderInvoice(id: string, overrideEmail?: string) {
  return adminFetch<{ success: boolean; message: string }>(
    `/api/admin/orders/${id}/send-invoice`,
    { method: "POST", body: JSON.stringify(overrideEmail ? { overrideEmail } : {}) }
  );
}

// ─── Emails secondaires client ─────────────────────────────────────────────

export interface CustomerExtraEmail {
  id: string;
  customerId: string;
  email: string;
  label: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export function getCustomerExtraEmails(customerId: string) {
  return adminFetch<CustomerExtraEmail[]>(`/api/admin/customers/${customerId}/emails`);
}

export function addCustomerExtraEmail(customerId: string, data: { email: string; label: string; isPrimary: boolean }) {
  return adminFetch<CustomerExtraEmail>(
    `/api/admin/customers/${customerId}/emails`,
    { method: "POST", body: JSON.stringify(data) }
  );
}

export function updateCustomerExtraEmail(customerId: string, emailId: string, data: { label?: string; isPrimary?: boolean }) {
  return adminFetch<CustomerExtraEmail>(
    `/api/admin/customers/${customerId}/emails/${emailId}`,
    { method: "PATCH", body: JSON.stringify(data) }
  );
}

export function deleteCustomerExtraEmail(customerId: string, emailId: string) {
  return adminFetch<{ success: boolean }>(
    `/api/admin/customers/${customerId}/emails/${emailId}`,
    { method: "DELETE" }
  );
}

// ─── Customers ───────────────────────────────────────────────

export function getAdminCustomers(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  const sp = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
    });
  }
  const q = sp.toString();
  return adminFetch<{
    customers: Customer[];
    total: number;
    page: number;
    pages: number;
  }>(`/api/admin/customers${q ? `?${q}` : ""}`);
}

export function getAdminCustomer(id: string) {
  return adminFetch<Customer>(`/api/admin/customers/${id}`);
}

export interface AdminCreateCustomerPayload {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  accountType: "b2c" | "b2b";
  sendInvitation?: boolean;
  acceptsEmailMarketing?: boolean;
  companyName?: string;
  activity?: string;
  proPhone?: string;
  siret?: string;
  vatNumber?: string;
}

export function createAdminCustomer(payload: AdminCreateCustomerPayload) {
  return adminFetch<{
    customer: Customer;
    invitation: { sent: boolean; skipped?: boolean; id?: string; provider?: string } | null;
  }>("/api/admin/customers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface AdminCustomerProAccountPayload {
  enabled: boolean;
  companyName?: string;
  activity?: string;
  phone?: string;
  siret?: string;
  vatNumber?: string;
}

export function updateAdminCustomerName(id: string, data: { firstName?: string; lastName?: string }) {
  return adminFetch<Customer>(`/api/admin/customers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
export function updateAdminCustomerProAccount(id: string, data: AdminCustomerProAccountPayload) {
  return adminFetch<Customer>(`/api/admin/customers/${id}/pro-account`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

//// ─── Brands ────────────────────────────────────────────────────

export interface AdminBrand {
  id: number;
  name: string;
  slug: string;
  logo: string | null;
  bannerImage: string | null;
  description: string | null;
  website: string | null;
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
  return adminFetch<AdminBrandDeleteResult>(
    `/api/admin/brands/${id}?confirm=true`,
    {
      method: "DELETE",
    }
  );
}

export function updateAdminBrand(
  id: number,
  data: Partial<Omit<AdminBrand, "id" | "slug" | "productCount">>
) {
  return adminFetch<AdminBrand>(`/api/admin/brands/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

async function uploadBrandMediaToCloudinary(
  file: File,
  kind: "logo" | "banner"
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error(
      "Seules les images sont acceptées (JPG, PNG, WebP, GIF, SVG)"
    );
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("L'image ne doit pas dépasser 10 Mo");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "barberparadise/brands");
  formData.append("tags", `brand,${kind}`);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message =
      (data as any)?.error?.message || `Erreur Cloudinary (${res.status})`;
    throw new Error(message);
  }

  const data = await res.json();
  if (typeof data.secure_url !== "string" || !data.secure_url) {
    throw new Error("Cloudinary n'a pas retourné d'URL sécurisée");
  }
  return data.secure_url;
}

export async function uploadBrandLogo(
  _id: number,
  file: File
): Promise<{ logo: string }> {
  const logo = await uploadBrandMediaToCloudinary(file, "logo");
  return { logo };
}

export async function uploadBrandBanner(
  _id: number,
  file: File
): Promise<{ bannerImage: string }> {
  const bannerImage = await uploadBrandMediaToCloudinary(file, "banner");
  return { bannerImage };
}

// ─── Categories ────────────────────────────────────────────────────

export interface AdminCategoryDetail {
  category: Category;
  products: Product[];
}

async function uploadCategoryMediaToCloudinary(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Seules les images sont acceptées (JPG, PNG, WebP, GIF, SVG)");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("L'image ne doit pas dépasser 10 Mo");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "barberparadise/categories");
  formData.append("tags", "category,admin");

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message =
      (data as any)?.error?.message || `Erreur Cloudinary (${res.status})`;
    throw new Error(message);
  }

  const data = await res.json();
  if (typeof data.secure_url !== "string" || !data.secure_url) {
    throw new Error("Cloudinary n'a pas retourné d'URL sécurisée");
  }
  return data.secure_url;
}

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

export function getAdminCategoryDetail(id: string) {
  return adminFetch<AdminCategoryDetail>(`/api/admin/categories/${id}`);
}

export function updateAdminCategoryDetail(id: string, data: Record<string, unknown>) {
  return adminFetch<Category>(`/api/admin/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function addProductsToAdminCategory(id: string, productIds: string[]) {
  return adminFetch<{ success: boolean; products: Product[] }>(
    `/api/admin/categories/${id}/products`,
    {
      method: "POST",
      body: JSON.stringify({ productIds }),
    }
  );
}

export function removeProductFromAdminCategory(id: string, productId: string) {
  return adminFetch<{ success: boolean }>(
    `/api/admin/categories/${id}/products/${productId}`,
    { method: "DELETE" }
  );
}

export function reorderAdminCategoryProducts(id: string, productIds: string[]) {
  return adminFetch<{ success: boolean }>(
    `/api/admin/categories/${id}/products/reorder`,
    {
      method: "PATCH",
      body: JSON.stringify({ productIds }),
    }
  );
}

export async function uploadCategoryImage(file: File): Promise<{ image: string }> {
  const image = await uploadCategoryMediaToCloudinary(file);
  return { image };
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
  optimizedSlug: string;
  slugSuggestions: string[];
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
  distribution: {
    excellent: number;
    good: number;
    average: number;
    poor: number;
  };
  priorityProducts: {
    id: string;
    name: string;
    brand: string;
    category: string;
    score: number;
    mainIssue: string;
  }[];
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

export function getSeoScores(params?: {
  page?: number;
  limit?: number;
  sort?: string;
  category?: string;
  minScore?: number;
  maxScore?: number;
}) {
  const sp = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
    });
  }
  const q = sp.toString();
  return adminFetch<{
    products: SeoScoredProduct[];
    total: number;
    page: number;
    pages: number;
  }>(`/api/admin/seo/scores${q ? `?${q}` : ""}`);
}

export function analyzeSeoProduct(id: string) {
  return adminFetch<{
    product: Product;
    score: number;
    details: { criterion: string; score: number; max: number; tip: string }[];
    geoScore: number;
    geoDetails: { criterion: string; score: number; max: number; tip: string }[];
  }>(`/api/admin/seo/analyze/${id}`);
}

export function optimizeSeoProduct(id: string) {
  return adminFetch<{ product: Product; optimization: SeoOptimization }>(
    `/api/admin/seo/optimize/${id}`,
    {
      method: "POST",
    }
  );
}

export function applySeoOptimization(
  id: string,
  data: {
    optimizedTitle?: string;
    optimizedSlug?: string;
    slug?: string;
    metaDescription?: string;
    seoDescription?: string;
    suggestedTags?: string[];
  }
) {
  return adminFetch<{ success: boolean; product: Product }>(
    `/api/admin/seo/apply/${id}`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

export function saveProductSeo(
  id: string,
  data: {
    optimizedTitle?: string;
    optimizedSlug?: string;
    slug?: string;
    metaDescription?: string;
    seoDescription?: string;
    suggestedTags?: string[];
    schemaJsonLd?: string;
    faqItems?: { question: string; answer: string }[];
    directAnswerIntro?: string;
    voiceSnippet?: string;
    eeaatContent?: string;
    longTailQuestions?: { question: string; answer: string; intent?: string }[];
    competitorComparison?: { feature: string; ourProduct: string; competitor1: string; competitor2: string }[];
    useCases?: { profile: string; useCase: string; benefit: string }[];
    buyingGuideSnippet?: string;
    entityKeywords?: string[];
  }
) {
  return adminFetch<{ success: boolean; product: Product }>(
    `/api/admin/products/${id}/seo`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
}

export function applyWhiteBackgroundToProductImages(id: string) {
  return adminFetch<{
    product: Product;
    images: string[];
    processed: number;
    errors: number;
    total: number;
    errorDetails: string[];
  }>(`/api/admin/seo/images/white-square/${id}`, {
    method: "POST",
  });
}

export function bulkOptimizeSeo(productIds: string[], autoApply: boolean) {
  return adminFetch<{
    total: number;
    success: number;
    failed: number;
    autoApplied: boolean;
    results: any[];
  }>("/api/admin/seo/bulk-optimize", {
    method: "POST",
    body: JSON.stringify({ productIds, autoApply }),
  });
}

export function generateSeoBlogArticle(data: {
  topic: string;
  type: string;
  relatedProductIds?: string[];
  keywords?: string[];
}) {
  return adminFetch<BlogArticleGenerated>("/api/admin/seo/blog/generate", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function saveSeoBlogArticle(data: {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  readTime: number;
  published: boolean;
}) {
  return adminFetch<{ success: boolean; article: any }>(
    "/api/admin/seo/blog/save",
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
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
  priceProEur?: number | null;
  purchasePrice?: number | null;
  stock: number;
  inStock: boolean;
  sku: string;
  image: string;
  order: number;
}

export function getProductVariants(
  productId: string
): Promise<ProductVariant[]> {
  return adminFetch<ProductVariant[]>(
    `/api/admin/products/${productId}/variants`
  );
}

export function createProductVariant(
  productId: string,
  data: Partial<ProductVariant>
): Promise<ProductVariant> {
  return adminFetch<ProductVariant>(
    `/api/admin/products/${productId}/variants`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

export function updateProductVariant(
  variantId: string,
  data: Partial<ProductVariant>
): Promise<ProductVariant> {
  return adminFetch<ProductVariant>(`/api/admin/variants/${variantId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteProductVariant(variantId: string): Promise<void> {
  return adminFetch<void>(`/api/admin/variants/${variantId}`, {
    method: "DELETE",
  });
}

export function reorderProductVariants(
  productId: string,
  items: { id: string; order: number }[]
): Promise<void> {
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
  distribution: {
    excellent: number;
    good: number;
    average: number;
    poor: number;
  };
  productsWithSchema: number;
  productsWithFaq: number;
  priorityProducts: {
    id: string;
    name: string;
    brand: string;
    category: string;
    geoScore: number;
    hasSchema: boolean;
    hasFaq: boolean;
  }[];
}

export function getGeoDashboard() {
  return adminFetch<GeoDashboardData>("/api/admin/seo/geo-dashboard");
}

export function optimizeProductGeo(id: string) {
  return adminFetch<{ product: Product; geoOptimization: GeoOptimization }>(
    `/api/admin/seo/geo-optimize/${id}`,
    {
      method: "POST",
    }
  );
}

export function applyGeoOptimization(
  id: string,
  data: {
    schemaJsonLd?: string;
    faqItems?: { question: string; answer: string }[];
    directAnswerIntro?: string;
  }
) {
  return adminFetch<{ success: boolean; product: Product }>(
    `/api/admin/seo/geo-apply/${id}`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

export function getGeoScore(id: string) {
  return adminFetch<{
    product: Product;
    geoScore: number;
    geoDetails: {
      criterion: string;
      score: number;
      max: number;
      tip: string;
    }[];
  }>(`/api/admin/seo/geo-score/${id}`);
}

export function generateLlmsTxt() {
  return adminFetch<{ content: string }>("/api/admin/seo/generate-llms-txt", {
    method: "POST",
  });
}

export function deployLlmsTxt(content: string) {
  return adminFetch<{ success: boolean; message: string }>(
    "/api/admin/seo/deploy-llms-txt",
    {
      method: "POST",
      body: JSON.stringify({ content }),
    }
  );
}

// ─── GEO Enrichi ────────────────────────────────────────────

export interface GeoEnrichedContent {
  voiceSnippet: string;
  eeaatContent: string;
  longTailQuestions: { question: string; answer: string; intent: string }[];
  competitorComparison: {
    feature: string;
    ourProduct: string;
    competitor1: string;
    competitor2: string;
  }[];
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
  topOpportunities: {
    productId: string;
    productName: string;
    geoScore: number;
    missingElements: string[];
  }[];
}

export function enrichProductGeo(id: string) {
  return adminFetch<{ product: Product; enriched: GeoEnrichedContent }>(
    `/api/admin/seo/geo-enrich/${id}`,
    {
      method: "POST",
    }
  );
}

export function applyGeoEnrichedContent(
  id: string,
  data: Partial<GeoEnrichedContent>
) {
  return adminFetch<{ success: boolean; product: Product }>(
    `/api/admin/seo/geo-enrich-apply/${id}`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

export function runGeoAudit() {
  return adminFetch<GeoAuditResult>("/api/admin/seo/geo-audit");
}

export function generateBuyingGuide(category: string) {
  return adminFetch<{
    title: string;
    content: string;
    slug: string;
    excerpt: string;
    tags: string[];
    readTime: number;
  }>("/api/admin/seo/generate-buying-guide", {
    method: "POST",
    body: JSON.stringify({ category }),
  });
}

// ─── Paramètres admin ────────────────────────────────────────

export async function changeAdminPassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await adminFetch("/api/admin/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

// ─── Image Alts SEO ──────────────────────────────────────────

export async function generateImageAltsSeo(
  productId: string
): Promise<{ alts: string[]; saved: boolean }> {
  return adminFetch(`/api/admin/seo/image-alts/generate/${productId}`, {
    method: "POST",
  });
}

export async function saveImageAltsSeo(
  productId: string,
  alts: string[]
): Promise<{ alts: string[]; saved: boolean }> {
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

export interface AdminProAccount {
  id: string;
  companyName: string;
  activity: string;
  phone: string;
  siret?: string | null;
  vatNumber?: string | null;
  status: "pending" | "approved" | "rejected" | "suspended";
  rejectionReason?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
    createdAt?: string;
  };
}
export function getAdminProAccounts(status?: string) {
  return adminFetch<{ accounts: AdminProAccount[] }>(
    `/api/pro/admin/accounts${status ? `?status=${encodeURIComponent(status)}` : ""}`
  );
}
export function getAdminProAccount(id: string) {
  return adminFetch<AdminProAccount>(`/api/pro/admin/accounts/${id}`);
}
export function approveAdminProAccount(id: string) {
  return adminFetch<{ account: AdminProAccount }>(
    `/api/pro/admin/accounts/${id}/approve`,
    { method: "POST" }
  );
}
export function rejectAdminProAccount(id: string, reason: string) {
  return adminFetch<{ account: AdminProAccount }>(
    `/api/pro/admin/accounts/${id}/reject`,
    { method: "POST", body: JSON.stringify({ reason }) }
  );
}
export function suspendAdminProAccount(id: string, reason?: string) {
  return adminFetch<{ account: AdminProAccount }>(
    `/api/pro/admin/accounts/${id}/suspend`,
    { method: "POST", body: JSON.stringify({ reason }) }
  );
}

// ─── Prix professionnels par marque ────────────────────────────

export interface AdminProPriceVariant {
  id: string;
  name: string;
  price: number | null;
  priceProEur: number | null;
  order?: number;
}

export interface AdminProPriceProduct {
  id: string;
  name: string;
  slug: string;
  brand: string;
  brandId: number | null;
  price: number;
  priceProEur: number | null;
  status: string;
  variants: AdminProPriceVariant[];
}

export interface AdminProPriceBrand {
  id: number;
  name: string;
  slug: string;
}

export interface AdminProPricesResponse {
  brand: AdminProPriceBrand;
  products: AdminProPriceProduct[];
}

export interface AdminProPricesSaveResult {
  updated: number;
  errors: string[];
}

export function getAdminProPricesByBrand(brandId: number) {
  return adminFetch<AdminProPricesResponse>(`/api/admin/pro/prices/${brandId}`);
}

export interface AdminProPriceUpdate {
  productId?: string;
  variantId?: string;
  priceProEur: number | null;
}

export function saveAdminProPricesByBrand(
  brandId: number,
  prices: AdminProPriceUpdate[]
) {
  return adminFetch<AdminProPricesSaveResult>(
    `/api/admin/pro/prices/brand/${brandId}`,
    {
      method: "PUT",
      body: JSON.stringify({ prices }),
    }
  );
}

// ─── Stock Management ─────────────────────────────────────────


export interface StockAlertRow {
  id: string;
  email: string;
  productId: string;
  productName: string;
  productSlug: string;
  variantId: string | null;
  variantName: string | null;
  createdAt: string;
  notified: boolean;
  notifiedAt: string | null;
}

export function getStockAlerts() {
  return adminFetch<{ alerts: StockAlertRow[]; pendingCount: number; total: number }>(
    "/api/admin/stock-alerts"
  );
}

export function deleteStockAlert(id: string) {
  return adminFetch<{ success: boolean }>(`/api/admin/stock-alerts/${id}`, {
    method: "DELETE",
  });
}

export function notifyStockAlertManually(id: string) {
  return adminFetch<{ success: boolean; result: { attempted: number; sent: number; skipped: number; failed: number } }>(
    `/api/admin/stock-alerts/${id}/notify`,
    { method: "POST" }
  );
}


export interface StockBrandSummary {
  brandId: number | null;
  brand: string;
  slug: string;
  logo: string | null;
  productCount: number;
  activeCount: number;
  inStockCount: number;
  outOfStockCount: number;
  totalStockCount: number;
}

export interface StockVariantRow {
  id: string;
  name: string;
  price: number | null;
  priceProEur: number | null;
  purchasePrice: number | null;
  stock: number;
  inStock: boolean;
  sku: string;
  order: number;
}

export type StockProductRow = Omit<
  Product,
  | "id"
  | "name"
  | "slug"
  | "brand"
  | "category"
  | "price"
  | "priceProEur"
  | "originalPrice"
  | "images"
  | "inStock"
  | "stockCount"
  | "status"
  | "variants"
> & {
  id: string;
  name: string;
  slug: string;
  brand: string;
  category: string;
  price: number;
  priceProEur?: number | null;
  originalPrice: number | null;
  images: string | string[];
  inStock: boolean;
  stockCount: number;
  status: string;
  brandId?: number | null;
  variants?: StockVariantRow[];
};

export interface StockImportProposal {
  lineText: string;
  extractedName: string;
  quantity: number;
  confidence: number;
  productId: string | null;
  productName: string | null;
  variantId: string | null;
  variantName: string | null;
  currentStock: number | null;
  newStock: number | null;
  reason: string;
}

export interface StockImportResult {
  fileName: string;
  extractionMode: "ia" | "heuristique" | string;
  textPreview: string;
  proposals: StockImportProposal[];
  matchedCount: number;
  total: number;
}

export function getStockBrands() {
  return adminFetch<{ brands: StockBrandSummary[] }>("/api/admin/stock/brands");
}

export function getStockProducts(params?: {
  brand?: string;
  brandId?: number | null;
  search?: string;
  status?: string;
}) {
  const sp = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "")
        sp.set(key, String(value));
    });
  }
  const q = sp.toString();
  return adminFetch<{ products: StockProductRow[]; total: number }>(
    `/api/admin/stock/products${q ? `?${q}` : ""}`
  );
}

export function updateStockProduct(
  id: string,
  data: Partial<
    Pick<
      StockProductRow,
      "price" | "priceProEur" | "purchasePrice" | "stockCount" | "inStock" | "status"
    >
  >
) {
  return adminFetch<StockProductRow>(`/api/admin/stock/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function updateStockVariant(
  id: string,
  data: Partial<Pick<StockVariantRow, "stock" | "inStock" | "priceProEur" | "purchasePrice">>
) {
  return adminFetch<StockVariantRow>(`/api/admin/stock/variants/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function importStockInvoicePdf(file: File) {
  const token = getToken();
  if (!token) throw new Error("Non authentifié");
  const formData = new FormData();
  formData.append("invoice", file);
  const res = await fetch(`${API_URL}/api/admin/stock/import-pdf`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (res.status === 401) {
    localStorage.removeItem("admin-token");
    localStorage.removeItem("admin-user");
    window.dispatchEvent(new CustomEvent("admin-session-expired"));
    throw new Error("Session expirée");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Erreur ${res.status}`);
  }
  return res.json() as Promise<StockImportResult>;
}

export function applyStockInvoiceAdjustments(
  adjustments: Array<{
    productId?: string | null;
    variantId?: string | null;
    quantity: number;
  }>,
  mode: "increment" | "set" = "increment"
) {
  return adminFetch<{ updated: number; errors: string[] }>(
    "/api/admin/stock/apply-pdf",
    {
      method: "POST",
      body: JSON.stringify({ adjustments, mode }),
    }
  );
}

// ─── Logistics Shipments ───────────────────────────────────────

export interface LogisticsOrderListItem {
  id: string;
  orderNumber: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  total: number;
  currency?: string;
  itemCount: number;
  estimatedWeightG: number | null;
  hasUnknownWeight: boolean;
}

export interface LogisticsPreparationItem {
  id: string;
  name: string;
  quantity: number;
  image: string;
  productId: string | null;
  weightG: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  isFragile: boolean;
  isLiquid: boolean;
  isAerosol: boolean;
  logisticNote: string | null;
}

export interface ShipmentRecord {
  id: string;
  orderId: string;
  carrier: "colissimo" | "mondial_relay" | "colissimo_international" | string;
  carrierShipmentId: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  packagingId: number | null;
  totalWeightG: number | null;
  offerId: string | null;
  serviceCode: string | null;
  deliveryMode: "home" | "relay" | string | null;
  relayPointId: string | null;
  labelPriceCents: number | null;
  labelCurrency: string | null;
  insuranceValueCents: number | null;
  labelFormat: string | null;
  labelSource: string | null;
  labelStatus: string | null;
  labelGeneratedAt: string | null;
  lastTrackingStatus: string | null;
  lastTrackingSyncAt: string | null;
  shippedAt: string | null;
  shippedBy: string | null;
  createdAt: string;
  updatedAt: string;
  packaging?: Packaging | null;
}

export interface LogisticsPreparationDetail {
  order: Order & { customerName: string };
  items: LogisticsPreparationItem[];
  packagings: Packaging[];
  recommendation: {
    totalWeightG: number;
    estimatedWeightG: number | null;
    totalVolumeCm3: number;
    packageTotalWeightG: number;
    hasUnknownWeight: boolean;
    hasFragile: boolean;
    hasLiquid: boolean;
    hasAerosol: boolean;
    recommendedBox: Packaging | null;
  };
  shipment: ShipmentRecord | null;
}

export interface LogisticsCarrierQuote {
  id: string;
  carrier: ShipmentRecord["carrier"];
  carrierLabel: string;
  serviceCode: string;
  serviceLabel: string;
  deliveryMode: "home" | "relay";
  amountCents: number;
  currency: "EUR";
  priceTaxIncluded: boolean;
  priceTaxLabel: "HT" | "TTC";
  taxRate: number;
  taxAmountCents: number;
  totalWithTaxCents: number;
  insuranceValueCents: number;
  insuranceLabel: string;
  signatureAvailable: boolean;
  signatureRequired: boolean;
  contractNumberApplied: boolean;
  contractNumberSuffix: string | null;
  estimatedDeliveryDays: string;
  requiresRelayPoint: boolean;
  purchasable: boolean;
  configurationError: string | null;
  source: "contract_tariff_grid";
}

export function getLogisticsOrders() {
  return adminFetch<{
    orders: LogisticsOrderListItem[];
    total: number;
    pendingCount: number;
  }>("/api/admin/logistics/orders");
}

export function getLogisticsOrder(orderId: string) {
  return adminFetch<LogisticsPreparationDetail>(
    `/api/admin/logistics/orders/${orderId}`
  );
}

export interface LogisticsCarrierQuoteOptions {
  packagingId?: number | null;
  totalWeightG?: number | null;
  colissimoInsuranceValueCents?: number | null;
  colissimoSignatureRequired?: boolean;
  mondialRelayInsuranceValueCents?: number | null;
}

export function getLogisticsCarrierQuotes(
  orderId: string,
  options: LogisticsCarrierQuoteOptions = {}
) {
  const params = new URLSearchParams();
  if (options.packagingId) params.set("packagingId", String(options.packagingId));
  if (options.totalWeightG && options.totalWeightG > 0) params.set("totalWeightG", String(options.totalWeightG));
  if (options.colissimoInsuranceValueCents !== undefined && options.colissimoInsuranceValueCents !== null) {
    params.set("colissimoInsuranceValueCents", String(options.colissimoInsuranceValueCents));
  }
  if (options.colissimoSignatureRequired !== undefined) {
    params.set("colissimoSignatureRequired", options.colissimoSignatureRequired ? "true" : "false");
  }
  if (options.mondialRelayInsuranceValueCents !== undefined && options.mondialRelayInsuranceValueCents !== null) {
    params.set("mondialRelayInsuranceValueCents", String(options.mondialRelayInsuranceValueCents));
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  return adminFetch<{
    quotes: LogisticsCarrierQuote[];
    totalWeightG: number;
    packaging: Packaging | null;
  }>(`/api/admin/logistics/orders/${orderId}/quotes${query}`);
}

export function purchaseLogisticsLabel(
  orderId: string,
  data: {
    carrier: ShipmentRecord["carrier"];
    offerId: string;
    insuranceValueCents?: number;
    signatureRequired?: boolean;
    relayPointId?: string | null;
    packagingId?: number | null;
    sendTrackingEmail?: boolean;
  }
) {
  return adminFetch<{
    success: boolean;
    order?: Order;
    shipment: ShipmentRecord;
    trackingEmailSent?: boolean;
    label?: {
      downloadUrl: string;
      source: string;
      priceCents: number;
      currency?: string;
      insuranceValueCents: number;
      priceTaxIncluded?: boolean;
      priceTaxLabel?: "HT" | "TTC";
      taxAmountCents?: number;
      totalWithTaxCents?: number;
      signatureRequired?: boolean;
    };
  }>(`/api/admin/logistics/orders/${orderId}/label`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function shipLogisticsOrder(
  orderId: string,
  data: {
    carrier: ShipmentRecord["carrier"];
    packagingId?: number | null;
  }
) {
  return adminFetch<{
    success: boolean;
    order: Order;
    shipment: ShipmentRecord;
    label?: {
      downloadUrl: string;
      source: string;
      priceCents?: number;
      insuranceValueCents?: number;
    };
  }>(`/api/admin/logistics/orders/${orderId}/ship`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getLogisticsLabelUrl(orderId: string) {
  return `${API_URL}/api/admin/logistics/orders/${orderId}/label`;
}

export function getShipmentLabelPdfUrl(shipmentId: string) {
  return `${API_URL}/api/admin/shipments/${shipmentId}/label.pdf`;
}

export function cancelShipmentLabel(shipmentId: string) {
  return adminFetch<{
    success: boolean;
    shipment: ShipmentRecord;
    message: string;
  }>(`/api/admin/shipments/${shipmentId}/cancel`, {
    method: "POST",
  });
}

export function syncLogisticsTracking(orderId: string) {
  return adminFetch<{
    success: boolean;
    shipment: ShipmentRecord;
  }>(`/api/admin/logistics/orders/${orderId}/tracking/sync`, {
    method: "POST",
  });
}

// ─── Finance / Export Indy ─────────────────────────────────────

export type IndyPspName = string;

export interface IndyReport {
  month: string;
  period: { start: string; end: string };
  ventesParPSP: Array<{
    psp: IndyPspName;
    ventesRealisees: number;
    commissionsPrelevees: number;
    variationTotale: number;
  }>;
  ventesParPaysEtTVA: Array<{
    paysLivraison: string;
    tauxTVA: number;
    totalHT: number;
    montantTVA: number;
    totalTTC: number;
    nbCommandes: number;
  }>;
  remboursements: Array<{
    type: "remboursement" | "annulation";
    montantTTC: number;
    psp: IndyPspName;
    date: string;
  }>;
  csvRows: Array<{
    type: "Marchandise";
    pays_expedition: "France";
    pays_livraison: string;
    tva_pct: number;
    total_ttc: number;
    moyen_paiement: IndyPspName;
  }>;
  summary: {
    caHTTotal: number;
    tvaCollecteeTotal: number;
    caTTCTotal: number;
    nbCommandesTotal: number;
    stockPurchaseValue?: number;
    averageCatalogMarginRate?: number;
    productsWithPurchasePriceCount?: number;
  };
}

export function getIndyReport(month: string) {
  return adminFetch<IndyReport>(`/api/admin/finance/indy-report?month=${encodeURIComponent(month)}`);
}

export async function downloadIndyCsv(month: string): Promise<Blob> {
  const token = getToken();
  if (!token) throw new Error("Non authentifié");

  const res = await fetch(
    `${API_URL}/api/admin/finance/indy-report/csv?month=${encodeURIComponent(month)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (res.status === 401) {
    localStorage.removeItem("admin-token");
    localStorage.removeItem("admin-user");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("admin-session-expired"));
    }
    throw new Error("Session expirée");
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `Erreur ${res.status}`);
  }

  return res.blob();
}

export async function downloadFinanceXlsx(month: string): Promise<Blob> {
  const token = getToken();
  if (!token) throw new Error("Non authentifié");

  const res = await fetch(
    `${API_URL}/api/admin/finance/export-xlsx?month=${encodeURIComponent(month)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (res.status === 401) {
    localStorage.removeItem("admin-token");
    localStorage.removeItem("admin-user");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("admin-session-expired"));
    }
    throw new Error("Session expirée");
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `Erreur ${res.status}`);
  }

  return res.blob();
}

export function sendIndyReportEmail(month: string) {
  return adminFetch<{
    sent: boolean;
    skipped: boolean;
    id?: string;
    month: string;
    to: string;
    cfoAnalysis: string;
  }>("/api/admin/finance/indy-report/send-email", {
    method: "POST",
    body: JSON.stringify({ month }),
  });
}

// ─── Agent Marketing ──────────────────────────────────────────
export interface MarketingDashboard {
  brevo: { configured: boolean; status: string; message: string };
  totals: {
    campaigns: number;
    activePromos: number;
    publishedBlogPosts: number;
    draftIdeas: number;
    emailCampaigns: number;
  };
  recentCampaigns: MarketingCampaign[];
  recentContent: MarketingContentDraft[];
  recentPromos: PromoCode[];
  recentEmails: EmailCampaign[];
  revenue: {
    last30Days: number;
    discountLast30Days: number;
    ordersWithPromoLast30Days: number;
  };
}

export interface MarketingCampaign {
  id: string;
  name: string;
  goal: string;
  audience: string;
  channel: string;
  status: string;
  brief?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MarketingContentDraft {
  id: string;
  campaignId?: string | null;
  type: string;
  topic: string;
  tone: string;
  prompt?: string | null;
  title: string;
  body: string;
  cta?: string | null;
  hashtags?: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromoCode {
  id: string;
  code: string;
  label: string;
  description?: string | null;
  type: string;
  value: number;
  minAmount?: number | null;
  maxUses?: number | null;
  usedCount: number;
  startsAt?: string | null;
  endsAt?: string | null;
  active: boolean;
  campaignId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailCampaign {
  id: string;
  campaignId?: string | null;
  name: string;
  subject: string;
  previewText?: string | null;
  htmlContent: string;
  textContent?: string | null;
  senderName: string;
  senderEmail: string;
  listIds?: number[];
  scheduledAt?: string | null;
  brevoCampaignId?: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function getMarketingDashboard() {
  return adminFetch<MarketingDashboard>("/api/admin/marketing/dashboard");
}

export function getMarketingCampaigns() {
  return adminFetch<{ campaigns: MarketingCampaign[] }>("/api/admin/marketing/campaigns");
}

export function createMarketingCampaign(data: Record<string, unknown>) {
  return adminFetch<{ campaign: MarketingCampaign }>("/api/admin/marketing/campaigns", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function generateMarketingContent(data: Record<string, unknown>) {
  return adminFetch<{ draft: MarketingContentDraft; generated: Record<string, unknown> }>("/api/admin/marketing/generate", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getMarketingContentDrafts(params?: { type?: string; status?: string }) {
  const sp = new URLSearchParams();
  if (params?.type) sp.set("type", params.type);
  if (params?.status) sp.set("status", params.status);
  const q = sp.toString();
  return adminFetch<{ drafts: MarketingContentDraft[] }>(`/api/admin/marketing/content${q ? `?${q}` : ""}`);
}

export function publishMarketingBlogPost(id: string) {
  return adminFetch<{ blogPost: unknown; draft: MarketingContentDraft }>(`/api/admin/marketing/content/${id}/publish-blog`, {
    method: "POST",
  });
}

export function getMarketingPromoCodes() {
  return adminFetch<{ promoCodes: PromoCode[] }>("/api/admin/marketing/promos");
}

export function createMarketingPromoCode(data: Record<string, unknown>) {
  return adminFetch<{ promoCode: PromoCode }>("/api/admin/marketing/promos", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getMarketingEmailCampaigns() {
  return adminFetch<{ emailCampaigns: EmailCampaign[] }>("/api/admin/marketing/emails");
}

export function createMarketingEmailCampaign(data: Record<string, unknown>) {
  return adminFetch<{ emailCampaign: EmailCampaign }>("/api/admin/marketing/emails", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function sendMarketingEmailCampaign(id: string) {
  return adminFetch<{ emailCampaign: EmailCampaign; brevo: unknown }>(`/api/admin/marketing/emails/${id}/send`, {
    method: "POST",
  });
}

export function syncMarketingBrevoContacts(listId?: number) {
  return adminFetch<{ synced: number; failed: number; skipped: boolean; message?: string }>("/api/admin/marketing/brevo/sync-contacts", {
    method: "POST",
    body: JSON.stringify({ listId }),
  });
}

// ─── Hermes Agent ───────────────────────────────────────────────

export interface HermesMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  module?: string | null;
  model?: string | null;
  tokensInput?: number | null;
  tokensOutput?: number | null;
  durationMs?: number | null;
  createdAt: string;
}

export interface HermesConversation {
  id: string;
  title?: string | null;
  channel: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  messages?: HermesMessage[];
  _count?: { messages: number };
}

export interface HermesStats {
  totalConversations: number;
  activeConversations: number;
  totalMessages: number;
  last30DaysMessages: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  avgResponseTimeMs: number;
}

export interface HermesConversationListResponse {
  conversations: HermesConversation[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export function getHermesConversations(status = "active") {
  return adminFetch<HermesConversationListResponse>(`/api/hermes/conversations?status=${encodeURIComponent(status)}`);
}

export function getHermesConversation(id: string) {
  return adminFetch<HermesConversation>(`/api/hermes/conversations/${id}`);
}

export function archiveHermesConversation(id: string) {
  return adminFetch<HermesConversation>(`/api/hermes/conversations/${id}/archive`, { method: "PATCH" });
}

export function deleteHermesConversation(id: string) {
  return adminFetch<{ success: boolean }>(`/api/hermes/conversations/${id}`, { method: "DELETE" });
}

export function getHermesStats() {
  return adminFetch<HermesStats>("/api/hermes/stats");
}

export function getHermesChatUrl() {
  return `${API_URL}/api/hermes/chat`;
}

export interface HermesContentDraft {
  id: string;
  type: string;
  title: string;
  content: string;
  status: string;
  seoMeta?: unknown;
  seoMetaTitle?: string | null;
  seoMetaDescription?: string | null;
  seoKeywords: string[];
  seoSlug?: string | null;
  metadata?: unknown;
  conversationId?: string | null;
  messageId?: string | null;
  campaignPlanId?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HermesDraftsResponse {
  drafts: HermesContentDraft[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface BlogArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage?: string | null;
  category: string;
  tags: string[];
  readTime: number;
  seoMetaTitle?: string | null;
  seoMetaDescription?: string | null;
  seoKeywords: string[];
  status: "draft" | "published" | string;
  publishedAt?: string | null;
  viewCount: number;
  linkedProductIds: string[];
  sourceDraftId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublishHermesDraftResponse {
  draft: HermesContentDraft;
  article?: BlogArticle;
}

export interface HermesCampaignPlan {
  id: string;
  name: string;
  targetAudience: string;
  brevoListIds: number[];
  subject: string;
  preheader?: string | null;
  htmlContent?: string | null;
  strategyBrief?: string | null;
  estimatedROI?: string | null;
  scheduledAt?: string | null;
  status: string;
  brevoCampaignId?: number | null;
  sentAt?: string | null;
  metricsSent?: number | null;
  metricsDelivered?: number | null;
  metricsOpened?: number | null;
  metricsClicked?: number | null;
  metricsUnsubscribed?: number | null;
  metricsBounced?: number | null;
  conversationId?: string | null;
  metadata?: unknown;
  drafts?: HermesContentDraft[];
  createdAt: string;
  updatedAt: string;
}

export interface HermesCampaignsResponse {
  plans: HermesCampaignPlan[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function toQuery(params?: Record<string, unknown>) {
  const sp = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") sp.set(key, String(value));
    });
  }
  const query = sp.toString();
  return query ? `?${query}` : "";
}

export function getHermesDrafts(params?: { type?: string; status?: string; page?: number; limit?: number }) {
  return adminFetch<HermesDraftsResponse>(`/api/hermes/drafts${toQuery(params)}`);
}

export function updateHermesDraft(id: string, data: Partial<HermesContentDraft>) {
  return adminFetch<HermesContentDraft>(`/api/hermes/drafts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function publishHermesDraft(id: string) {
  return adminFetch<PublishHermesDraftResponse>(`/api/hermes/drafts/${id}/publish`, { method: "POST" });
}

export function getAdminBlogArticles(params?: { status?: string; category?: string; page?: number; limit?: number }) {
  return adminFetch<{ articles: BlogArticle[]; total: number; page: number; limit: number; totalPages: number }>(
    `/api/admin/blog/articles${toQuery(params)}`
  );
}

export function createAdminBlogArticle(data: Partial<BlogArticle>) {
  return adminFetch<BlogArticle>("/api/admin/blog/articles", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateAdminBlogArticle(id: string, data: Partial<BlogArticle>) {
  return adminFetch<BlogArticle>(`/api/admin/blog/articles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function publishAdminBlogArticle(id: string) {
  return adminFetch<BlogArticle>(`/api/admin/blog/articles/${id}/publish`, { method: "POST" });
}

export function unpublishAdminBlogArticle(id: string) {
  return adminFetch<BlogArticle>(`/api/admin/blog/articles/${id}/unpublish`, { method: "POST" });
}

export function deleteAdminBlogArticle(id: string) {
  return adminFetch<{ success: boolean }>(`/api/admin/blog/articles/${id}`, { method: "DELETE" });
}

export function updateHermesDraftStatus(id: string, status: string) {
  return adminFetch<HermesContentDraft>(`/api/hermes/drafts/${id}/status`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}

export function deleteHermesDraft(id: string) {
  return adminFetch<{ ok: boolean }>(`/api/hermes/drafts/${id}`, { method: "DELETE" });
}

export function getHermesDraftStats() {
  return adminFetch<{
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    publishedLast30Days: number;
  }>("/api/hermes/drafts/stats");
}

export function getHermesCampaigns(params?: { status?: string; targetAudience?: string; page?: number; limit?: number }) {
  return adminFetch<HermesCampaignsResponse>(`/api/hermes/campaigns${toQuery(params)}`);
}

export function createHermesCampaign(data: Partial<HermesCampaignPlan>) {
  return adminFetch<HermesCampaignPlan>("/api/hermes/campaigns", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateHermesCampaign(id: string, data: Partial<HermesCampaignPlan>) {
  return adminFetch<HermesCampaignPlan>(`/api/hermes/campaigns/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function approveHermesCampaign(id: string) {
  return adminFetch<HermesCampaignPlan>(`/api/hermes/campaigns/${id}/approve`, { method: "POST" });
}

export function scheduleHermesCampaign(id: string, scheduledAt: string) {
  return adminFetch<HermesCampaignPlan>(`/api/hermes/campaigns/${id}/schedule`, {
    method: "POST",
    body: JSON.stringify({ scheduledAt }),
  });
}

export function sendHermesCampaignNow(id: string) {
  return adminFetch<HermesCampaignPlan>(`/api/hermes/campaigns/${id}/send-now`, { method: "POST" });
}

export function syncHermesCampaignStats(id: string) {
  return adminFetch<HermesCampaignPlan>(`/api/hermes/campaigns/${id}/sync-stats`, { method: "POST" });
}

export function deleteHermesCampaign(id: string) {
  return adminFetch<{ ok: boolean }>(`/api/hermes/campaigns/${id}`, { method: "DELETE" });
}

export function getHermesCampaignStats() {
  return adminFetch<{
    byStatus: Record<string, number>;
    recentSent: HermesCampaignPlan[];
    lists: unknown;
    brevoConfigured: boolean;
  }>("/api/hermes/campaigns/stats");
}


// ─── Hermes Images & Analytics Phase 4 ───────────────────────────

export interface HermesImage {
  id: string;
  prompt: string;
  model: string;
  status: string;
  category?: string | null;
  tags: string[];
  aspectRatio?: string | null;
  replicateUrl?: string | null;
  replicateId?: string | null;
  cloudinaryUrl?: string | null;
  cloudinaryId?: string | null;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  costUsd?: number | null;
  conversationId?: string | null;
  messageId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HermesImagesResponse {
  images: HermesImage[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface HermesImageStats {
  total: number;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  generatedLast30Days: number;
  totalCostUsd: number;
  avgGenerationTimeMs: number;
}

export interface HermesMarketingKPI {
  id: string;
  source: string;
  metric: string;
  value: number;
  unit?: string | null;
  period: string;
  date: string;
  metadata?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface HermesAnalyticsReport {
  period: { startDate: string; endDate: string; days: number };
  totals: Record<string, number>;
  bySource: Record<string, Record<string, number>>;
  trends: HermesMarketingKPI[];
  insights: string[];
}

export function getHermesImages(params?: { category?: string; status?: string; tags?: string; page?: number; limit?: number }) {
  return adminFetch<HermesImagesResponse>(`/api/hermes/images${toQuery(params)}`);
}

export function generateHermesImage(data: {
  prompt: string;
  category?: string;
  tags?: string[];
  aspectRatio?: string;
  useFastModel?: boolean;
}) {
  return adminFetch<HermesImage>("/api/hermes/images/generate", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateHermesImage(id: string, data: { category?: string; tags?: string[] }) {
  return adminFetch<HermesImage>(`/api/hermes/images/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteHermesImage(id: string) {
  return adminFetch<{ ok: boolean }>(`/api/hermes/images/${id}`, { method: "DELETE" });
}

export function getHermesImageStats() {
  return adminFetch<HermesImageStats>("/api/hermes/images/stats");
}

export function getHermesAnalyticsKpis(params?: { startDate?: string; endDate?: string; source?: string; period?: string }) {
  return adminFetch<{ kpis: HermesMarketingKPI[] }>(`/api/hermes/analytics/kpis${toQuery(params)}`);
}

export function getHermesAnalyticsReport(days = 30) {
  return adminFetch<HermesAnalyticsReport>(`/api/hermes/analytics/report?days=${encodeURIComponent(String(days))}`);
}

export function getHermesAnalyticsContext() {
  return adminFetch<{ context: string }>("/api/hermes/analytics/context");
}

export function collectHermesAnalytics() {
  return adminFetch<{ ok: boolean; report: unknown }>("/api/hermes/analytics/collect", { method: "POST" });
}

// ─── Carousel ───────────────────────────────────────────────────

export type AdminCarouselCtaMetadata = {
  x?: number;
  y?: number;
  backgroundColor?: string;
  textColor?: string;
  shadow?: boolean;
  shape?: "rounded" | "square" | string;
};

export type AdminCarouselSlideMetadata = {
  cta?: AdminCarouselCtaMetadata;
  ctaMobile?: AdminCarouselCtaMetadata;
  [key: string]: unknown;
};

export type AdminCarouselSlide = {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  imageUrl: string;
  imageMobileUrl?: string | null;
  imageAlt?: string | null;
  cloudinaryId?: string | null;
  mobileCloudinaryId?: string | null;
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
  category: "promo" | "nouveaute" | "event" | "saison" | "general" | string;
  createdBy?: string | null;
  metadata?: AdminCarouselSlideMetadata | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminCarouselSlidePayload = Partial<Omit<AdminCarouselSlide, "id" | "createdAt" | "updatedAt">> & {
  imageUrl?: string;
};

export function getAdminCarouselSlides(params?: { category?: string; isActive?: boolean }) {
  const sp = new URLSearchParams();
  if (params?.category && params.category !== "all") sp.set("category", params.category);
  if (typeof params?.isActive === "boolean") sp.set("isActive", String(params.isActive));
  const q = sp.toString();
  return adminFetch<{ slides: AdminCarouselSlide[] }>(`/api/carousel${q ? `?${q}` : ""}`);
}

export function createAdminCarouselSlide(payload: AdminCarouselSlidePayload) {
  return adminFetch<{ slide: AdminCarouselSlide }>("/api/carousel", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAdminCarouselSlide(id: string, payload: AdminCarouselSlidePayload) {
  return adminFetch<{ slide: AdminCarouselSlide }>(`/api/carousel/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function toggleAdminCarouselSlide(id: string) {
  return adminFetch<{ slide: AdminCarouselSlide }>(`/api/carousel/${id}/toggle`, {
    method: "PATCH",
  });
}

export function deleteAdminCarouselSlide(id: string) {
  return adminFetch<{ success: boolean }>(`/api/carousel/${id}`, {
    method: "DELETE",
  });
}

export function reorderAdminCarouselSlides(order: { id: string; position: number }[]) {
  return adminFetch<{ success: boolean }>("/api/carousel/reorder", {
    method: "PUT",
    body: JSON.stringify({ order }),
  });
}

export function uploadAdminCarouselSlide(payload: AdminCarouselSlidePayload & { imageBase64: string }) {
  return adminFetch<{ slide: AdminCarouselSlide }>("/api/carousel/upload", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ─── API Keys ──────────────────────────────────────────────────

export type ApiKeyPermission = "carousel" | "hermes" | "products" | "orders" | "admin";

export const API_KEY_PERMISSION_LABELS: Record<ApiKeyPermission, string> = {
  carousel: "Carrousel",
  hermes: "Buzz",
  products: "Produits",
  orders: "Commandes",
  admin: "Administration complète",
};

export interface AdminApiKey {
  id: string;
  name: string;
  prefix: string;
  permissions: ApiKeyPermission[];
  isActive: boolean;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApiKeyPayload {
  name: string;
  permissions: ApiKeyPermission[];
  expiresAt?: string | null;
}

export async function listApiKeys() {
  return adminFetch<{ keys: AdminApiKey[] }>("/api/admin/api-keys");
}

export async function createApiKey(payload: CreateApiKeyPayload) {
  return adminFetch<{ message: string; token: string; apiKey: AdminApiKey }>("/api/admin/api-keys", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function revokeApiKey(id: string) {
  return adminFetch<{ success: boolean; message: string; apiKey: AdminApiKey }>(`/api/admin/api-keys/${id}/revoke`, {
    method: "PATCH",
  });
}

export async function activateApiKey(id: string) {
  return adminFetch<{ success: boolean; message: string; apiKey: AdminApiKey }>(`/api/admin/api-keys/${id}/activate`, {
    method: "PATCH",
  });
}

export async function deleteApiKey(id: string) {
  return adminFetch<{ success: boolean }>(`/api/admin/api-keys/${id}`, {
    method: "DELETE",
  });
}

// ─── Promotions Shopify-like ───────────────────────────────────

export type AdminPromotionMethod = "code" | "automatic";
export type AdminPromotionType = "percentage" | "fixed_amount" | "free_shipping" | "buy_x_get_y";
export type AdminPromotionAppliesTo = "all" | "products" | "categories";
export type AdminPromotionCustomerType = "all" | "b2c" | "b2b";

export interface AdminPromotion {
  id: string;
  code: string | null;
  name: string;
  description?: string | null;
  method: AdminPromotionMethod;
  type: AdminPromotionType;
  value: number | null;
  valueType: "percentage" | "fixed";
  appliesTo: AdminPromotionAppliesTo;
  productIds: string[];
  categoryIds: string[];
  minOrderAmount: number | null;
  minQuantity: number | null;
  customerType: AdminPromotionCustomerType;
  usageLimit: number | null;
  usagePerCustomer: number | null;
  usageCount: number;
  stackable: boolean;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPromotionStats {
  totalPromotions: number;
  activePromotions: number;
  codePromotions: number;
  automaticPromotions: number;
  totalUsage: number;
  totalDiscount: number;
}

export type AdminPromotionPayload = Partial<Omit<AdminPromotion, "id" | "createdAt" | "updatedAt" | "usageCount">>;

export interface AdminPromotionListResponse {
  promotions: AdminPromotion[];
  total: number;
  page: number;
  pages: number;
}

export async function getAdminPromotions(params: { search?: string; status?: string; method?: string; page?: number; limit?: number } = {}) {
  const query = new URLSearchParams();
  if (params.status === "active") query.set("isActive", "true");
  if (params.status === "inactive") query.set("isActive", "false");
  if (params.method && params.method !== "all") query.set("method", params.method);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const result = await adminFetch<AdminPromotionListResponse>(`/api/promotions${suffix}`);
  const search = params.search?.trim().toLowerCase();
  if (!search) return result;
  return {
    ...result,
    promotions: result.promotions.filter((promotion) =>
      [promotion.name, promotion.code || "", promotion.description || ""]
        .join(" ")
        .toLowerCase()
        .includes(search)
    ),
  };
}

export async function getAdminPromotion(id: string) {
  const promotion = await adminFetch<AdminPromotion>(`/api/promotions/${id}`);
  return { promotion };
}

export async function getAdminPromotionStats() {
  const stats = await adminFetch<AdminPromotionStats>("/api/promotions/stats");
  return { stats };
}

export async function createAdminPromotion(data: AdminPromotionPayload) {
  const promotion = await adminFetch<AdminPromotion>("/api/promotions", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return { promotion };
}

export async function updateAdminPromotion(id: string, data: AdminPromotionPayload) {
  const promotion = await adminFetch<AdminPromotion>(`/api/promotions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  return { promotion };
}

export async function toggleAdminPromotion(id: string) {
  const promotion = await adminFetch<AdminPromotion>(`/api/promotions/${id}/toggle`, {
    method: "PATCH",
  });
  return { promotion };
}

export async function duplicateAdminPromotion(id: string) {
  const promotion = await adminFetch<AdminPromotion>(`/api/promotions/${id}/duplicate`, {
    method: "POST",
  });
  return { promotion };
}

export function deleteAdminPromotion(id: string) {
  return adminFetch<void>(`/api/promotions/${id}`, { method: "DELETE" });
}

// ─── Pages légales ────────────────────────────────────────────

export type AdminLegalPage = {
  id: string;
  slug: string;
  title: string;
  content: string;
  updatedAt: string;
};

export function getAdminLegalPages() {
  return adminFetch<AdminLegalPage[]>("/api/legal-pages");
}

export function getAdminLegalPage(slug: string) {
  return adminFetch<AdminLegalPage>(`/api/legal-pages/${slug}`);
}

export function updateAdminLegalPage(slug: string, data: { title: string; content: string }) {
  return adminFetch<AdminLegalPage>(`/api/legal-pages/${slug}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// ─── POS / Caisse ──────────────────────────────────────────────

export interface PosVariant {
  id: string;
  name: string;
  label: string | null;
  sku: string;
  price: number;
  stock: number;
  inStock: boolean;
  image: string;
}

export interface PosProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  image: string;
  inStock: boolean;
  stockCount: number;
  hasVariants: boolean;
  variants: PosVariant[];
}

export interface PosTerminal {
  id: string;
  description: string;
  status: string;
  brand?: string;
  model?: string;
  serialNumber?: string | null;
}

export interface PosOrderItem {
  id: string;
  productId?: string | null;
  variantId?: string | null;
  variantLabel?: string | null;
  name: string;
  price: number;
  quantity: number;
  image: string;
  discountAmount: number;
  lineDiscountType?: DiscountType | null;
  lineDiscountValue?: number | null;
  isCustomSale: boolean;
}

export interface PosOrder {
  id: string;
  orderNumber: string;
  channel: string;
  status: string;
  posPaymentStatus?: string | null;
  providerPaymentId?: string | null;
  terminalId?: string | null;
  posSessionId?: string | null;
  paymentMethod?: PosPaymentMethod | string | null;
  subtotal: number;
  discountAmount: number;
  orderDiscountType?: DiscountType | null;
  orderDiscountValue?: number | null;
  discountTotal?: number | null;
  totalHT: number;
  vatAmount: number;
  totalTTC: number;
  total: number;
  currency: string;
  notes?: string | null;
  createdAt: string;
  posPaidAt?: string | null;
  customer?: { id: string; email: string; firstName?: string | null; lastName?: string | null; phone?: string | null } | null;
  items: PosOrderItem[];
}

export type PosPaymentMethod = "card" | "cash" | "manual";

export interface PosStats {
  period: string;
  start: string;
  salesCount: number;
  revenue: number;
  averageOrder: number;
  paymentBreakdown?: {
    card: { revenue: number; count: number };
    cash: { revenue: number; count: number };
  };
  topProducts: { name: string; quantity: number; revenue: number }[];
  latestOrder: PosOrder | null;
}

export interface PosCartItemPayload {
  productId: string;
  variantId?: string | null;
  quantity: number;
  discountAmount?: number;
  lineDiscountType?: DiscountType | null;
  lineDiscountValue?: number | null;
}


export function getPosTerminals() {
  return adminFetch<{ terminals: PosTerminal[] }>("/api/pos/terminals");
}

export function getPosCatalog(params: { q?: string; category?: string; limit?: number } = {}) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.category) search.set("category", params.category);
  if (params.limit) search.set("limit", String(params.limit));
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return adminFetch<{ products: PosProduct[]; categories: string[] }>(`/api/pos/catalog${suffix}`);
}

export function openPosSession(payload: { terminalId: string; notes?: string }) {
  return adminFetch<{ session: { id: string; terminalId: string; openedAt: string; closedAt?: string | null } }>("/api/pos/sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function closePosSession(sessionId: string) {
  return adminFetch<{ session: { id: string; closedAt?: string | null } }>(`/api/pos/sessions/${sessionId}/close`, { method: "POST" });
}

export function createPosPayment(payload: {
  terminalId?: string | null;
  posSessionId?: string | null;
  customerId?: string | null;
  paymentMethod?: PosPaymentMethod;
  items: PosCartItemPayload[];
  globalDiscount?: number;
  orderDiscountType?: DiscountType | null;
  orderDiscountValue?: number | null;
  notes?: string | null;
}) {
  return adminFetch<{ order: PosOrder; paymentId: string | null; status: string; changePaymentStateUrl?: string | null }>("/api/pos/payments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createPosQuickSale(payload: {
  terminalId?: string | null;
  posSessionId?: string | null;
  customerId?: string | null;
  paymentMethod?: PosPaymentMethod;
  amount: number;
  description?: string;
  orderDiscountType?: DiscountType | null;
  orderDiscountValue?: number | null;
  globalDiscount?: number;
  notes?: string | null;
}) {
  return adminFetch<{ order: PosOrder; paymentId: string | null; status: string; changePaymentStateUrl?: string | null }>("/api/pos/quick-sale", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getPosPaymentStatus(paymentId: string) {
  return adminFetch<{ status: string; paymentId: string; order: PosOrder | null; changePaymentStateUrl?: string | null }>(`/api/pos/payments/${paymentId}/status`);
}

export function cancelPosPayment(paymentId: string) {
  return adminFetch<{ ok: boolean }>(`/api/pos/payments/${paymentId}/cancel`, { method: "POST" });
}

export function getPosHistory(params: { page?: number; limit?: number; period?: string; status?: string; search?: string } = {}) {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  if (params.period) search.set("period", params.period);
  if (params.status) search.set("status", params.status);
  if (params.search) search.set("search", params.search);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return adminFetch<{ orders: PosOrder[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/api/pos/history${suffix}`);
}

export function getPosOrder(orderId: string) {
  return adminFetch<{ order: PosOrder }>(`/api/pos/history/${orderId}`);
}

export function getPosStats(period = "today") {
  return adminFetch<PosStats>(`/api/pos/stats?period=${encodeURIComponent(period)}`);
}

export function markPosOrderPaid(orderId: string) {
  return adminFetch<{ order: PosOrder }>(`/api/pos/orders/${encodeURIComponent(orderId)}/mark-paid`, { method: "POST" });
}

export function resendOrderConfirmation(orderId: string, overrideEmail?: string) {
  return adminFetch<{ success: boolean; message: string; provider?: string; id?: string }>(
    `/api/admin/orders/${encodeURIComponent(orderId)}/resend-confirmation`,
    { method: "POST", body: JSON.stringify(overrideEmail ? { overrideEmail } : {}) }
  );
}

export function resendOrderTracking(orderId: string, overrideEmail?: string) {
  return adminFetch<{ success: boolean; message: string; trackingNumber?: string; provider?: string; id?: string }>(
    `/api/admin/orders/${encodeURIComponent(orderId)}/resend-tracking`,
    { method: "POST", body: JSON.stringify(overrideEmail ? { overrideEmail } : {}) }
  );
}
