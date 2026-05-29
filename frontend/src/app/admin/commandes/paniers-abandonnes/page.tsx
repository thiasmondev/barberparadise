"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import AdminOrdersTabs from "@/components/admin/AdminOrdersTabs";
import {
  getAdminAbandonedCarts,
  type AdminAbandonedCartItem,
} from "@/lib/admin-api";
import { ShoppingCart } from "lucide-react";

function formatMoney(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AdminAbandonedCartsPage() {
  const [carts, setCarts] = useState<AdminAbandonedCartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadCarts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAdminAbandonedCarts();
      setCarts(data.carts);
    } catch (err: any) {
      setError(err.message || "Erreur lors du chargement des paniers abandonnés");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCarts();
  }, [loadCarts]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading font-bold text-xl text-dark-800">Commandes</h1>
        <p className="text-sm text-gray-500">Sessions avec panier non converti depuis plus d’une heure</p>
      </div>
      <AdminOrdersTabs />

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Chargement des paniers abandonnés...</div>
        ) : carts.length === 0 ? (
          <div className="px-4 py-16 text-center text-gray-400">
            <ShoppingCart size={36} className="mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-dark-700">Aucun panier abandonné</p>
            <p className="mt-1 text-sm text-gray-500">Les paniers non convertis de plus d’une heure apparaîtront ici.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Email client</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Produits</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Articles</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Montant</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Date d’abandon</th>
                </tr>
              </thead>
              <tbody>
                {carts.map((cart) => (
                  <tr key={cart.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-dark-800">{cart.email}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <div className="max-w-md truncate" title={cart.products.join(", ") || "—"}>
                        {cart.products.join(", ") || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{cart.itemCount}</td>
                    <td className="px-4 py-3 font-medium text-dark-800">{formatMoney(cart.total)}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(cart.abandonedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
