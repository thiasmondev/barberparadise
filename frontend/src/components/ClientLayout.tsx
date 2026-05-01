"use client";

import { ReactNode, Suspense } from "react";
import { CartProvider } from "@/contexts/CartContext";
import { CustomerAuthProvider } from "@/contexts/CustomerAuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <CustomerAuthProvider>
        <Suspense fallback={<div className="h-20 bg-[#131313]" />}>
          <Header />
        </Suspense>
        <Suspense fallback={<main className="flex-1 min-h-screen bg-light-50" />}>
          <main className="flex-1">{children}</main>
        </Suspense>
        <Footer />
      </CustomerAuthProvider>
    </CartProvider>
  );
}
