"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { Product, CartItem, ProductVariant } from "@/types";
import { CUSTOMER_TOKEN_KEY } from "@/lib/customer-api";
import { createCartSessionSyncQueue, type CartSessionRequest, type CartSyncResult } from "@/lib/cart-session-sync";

export type CartSyncStatus = "idle" | "syncing" | "synced" | "error";

interface CartContextType {
  items: CartItem[];
  cartSessionId: string;
  addItem: (product: Product, quantity?: number, variant?: ProductVariant | null) => void;
  removeItem: (productId: string, variantId?: string | null) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string | null) => void;
  replaceItems: (items: CartItem[]) => void;
  clearCart: () => void;
  rotateCartSession: () => void;
  removedInvalidVariantLines: string[];
  clearRemovedInvalidVariantLines: () => void;
  itemCount: number;
  total: number;
  updateCartEmail: (email: string) => void;
  syncStatus: CartSyncStatus;
  syncMessage: string;
  lastSyncedAt: string | null;
  syncCartNow: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://barberparadise-backend.onrender.com";
const CART_SESSION_KEY = "barberparadise-cart-session";
const SYNC_ERROR_MESSAGE = "Votre panier reste disponible sur cet appareil, mais son enregistrement n’a pas abouti. Réessayez.";

function createCartSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
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
  if (!hasProductVariants(product) || !variantId) return null;
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

