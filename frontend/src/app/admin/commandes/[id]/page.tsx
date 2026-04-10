"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getAdminOrder, updateOrderStatus } from "@/lib/admin-api";
import type { Order } from "@/types";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  AlertCircle,
  MapPin,
  Mail,
  Package,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "En attente", color: "text-yellow-600 bg-yellow-50", icon: Clock },
  processing: { label: "En cours", color: "text-blue-600 bg-blue-50", icon: AlertCircle },
  shipped: { label: "Expédiée", color: "text-purple-600 bg-purple-50", icon: Truck },
  delivered: { label: "Livrée", color: "text-green-600 bg-green-50", icon: CheckCircle },
  cancelled: { label: "Annulée", color: "text-red-600 bg-red-50", icon: XCircle },
};

function formatPrice(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function OrderDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!id) return;
    getAdminOrder(id)
      .then(setOrder)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatusChange = async (newStatus: string) => {
    if (!order) return;
    setUpdating(true);
    try {
      await updateOrderStatus(order.id, newStatus);
      setOrder({ ...order, status: newStatus });
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-100 rounded w-48 animate-pulse" />
        <div className="bg-white rounded-xl p-6 animate-pulse space-y-4">
          <div className="h-6 bg-gray-100 rounded w-32" />
          <div className="h-4 bg-gray-100 rounded w-64" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Commande non trouvée</p>
        <Link href="/admin/commandes" className="text-primary text-sm hover:underline mt-2 inline-block">
          ← Retour aux commandes
        </Link>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/commandes" className="p-2 text-gray-400 hover:text-dark-800 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-heading font-bold text-xl text-dark-800">
            Commande #{order.orderNumber || order.id.slice(-8)}
          </h1>
          <p className="text-sm text-gray-500">{formatDate(order.createdAt)}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Order details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${cfg.color}`}>
                  <cfg.icon size={18} />
                </div>
                <div>
                  <div className="text-sm font-medium text-dark-800">Statut de la commande</div>
                  <div className={`text-sm font-semibold ${cfg.color.split(" ")[0]}`}>{cfg.label}</div>
                </div>
              </div>
              <select
                value={order.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={updating}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary disabled:opacity-50"
              >
                {Object.entries(STATUS_CONFIG).map(([val, c]) => (
                  <option key={val} value={val}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Items */}
          <div className="bg-white rounded-xl border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-heading font-semibold text-sm text-dark-800">Articles ({order.items.length})</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                    {item.image ? (
                      <img src={item.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <Package size={16} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-dark-800 truncate">{item.name}</div>
                    <div className="text-xs text-gray-400">Qté: {item.quantity} × {formatPrice(item.price)}</div>
                  </div>
                  <div className="text-sm font-semibold text-dark-800 tabular-nums">
                    {formatPrice(item.price * item.quantity)}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Sous-total</span>
                <span className="text-dark-700">{formatPrice(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Livraison</span>
                <span className="text-dark-700">{order.shipping === 0 ? "Gratuite" : formatPrice(order.shipping)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-gray-100">
                <span className="text-dark-800">Total</span>
                <span className="text-dark-800">{formatPrice(order.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-heading font-semibold text-sm text-dark-800 mb-3">Client</h3>
            {order.customer ? (
              <div className="space-y-2">
                <div className="text-sm text-dark-700">{order.customer.firstName} {order.customer.lastName}</div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Mail size={12} /> {order.customer.email || order.email}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Mail size={12} /> {order.email}
              </div>
            )}
          </div>

          {/* Shipping address */}
          {order.shippingAddress && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-heading font-semibold text-sm text-dark-800 mb-3">Adresse de livraison</h3>
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <MapPin size={14} className="text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <div>{order.shippingAddress.firstName} {order.shippingAddress.lastName}</div>
                  <div>{order.shippingAddress.address}</div>
                  <div>{order.shippingAddress.postalCode} {order.shippingAddress.city}</div>
                  <div>{order.shippingAddress.country}</div>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-heading font-semibold text-sm text-dark-800 mb-3">Notes</h3>
              <p className="text-sm text-gray-600">{order.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
