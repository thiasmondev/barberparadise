"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Customer } from "@/types";
import {
  CUSTOMER_TOKEN_KEY,
  customerLogin,
  customerRegister,
  getCustomerMe,
  getProStatus,
  type ProAccount,
  type RegisterData,
} from "@/lib/customer-api";

interface CustomerAuthContextValue {
  customer: Customer | null;
  proAccount: ProAccount | null;
  isApprovedPro: boolean;
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
  const [proAccount, setProAccount] = useState<ProAccount | null>(null);
  const [isApprovedPro, setIsApprovedPro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const clearProStatus = useCallback(() => {
    setProAccount(null);
    setIsApprovedPro(false);
  }, []);

  const refreshProStatus = useCallback(async () => {
    try {
      const status = await getProStatus();
      setProAccount(status.proAccount);
      setIsApprovedPro(status.isApprovedPro);
    } catch {
      clearProStatus();
    }
  }, [clearProStatus]);

  const logout = useCallback(() => {
    localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    setCustomer(null);
    clearProStatus();
  }, [clearProStatus]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateCustomer() {
      const token = localStorage.getItem(CUSTOMER_TOKEN_KEY);

      if (!token || isTokenExpired(token)) {
        if (token) localStorage.removeItem(CUSTOMER_TOKEN_KEY);
        if (!cancelled) {
          clearProStatus();
          setIsLoading(false);
        }
        return;
      }

      try {
        const profile = await getCustomerMe(token);
        if (!cancelled) {
          setCustomer(profile);
          await refreshProStatus();
        }
      } catch {
        localStorage.removeItem(CUSTOMER_TOKEN_KEY);
        if (!cancelled) {
          setCustomer(null);
          clearProStatus();
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    hydrateCustomer();

    return () => {
      cancelled = true;
    };
  }, [clearProStatus, refreshProStatus]);

  useEffect(() => {
    const handleSessionExpired = () => logout();
    window.addEventListener("customer-session-expired", handleSessionExpired);
    return () => window.removeEventListener("customer-session-expired", handleSessionExpired);
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await customerLogin(email, password);
    localStorage.setItem(CUSTOMER_TOKEN_KEY, response.token);
    setCustomer(response.user);
    await refreshProStatus();
  }, [refreshProStatus]);

  const register = useCallback(async (data: RegisterData) => {
    const response = await customerRegister(data);
    localStorage.setItem(CUSTOMER_TOKEN_KEY, response.token);
    setCustomer(response.user);
    clearProStatus();
  }, [clearProStatus]);

  return (
    <CustomerAuthContext.Provider
      value={{
        customer,
        proAccount,
        isApprovedPro,
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
