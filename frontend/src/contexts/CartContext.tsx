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
  removedInvalidVariantLines: string[];
  clearRemovedInvalidVariantLines: () => void;
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
  return `${productId}::${variantId || "product"}`;
}

function hasProductVariants(product: Product) {
  return Array.isArray(product.variants) && product.variants.length > 0;
}

function getCartItemVariantId(item: CartItem) {
  return item.variantId || item.variant?.id || null;
}

function getValidVariant(product: Product, variantId: string | null, variant?: ProductVariant | null) {
  if (!hasProductVariants(product)) return null;
  if (!variantId) return null;
  return product.variants?.find((candidate) => candidate.id === variantId) || variant || null;
}

function sanitizeCartItems(nextItems: CartItem[]) {
  const removed: string[] = [];
  const items = nextItems.reduce<CartItem[]>((acc, item) => {
    if (!hasProductVariants(item.product)) {
      acc.push(item);
      return acc;
    }

    const variantId = getCartItemVariantId(item);
    const variant = getValidVariant(item.product, variantId, item.variant);
    if (!variantId || !variant) {
      removed.push(item.product.name);
      return acc;
    }

    acc.push({ ...item, variantId, variant });
    return acc;
  }, []);

  return { items, removed };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [cartSessionId, setCartSessionId] = useState("");
  const [removedInvalidVariantLines, setRemovedInvalidVariantLines] = useState<string[]>([]);

  const registerRemovedLines = useCallback((removed: string[]) => {
    if (removed.length === 0) return;
    setRemovedInvalidVariantLines((current) => Array.from(new Set([...current, ...removed])));
  }, []);

  const clearRemovedInvalidVariantLines = useCallback(() => {
    setRemovedInvalidVariantLines([]);
  }, []);

  // Charger le panier et la session de suivi depuis localStorage
  useEffect(() => {
    const saved = localStorage.getItem("barberparadise-cart");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as CartItem[];
        const sanitized = sanitizeCartItems(Array.isArray(parsed) ? parsed : []);
        setItems(sanitized.items);
        registerRemovedLines(sanitized.removed);
      } catch {
        // ignore
      }
    }

    const existingSessionId = localStorage.getItem(CART_SESSION_KEY);
    const sessionId = existingSessionId || createCartSessionId();
    localStorage.setItem(CART_SESSION_KEY, sessionId);
    setCartSessionId(sessionId);
  }, [registerRemovedLines]);

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
          variantId: getCartItemVariantId(item),
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
    if (hasProductVariants(product)) {
      const variantId = variant?.id ?? null;
      const validVariant = getValidVariant(product, variantId, variant);
      if (!variantId || !validVariant) {
        registerRemovedLines([product.name]);
        return;
      }
    }

    setItems((prev) => {
      const variantId = variant?.id ?? null;
      const lineKey = getCartLineKey(product.id, variantId);
      const existing = prev.find((item) => getCartLineKey(item.product.id, getCartItemVariantId(item)) === lineKey);
      if (existing) {
        return prev.map((item) =>
          getCartLineKey(item.product.id, getCartItemVariantId(item)) === lineKey
            ? { ...item, quantity: item.quantity + quantity, variantId, variant }
            : item
        );
      }
      return [...prev, { product, quantity, variantId, variant }];
    });
  }, [registerRemovedLines]);

  const removeItem = useCallback((productId: string, variantId: string | null = null) => {
    const lineKey = getCartLineKey(productId, variantId);
    setItems((prev) => prev.filter((item) => getCartLineKey(item.product.id, getCartItemVariantId(item)) !== lineKey));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number, variantId: string | null = null) => {
    if (quantity <= 0) {
      removeItem(productId, variantId);
      return;
    }
    const lineKey = getCartLineKey(productId, variantId);
    setItems((prev) =>
      prev.map((item) =>
        getCartLineKey(item.product.id, getCartItemVariantId(item)) === lineKey ? { ...item, quantity } : item
      )
    );
  }, [removeItem]);

  const replaceItems = useCallback((nextItems: CartItem[]) => {
    const sanitized = sanitizeCartItems(nextItems);
    setItems(sanitized.items);
    registerRemovedLines(sanitized.removed);
  }, [registerRemovedLines]);

  const clearCart = useCallback(() => {
    setItems([]);
    setRemovedInvalidVariantLines([]);
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
      value={{ items, cartSessionId, addItem, removeItem, updateQuantity, replaceItems, clearCart, removedInvalidVariantLines, clearRemovedInvalidVariantLines, itemCount, total }}
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
