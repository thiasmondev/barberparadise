"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { Product, CartItem, ProductVariant } from "@/types";
import { CUSTOMER_TOKEN_KEY } from "@/lib/customer-api";

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
  /**
   * Permet aux composants enfants (ex: CustomerAuthProvider) d'enrichir la session panier
   * avec l'email du client connecté, sans créer de dépendance circulaire entre providers.
   * Appelé dès que l'authentification client est disponible.
   */
  updateCartEmail: (email: string) => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://barberparadise-backend.onrender.com";
const CART_SESSION_KEY = "barberparadise-cart-session";

interface CartSessionPayload {
  sessionId: string;
  email?: string;
  cartItems?: { productId: string; variantId: string | null; quantity: number }[];
}

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
  const [hydrated, setHydrated] = useState(false);
  const [removedInvalidVariantLines, setRemovedInvalidVariantLines] = useState<string[]>([]);
  // Les callbacks du pont peuvent changer la session avant le prochain rendu du provider.
  const sessionIdRef = useRef("");
  const itemsRef = useRef<CartItem[]>([]);
  const cartEmailRef = useRef<string>("");
  const lastEmailRequestRef = useRef<{ sessionId: string; email: string } | null>(null);
  const requestQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Une seule requête à la fois : une identité ne peut pas dépasser un snapshot d'articles.
  // Les tâches obsolètes sont ignorées avant leur départ, sans aborter une écriture en vol.
  const enqueueCartRequest = useCallback((sessionId: string, getPayload: () => CartSessionPayload | null) => {
    const token = localStorage.getItem(CUSTOMER_TOKEN_KEY);
    const request = requestQueueRef.current.then(async () => {
      if (!mountedRef.current || sessionIdRef.current !== sessionId) return false;
      if (localStorage.getItem(CUSTOMER_TOKEN_KEY) !== token) return false;
      const payload = getPayload();
      if (!payload) return false;

      try {
        const response = await fetch(`${API_URL}/api/checkout/cart-session`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });
        return response.ok;
      } catch {
        // Le suivi ne doit jamais bloquer l'expérience d'achat.
        return false;
      }
    });
    requestQueueRef.current = request.catch(() => false);
    return request;
  }, []);

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
    sessionIdRef.current = sessionId;
    setCartSessionId(sessionId);
    setHydrated(true);
  }, [registerRemovedLines]);

  // Ne pas écraser les articles persistés avec [] lors du tout premier rendu.
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("barberparadise-cart", JSON.stringify(items));
  }, [hydrated, items]);

  // L'email courant reste inclus lorsque les articles sont synchronisés.
  useEffect(() => {
    if (!hydrated) return;
    itemsRef.current = items;
    if (!cartSessionId || sessionIdRef.current !== cartSessionId) return;

    void enqueueCartRequest(cartSessionId, () => {
      if (itemsRef.current !== items) return null;
      return {
        sessionId: cartSessionId,
        ...(cartEmailRef.current ? { email: cartEmailRef.current } : {}),
        cartItems: items.map((item) => ({
          productId: item.product.id,
          variantId: getCartItemVariantId(item),
          quantity: item.quantity,
        })),
      };
    });
  }, [cartSessionId, enqueueCartRequest, hydrated, items]);

  // Déconnexion/changement de compte : conserver les articles, jamais l'ancienne identité.
  const rotateCartSession = useCallback(() => {
    cartEmailRef.current = "";
    lastEmailRequestRef.current = null;
    const nextSessionId = createCartSessionId();
    sessionIdRef.current = nextSessionId;
    localStorage.setItem(CART_SESSION_KEY, nextSessionId);
    setCartSessionId(nextSessionId);
  }, []);

  /**
   * Met à jour l'email associé à la session panier courante.
   * Appelé par les composants enfants qui ont accès au contexte d'authentification client
   * (ex: un useEffect dans ClientLayout ou dans un composant qui utilise useCustomerAuth).
   * Omet cartItems : [] serait un véritable vidage de la session côté serveur.
   */
  const updateCartEmail = useCallback((email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const sessionId = sessionIdRef.current;
    if (!normalizedEmail.includes("@") || !sessionId) return;
    cartEmailRef.current = normalizedEmail;

    const previous = lastEmailRequestRef.current;
    if (previous?.sessionId === sessionId && previous.email === normalizedEmail) return;
    const association = { sessionId, email: normalizedEmail };
    lastEmailRequestRef.current = association;

    void enqueueCartRequest(sessionId, () => (
      cartEmailRef.current === normalizedEmail ? association : null
    )).then((sent) => {
      // Un échec ne doit pas empêcher une future tentative sur le même couple.
      if (!sent && lastEmailRequestRef.current === association) {
        lastEmailRequestRef.current = null;
      }
    });
  }, [enqueueCartRequest]);

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
    rotateCartSession();
  }, [rotateCartSession]);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{ items, cartSessionId, addItem, removeItem, updateQuantity, replaceItems, clearCart, rotateCartSession, removedInvalidVariantLines, clearRemovedInvalidVariantLines, itemCount, total, updateCartEmail }}
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
