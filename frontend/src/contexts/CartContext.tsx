"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { Product, CartItem, ProductVariant } from "@/types";

interface CartContextType {
  items: CartItem[];
  cartSessionId: string;
  addItem: (product: Product, quantity?: number, variant?: ProductVariant | null) => void;
  removeItem: (productId: string, variantId?: string | null) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string | null) => void;
  replaceItems: (items: CartItem[]) => void;
  clearCart: () => void;
  itemCount: number;
  total: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://barberparadise-backend.onrender.com";
const CART_SESSION_KEY = "barberparadise-cart-session";

function createCartSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cart-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function getCartLineKey(productId: string, variantId?: string | null) {
  return `${productId}::${variantId || 'product'}`;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [cartSessionId, setCartSessionId] = useState("");

  // Charger le panier et la session de suivi depuis localStorage
  useEffect(() => {
    const saved = localStorage.getItem("barberparadise-cart");
    if (saved) {
      try {
        setItems(JSON.parse(saved));
      } catch {
        // ignore
      }
    }

    const existingSessionId = localStorage.getItem(CART_SESSION_KEY);
    const sessionId = existingSessionId || createCartSessionId();
    localStorage.setItem(CART_SESSION_KEY, sessionId);
    setCartSessionId(sessionId);
  }, []);

  // Sauvegarder le panier dans localStorage
  useEffect(() => {
    localStorage.setItem("barberparadise-cart", JSON.stringify(items));
  }, [items]);

  // Synchroniser le panier avec le backend pour l’onglet admin Paniers abandonnés.
  useEffect(() => {
    if (!cartSessionId) return;
    const controller = new AbortController();

    fetch(`${API_URL}/api/checkout/cart-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: cartSessionId,
        cartItems: items.map((item) => ({
          productId: item.product.id,
          variantId: item.variantId || item.variant?.id || null,
          quantity: item.quantity,
        })),
      }),
      signal: controller.signal,
    }).catch(() => {
      // Le suivi des paniers abandonnés ne doit jamais bloquer l’expérience d’achat.
    });

    return () => controller.abort();
  }, [cartSessionId, items]);

  const addItem = useCallback((product: Product, quantity = 1, variant: ProductVariant | null = null) => {
    setItems((prev) => {
      const variantId = variant?.id ?? null;
      const lineKey = getCartLineKey(product.id, variantId);
      const existing = prev.find((item) => getCartLineKey(item.product.id, item.variantId || item.variant?.id || null) === lineKey);
      if (existing) {
        return prev.map((item) =>
          getCartLineKey(item.product.id, item.variantId || item.variant?.id || null) === lineKey
            ? { ...item, quantity: item.quantity + quantity, variantId, variant }
            : item
        );
      }
      return [...prev, { product, quantity, variantId, variant }];
    });
  }, []);

  const removeItem = useCallback((productId: string, variantId: string | null = null) => {
    const lineKey = getCartLineKey(productId, variantId);
    setItems((prev) => prev.filter((item) => getCartLineKey(item.product.id, item.variantId || item.variant?.id || null) !== lineKey));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number, variantId: string | null = null) => {
    if (quantity <= 0) {
      removeItem(productId, variantId);
      return;
    }
    const lineKey = getCartLineKey(productId, variantId);
    setItems((prev) =>
      prev.map((item) =>
        getCartLineKey(item.product.id, item.variantId || item.variant?.id || null) === lineKey ? { ...item, quantity } : item
      )
    );
  }, [removeItem]);

  const replaceItems = useCallback((nextItems: CartItem[]) => {
    setItems(nextItems);
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    const nextSessionId = createCartSessionId();
    localStorage.setItem(CART_SESSION_KEY, nextSessionId);
    setCartSessionId(nextSessionId);
  }, []);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{ items, cartSessionId, addItem, removeItem, updateQuantity, replaceItems, clearCart, itemCount, total }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
