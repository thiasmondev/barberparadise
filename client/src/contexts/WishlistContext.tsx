// ============================================================
// BARBER PARADISE — Contexte Wishlist
// ============================================================

import React, { createContext, useContext, useReducer, useEffect } from "react";
import type { Product } from "@/lib/data";

interface WishlistState {
  items: Product[];
}

type WishlistAction =
  | { type: "ADD_ITEM"; product: Product }
  | { type: "REMOVE_ITEM"; productId: number }
  | { type: "TOGGLE_ITEM"; product: Product }
  | { type: "CLEAR" };

interface WishlistContextValue {
  items: Product[];
  addItem: (product: Product) => void;
  removeItem: (productId: number) => void;
  toggleItem: (product: Product) => void;
  isWishlisted: (productId: number) => boolean;
  count: number;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

const WISHLIST_KEY = "bp_wishlist";

function loadWishlist(): Product[] {
  try {
    const stored = localStorage.getItem(WISHLIST_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

function wishlistReducer(state: WishlistState, action: WishlistAction): WishlistState {
  switch (action.type) {
    case "ADD_ITEM":
      if (state.items.find((i) => i.id === action.product.id)) return state;
      return { items: [...state.items, action.product] };
    case "REMOVE_ITEM":
      return { items: state.items.filter((i) => i.id !== action.productId) };
    case "TOGGLE_ITEM": {
      const exists = state.items.find((i) => i.id === action.product.id);
      if (exists) return { items: state.items.filter((i) => i.id !== action.product.id) };
      return { items: [...state.items, action.product] };
    }
    case "CLEAR":
      return { items: [] };
    default:
      return state;
  }
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(wishlistReducer, { items: loadWishlist() });

  useEffect(() => {
    try {
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(state.items));
    } catch {}
  }, [state.items]);

  const value: WishlistContextValue = {
    items: state.items,
    addItem: (product) => dispatch({ type: "ADD_ITEM", product }),
    removeItem: (productId) => dispatch({ type: "REMOVE_ITEM", productId }),
    toggleItem: (product) => dispatch({ type: "TOGGLE_ITEM", product }),
    isWishlisted: (productId) => !!state.items.find((i) => i.id === productId),
    count: state.items.length,
  };

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
