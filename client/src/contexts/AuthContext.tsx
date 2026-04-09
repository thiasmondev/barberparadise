// ============================================================
// BARBER PARADISE — Contexte Authentification (mockée)
// ============================================================

import React, { createContext, useContext, useState, useEffect } from "react";
import { type Order, mockOrders } from "@/lib/data";


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
  orders: Order[];
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

// Utilisateur de démo
const DEMO_USER: User = {
  id: "user_001",
  email: "demo@barberparadise.fr",
  firstName: "Jean",
  lastName: "Dupont",
  phone: "06 12 34 56 78",
  address: {
    street: "12 Rue de la Paix",
    city: "Paris",
    postalCode: "75001",
    country: "France",
  },
  isPro: false,
  createdAt: "2023-09-01",
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_KEY);
      if (stored) setUser(JSON.parse(stored));
    } catch {}
    setIsLoading(false);
  }, []);

  const login = async (email: string, _password: string) => {
    // Simulation d'une authentification (mockée)
    await new Promise((r) => setTimeout(r, 800));
    if (email === "demo@barberparadise.fr" || email.includes("@")) {
      const loggedUser = { ...DEMO_USER, email };
      setUser(loggedUser);
      localStorage.setItem(AUTH_KEY, JSON.stringify(loggedUser));
      return { success: true };
    }
    return { success: false, error: "Email ou mot de passe incorrect" };
  };

  const register = async (data: RegisterData) => {
    await new Promise((r) => setTimeout(r, 1000));
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
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(AUTH_KEY);
  };

  const updateProfile = (data: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...data };
    setUser(updated);
    localStorage.setItem(AUTH_KEY, JSON.stringify(updated));
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
