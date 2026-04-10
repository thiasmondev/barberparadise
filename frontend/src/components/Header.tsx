"use client";

import Link from "next/link";
import { useState } from "react";
import { ShoppingCart, Search, Menu, X, User, ChevronDown } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

const NAV_ITEMS = [
  { label: "Accueil", href: "/" },
  {
    label: "Produits",
    href: "/catalogue",
    children: [
      { label: "Tous les produits", href: "/catalogue" },
      { label: "Tondeuses", href: "/catalogue?category=Tondeuses" },
      { label: "Ciseaux", href: "/catalogue?category=Ciseaux" },
      { label: "Rasoirs", href: "/catalogue?category=Rasoirs" },
      { label: "Soins cheveux", href: "/catalogue?category=Soins+cheveux" },
      { label: "Soins barbe", href: "/catalogue?category=Soins+barbe" },
    ],
  },
  { label: "Nouveautés", href: "/catalogue?sort=newest" },
  { label: "Promotions", href: "/catalogue?promo=true" },
  { label: "Contact", href: "/contact" },
];

export default function Header() {
  const { itemCount } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      {/* Top bar */}
      <div className="bg-dark-800 text-white text-xs py-1.5">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
          <span>Livraison gratuite dès 49€ d&apos;achat</span>
          <span>Service client : contact@barberparadise.fr</span>
        </div>
      </div>

      {/* Main header */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Mobile menu button */}
          <button
            className="lg:hidden p-2 -ml-2 text-dark-800"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
              <span className="text-white font-heading font-bold text-lg">BP</span>
            </div>
            <div className="hidden sm:block">
              <span className="font-heading font-bold text-xl text-dark-800 leading-none block">
                BARBER
              </span>
              <span className="font-heading text-xs text-primary tracking-[0.2em] block">
                PARADISE
              </span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <div
                key={item.label}
                className="relative"
                onMouseEnter={() => item.children && setOpenDropdown(item.label)}
                onMouseLeave={() => setOpenDropdown(null)}
              >
                <Link
                  href={item.href}
                  className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-dark-700 hover:text-primary transition-colors"
                >
                  {item.label}
                  {item.children && <ChevronDown size={14} />}
                </Link>
                {item.children && openDropdown === item.label && (
                  <div className="absolute top-full left-0 bg-white shadow-lg rounded-lg py-2 min-w-[200px] border border-gray-100">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className="block px-4 py-2 text-sm text-dark-600 hover:bg-primary-50 hover:text-primary transition-colors"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="p-2 text-dark-600 hover:text-primary transition-colors"
              aria-label="Rechercher"
            >
              <Search size={20} />
            </button>

            {/* Account */}
            <Link
              href="/compte"
              className="p-2 text-dark-600 hover:text-primary transition-colors hidden sm:block"
            >
              <User size={20} />
            </Link>

            {/* Cart */}
            <Link
              href="/panier"
              className="relative p-2 text-dark-600 hover:text-primary transition-colors"
            >
              <ShoppingCart size={20} />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-primary text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* Search bar */}
      {searchOpen && (
        <div className="border-t border-gray-100 bg-white">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (searchQuery.trim()) {
                  window.location.href = `/catalogue?search=${encodeURIComponent(searchQuery)}`;
                  setSearchOpen(false);
                }
              }}
              className="flex items-center gap-3"
            >
              <Search size={18} className="text-gray-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un produit, une marque..."
                className="flex-1 text-sm outline-none text-dark-800 placeholder:text-gray-400"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="text-gray-400 hover:text-dark-600"
              >
                <X size={18} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-gray-100 bg-white">
          <nav className="max-w-7xl mx-auto px-4 py-4 space-y-1">
            {NAV_ITEMS.map((item) => (
              <div key={item.label}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="block py-2.5 text-sm font-medium text-dark-700 hover:text-primary"
                >
                  {item.label}
                </Link>
                {item.children && (
                  <div className="pl-4 space-y-1">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => setMobileOpen(false)}
                        className="block py-1.5 text-sm text-dark-500 hover:text-primary"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <Link
              href="/compte"
              onClick={() => setMobileOpen(false)}
              className="block py-2.5 text-sm font-medium text-dark-700 hover:text-primary"
            >
              Mon compte
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
