"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Product, CartItem } from "@/types";

interface CartContextType {
  items: CartItem[];
  cartSessionId: string;
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
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
          quantity: item.quantity,
        })),
      }),
      signal: controller.signal,
    }).catch(() => {
      // Le suivi des paniers abandonnés ne doit jamais bloquer l’expérience d’achat.
    });

    return () => controller.abort();
  }, [cartSessionId, items]);

  const addItem = (product: Product, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
    const nextSessionId = createCartSessionId();
    localStorage.setItem(CART_SESSION_KEY, nextSessionId);
    setCartSessionId(nextSessionId);
  };

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{ items, cartSessionId, addItem, removeItem, updateQuantity, clearCart, itemCount, total }}
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
