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
  images: string;
  description: string;
  shortDescription: string;
  features: string;
  inStock: boolean;
  stockCount: number;
  rating: number;
  reviewCount: number;
  isNew: boolean;
  isPromo: boolean;
  tags: string;
  status: string;
  createdAt: string;
  updatedAt: string;
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
