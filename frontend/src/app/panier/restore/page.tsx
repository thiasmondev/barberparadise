"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ShoppingBag } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import type { CartItem } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://barberparadise-backend.onrender.com";

type RestoreResponse = {
  cart?: {
    id: string;
    email?: string | null;
    total: number;
    expiresAt: string;
    items: CartItem[];
  };
  error?: string;
};

function RestoreContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { replaceItems } = useCart();
  const [status, setStatus] = useState<"loading" | "error" | "unsubscribed">("loading");
  const [message, setMessage] = useState("Restauration de votre panier en cours...");

  useEffect(() => {
    const token = searchParams.get("token");
    const unsubscribe = searchParams.get("unsubscribe");
    const controller = new AbortController();

    async function run() {
      try {
        if (unsubscribe) {
          const response = await fetch(`${API_URL}/api/checkout/abandoned-cart/unsubscribe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: unsubscribe }),
            signal: controller.signal,
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || "Impossible de confirmer la désinscription.");
          setStatus("unsubscribed");
          setMessage("Vous ne recevrez plus de relance pour ce panier. Cette désinscription n’affecte pas vos autres communications Barber Paradise.");
          return;
        }

        if (!token) throw new Error("Lien de restauration incomplet.");

        const response = await fetch(`${API_URL}/api/checkout/abandoned-cart/restore?token=${encodeURIComponent(token)}`, {
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => ({}))) as RestoreResponse;
        if (!response.ok || !data.cart) throw new Error(data.error || "Impossible de restaurer ce panier.");

        replaceItems(data.cart.items);
        window.localStorage.setItem("barberparadise-restored-cart", JSON.stringify({
          restoredAt: new Date().toISOString(),
          expiresAt: data.cart.expiresAt,
          email: data.cart.email || null,
        }));
        router.replace("/panier?restored=1");
      } catch (error) {
        if (controller.signal.aborted) return;
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Impossible de traiter ce lien.");
      }
    }

    run();
    return () => controller.abort();
  }, [replaceItems, router, searchParams]);

  return (
    <main className="min-h-screen bg-cream-50 px-4 py-16">
      <div className="mx-auto max-w-xl rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary-600">
          {status === "loading" ? <Loader2 className="animate-spin" size={26} /> : <ShoppingBag size={26} />}
        </div>
        <h1 className="font-heading text-2xl font-bold text-dark-800">
          {status === "unsubscribed" ? "Désinscription confirmée" : status === "error" ? "Lien indisponible" : "Panier Barber Paradise"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">{message}</p>
        {status !== "loading" && (
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/" className="rounded-full border border-gray-200 px-5 py-2.5 text-sm font-semibold text-dark-800 hover:bg-gray-50">
              Retour boutique
            </Link>
            {status === "error" && (
              <Link href="/panier" className="rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700">
                Voir mon panier
              </Link>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

export default function RestoreAbandonedCartPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-cream-50 px-4 py-16 text-center text-gray-500">Chargement...</main>}>
      <RestoreContent />
    </Suspense>
  );
}
