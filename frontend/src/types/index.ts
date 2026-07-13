export interface Product {
  id: string;
  handle: string;
  name: string;
  slug: string;
  brand: string;
  brandId?: number | null;
  category: string;
  subcategory: string;
  subsubcategory: string;
  price: number;
  pricePublic?: number;
  priceProEur?: number | null;
  hasPriceProEur?: boolean;
  isPro?: boolean;
  originalPrice: number | null;
  compareAtPrice?: number | null;
  purchasePrice?: number | null;
  images: string | string[];
  description: string;
  shortDescription: string;
  features: string | string[];
  inStock: boolean;
  stockCount: number;
  weightG?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  isFragile?: boolean;
  isLiquid?: boolean;
  isAerosol?: boolean;
  requiresGlass?: boolean;
  logisticNote?: string | null;
  rating: number;
  reviewCount: number;
  isNew: boolean;
  isPromo: boolean;
  automaticPromotionName?: string;
  automaticPromotionDiscountPercent?: number;
  tags: string | string[];
  status: string;
  categoryOrder?: number;
  recommendedProductIds?: string[];
  recommendedProducts?: Product[];
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

export interface Packaging {
  id: number;
  name: string;
  type: "carton" | "enveloppe" | "tube" | string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  internalVolumeCm3: number;
  maxWeightG: number;
  selfWeightG: number;
  costEur: number;
  stock: number;
  isReinforced: boolean;
  isActive: boolean;
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
  priceProEur?: number | null;
  purchasePrice?: number | null;
  pricePublic?: number;
  compareAtPrice?: number | null;
  originalPrice?: number | null;
  isPromo?: boolean;
  automaticPromotionName?: string;
  automaticPromotionDiscountPercent?: number;
  hasPriceProEur?: boolean;
  stock: number;
  inStock: boolean;
  sku: string;
  image: string;
  order: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  variantId?: string | null;
  variant?: ProductVariant | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  parentSlug: string;
  order: number;
  isActive?: boolean;
  metaTitle?: string;
  metaDescription?: string;
}

// ─── Brand Types ────────────────────────────────────────────

export interface Brand {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  logo: string | null;
  bannerImage: string | null;
  website: string | null;
  productCount: number;
}

export interface BrandDetail {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  logo: string | null;
  bannerImage: string | null;
  website: string | null;
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
    orderNumber: string;
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

export type DiscountType = "percent" | "fixed";

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string | null;
  email: string;
  status: string;
  paymentMethod?: string | null;
  paymentProvider?: string | null;
  providerPaymentId?: string | null;
  subtotal: number;
  shipping: number;
  total: number;
  totalHT?: number;
  vatRate?: number;
  vatAmount?: number;
  totalTTC?: number;
  currency?: string;
  isB2B?: boolean;
  invoiceNumber?: string | null;
  invoiceUrl?: string | null;
  proInvoiceNumber?: string | null;
  proInvoiceUrl?: string | null;
  channel?: "online" | "pos" | string;
  terminalId?: string | null;
  posSessionId?: string | null;
  posPaymentStatus?: string | null;
  posPaidAt?: string | null;
  posCashierId?: string | null;
  posCashierEmail?: string | null;
  discountAmount?: number;
  orderDiscountType?: DiscountType | null;
  orderDiscountValue?: number | null;
  discountTotal?: number | null;
  customerEmail?: string | null;
  billingAddress?: unknown;
  notes: string | null;
  relayPointId?: string | null;
  relayPointName?: string | null;
  relayPointAddress?: string | null;
  itemsLastModifiedAt?: string | null; // Date de dernière modification des articles (pour badge "Facture à régénérer")
  refundedAmount?: number;
  refundedAt?: string | null;
  refundMode?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    _count?: { orders: number };
  } | null;
  items: OrderItem[];
  shippingAddress?: ShippingAddress | null;
  shipment?: {
    id: string;
    carrier: string;
    trackingNumber?: string | null;
    trackingUrl?: string | null;
    packagingId?: number | null;
    totalWeightG?: number | null;
    deliveryMode?: string | null;
    relayPointId?: string | null;
    labelStatus?: string | null;
    labelGeneratedAt?: string | null;
    shippedAt?: string | null;
    lastTrackingStatus?: string | null;
    labelSource?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    labelPriceCents?: number | null;
    labelCurrency?: string | null;
    serviceCode?: string | null;
  } | null;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId?: string | null;
  name: string;
  variantLabel?: string | null;
  price: number;
  quantity: number;
  image: string;
  discountAmount?: number;
  lineDiscountType?: DiscountType | null;
  lineDiscountValue?: number | null;
  isCustomSale?: boolean;
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
  extension?: string | null;
  phone?: string | null;
}

export interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  createdAt: string;
  updatedAt?: string;
  totalSpent?: number;
  proAccount?: {
    id: string;
    companyName: string;
    status: string;
    activity?: string | null;
    phone?: string | null;
    siret?: string | null;
    vatNumber?: string | null;
    approvedAt?: string | null;
    approvedBy?: string | null;
    rejectionReason?: string | null;
  } | null;
  _count?: {
    orders: number;
    wishlist?: number;
  };
  orders?: Order[];
  addresses?: {
    id: string;
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
    isDefault: boolean;
    phone?: string;
  }[];
}
