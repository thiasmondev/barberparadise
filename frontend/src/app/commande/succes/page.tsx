"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CheckCircle2, PackageCheck, ShoppingBag } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { formatPrice } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://barberparadise-backend.onrender.com";

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  image?: string | null;
};

type OrderDetails = {
  id: string;
  orderNumber?: string | null;
  status?: string | null;
  total?: number | null;
  totalTTC?: number | null;
  items?: OrderItem[];
};

export default function OrderSuccessPage() {
  const { clearCart } = useCart();
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("orderId") || "";
    setOrderId(id);
    if (!id) return;

    const controller = new AbortController();
    async function loadOrder() {
      setIsLoading(true);
      setError("");
      try {
        const response = await fetch(`${API_URL}/api/orders/${id}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Impossible de charger la commande");
        setOrder(data);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Erreur de chargement de commande");
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    loadOrder();
    return () => controller.abort();
  }, []);

  const displayNumber = order?.orderNumber || orderId || "commande";
  const total = useMemo(() => order?.totalTTC ?? order?.total ?? 0, [order]);

  return (
    <div className="bg-[#131313] min-h-screen text-[#e5e2e1] px-4 py-16">
      <div className="max-w-3xl mx-auto">
        <div className="bg-[#1c1b1b] border border-white/10 p-8 md:p-12">
          <div className="flex items-center gap-3 text-[#ff4a8d] mb-6">
            <CheckCircle2 size={24} />
            <span className="text-[10px] font-black tracking-[0.35em] uppercase">Paiement validé</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-black tracking-tighter italic uppercase mb-4">
            Commande confirmée ✓
          </h1>
          <p className="text-sm text-gray-400 leading-relaxed mb-8">
            Votre paiement a été pris en compte par le prestataire. Vous pouvez retrouver le suivi de votre commande depuis votre espace client.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            <div className="border border-white/10 bg-[#131313] p-5">
              <p className="text-[10px] text-gray-500 font-black tracking-[0.3em] uppercase mb-2">Numéro de commande</p>
              <p className="text-lg font-black text-white">{displayNumber}</p>
            </div>
            <div className="border border-white/10 bg-[#131313] p-5">
              <p className="text-[10px] text-gray-500 font-black tracking-[0.3em] uppercase mb-2">Total</p>
              <p className="text-lg font-black text-white">{total ? formatPrice(total) : "En cours"}</p>
            </div>
          </div>

          <div className="border border-white/10 bg-[#131313] p-5 mb-8">
            <div className="flex items-center gap-3 mb-5">
              <PackageCheck size={16} className="text-[#ff4a8d]" />
              <h2 className="text-xs font-black tracking-[0.3em] uppercase">Récapitulatif produits</h2>
            </div>

            {isLoading && <p className="text-xs text-gray-500 uppercase tracking-widest">Chargement de la commande...</p>}
            {error && <p className="text-xs text-amber-200 leading-relaxed">{error}. Le paiement reste confirmé si le prestataire vous a affiché la validation.</p>}
            {!isLoading && !error && (!order?.items || order.items.length === 0) && (
              <p className="text-xs text-gray-500 uppercase tracking-widest">Le récapitulatif sera visible dans votre espace client.</p>
            )}
            <div className="space-y-4">
              {order?.items?.map((item) => (
                <div key={item.id} className="flex items-center gap-4 border-t border-white/5 pt-4 first:border-t-0 first:pt-0">
                  <div className="w-14 h-14 bg-[#242222] flex-shrink-0 relative overflow-hidden">
                    {item.image ? <Image src={item.image} alt={item.name} fill className="object-contain p-1.5" /> : <ShoppingBag size={18} className="absolute inset-0 m-auto text-gray-700" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white truncate">{item.name}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Quantité {item.quantity}</p>
                  </div>
                  <p className="text-sm font-black">{formatPrice(item.price * item.quantity)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/compte?tab=commandes" className="flex-1 flex items-center justify-center gap-3 bg-[#ff4a8d] hover:bg-[#ff1f70] text-white py-5 text-xs font-black tracking-widest uppercase transition-colors">
              Voir mes commandes
              <ArrowRight size={14} />
            </Link>
            <Link href="/catalogue" className="flex-1 flex items-center justify-center border border-white/10 hover:border-white/25 py-5 text-xs font-black tracking-widest uppercase transition-colors">
              Continuer mes achats
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
