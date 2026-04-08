// ============================================================
// BARBER PARADISE — Header
// Couleurs: Primary #4EAADB | Secondary #252525 | BG #FFFFFF
// Navigation: Nouveautés, Produits, Matériel, Marques, Promo, Contact
// ============================================================

import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Search, ShoppingCart, User, Heart, Menu, X, ChevronDown,
  Package, Scissors, Zap, Tag, Phone, Star
} from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useAuth } from "@/contexts/AuthContext";
import { searchProducts } from "@/lib/data";
import type { Product } from "@/lib/data";
import CartDrawer from "@/components/cart/CartDrawer";

const navLinks = [
  { label: "Nouveautés", href: "/catalogue?filter=new", icon: Star },
  {
    label: "Produits",
    href: "/catalogue?category=produits",
    icon: Package,
    submenu: [
      { label: "Tous les produits", href: "/catalogue?category=produits" },
      { label: "Cheveux", href: "/catalogue?subcategory=cheveux" },
      { label: "Barbe", href: "/catalogue?subcategory=barbe" },
      { label: "Rasage", href: "/catalogue?subcategory=rasage" },
      { label: "Parfums", href: "/catalogue?subcategory=parfums" },
      { label: "Corps", href: "/catalogue?subcategory=corps" },
    ],
  },
  {
    label: "Matériel",
    href: "/catalogue?category=materiel",
    icon: Scissors,
    submenu: [
      { label: "Tout le matériel", href: "/catalogue?category=materiel" },
      { label: "Tondeuses", href: "/catalogue?subcategory=tondeuse" },
      { label: "Ciseaux", href: "/catalogue?subcategory=ciseaux" },
      { label: "Brosses & Peignes", href: "/catalogue?subcategory=brosse-peigne" },
      { label: "Sèche-cheveux", href: "/catalogue?subcategory=seche-cheveux" },
      { label: "Accessoires", href: "/catalogue?subcategory=accessoire" },
    ],
  },
  {
    label: "Marques",
    href: "/marques",
    icon: Zap,
    submenu: [
      { label: "Andis", href: "/catalogue?brand=andis" },
      { label: "Babyliss Pro", href: "/catalogue?brand=babyliss-pro" },
      { label: "JRL", href: "/catalogue?brand=jrl" },
      { label: "Style Craft", href: "/catalogue?brand=stylecraft" },
      { label: "Wahl", href: "/catalogue?brand=wahl" },
      { label: "Osaka", href: "/catalogue?brand=osaka" },
      { label: "Lockhart's", href: "/catalogue?brand=lockharts" },
      { label: "Hey Joe!", href: "/catalogue?brand=hey-joe" },
    ],
  },
  { label: "PROMO", href: "/catalogue?filter=promo", icon: Tag, isPromo: true },
  { label: "Contact", href: "/contact", icon: Phone },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const searchRef = useRef<HTMLDivElement>(null);
  const { totalItems, openCart } = useCart();
  const { count: wishlistCount } = useWishlist();
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (searchQuery.length >= 2) {
      setSearchResults(searchProducts(searchQuery).slice(0, 6));
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setSearchQuery("");
        setSearchResults([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/catalogue?q=${encodeURIComponent(searchQuery)}`);
      setSearchOpen(false);
      setSearchQuery("");
    }
  };

  return (
    <>
      {/* Announcement Bar */}
      <div className="announcement-bar">
        LIVRAISON GRATUITE DÈS 54€ EN POINTS RELAIS !
      </div>

      {/* Main Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="container">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Mobile menu button */}
            <button
              className="lg:hidden p-2 text-gray-700 hover:text-primary transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Menu"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            {/* Logo */}
            <Link href="/" className="flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                  <span className="text-white font-black text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>BP</span>
                </div>
                <span className="hidden sm:block font-black text-xl text-secondary tracking-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  BARBER<span className="text-primary">PARADISE</span>
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center">
              {navLinks.map((link) => (
                <div
                  key={link.label}
                  className="relative"
                  onMouseEnter={() => link.submenu && setActiveDropdown(link.label)}
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  <Link
                    href={link.href}
                    className={`flex items-center gap-1 px-3 py-2 text-sm font-semibold uppercase tracking-wider transition-colors ${
                      link.isPromo
                        ? "text-red-600 hover:text-red-700"
                        : "text-gray-800 hover:text-primary"
                    }`}
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.08em" }}
                  >
                    {link.label}
                    {link.submenu && <ChevronDown size={14} className={`transition-transform ${activeDropdown === link.label ? "rotate-180" : ""}`} />}
                  </Link>

                  {/* Dropdown */}
                  {link.submenu && activeDropdown === link.label && (
                    <div className="absolute top-full left-0 bg-white border border-gray-200 shadow-xl min-w-[200px] z-50 py-2">
                      {link.submenu.map((sub) => (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-primary/10 hover:text-primary transition-colors font-medium"
                          onClick={() => setActiveDropdown(null)}
                        >
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-1">
              {/* Search */}
              <div ref={searchRef} className="relative">
                <button
                  className="p-2 text-gray-700 hover:text-primary transition-colors"
                  onClick={() => setSearchOpen(!searchOpen)}
                  aria-label="Recherche"
                >
                  <Search size={20} />
                </button>

                {searchOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 shadow-xl z-50">
                    <form onSubmit={handleSearchSubmit} className="flex items-center border-b border-gray-200">
                      <Search size={16} className="ml-3 text-gray-400 flex-shrink-0" />
                      <input
                        autoFocus
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Qu'est-ce que tu cherches..."
                        className="flex-1 px-3 py-3 text-sm focus:outline-none"
                      />
                      <button type="submit" className="px-3 py-3 bg-primary text-white text-xs font-bold uppercase">
                        GO
                      </button>
                    </form>
                    {searchResults.length > 0 && (
                      <div>
                        {searchResults.map((p) => (
                          <Link
                            key={p.id}
                            href={`/produit/${p.slug}`}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
                            onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                          >
                            <img src={p.images[0]} alt={p.name} className="w-10 h-10 object-cover flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                              <p className="text-xs text-primary font-bold">{p.price.toFixed(2)} €</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Wishlist */}
              <Link href="/wishlist" className="relative p-2 text-gray-700 hover:text-primary transition-colors" aria-label="Wishlist">
                <Heart size={20} />
                {wishlistCount > 0 && (
                  <span className="cart-badge">{wishlistCount}</span>
                )}
              </Link>

              {/* Account */}
              <Link
                href={isAuthenticated ? "/compte" : "/connexion"}
                className="relative p-2 text-gray-700 hover:text-primary transition-colors hidden sm:flex items-center gap-1"
                aria-label="Compte"
              >
                <User size={20} />
                {isAuthenticated && (
                  <span className="text-xs font-semibold text-gray-600 hidden md:block">
                    {user?.firstName}
                  </span>
                )}
              </Link>

              {/* Cart */}
              <button
                onClick={openCart}
                className="relative p-2 text-gray-700 hover:text-primary transition-colors"
                aria-label="Panier"
              >
                <ShoppingCart size={20} />
                {totalItems > 0 && (
                  <span className="cart-badge">{totalItems}</span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="lg:hidden bg-white border-t border-gray-200 shadow-lg">
            <nav className="container py-4 space-y-1">
              {navLinks.map((link) => (
                <div key={link.label}>
                  <Link
                    href={link.href}
                    className={`block px-4 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${
                      link.isPromo ? "text-red-600" : "text-gray-800 hover:text-primary hover:bg-primary/5"
                    }`}
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </Link>
                  {link.submenu && (
                    <div className="pl-4 space-y-1">
                      {link.submenu.map((sub) => (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className="block px-4 py-2 text-sm text-gray-600 hover:text-primary transition-colors"
                          onClick={() => setMobileOpen(false)}
                        >
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div className="border-t border-gray-200 pt-3 mt-3">
                <Link
                  href={isAuthenticated ? "/compte" : "/connexion"}
                  className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 hover:text-primary"
                  onClick={() => setMobileOpen(false)}
                >
                  <User size={16} />
                  {isAuthenticated ? `Mon compte (${user?.firstName})` : "Se connecter"}
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Cart Drawer */}
      <CartDrawer />
    </>
  );
}
