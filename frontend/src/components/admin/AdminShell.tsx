"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
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
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/produits", label: "Produits", icon: Package },
  { href: "/admin/commandes", label: "Commandes", icon: ShoppingCart },
  { href: "/admin/clients", label: "Clients", icon: Users },
  { href: "/admin/pro", label: "Comptes pro", icon: Users },
  { href: "/admin/pro/prices", label: "Prix professionnels", icon: Euro },
  { href: "/admin/categories", label: "Catégories", icon: FolderTree },
  { href: "/admin/brands", label: "Marques", icon: Tag },
  { href: "/admin/seo", label: "Agent SEO", icon: Search },
  { href: "/admin/geo", label: "Outils GEO", icon: Globe },
  { href: "/admin/logistique/emballages", label: "Logistique", icon: Boxes },
  { href: "/admin/import-reviews", label: "Import Avis", icon: MessageSquare },
  { href: "/admin/parametres", label: "Paramètres", icon: Settings },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const { admin, logout, isLoading } = useAdminAuth();
  const [pathname, setPathname] = useState("/admin");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const syncLocation = () => setPathname(window.location.pathname);
    syncLocation();
    window.addEventListener("popstate", syncLocation);
    return () => window.removeEventListener("popstate", syncLocation);
  }, []);

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
    if (href === "/admin/pro") return pathname === "/admin/pro" || /^\/admin\/pro\/(?!prices(?:\/|$))/.test(pathname);
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const currentPage = NAV_ITEMS.find((item) => isNavItemActive(item.href));

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-dark-900 text-white flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-white/10">
          <Link href="/admin" className="flex items-center gap-2.5" onClick={() => setSidebarOpen(false)}>
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-sm">
              BP
            </div>
            <div>
              <div className="font-heading font-bold text-sm leading-tight">Barber Paradise</div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wider">Admin Panel</div>
            </div>
          </Link>
          <button
            className="ml-auto lg:hidden text-gray-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = isNavItemActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/20 text-primary"
                    : "text-gray-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center text-primary text-xs font-bold">
              {admin.name?.charAt(0).toUpperCase() || "A"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{admin.name}</div>
              <div className="text-xs text-gray-400 truncate">{admin.email}</div>
            </div>
            <button
              onClick={logout}
              className="text-gray-400 hover:text-red-400 transition-colors"
              title="Déconnexion"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 sm:px-6 gap-4 sticky top-0 z-30">
          <button
            className="lg:hidden text-gray-500 hover:text-gray-700"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={22} />
          </button>

          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <Link href="/admin" className="hover:text-primary">
              Admin
            </Link>
            {currentPage && currentPage.href !== "/admin" && (
              <>
                <ChevronRight size={14} />
                <span className="text-dark-800 font-medium">{currentPage.label}</span>
              </>
            )}
          </div>

          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/"
              target="_blank"
              className="text-xs text-gray-400 hover:text-primary transition-colors"
            >
              Voir le site →
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
