// ============================================================
// BARBER PARADISE — Page Compte Client
// Couleurs: Primary #4EAADB | Secondary #252525
// ============================================================

import { useState } from "react";
import { useLocation } from "wouter";
import { LogOut, User, Package, Edit2, Save, X, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/data";
import { toast } from "sonner";

export default function Account() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, isLoading, logout, updateProfile } = useAuth();
  const [tab, setTab] = useState<"profile" | "orders">("profile");
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editData, setEditData] = useState<any>(user ? { ...user } : {});

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container py-12">
          <div className="max-w-md mx-auto">
            <h1 className="text-3xl font-black text-center mb-8" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              CONNEXION
            </h1>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const email = (e.target as any).email.value;
                const password = (e.target as any).password.value;
                const result = await (window as any).authContext?.login?.(email, password);
                if (result?.success) {
                  toast.success("Connecté !");
                  navigate("/compte");
                } else {
                  toast.error(result?.error || "Erreur de connexion");
                }
              }}
              className="bg-white border border-gray-200 p-6 space-y-4"
            >
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <input type="email" name="email" className="input-bp w-full" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Mot de passe</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    className="input-bp w-full"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button type="submit" className="btn-primary w-full py-3">
                Se connecter
              </button>
            </form>

            <p className="text-center text-sm text-gray-600 mt-4">
              Pas encore de compte ?{" "}
              <button onClick={() => navigate("/inscription")} className="text-primary hover:underline font-semibold">
                S'inscrire
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { orders } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-secondary text-white py-8">
        <div className="container">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-black uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                Mon Compte
              </h1>
              <p className="text-gray-400 text-sm mt-1">{user.email}</p>
            </div>
            <button
              onClick={() => {
                logout();
                navigate("/");
              }}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-sm font-semibold transition-colors"
            >
              <LogOut size={16} /> Déconnexion
            </button>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <div className="flex gap-4 mb-8 border-b border-gray-200">
          <button
            onClick={() => setTab("profile")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${
              tab === "profile"
                ? "border-b-2 border-primary text-primary"
                : "text-gray-500 hover:text-gray-800"
            }`}
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            <User size={16} /> Profil
          </button>
          <button
            onClick={() => setTab("orders")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${
              tab === "orders"
                ? "border-b-2 border-primary text-primary"
                : "text-gray-500 hover:text-gray-800"
            }`}
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            <Package size={16} /> Commandes ({orders.length})
          </button>
        </div>

        {tab === "profile" && (
          <div className="max-w-2xl">
            <div className="bg-white border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  Informations Personnelles
                </h2>
                <button
                  onClick={() => {
                    if (isEditing) {
                      updateProfile(editData);
                      toast.success("Profil mis à jour");
                    }
                    setIsEditing(!isEditing);
                  }}
                  className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                >
                  {isEditing ? (
                    <>
                      <Save size={16} /> Enregistrer
                    </>
                  ) : (
                    <>
                      <Edit2 size={16} /> Modifier
                    </>
                  )}
                </button>
              </div>

              {isEditing && (
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditData(user);
                  }}
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
                >
                  <X size={14} /> Annuler
                </button>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Prénom</label>
                    <input
                      type="text"
                      value={editData?.firstName || ""}
                      onChange={(e) => setEditData({ ...editData, firstName: e.target.value })}
                      disabled={!isEditing}
                      className={`input-bp w-full ${!isEditing && "bg-gray-50 cursor-not-allowed"}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Nom</label>
                    <input
                      type="text"
                      value={editData?.lastName || ""}
                      onChange={(e) => setEditData({ ...editData, lastName: e.target.value })}
                      disabled={!isEditing}
                      className={`input-bp w-full ${!isEditing && "bg-gray-50 cursor-not-allowed"}`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={editData?.email || ""}
                    disabled
                    className="input-bp w-full bg-gray-50 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Téléphone</label>
                  <input
                    type="tel"
                    value={editData?.phone || ""}
                    onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                    disabled={!isEditing}
                    className={`input-bp w-full ${!isEditing && "bg-gray-50 cursor-not-allowed"}`}
                  />
                </div>

                <div className="border-t border-gray-200 pt-4 mt-6">
                  <h3 className="font-bold uppercase text-sm mb-4" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    Adresse de Livraison
                  </h3>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Rue</label>
                    <input
                      type="text"
                      value={(editData?.address as any)?.street || ""}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          address: { ...(editData?.address as any), street: e.target.value },
                        })
                      }
                      disabled={!isEditing}
                      className={`input-bp w-full ${!isEditing && "bg-gray-50 cursor-not-allowed"}`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Ville</label>
                      <input
                        type="text"
                        value={(editData?.address as any)?.city || ""}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            address: { ...(editData?.address as any), city: e.target.value },
                          })
                        }
                        disabled={!isEditing}
                        className={`input-bp w-full ${!isEditing && "bg-gray-50 cursor-not-allowed"}`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Code postal</label>
                      <input
                        type="text"
                        value={(editData?.address as any)?.postalCode || ""}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            address: { ...(editData?.address as any), postalCode: e.target.value },
                          })
                        }
                        disabled={!isEditing}
                        className={`input-bp w-full ${!isEditing && "bg-gray-50 cursor-not-allowed"}`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "orders" && (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="bg-white border border-gray-200 p-8 text-center">
                <Package size={48} className="text-gray-200 mx-auto mb-4" />
                <p className="text-gray-500">Aucune commande pour le moment</p>
              </div>
            ) : (
              orders.map((order) => (
                <div key={order.id} className="bg-white border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
                    <div>
                      <p className="text-sm text-gray-500">Commande #{order.id}</p>
                      <p className="font-semibold text-gray-800">{new Date(order.date).toLocaleDateString("fr-FR")}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full ${STATUS_COLORS[order.status]}`}>
                        {STATUS_LABELS[order.status]}
                      </span>
                      <p className="font-black text-secondary text-lg mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                        {order.total.toFixed(2)} €
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-600">{item.name} x{item.quantity}</span>
                        <span className="font-semibold">{(item.price * item.quantity).toFixed(2)} €</span>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-gray-500">Livraison à : {order.shippingAddress}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
