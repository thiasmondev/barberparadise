"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import AdminLoginPage from "./AdminLoginPage";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  FolderTree,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Search,
  Globe,
  Settings,
  MessageSquare,
  Tag,
  Boxes,
  Euro,
  Truck,
  Megaphone,
  Sparkles,
  Images,
  KeyRound,
  Store,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/stock", label: "Stock", icon: Package },
  { href: "/admin/caisse", label: "Caisse", icon: Store },
  { href: "/admin/commandes", label: "Commandes", icon: ShoppingCart },
  { href: "/admin/clients", label: "Clients", icon: Users },
  { href: "/admin/pro", label: "Comptes pro", icon: Users },
  { href: "/admin/pro/prices", label: "Prix professionnels", icon: Euro },
  { href: "/admin/finance", label: "Finance", icon: Euro },
  { href: "/admin/categories", label: "Catégories", icon: FolderTree },
  { href: "/admin/brands", label: "Marques", icon: Tag },
  { href: "/admin/seo", label: "Agent SEO", icon: Search },
  { href: "/admin/marketing", label: "Agent Marketing", icon: Megaphone },
  { href: "/admin/promotions", label: "Promotions", icon: Tag },
  { href: "/admin/carousel", label: "Carrousel", icon: Images },
  { href: "/admin/buzz", label: "Buzz", icon: Sparkles },
  { href: "/admin/geo", label: "Outils GEO", icon: Globe },
  { href: "/admin/logistique/emballages", label: "Emballages", icon: Boxes },
  { href: "/admin/parametres/expedition", label: "Expédition", icon: Truck },
  { href: "/admin/api-keys", label: "Clés API", icon: KeyRound },
  { href: "/admin/import-reviews", label: "Import Avis", icon: MessageSquare },
  { href: "/admin/parametres", label: "Paramètres", icon: Settings },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const { admin, logout, isLoading } = useAdminAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fermer automatiquement la sidebar mobile lors d'un changement de route
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Bloquer le scroll du body quand la sidebar mobile est ouverte
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!admin) {
    return <AdminLoginPage />;
  }

  const isNavItemActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    if (href === "/admin/pro")
      return (
        pathname === "/admin/pro" ||
        /^\/admin\/pro\/(?!prices(?:\/|$))/.test(pathname)
      );
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const currentPage = NAV_ITEMS.find(item => isNavItemActive(item.href));

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Overlay mobile — backdrop semi-transparent quand la sidebar est ouverte */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-72 bg-dark-900 text-white flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-auto lg:w-64 ${
          sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
        aria-label="Navigation principale"
      >
        {/* Logo + bouton fermeture mobile */}
        <div className="h-16 flex items-center px-5 border-b border-white/10 shrink-0">
          <Link
            href="/admin"
            className="flex items-center gap-2.5 min-w-0"
          >
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0">
              BP
            </div>
            <div className="min-w-0">
              <div className="font-heading font-bold text-sm leading-tight truncate">
                Barber Paradise
              </div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wider">
                Admin Panel
              </div>
            </div>
          </Link>
          <button
            className="ml-auto lg:hidden text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fermer le menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto" aria-label="Menu admin">
          {NAV_ITEMS.map(item => {
            const isActive = isNavItemActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                  isActive
                    ? "bg-primary/20 text-primary"
                    : "text-gray-300 hover:bg-white/5 hover:text-white active:bg-white/10"
                }`}
              >
                <item.icon size={18} className="shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Section utilisateur */}
        <div className="p-3 border-t border-white/10 shrink-0">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center text-primary text-xs font-bold shrink-0">
              {admin.name?.charAt(0).toUpperCase() || "A"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">
                {admin.name}
              </div>
              <div className="text-xs text-gray-400 truncate">
                {admin.email}
              </div>
            </div>
            <button
              onClick={logout}
              className="text-gray-400 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-white/10 min-w-[36px] min-h-[36px] flex items-center justify-center"
              title="Déconnexion"
              aria-label="Se déconnecter"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Barre supérieure */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 sm:px-6 gap-3 sticky top-0 z-30">
          {/* Bouton burger — visible uniquement sur mobile/tablette */}
          <button
            className="lg:hidden text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            onClick={() => setSidebarOpen(true)}
            aria-label="Ouvrir le menu"
            aria-expanded={sidebarOpen}
          >
            <Menu size={22} />
          </button>

          {/* Fil d'Ariane */}
          <div className="flex items-center gap-1.5 text-sm text-gray-500 min-w-0">
            <Link href="/admin" className="hover:text-primary shrink-0">
              Admin
            </Link>
            {currentPage && currentPage.href !== "/admin" && (
              <>
                <ChevronRight size={14} className="shrink-0 text-gray-300" />
                <span className="text-dark-800 font-medium truncate">
                  {currentPage.label}
                </span>
              </>
            )}
          </div>

          <div className="ml-auto flex items-center gap-3 shrink-0">
            <Link
              href="/"
              target="_blank"
              className="text-xs text-gray-400 hover:text-primary transition-colors hidden sm:inline"
            >
              Voir le site →
            </Link>
          </div>
        </header>

        {/* Contenu de la page */}
        <main className="flex-1 min-w-0 overflow-x-hidden p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
