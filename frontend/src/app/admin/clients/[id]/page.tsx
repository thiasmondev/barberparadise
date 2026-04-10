"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getAdminCustomer } from "@/lib/admin-api";
import type { Customer } from "@/types";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  ShoppingCart,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  AlertCircle,
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
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function CustomerDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getAdminCustomer(id)
      .then(setCustomer)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

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

  if (!customer) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Client non trouvé</p>
        <Link href="/admin/clients" className="text-primary text-sm hover:underline mt-2 inline-block">
          ← Retour aux clients
        </Link>
      </div>
    );
  }

  const totalSpent = customer.orders?.reduce((sum, o) => sum + o.total, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/clients" className="p-2 text-gray-400 hover:text-dark-800 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-heading font-bold text-xl text-dark-800">
            {customer.firstName} {customer.lastName}
          </h1>
          <p className="text-sm text-gray-500">Fiche client</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Customer info */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-lg">
                {customer.firstName?.charAt(0)}{customer.lastName?.charAt(0)}
              </div>
              <div>
                <div className="font-heading font-semibold text-dark-800">{customer.firstName} {customer.lastName}</div>
                <div className="text-xs text-gray-400">Client depuis {formatDate(customer.createdAt)}</div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <Mail size={14} className="text-gray-400" />
                {customer.email}
              </div>
              {customer.phone && (
                <div className="flex items-center gap-2.5 text-sm text-gray-600">
                  <Phone size={14} className="text-gray-400" />
                  {customer.phone}
                </div>
              )}
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <Calendar size={14} className="text-gray-400" />
                Inscrit le {formatDate(customer.createdAt)}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              <div className="text-2xl font-heading font-bold text-dark-800">{customer._count?.orders || customer.orders?.length || 0}</div>
              <div className="text-xs text-gray-500 mt-0.5">Commandes</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              <div className="text-2xl font-heading font-bold text-dark-800">{formatPrice(totalSpent)}</div>
              <div className="text-xs text-gray-500 mt-0.5">Total dépensé</div>
            </div>
          </div>

          {/* Addresses */}
          {customer.addresses && customer.addresses.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-heading font-semibold text-sm text-dark-800 mb-3">Adresses</h3>
              <div className="space-y-3">
                {customer.addresses.map((addr) => (
                  <div key={addr.id} className="flex items-start gap-2 text-sm text-gray-600">
                    <MapPin size={14} className="text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <div>{addr.address}</div>
                      <div>{addr.postalCode} {addr.city}, {addr.country}</div>
                      {addr.isDefault && (
                        <span className="text-xs text-primary font-medium">Adresse par défaut</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Orders */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-heading font-semibold text-sm text-dark-800">
                Historique des commandes ({customer.orders?.length || 0})
              </h2>
            </div>
            {!customer.orders || customer.orders.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <ShoppingCart size={32} className="mx-auto mb-2 text-gray-300" />
                Aucune commande
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {customer.orders.map((order) => {
                  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                  return (
                    <Link
                      key={order.id}
                      href={`/admin/commandes/${order.id}`}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/50 transition-colors"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cfg.color}`}>
                        <cfg.icon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-dark-800">
                          #{order.orderNumber || order.id.slice(-8)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {formatDate(order.createdAt)} · {order.items?.length || 0} article{(order.items?.length || 0) !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <span className="text-sm font-semibold text-dark-800 tabular-nums">
                        {formatPrice(order.total)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
