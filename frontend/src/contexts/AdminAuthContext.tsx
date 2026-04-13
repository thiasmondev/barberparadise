"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import type { AdminUser } from "@/types";

interface AdminAuthContextType {
  admin: AdminUser | null;
  token: string | null;
  login: (token: string, admin: AdminUser) => void;
  logout: () => void;
  isLoading: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

/** Vérifie si un token JWT est expiré */
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem("admin-token");
    localStorage.removeItem("admin-user");
    setToken(null);
    setAdmin(null);
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem("admin-token");
    const savedAdmin = localStorage.getItem("admin-user");

    if (savedToken && savedAdmin) {
      // Vérifier si le token est expiré avant de l'utiliser
      if (isTokenExpired(savedToken)) {
        localStorage.removeItem("admin-token");
        localStorage.removeItem("admin-user");
      } else {
        try {
          setToken(savedToken);
          setAdmin(JSON.parse(savedAdmin));
        } catch {
          localStorage.removeItem("admin-token");
          localStorage.removeItem("admin-user");
        }
      }
    }
    setIsLoading(false);
  }, []);

  // Écouter l'événement de session expirée émis par adminFetch
  // Cela évite la boucle infinie causée par window.location.href = "/admin"
  useEffect(() => {
    const handleSessionExpired = () => {
      logout();
    };
    window.addEventListener("admin-session-expired", handleSessionExpired);
    return () => {
      window.removeEventListener("admin-session-expired", handleSessionExpired);
    };
  }, [logout]);

  const login = (newToken: string, newAdmin: AdminUser) => {
    localStorage.setItem("admin-token", newToken);
    localStorage.setItem("admin-user", JSON.stringify(newAdmin));
    setToken(newToken);
    setAdmin(newAdmin);
  };

  return (
    <AdminAuthContext.Provider value={{ admin, token, login, logout, isLoading }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
