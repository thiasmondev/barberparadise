export interface Product {
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
  images: string | string[];
  description: string;
  shortDescription: string;
  features: string | string[];
  inStock: boolean;
  stockCount: number;
  rating: number;
  reviewCount: number;
  isNew: boolean;
  isPromo: boolean;
  tags: string | string[];
  status: string;
  comparePrice?: number | null;
  metaDescription?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoTags?: string | null;
  schemaJsonLd?: string | null;
  faqItems?: string | null;
  directAnswer?: string | null;
  createdAt: string;
  updatedAt: string;
  variants?: ProductVariant[];
  [key: string]: unknown;
}

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

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  parentSlug: string;
  order: number;
}

// ─── Admin Types ────────────────────────────────────────────

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface DashboardStats {
  totalProducts: number;
  totalOrders: number;
  totalCustomers: number;
  totalRevenue: number;
  recentOrders: {
    id: string;
    total: number;
    status: string;
    createdAt: string;
  }[];
  ordersByStatus: {
    status: string;
    count: number;
    revenue: number;
  }[];
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string | null;
  email: string;
  status: string;
  subtotal: number;
  shipping: number;
  total: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  items: OrderItem[];
  shippingAddress?: ShippingAddress | null;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

export interface ShippingAddress {
  id: string;
  orderId: string;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  createdAt: string;
  updatedAt?: string;
  _count?: {
    orders: number;
    wishlist?: number;
  };
  orders?: Order[];
  addresses?: {
    id: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
    isDefault: boolean;
  }[];
}
