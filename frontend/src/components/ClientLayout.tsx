"use client";

import { ReactNode, Suspense, useEffect, useRef } from "react";
import { CartProvider, useCart } from "@/contexts/CartContext";
import { CustomerAuthProvider, useCustomerAuth } from "@/contexts/CustomerAuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import BarbaraChatbot from "@/components/BarbaraChatbot";

/**
 * Pont entre CustomerAuthContext et CartContext.
 * Ce composant est rendu à l'intérieur de CustomerAuthProvider (qui est lui-même
 * à l'intérieur de CartProvider), ce qui lui permet d'accéder aux deux contextes.
 *
 * Objectif : quand un client se connecte, envoyer son email au backend pour enrichir
 * la session panier abandonnée — même si le client n'a pas encore atteint l'étape
 * "contact" du checkout. Sans ce pont, les paniers des clients connectés apparaissent
 * avec "Email non renseigné" dans l'onglet admin Paniers abandonnés.
 */
function CartEmailBridge() {
  const { customer, isLoading } = useCustomerAuth();
  const { cartSessionId, updateCartEmail, rotateCartSession } = useCart();
  const previousIdentityRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    // Le null initial de l'auth est encore inconnu, pas une déconnexion.
    if (isLoading || !cartSessionId) return;
    const identity = customer ? `${customer.id}:${customer.email.trim().toLowerCase()}` : null;
    const previousIdentity = previousIdentityRef.current;
    previousIdentityRef.current = identity;

    if (previousIdentity !== undefined && previousIdentity !== identity) {
      // Les articles restent présents, mais l'ancien client garde son ancienne session.
      rotateCartSession();
    }

    if (customer?.email) {
      updateCartEmail(customer.email);
    }
  }, [customer, isLoading, cartSessionId, rotateCartSession, updateCartEmail]);

  return null;
}

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <CustomerAuthProvider>
        {/* Pont silencieux : synchronise l'email du client connecté avec la session panier */}
        <CartEmailBridge />
        <Suspense fallback={<div className="h-20 bg-[#131313]" />}>
          <Header />
        </Suspense>
        <Suspense fallback={<main className="flex-1 min-h-screen bg-light-50" />}>
          <main className="flex-1 pt-20 md:pt-0">{children}</main>
        </Suspense>
        <Footer />
        <BarbaraChatbot />
        <CookieConsentBanner />
      </CustomerAuthProvider>
    </CartProvider>
  );
}
