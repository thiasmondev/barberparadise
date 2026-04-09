// ============================================================
// BARBER PARADISE — Panel d'Administration
// Couleurs: Primary #4EAADB | Secondary #252525
// Design: Interface admin professionnelle avec sidebar
// ============================================================

import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard, Package, ShoppingCart, Users, FileText,
  Star, LogOut, Menu, X, TrendingUp, AlertCircle, CheckCircle,
  Clock, Truck, XCircle, Edit2, Trash2, Plus, Search, Eye,
  ChevronDown, ChevronUp, RefreshCw, Save, ArrowLeft
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────
interface AdminStats {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  totalProducts: number;
  revenueGrowth: number;
  ordersGrowth: number;
  pendingOrders: number;
  lowStockProducts: number;
}

interface AdminProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  price: number;
  originalPrice?: number;
  stock: number;
  isActive: boolean;
  images: string[];
  description: string;
}

interface AdminOrder {
  id: string;
  createdAt: string;
  status: string;
  total: number;
  customer: { firstName: string; lastName: string; email: string } | null;
  guestEmail?: string;
  itemCount: number;
}

interface AdminCustomer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  orderCount: number;
  totalSpent: number;
}

// ─── API Admin ────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

function getAdminToken() {
  return localStorage.getItem("bp_admin_token");
}

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Erreur serveur" }));
    throw new Error(err.message || `Erreur ${res.status}`);
  }
  return res.json();
}

