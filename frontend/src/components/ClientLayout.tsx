"use client";

import { ReactNode, Suspense } from "react";
import { CartProvider } from "@/contexts/CartContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <Suspense fallback={<div className="h-20 bg-[#131313]" />}>
        <Header />
      </Suspense>
      <main className="flex-1">{children}</main>
      <Footer />
    </CartProvider>
  );
}