function requestSignature(request: CartSessionRequest) {
  return JSON.stringify([request.token, request.payload]);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [cartSessionId, setCartSessionId] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [removedInvalidVariantLines, setRemovedInvalidVariantLines] = useState<string[]>([]);
  const [syncStatus, setSyncStatus] = useState<CartSyncStatus>("idle");
  const [syncMessage, setSyncMessage] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const sessionIdRef = useRef("");
  const itemsRef = useRef<CartItem[]>(items);
  const cartEmailRef = useRef("");
  const mountedRef = useRef(false);
  const hydratedRef = useRef(false);
  const snapshotTaskRef = useRef(0);
  const pendingSnapshotRef = useRef(false);
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRecoveryRef = useRef(0);
  const lastEmailRequestRef = useRef<string | null>(null);
  const queueRef = useRef<ReturnType<typeof createCartSessionSyncQueue> | null>(null);
  // Keep refs fresh before children run effects (the email bridge runs first).
  itemsRef.current = items;

  const getQueue = useCallback(() => {
    if (!queueRef.current) queueRef.current = createCartSessionSyncQueue({ url: `${API_URL}/api/checkout/cart-session` });
    return queueRef.current;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      queueRef.current?.cancelActive();
      if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
    };
  }, []);

  const buildRequest = useCallback((sessionId: string, snapshot: boolean): CartSessionRequest | null => {
    if (!mountedRef.current || !hydratedRef.current || sessionIdRef.current !== sessionId) return null;
    return {
      token: localStorage.getItem(CUSTOMER_TOKEN_KEY),
      payload: {
        sessionId,
        ...(cartEmailRef.current ? { email: cartEmailRef.current } : {}),
        ...(snapshot ? { cartItems: itemsRef.current.map((item) => ({
          productId: item.product.id,
          variantId: getCartItemVariantId(item),
          quantity: item.quantity,
        })) } : {}),
      },
    };
  }, []);

  // The server can issue a replacement session for a previously converted cart.
  // Preserve email and articles; rotateCartSession deliberately clears identity.
  const adoptSession = useCallback((nextSessionId: string) => {
    if (nextSessionId === sessionIdRef.current) return;
    queueRef.current?.cancelActive();
    snapshotTaskRef.current++;
    pendingSnapshotRef.current = false;
    lastEmailRequestRef.current = null;
    sessionIdRef.current = nextSessionId;
    localStorage.setItem(CART_SESSION_KEY, nextSessionId);
    setLastSyncedAt(null);
    setSyncStatus("idle");
    setSyncMessage("");
    setCartSessionId(nextSessionId);
  }, []);

  const syncCartNow = useCallback(function syncSnapshot() {
    const sessionId = sessionIdRef.current;
    if (!hydratedRef.current || !sessionId || !mountedRef.current) return;
    const task = ++snapshotTaskRef.current;
    pendingSnapshotRef.current = true;
    setSyncStatus("syncing");
    setSyncMessage("");
    void getQueue().enqueue(() => {
      if (task !== snapshotTaskRef.current) return null;
      return buildRequest(sessionId, true);
    }).then((result: CartSyncResult) => {
      if (!mountedRef.current || sessionIdRef.current !== sessionId || task !== snapshotTaskRef.current) return;
      pendingSnapshotRef.current = false;
      if (result.status === "skipped") return;
      if (result.status === "error") {
        setSyncStatus("error");
        setSyncMessage(SYNC_ERROR_MESSAGE);
        return;
      }
      const current = buildRequest(sessionId, true);
      if (!current || requestSignature(current) !== requestSignature(result.request)) {
        // Items/email/token changed while the write was in flight: acknowledge only
        // the latest full snapshot, never the old request or an identity-only reply.
        syncSnapshot();
        return;
      }
      if (result.response.sessionId !== sessionId) {
        adoptSession(result.response.sessionId);
        return; // The session effect sends a fresh snapshot under the new identity.
      }
      if (!result.response.hasSnapshot || !result.request.payload.cartItems ||
          typeof result.response.syncedAt !== "string" || !Number.isFinite(Date.parse(result.response.syncedAt))) {
        setSyncStatus("error");
        setSyncMessage(SYNC_ERROR_MESSAGE);
        return;
      }
      setLastSyncedAt(result.response.syncedAt);
      const issues = Array.isArray(result.response.validationIssues) ? result.response.validationIssues : [];
      const expectedCount = result.request.payload.cartItems.reduce((sum, item) => sum + item.quantity, 0);
      if (issues.length > 0 || result.response.itemCount !== expectedCount) {
        setSyncStatus("error");
        setSyncMessage("Articles à vérifier : certains articles du panier nécessitent votre attention. Le panier reste disponible sur cet appareil.");
      } else {
        setSyncStatus("synced");
        setSyncMessage("Panier enregistré.");
      }
    });
  }, [adoptSession, buildRequest, getQueue]);

  const registerRemovedLines = useCallback((removed: string[]) => {
    if (removed.length > 0) setRemovedInvalidVariantLines((current) => Array.from(new Set([...current, ...removed])));
  }, []);

  const clearRemovedInvalidVariantLines = useCallback(() => setRemovedInvalidVariantLines([]), []);

  useEffect(() => {
    const saved = localStorage.getItem("barberparadise-cart");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as CartItem[];
        const sanitized = sanitizeCartItems(Array.isArray(parsed) ? parsed : []);
        setItems(sanitized.items);
        itemsRef.current = sanitized.items;
        registerRemovedLines(sanitized.removed);
      } catch { /* Keep shopping available if the local snapshot is malformed. */ }
    }
    const sessionId = localStorage.getItem(CART_SESSION_KEY) || createCartSessionId();
    localStorage.setItem(CART_SESSION_KEY, sessionId);
    sessionIdRef.current = sessionId;
    hydratedRef.current = true;
    setCartSessionId(sessionId);
    setHydrated(true);
  }, [registerRemovedLines]);

  useEffect(() => {
    if (hydrated) localStorage.setItem("barberparadise-cart", JSON.stringify(items));
  }, [hydrated, items]);

  useEffect(() => {
    if (hydrated && cartSessionId === sessionIdRef.current) syncCartNow();
  }, [cartSessionId, hydrated, items, syncCartNow]);

  useEffect(() => {
    const recover = () => {
      if (document.visibilityState !== "visible" || navigator.onLine === false) return;
      if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = setTimeout(() => {
        recoveryTimerRef.current = null;
        if (document.visibilityState !== "visible" || navigator.onLine === false || pendingSnapshotRef.current) return;
        if (Date.now() - lastRecoveryRef.current < 2_000) return;
        lastRecoveryRef.current = Date.now();
        syncCartNow();
      }, 350);
    };
    window.addEventListener("online", recover);
    document.addEventListener("visibilitychange", recover);
    return () => {
      window.removeEventListener("online", recover);
      document.removeEventListener("visibilitychange", recover);
      if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
    };
  }, [syncCartNow]);

  const rotateCartSession = useCallback(() => {
    cartEmailRef.current = "";
    adoptSession(createCartSessionId());
  }, [adoptSession]);

  const updateCartEmail = useCallback((email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const sessionId = sessionIdRef.current;
    if (!normalizedEmail.includes("@") || !sessionId) return;
    cartEmailRef.current = normalizedEmail;
    const associationKey = JSON.stringify([sessionId, normalizedEmail, localStorage.getItem(CUSTOMER_TOKEN_KEY)]);
    if (lastEmailRequestRef.current !== associationKey) {
      lastEmailRequestRef.current = associationKey;
      // Identity writes omit cartItems; [] would destructively empty the server cart.
      void getQueue().enqueue(() => {
        if (cartEmailRef.current !== normalizedEmail) return null;
        return buildRequest(sessionId, false);
      }).then((result) => {
        if (!mountedRef.current || sessionIdRef.current !== sessionId) return;
        if (result.status === "success") {
          const current = buildRequest(sessionId, false);
          if (current && requestSignature(current) === requestSignature(result.request) && result.response.sessionId !== sessionId) {
            adoptSession(result.response.sessionId);
          }
          // Identity-only success NEVER changes the snapshot sync status.
        } else if (lastEmailRequestRef.current === associationKey) {
          lastEmailRequestRef.current = null;
        }
      });
    }
    // Authentication must also repair an absent snapshot, even when the email was
    // already associated or an earlier snapshot was invalidated by a token change.
    syncCartNow();
  }, [adoptSession, buildRequest, getQueue, syncCartNow]);

  const addItem = useCallback((product: Product, quantity = 1, variant: ProductVariant | null = null) => {
    if (hasProductVariants(product) && (!variant?.id || !getValidVariant(product, variant.id, variant))) {
      registerRemovedLines([product.name]);
      return;
    }
    setItems((prev) => {
      const variantId = variant?.id ?? null;
      const lineKey = getCartLineKey(product.id, variantId);
      const existing = prev.find((item) => getCartLineKey(item.product.id, getCartItemVariantId(item)) === lineKey);
      if (existing) return prev.map((item) => getCartLineKey(item.product.id, getCartItemVariantId(item)) === lineKey
        ? { ...item, quantity: item.quantity + quantity, variantId, variant } : item);
      return [...prev, { product, quantity, variantId, variant }];
    });
  }, [registerRemovedLines]);

  const removeItem = useCallback((productId: string, variantId: string | null = null) => {
    const lineKey = getCartLineKey(productId, variantId);
    setItems((prev) => prev.filter((item) => getCartLineKey(item.product.id, getCartItemVariantId(item)) !== lineKey));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number, variantId: string | null = null) => {
    if (quantity <= 0) { removeItem(productId, variantId); return; }
    const lineKey = getCartLineKey(productId, variantId);
    setItems((prev) => prev.map((item) => getCartLineKey(item.product.id, getCartItemVariantId(item)) === lineKey ? { ...item, quantity } : item));
  }, [removeItem]);

  const replaceItems = useCallback((nextItems: CartItem[]) => {
    const sanitized = sanitizeCartItems(nextItems);
    setItems(sanitized.items);
    registerRemovedLines(sanitized.removed);
  }, [registerRemovedLines]);

  const clearCart = useCallback(() => {
    setItems([]);
    setRemovedInvalidVariantLines([]);
    rotateCartSession();
  }, [rotateCartSession]);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  return (
    <CartContext.Provider value={{ items, cartSessionId, addItem, removeItem, updateQuantity, replaceItems, clearCart, rotateCartSession,
      removedInvalidVariantLines, clearRemovedInvalidVariantLines, itemCount, total, updateCartEmail,
      syncStatus, syncMessage, lastSyncedAt, syncCartNow }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
