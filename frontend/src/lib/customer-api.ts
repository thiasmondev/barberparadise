import type { Customer, Order, Product } from "@/types";

export const CUSTOMER_TOKEN_KEY = "bp_customer_token";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://barberparadise-backend.onrender.com";

export interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
}

export interface CustomerAuthResponse {
  token: string;
  user: Customer;
}

export interface CustomerProfileUpdate {
  firstName: string;
  lastName: string;
  phone?: string | null;
}

export interface CustomerAddress {
  id: string;
  firstName: string;
  lastName: string;
  address: string;
  extension?: string;
  city: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
  phone?: string;
}

export interface CustomerAddressInput {
  firstName: string;
  lastName: string;
  address: string;
  extension?: string;
  postalCode: string;
  city: string;
  country: string;
  phone?: string;
}

async function parseApiError(response: Response, fallback: string): Promise<string> {
  try {
    const data = await response.json();
    return data?.error || data?.message || fallback;
  } catch {
    return fallback;
  }
}

async function customerFetch<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const authToken = token ?? (typeof window !== "undefined" ? localStorage.getItem(CUSTOMER_TOKEN_KEY) : null);
  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event("customer-session-expired"));
    }
    throw new Error(await parseApiError(response, "Une erreur est survenue"));
  }

  return response.json();
}

export async function customerLogin(email: string, password: string): Promise<CustomerAuthResponse> {
  return customerFetch<CustomerAuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  }, null);
}

export async function customerRegister(data: RegisterData): Promise<CustomerAuthResponse> {
  return customerFetch<CustomerAuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  }, null);
}

export async function getCustomerMe(token?: string | null): Promise<Customer> {
  return customerFetch<Customer>("/api/customers/me", {}, token);
}

export async function updateCustomerMe(data: CustomerProfileUpdate): Promise<Customer> {
  return customerFetch<Customer>("/api/customers/me", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function getCustomerOrders(): Promise<Order[]> {
  return customerFetch<Order[]>("/api/customers/me/orders");
}

export async function getCustomerAddresses(): Promise<CustomerAddress[]> {
  return customerFetch<CustomerAddress[]>("/api/customers/me/addresses");
}

export async function createCustomerAddress(data: CustomerAddressInput): Promise<CustomerAddress> {
  return customerFetch<CustomerAddress>("/api/customers/me/addresses", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCustomerAddress(id: string, data: CustomerAddressInput): Promise<CustomerAddress> {
  return customerFetch<CustomerAddress>(`/api/customers/me/addresses/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteCustomerAddress(id: string): Promise<{ success: boolean }> {
  return customerFetch<{ success: boolean }>(`/api/customers/me/addresses/${id}`, {
    method: "DELETE",
  });
}

export async function getCustomerWishlist(): Promise<Product[]> {
  return customerFetch<Product[]>("/api/customers/me/wishlist");
}

export async function addCustomerWishlist(productId: string): Promise<{ success: boolean }> {
  return customerFetch<{ success: boolean }>(`/api/customers/me/wishlist/${productId}`, {
    method: "POST",
  });
}

export async function removeCustomerWishlist(productId: string): Promise<{ success: boolean }> {
  return customerFetch<{ success: boolean }>(`/api/customers/me/wishlist/${productId}`, {
    method: "DELETE",
  });
}