// ─── Composants utilitaires ───────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    pending:    { label: "En attente",   className: "bg-yellow-100 text-yellow-800", icon: <Clock size={12} /> },
    processing: { label: "En cours",     className: "bg-blue-100 text-blue-800",    icon: <RefreshCw size={12} /> },
    shipped:    { label: "Expédié",      className: "bg-purple-100 text-purple-800", icon: <Truck size={12} /> },
    delivered:  { label: "Livré",        className: "bg-green-100 text-green-800",  icon: <CheckCircle size={12} /> },
    cancelled:  { label: "Annulé",       className: "bg-red-100 text-red-800",      icon: <XCircle size={12} /> },
  };
  const c = config[status] || { label: status, className: "bg-gray-100 text-gray-800", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${c.className}`}>
      {c.icon} {c.label}
    </span>
  );
};

// ─── Vues Admin ───────────────────────────────────────────────

// Dashboard
function DashboardView({ stats }: { stats: AdminStats | null }) {
  if (!stats) return <div className="flex items-center justify-center h-64"><RefreshCw className="animate-spin text-primary" /></div>;

  const cards = [
    { label: "Chiffre d'affaires", value: `${stats.totalRevenue.toFixed(2)} €`, growth: stats.revenueGrowth, icon: <TrendingUp size={24} />, color: "text-green-600" },
    { label: "Commandes totales", value: stats.totalOrders, growth: stats.ordersGrowth, icon: <ShoppingCart size={24} />, color: "text-blue-600" },
    { label: "Clients", value: stats.totalCustomers, growth: null, icon: <Users size={24} />, color: "text-purple-600" },
    { label: "Produits actifs", value: stats.totalProducts, growth: null, icon: <Package size={24} />, color: "text-orange-600" },
  ];

  return (
    <div>
      <h2 className="text-2xl font-black uppercase mb-6" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
        Tableau de Bord
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {cards.map((card, i) => (
          <div key={i} className="bg-white border border-gray-200 p-5 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500 font-medium">{card.label}</span>
              <span className={card.color}>{card.icon}</span>
            </div>
            <p className="text-3xl font-black text-gray-900" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              {card.value}
            </p>
            {card.growth !== null && (
              <p className={`text-xs mt-1 font-semibold ${card.growth >= 0 ? "text-green-600" : "text-red-600"}`}>
                {card.growth >= 0 ? "+" : ""}{card.growth}% ce mois
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 p-5 rounded-lg">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <AlertCircle size={18} className="text-yellow-500" /> Alertes
          </h3>
          <div className="space-y-3">
            {stats.pendingOrders > 0 && (
              <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded">
                <span className="text-sm text-yellow-800">{stats.pendingOrders} commande(s) en attente</span>
                <Clock size={16} className="text-yellow-600" />
              </div>
            )}
            {stats.lowStockProducts > 0 && (
              <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded">
                <span className="text-sm text-red-800">{stats.lowStockProducts} produit(s) en rupture de stock</span>
                <AlertCircle size={16} className="text-red-600" />
              </div>
            )}
            {stats.pendingOrders === 0 && stats.lowStockProducts === 0 && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded">
                <CheckCircle size={16} className="text-green-600" />
                <span className="text-sm text-green-800">Tout est en ordre !</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-lg">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-primary" /> Résumé
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Commandes en attente</span>
              <span className="font-bold text-yellow-600">{stats.pendingOrders}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Produits en rupture</span>
              <span className="font-bold text-red-600">{stats.lowStockProducts}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total clients</span>
              <span className="font-bold text-gray-800">{stats.totalCustomers}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Panier moyen</span>
              <span className="font-bold text-gray-800">
                {stats.totalOrders > 0 ? (stats.totalRevenue / stats.totalOrders).toFixed(2) : "0.00"} €
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Produits
function ProductsView() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const PER_PAGE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PER_PAGE), search });
      const data = await adminFetch<{ products: AdminProduct[]; total: number }>(`/admin/products?${params}`, {}, );
      setProducts(data.products);
      setTotal(data.total);
    } catch (e: any) {
      toast.error("Erreur chargement produits : " + e.message);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Supprimer "${name}" ?`)) return;
    try {
      await adminFetch(`/admin/products/${id}`, { method: "DELETE" });
      toast.success("Produit supprimé");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleToggleActive = async (product: AdminProduct) => {
    try {
      await adminFetch(`/admin/products/${product.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !product.isActive }),
      });
      toast.success(product.isActive ? "Produit désactivé" : "Produit activé");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (editingProduct) {
    return <ProductEditForm product={editingProduct} onBack={() => { setEditingProduct(null); load(); }} />;
  }

  if (showAddForm) {
    return <ProductEditForm product={null} onBack={() => { setShowAddForm(false); load(); }} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
          Produits ({total})
        </h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded font-semibold text-sm hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} /> Ajouter un produit
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un produit..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Produit</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Catégorie</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Prix</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Stock</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Statut</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.images?.[0] && (
                          <img src={p.images[0]} alt="" className="w-10 h-10 object-cover rounded border border-gray-200" />
                        )}
                        <div>
                          <p className="font-semibold text-gray-800 line-clamp-1">{p.name}</p>
                          <p className="text-xs text-gray-500">{p.brand}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{p.subcategory || p.category}</td>
                    <td className="px-4 py-3 text-right font-semibold">{p.price.toFixed(2)} €</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${p.stock === 0 ? "text-red-600" : p.stock < 5 ? "text-yellow-600" : "text-green-600"}`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleActive(p)}
                        className={`text-xs font-semibold px-2 py-1 rounded-full transition-colors ${
                          p.isActive ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {p.isActive ? "Actif" : "Inactif"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setEditingProduct(p)}
                          className="p-1.5 text-gray-500 hover:text-primary hover:bg-blue-50 rounded transition-colors"
                          title="Modifier"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id, p.name)}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > PER_PAGE && (
          <div className="flex items-center justify-between p-4 border-t border-gray-200">
            <span className="text-sm text-gray-500">
              {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} sur {total}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-50"
              >
                Précédent
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page * PER_PAGE >= total}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-50"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Formulaire édition produit
function ProductEditForm({ product, onBack }: { product: AdminProduct | null; onBack: () => void }) {
  const isNew = !product;
  const [form, setForm] = useState({
    name: product?.name || "",
    brand: product?.brand || "",
    category: product?.category || "materiel",
    subcategory: product?.subcategory || "",
    price: product?.price || 0,
    originalPrice: product?.originalPrice || "",
    stock: product?.stock || 0,
    description: product?.description || "",
    isActive: product?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isNew) {
        await adminFetch("/admin/products", { method: "POST", body: JSON.stringify(form) });
        toast.success("Produit créé !");
      } else {
        await adminFetch(`/admin/products/${product!.id}`, { method: "PATCH", body: JSON.stringify(form) });
        toast.success("Produit mis à jour !");
      }
      onBack();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeft size={16} /> Retour aux produits
      </button>
      <h2 className="text-2xl font-black uppercase mb-6" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
        {isNew ? "Nouveau Produit" : "Modifier le Produit"}
      </h2>

      <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-2xl space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Nom du produit *</label>
            <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Marque</label>
            <input type="text" value={form.brand} onChange={e => setForm({...form, brand: e.target.value})}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Sous-catégorie</label>
            <input type="text" value={form.subcategory} onChange={e => setForm({...form, subcategory: e.target.value})}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Prix (€) *</label>
            <input type="number" step="0.01" value={form.price} onChange={e => setForm({...form, price: parseFloat(e.target.value)})}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Prix barré (€)</label>
            <input type="number" step="0.01" value={form.originalPrice} onChange={e => setForm({...form, originalPrice: e.target.value})}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Stock</label>
            <input type="number" value={form.stock} onChange={e => setForm({...form, stock: parseInt(e.target.value)})}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Statut</label>
            <select value={form.isActive ? "active" : "inactive"} onChange={e => setForm({...form, isActive: e.target.value === "active"})}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-primary">
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
            <textarea rows={4} value={form.description} onChange={e => setForm({...form, description: e.target.value})}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none" />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-primary text-white px-6 py-2 rounded font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            {isNew ? "Créer" : "Enregistrer"}
          </button>
          <button onClick={onBack} className="px-6 py-2 border border-gray-300 rounded font-semibold text-sm hover:bg-gray-50">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

// Commandes
function OrdersView() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<any>(null);
  const PER_PAGE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PER_PAGE) });
      if (statusFilter) params.set("status", statusFilter);
      const data = await adminFetch<{ orders: AdminOrder[]; total: number }>(`/admin/orders?${params}`);
      setOrders(data.orders);
      setTotal(data.total);
    } catch (e: any) {
      toast.error("Erreur : " + e.message);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const loadDetail = async (id: string) => {
    if (expandedOrder === id) { setExpandedOrder(null); setOrderDetail(null); return; }
    try {
      const data = await adminFetch<any>(`/admin/orders/${id}`);
      setOrderDetail(data);
      setExpandedOrder(id);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await adminFetch(`/admin/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      toast.success("Statut mis à jour");
      load();
      if (expandedOrder === id) loadDetail(id);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
          Commandes ({total})
        </h2>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-primary"
        >
          <option value="">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="processing">En cours</option>
          <option value="shipped">Expédié</option>
          <option value="delivered">Livré</option>
          <option value="cancelled">Annulé</option>
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32"><RefreshCw className="animate-spin text-primary" /></div>
        ) : (
          <div className="divide-y divide-gray-100">
            {orders.map((order) => (
              <div key={order.id}>
                <div
                  className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => loadDetail(order.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-800 text-sm">#{order.id.slice(-8).toUpperCase()}</span>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : order.guestEmail || "Invité"} •{" "}
                      {new Date(order.createdAt).toLocaleDateString("fr-FR")} • {order.itemCount} article(s)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-gray-900" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                      {order.total.toFixed(2)} €
                    </p>
                  </div>
                  {expandedOrder === order.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>

                {expandedOrder === order.id && orderDetail && (
                  <div className="bg-gray-50 border-t border-gray-200 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <h4 className="font-semibold text-sm text-gray-700 mb-2">Articles</h4>
                        <div className="space-y-1">
                          {orderDetail.items?.map((item: any, i: number) => (
                            <div key={i} className="flex justify-between text-sm">
                              <span className="text-gray-600">{item.productName} x{item.quantity}</span>
                              <span className="font-semibold">{(item.price * item.quantity).toFixed(2)} €</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-gray-700 mb-2">Changer le statut</h4>
                        <div className="flex flex-wrap gap-2">
                          {["pending", "processing", "shipped", "delivered", "cancelled"].map(s => (
                            <button
                              key={s}
                              onClick={() => updateStatus(order.id, s)}
                              className={`text-xs px-3 py-1 rounded-full border font-semibold transition-colors ${
                                order.status === s
                                  ? "bg-primary text-white border-primary"
                                  : "border-gray-300 text-gray-600 hover:border-primary hover:text-primary"
                              }`}
                            >
                              {s === "pending" ? "En attente" : s === "processing" ? "En cours" : s === "shipped" ? "Expédié" : s === "delivered" ? "Livré" : "Annulé"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {total > PER_PAGE && (
          <div className="flex items-center justify-between p-4 border-t border-gray-200">
            <span className="text-sm text-gray-500">{(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} sur {total}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-50">Précédent</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page * PER_PAGE >= total}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-50">Suivant</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Clients
function CustomersView() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PER_PAGE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PER_PAGE), search });
      const data = await adminFetch<{ customers: AdminCustomer[]; total: number }>(`/admin/customers?${params}`);
      setCustomers(data.customers);
      setTotal(data.total);
    } catch (e: any) {
      toast.error("Erreur : " + e.message);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <h2 className="text-2xl font-black uppercase mb-6" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
        Clients ({total})
      </h2>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un client..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32"><RefreshCw className="animate-spin text-primary" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Client</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Commandes</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Total dépensé</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Inscrit le</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          {c.firstName?.[0]}{c.lastName?.[0]}
                        </div>
                        <span className="font-semibold text-gray-800">{c.firstName} {c.lastName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.email}</td>
                    <td className="px-4 py-3 text-right font-semibold">{c.orderCount}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-800">{c.totalSpent?.toFixed(2) || "0.00"} €</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(c.createdAt).toLocaleDateString("fr-FR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > PER_PAGE && (
          <div className="flex items-center justify-between p-4 border-t border-gray-200">
            <span className="text-sm text-gray-500">{(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} sur {total}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-50">Précédent</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page * PER_PAGE >= total}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-50">Suivant</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Blog
function BlogView() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPost, setEditingPost] = useState<any>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminFetch<{ posts: any[] }>("/blog?limit=50");
      setPosts(data.posts || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Supprimer "${title}" ?`)) return;
    try {
      await adminFetch(`/admin/blog/${id}`, { method: "DELETE" });
      toast.success("Article supprimé");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (editingPost) return <BlogEditForm post={editingPost} onBack={() => { setEditingPost(null); load(); }} />;
  if (showAddForm) return <BlogEditForm post={null} onBack={() => { setShowAddForm(false); load(); }} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Blog</h2>
        <button onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded font-semibold text-sm hover:bg-primary/90">
          <Plus size={16} /> Nouvel article
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32"><RefreshCw className="animate-spin text-primary" /></div>
        ) : posts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Aucun article. Créez le premier !</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {posts.map((post) => (
              <div key={post.id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{post.title}</p>
                  <p className="text-xs text-gray-500">{post.category} • {new Date(post.publishedAt || post.createdAt).toLocaleDateString("fr-FR")}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${post.isPublished ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {post.isPublished ? "Publié" : "Brouillon"}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setEditingPost(post)} className="p-1.5 text-gray-500 hover:text-primary hover:bg-blue-50 rounded"><Edit2 size={15} /></button>
                  <button onClick={() => handleDelete(post.id, post.title)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BlogEditForm({ post, onBack }: { post: any; onBack: () => void }) {
  const isNew = !post;
  const [form, setForm] = useState({
    title: post?.title || "",
    slug: post?.slug || "",
    excerpt: post?.excerpt || "",
    content: post?.content || "",
    category: post?.category || "Conseils",
    isPublished: post?.isPublished ?? false,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isNew) {
        await adminFetch("/admin/blog", { method: "POST", body: JSON.stringify(form) });
        toast.success("Article créé !");
      } else {
        await adminFetch(`/admin/blog/${post.id}`, { method: "PATCH", body: JSON.stringify(form) });
        toast.success("Article mis à jour !");
      }
      onBack();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeft size={16} /> Retour aux articles
      </button>
      <h2 className="text-2xl font-black uppercase mb-6" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
        {isNew ? "Nouvel Article" : "Modifier l'Article"}
      </h2>
      <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-2xl space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Titre *</label>
          <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-primary" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Slug (URL)</label>
          <input type="text" value={form.slug} onChange={e => setForm({...form, slug: e.target.value})}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-primary" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Catégorie</label>
          <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-primary">
            <option>Conseils</option>
            <option>Tendances</option>
            <option>Soins</option>
            <option>Actualités</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Extrait</label>
          <textarea rows={2} value={form.excerpt} onChange={e => setForm({...form, excerpt: e.target.value})}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Contenu</label>
          <textarea rows={8} value={form.content} onChange={e => setForm({...form, content: e.target.value})}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none" />
        </div>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="published" checked={form.isPublished} onChange={e => setForm({...form, isPublished: e.target.checked})}
            className="w-4 h-4 accent-primary" />
          <label htmlFor="published" className="text-sm font-semibold text-gray-700">Publier l'article</label>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-primary text-white px-6 py-2 rounded font-semibold text-sm hover:bg-primary/90 disabled:opacity-50">
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            {isNew ? "Créer" : "Enregistrer"}
          </button>
          <button onClick={onBack} className="px-6 py-2 border border-gray-300 rounded font-semibold text-sm hover:bg-gray-50">Annuler</button>
        </div>
      </div>
    </div>
  );
}

// ─── Login Admin ──────────────────────────────────────────────
function AdminLogin({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState("admin@barberparadise.fr");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await adminFetch<{ token: string; admin: any }>("/auth/admin/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem("bp_admin_token", data.token);
      onLogin(data.token);
      toast.success(`Bienvenue, ${data.admin.firstName} !`);
    } catch (e: any) {
      setError(e.message || "Identifiants incorrects");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-secondary" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            BARBER PARADISE
          </h1>
          <p className="text-gray-500 mt-1">Panel d'Administration</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm space-y-4">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Connexion Admin</h2>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Mot de passe</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-primary" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-primary text-white py-3 rounded font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <RefreshCw size={16} className="animate-spin" /> : null}
            {loading ? "Connexion..." : "Se connecter"}
          </button>

          <p className="text-xs text-gray-400 text-center">
            Compte par défaut : admin@barberparadise.fr / admin123
          </p>
        </form>
      </div>
    </div>
  );
}

// ─── Panel Principal ──────────────────────────────────────────
export default function Admin() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("bp_admin_token"));
  const [activeView, setActiveView] = useState<"dashboard" | "products" | "orders" | "customers" | "blog" | "reviews">("dashboard");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (token) {
      adminFetch<AdminStats>("/admin/stats")
        .then(setStats)
        .catch(() => {
          // Token invalide ou backend non disponible
          // On affiche quand même le panel avec des stats mockées
          setStats({
            totalRevenue: 0,
            totalOrders: 0,
            totalCustomers: 0,
            totalProducts: 405,
            revenueGrowth: 0,
            ordersGrowth: 0,
            pendingOrders: 0,
            lowStockProducts: 0,
          });
        });
    }
  }, [token]);

  if (!token) {
    return <AdminLogin onLogin={setToken} />;
  }

  const navItems = [
    { id: "dashboard",  label: "Tableau de bord", icon: <LayoutDashboard size={18} /> },
    { id: "products",   label: "Produits",         icon: <Package size={18} /> },
    { id: "orders",     label: "Commandes",        icon: <ShoppingCart size={18} /> },
    { id: "customers",  label: "Clients",          icon: <Users size={18} /> },
    { id: "blog",       label: "Blog",             icon: <FileText size={18} /> },
    { id: "reviews",    label: "Avis",             icon: <Star size={18} /> },
  ] as const;

  const handleLogout = () => {
    localStorage.removeItem("bp_admin_token");
    setToken(null);
    toast.success("Déconnecté");
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-secondary text-white flex flex-col transition-transform duration-200
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        lg:relative lg:translate-x-0
      `}>
        {/* Logo */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-black uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                Barber Paradise
              </h1>
              <p className="text-xs text-gray-400">Administration</p>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveView(item.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-semibold transition-colors ${
                activeView === item.id
                  ? "bg-primary text-white"
                  : "text-gray-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-semibold text-gray-300 hover:bg-red-600/20 hover:text-red-400 transition-colors"
          >
            <LogOut size={18} /> Déconnexion
          </button>
          <a
            href="/"
            target="_blank"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-semibold text-gray-300 hover:bg-white/10 hover:text-white transition-colors mt-1"
          >
            <Eye size={18} /> Voir le site
          </a>
        </div>
      </aside>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-500 hover:text-gray-800">
            <Menu size={20} />
          </button>
          <h2 className="font-bold text-gray-800 capitalize">
            {navItems.find(n => n.id === activeView)?.label}
          </h2>
          <div className="ml-auto flex items-center gap-3">
            {stats && (
              <span className="text-xs text-gray-500 hidden md:block">
                {stats.totalProducts} produits • {stats.totalOrders} commandes
              </span>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 overflow-auto">
          {activeView === "dashboard" && <DashboardView stats={stats} />}
          {activeView === "products" && <ProductsView />}
          {activeView === "orders" && <OrdersView />}
          {activeView === "customers" && <CustomersView />}
          {activeView === "blog" && <BlogView />}
          {activeView === "reviews" && (
            <div>
              <h2 className="text-2xl font-black uppercase mb-6" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Avis Clients</h2>
              <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
                <Star size={48} className="text-gray-200 mx-auto mb-4" />
                <p>Aucun avis à modérer pour le moment.</p>
                <p className="text-sm mt-1">Les avis clients apparaîtront ici une fois que des clients auront laissé des commentaires.</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
