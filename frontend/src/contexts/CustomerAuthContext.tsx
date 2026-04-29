"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Customer } from "@/types";
import {
  CUSTOMER_TOKEN_KEY,
  customerLogin,
  customerRegister,
  getCustomerMe,
  type RegisterData,
} from "@/lib/customer-api";

interface CustomerAuthContextValue {
  customer: Customer | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (data: RegisterData) => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | undefined>(undefined);

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return typeof payload.exp === "number" && Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    setCustomer(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateCustomer() {
      const token = localStorage.getItem(CUSTOMER_TOKEN_KEY);

      if (!token || isTokenExpired(token)) {
        if (token) localStorage.removeItem(CUSTOMER_TOKEN_KEY);
        if (!cancelled) setIsLoading(false);
        return;
      }

      try {
        const profile = await getCustomerMe(token);
        if (!cancelled) setCustomer(profile);
      } catch {
        localStorage.removeItem(CUSTOMER_TOKEN_KEY);
        if (!cancelled) setCustomer(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    hydrateCustomer();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleSessionExpired = () => logout();
    window.addEventListener("customer-session-expired", handleSessionExpired);
    return () => window.removeEventListener("customer-session-expired", handleSessionExpired);
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await customerLogin(email, password);
    localStorage.setItem(CUSTOMER_TOKEN_KEY, response.token);
    setCustomer(response.user);
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    const response = await customerRegister(data);
    localStorage.setItem(CUSTOMER_TOKEN_KEY, response.token);
    setCustomer(response.user);
  }, []);

  return (
    <CustomerAuthContext.Provider
      value={{
        customer,
        isAuthenticated: Boolean(customer),
        isLoading,
        login,
        logout,
        register,
      }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (!context) throw new Error("useCustomerAuth must be used within CustomerAuthProvider");
  return context;
}
