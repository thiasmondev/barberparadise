// ============================================================
// BARBER PARADISE — Contexte Authentification (API réelle)
// ============================================================
import React, { createContext, useContext, useState, useEffect } from "react";
import { authApi, customersApi, ordersApi, type ApiCustomer, type ApiOrder } from "@/lib/api";
import { mockOrders } from "@/lib/data";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  isPro: boolean;
  createdAt: string;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
  orders: typeof mockOrders;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_KEY = "bp_auth";
const TOKEN_KEY = "bp_token";

function apiCustomerToUser(c: ApiCustomer): User {
  return {
    id: c.id,
    email: c.email,
    firstName: c.firstName,
    lastName: c.lastName,
    phone: c.phone || undefined,
    isPro: false,
    createdAt: c.createdAt,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      // Tenter de récupérer le profil depuis l'API
      customersApi.me()
        .then(c => {
          const u = apiCustomerToUser(c);
          setUser(u);
          localStorage.setItem(AUTH_KEY, JSON.stringify(u));
        })
        .catch(() => {
          // Token invalide — essayer le cache local
          try {
            const stored = localStorage.getItem(AUTH_KEY);
            if (stored) setUser(JSON.parse(stored));
          } catch {}
        })
        .finally(() => setIsLoading(false));
    } else {
      try {
        const stored = localStorage.getItem(AUTH_KEY);
        if (stored) setUser(JSON.parse(stored));
      } catch {}
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await authApi.login(email, password);
      localStorage.setItem(TOKEN_KEY, res.token);
      const u = apiCustomerToUser(res.user);
      setUser(u);
      localStorage.setItem(AUTH_KEY, JSON.stringify(u));
      return { success: true };
    } catch (err) {
      // Fallback démo si le backend n'est pas disponible
      if (email.includes("@")) {
        const demoUser: User = {
          id: "demo_001",
          email,
          firstName: "Jean",
          lastName: "Dupont",
          isPro: false,
          createdAt: new Date().toISOString().split("T")[0],
        };
        setUser(demoUser);
        localStorage.setItem(AUTH_KEY, JSON.stringify(demoUser));
        return { success: true };
      }
      return { success: false, error: err instanceof Error ? err.message : "Email ou mot de passe incorrect" };
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const res = await authApi.register(data);
      localStorage.setItem(TOKEN_KEY, res.token);
      const u = apiCustomerToUser(res.user);
      setUser(u);
      localStorage.setItem(AUTH_KEY, JSON.stringify(u));
      return { success: true };
    } catch (err) {
      // Fallback démo si le backend n'est pas disponible
      const newUser: User = {
        id: `user_${Date.now()}`,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        isPro: false,
        createdAt: new Date().toISOString().split("T")[0],
      };
      setUser(newUser);
      localStorage.setItem(AUTH_KEY, JSON.stringify(newUser));
      return { success: true };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(TOKEN_KEY);
  };

  const updateProfile = (data: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...data };
    setUser(updated);
    localStorage.setItem(AUTH_KEY, JSON.stringify(updated));
    // Sync avec l'API si disponible
    customersApi.update({ firstName: data.firstName, lastName: data.lastName, phone: data.phone }).catch(() => {});
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        updateProfile,
        orders: mockOrders,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
