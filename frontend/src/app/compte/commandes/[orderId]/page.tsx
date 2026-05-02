"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, PackageCheck, ShoppingBag } from "lucide-react";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { getCustomerOrder } from "@/lib/customer-api";
import { formatPrice } from "@/lib/utils";
import type { Order } from "@/types";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: "EN ATTENTE", className: "bg-zinc-700 text-zinc-100" },
  pending_payment: { label: "EN ATTENTE", className: "bg-zinc-700 text-zinc-100" },
  paid: { label: "PAYÉ", className: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30" },
  processing: { label: "PAYÉ", className: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30" },
  shipped: { label: "EXPÉDIÉ", className: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30" },
  delivered: { label: "EXPÉDIÉ", className: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30" },
  cancelled: { label: "ANNULÉ", className: "bg-red-500/15 text-red-300 ring-1 ring-red-500/30" },
};

const PAYMENT_LABELS: Record<string, string> = {
  card: "CARTE BANCAIRE",
  cb: "CARTE BANCAIRE",
  checkout: "CARTE BANCAIRE",
  paypal: "PAYPAL 4X SANS FRAIS",
  paypal_4x: "PAYPAL 4X SANS FRAIS",
  bank_transfer: "VIREMENT BANCAIRE",
  virement: "VIREMENT BANCAIRE",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getPaymentLabel(order: Order): string {
  const method = order.paymentMethod?.toLowerCase() || order.paymentProvider?.toLowerCase() || "";
  return PAYMENT_LABELS[method] || order.paymentMethod || order.paymentProvider || "Non renseignée";
}

function DetailRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 border-t border-white/10 py-4 first:border-t-0 ${highlight ? "text-white" : "text-white/70"}`}>
      <span className="text-[11px] font-black uppercase tracking-[0.18em]">{label}</span>
      <span className={`text-right ${highlight ? "text-xl font-black" : "text-sm font-bold"}`}>{value}</span>
    </div>
  );
}

function LoadingState() {
  return (
    <section className="min-h-[calc(100vh-160px)] bg-[#0b0b0b] px-6 py-20 text-white">
      <div className="mx-auto flex max-w-4xl items-center justify-center gap-3 border border-white/10 bg-[#131313] p-10 text-white/60">
        <Loader2 className="animate-spin text-[#E91E8C]" size={22} /> Chargement du détail de commande...
      </div>
    </section>
  );
}

export default function CustomerOrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useCustomerAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [isFetching, setIsFetching] = useState(true);

  const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(`/connexion?redirect=/compte/commandes/${orderId}`);
    }
  }, [isAuthenticated, isLoading, orderId, router]);

  useEffect(() => {
    if (!isAuthenticated || !orderId) return;

    let cancelled = false;
    async function loadOrder() {
      setIsFetching(true);
      setError("");
      try {
        const data = await getCustomerOrder(orderId);
        if (!cancelled) setOrder(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Impossible de charger cette commande.");
      } finally {
        if (!cancelled) setIsFetching(false);
      }
    }

    loadOrder();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, orderId]);

  const finance = useMemo(() => {
    if (!order) return null;
    const shipping = order.shipping ?? 0;
    const totalTTC = order.totalTTC ?? order.total ?? 0;
    const vatRate = order.vatRate ?? 20;
    const subtotalHT = order.totalHT ?? Math.max((totalTTC - shipping) / (1 + vatRate / 100), 0);
    const vatAmount = order.vatAmount ?? subtotalHT * (vatRate / 100);
    return { subtotalHT, vatRate, vatAmount, shipping, totalTTC };
  }, [order]);

  if (isLoading || (!isAuthenticated && !error)) return <LoadingState />;

  const status = order ? STATUS_CONFIG[order.status] || { label: order.status.toUpperCase(), className: "bg-zinc-700 text-zinc-100" } : null;

  return (
    <section className="min-h-[calc(100vh-160px)] bg-[#0b0b0b] px-4 py-10 text-white sm:px-6 lg:py-14">
      <div className="mx-auto max-w-6xl">
        <Link href="/compte?tab=commandes" className="mb-6 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-white/55 transition hover:text-[#E91E8C]">
          <ArrowLeft size={16} /> Retour à mes commandes
        </Link>

        {isFetching ? <LoadingState /> : error || !order || !finance ? (
          <div className="border border-red-500/25 bg-red-500/10 p-8 text-red-100">
            <h1 className="text-2xl font-black uppercase">Commande introuvable</h1>
            <p className="mt-3 text-sm text-red-100/80">{error || "Cette commande n’existe pas ou n’est pas associée à votre compte."}</p>
            <Link href="/compte?tab=commandes" className="mt-6 inline-flex bg-[#E91E8C] px-6 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white">Retour à mes commandes</Link>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="border border-white/10 bg-[#131313] p-6 sm:p-8">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.35em] text-[#E91E8C]">Détail de commande</p>
                  <h1 className="mt-4 text-3xl font-black uppercase sm:text-4xl">Commande {order.orderNumber}</h1>
                  <p className="mt-3 text-sm text-white/50">Passée le {formatDate(order.createdAt)}</p>
                </div>
                {status && <span className={`w-fit px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] ${status.className}`}>{status.label}</span>}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <div className="space-y-6">
                <div className="border border-white/10 bg-[#131313] p-6 sm:p-8">
                  <div className="mb-6 flex items-center gap-3">
                    <PackageCheck className="text-[#E91E8C]" size={18} />
                    <h2 className="text-sm font-black uppercase tracking-[0.25em]">Produits commandés</h2>
                  </div>

                  <div className="space-y-4">
                    {order.items.map((item) => (
                      <div key={item.id} className="grid gap-4 border-t border-white/10 pt-4 first:border-t-0 first:pt-0 sm:grid-cols-[72px_1fr_auto] sm:items-center">
                        <div className="relative h-18 w-18 overflow-hidden bg-black/30 sm:h-[72px] sm:w-[72px]">
                          {item.image ? <Image src={item.image} alt={item.name} fill className="object-contain p-2" /> : <ShoppingBag className="absolute inset-0 m-auto text-white/25" size={22} />}
                        </div>
                        <div>
                          <h3 className="font-black text-white">{item.name}</h3>
                          <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-white/45">Quantité {item.quantity} · Prix unitaire {formatPrice(item.price)}</p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Sous-total</p>
                          <p className="mt-1 text-lg font-black">{formatPrice(item.price * item.quantity)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-white/10 bg-[#131313] p-6 sm:p-8">
                  <h2 className="text-sm font-black uppercase tracking-[0.25em]">Adresse de livraison</h2>
                  {order.shippingAddress ? (
                    <div className="mt-6 text-sm leading-7 text-white/70">
                      <p className="font-black text-white">{order.shippingAddress.firstName} {order.shippingAddress.lastName}</p>
                      <p>{order.shippingAddress.address}</p>
                      {order.shippingAddress.extension && <p>{order.shippingAddress.extension}</p>}
                      <p>{order.shippingAddress.postalCode} {order.shippingAddress.city}</p>
                      <p>{order.shippingAddress.country}</p>
                      {order.shippingAddress.phone && <p className="mt-2 text-white/50">Téléphone : {order.shippingAddress.phone}</p>}
                    </div>
                  ) : <p className="mt-6 text-sm text-white/45">Adresse de livraison non renseignée.</p>}
                </div>
              </div>

              <aside className="space-y-6">
                <div className="border border-white/10 bg-[#131313] p-6 sm:p-8">
                  <h2 className="text-sm font-black uppercase tracking-[0.25em]">Récapitulatif financier</h2>
                  <div className="mt-6">
                    <DetailRow label="Sous-total HT" value={formatPrice(finance.subtotalHT)} />
                    <DetailRow label={`TVA ${finance.vatRate}%`} value={formatPrice(finance.vatAmount)} />
                    <DetailRow label="Frais de livraison" value={formatPrice(finance.shipping)} />
                    <DetailRow label="Total TTC" value={formatPrice(finance.totalTTC)} highlight />
                  </div>
                </div>

                <div className="border border-white/10 bg-[#131313] p-6 sm:p-8">
                  <h2 className="text-sm font-black uppercase tracking-[0.25em]">Méthode de paiement</h2>
                  <p className="mt-5 text-lg font-black uppercase text-white">{getPaymentLabel(order)}</p>
                </div>

                <Link href="/compte?tab=commandes" className="flex w-full items-center justify-center bg-[#E91E8C] px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-[#ff4a9f]">
                  Retour à mes commandes
                </Link>
              </aside>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
