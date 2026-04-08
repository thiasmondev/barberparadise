// ============================================================
// BARBER PARADISE — Header
// Couleurs: Primary #4EAADB | Secondary #252525
// Menu: Nouveautés, Produits, Matériel, Marques, PROMO, Contact
// ============================================================

import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Search,
  ShoppingCart,
  User,
  Menu,
  X,
  ChevronDown,
  Heart,
  ChevronRight,
} from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useAuth } from "@/contexts/AuthContext";
import { menuStructure } from "@/lib/menuData";

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<string[]>([]);
  const [, navigate] = useLocation();
  const { totalItems, openCart } = useCart();
  const { items: wishlistItems } = useWishlist();
  const { user } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [searchOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/catalogue?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery("");
    }
  };

  const toggleMobileExpand = (slug: string) => {
    setMobileExpanded((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const getMenuHref = (item: { slug: string; label: string }) => {
    if (item.slug === "contact") return "/contact";
    if (item.slug === "nouveautes") return "/catalogue?badge=nouveau";
    if (item.slug === "promo") return "/catalogue?promo=true";
    return `/catalogue?category=${item.slug}`;
  };

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-200">
      {/* Barre d'annonce */}
      <div
        className="text-white text-xs py-2 text-center font-medium tracking-wide"
        style={{ backgroundColor: "#252525" }}
      >
        🚚 Livraison gratuite en point relais dès 54€ d'achat &nbsp;|&nbsp; 📦 Expédition sous 24-48h
      </div>

      {/* Header principal */}
      <div className="container">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0">
            <div className="flex items-center gap-2">
              <div
                className="w-9 h-9 flex items-center justify-center text-white font-black text-sm"
                style={{ backgroundColor: "#4EAADB", fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                BP
              </div>
              <div className="hidden sm:block">
                <div
                  className="text-lg font-black leading-none text-gray-900"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  BARBER
                </div>
                <div
                  className="text-xs font-bold leading-none tracking-widest"
                  style={{ color: "#4EAADB", fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  PARADISE
                </div>
              </div>
            </div>
          </Link>

          {/* Navigation desktop */}
          <nav ref={menuRef} className="hidden lg:flex items-center gap-0">
            {menuStructure.map((item) => (
              <div
                key={item.slug}
                className="relative"
                onMouseEnter={() => item.children ? setActiveMenu(item.slug) : undefined}
                onMouseLeave={() => setActiveMenu(null)}
              >
                {item.children ? (
                  <button
                    className={`flex items-center gap-1 px-3 py-5 text-sm font-semibold transition-colors whitespace-nowrap ${
                      activeMenu === item.slug
                        ? "border-b-2 border-primary"
                        : "text-gray-700 hover:text-primary"
                    } ${item.slug === "promo" ? "!text-red-500 hover:!text-red-600" : ""}`}
                    style={{
                      fontFamily: "'Barlow', sans-serif",
                      color: activeMenu === item.slug && item.slug !== "promo" ? "#4EAADB" : undefined,
                    }}
                    onClick={() => setActiveMenu(activeMenu === item.slug ? null : item.slug)}
                  >
                    {item.label}
                    <ChevronDown
                      size={14}
                      className={`transition-transform ${activeMenu === item.slug ? "rotate-180" : ""}`}
                    />
                  </button>
                ) : (
                  <Link
                    href={getMenuHref(item)}
                    className={`flex items-center px-3 py-5 text-sm font-semibold transition-colors whitespace-nowrap ${
                      item.slug === "promo"
                        ? "text-red-500 hover:text-red-600 font-black"
                        : "text-gray-700 hover:text-primary"
                    }`}
                    style={{ fontFamily: "'Barlow', sans-serif" }}
                  >
                    {item.label}
                  </Link>
                )}

                {/* Mega Menu dropdown */}
                {item.children && activeMenu === item.slug && (
                  <div
                    className="absolute top-full left-0 bg-white shadow-xl border border-gray-200 z-50"
                    style={{ marginTop: "-1px" }}
                  >
                    {item.slug === "marques" ? (
                      /* Grille de 29 marques */
                      <div className="p-3 grid grid-cols-3 gap-0.5 w-80">
                        {item.children.map((brand) => (
                          <Link
                            key={brand.slug}
                            href={`/catalogue?brand=${encodeURIComponent(brand.label)}`}
                            className="px-2 py-1.5 text-xs text-gray-700 hover:text-primary hover:bg-blue-50 transition-colors truncate"
                            onClick={() => setActiveMenu(null)}
                          >
                            {brand.label}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      /* Menu avec sous-catégories et sous-sous-catégories */
                      <div className="flex">
                        <div className="py-2 min-w-[200px]">
                          {item.children.map((child) => (
                            <div key={child.slug} className="group/sub relative">
                              <Link
                                href={`/catalogue?category=${item.slug}&sub=${child.slug}`}
                                className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:text-primary hover:bg-blue-50 transition-colors"
                                onClick={() => setActiveMenu(null)}
                              >
                                <span className="font-medium">{child.label}</span>
                                {child.children && (
                                  <ChevronRight size={12} className="text-gray-400 flex-shrink-0 ml-2" />
                                )}
                              </Link>
                              {/* Sous-sous-catégories au survol */}
                              {child.children && (
                                <div className="absolute left-full top-0 bg-white shadow-xl border border-gray-200 hidden group-hover/sub:block min-w-[180px] py-2 z-50">
                                  {child.children.map((sub) => (
                                    <Link
                                      key={sub.slug}
                                      href={`/catalogue?category=${item.slug}&sub=${child.slug}&subsub=${sub.slug}`}
                                      className="block px-4 py-2 text-sm text-gray-600 hover:text-primary hover:bg-blue-50 transition-colors whitespace-nowrap"
                                      onClick={() => setActiveMenu(null)}
                                    >
                                      {sub.label}
                                    </Link>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Actions droite */}
          <div className="flex items-center gap-1">
            {/* Recherche */}
            <div className="relative">
              {searchOpen ? (
                <form onSubmit={handleSearch} className="flex items-center">
                  <input
                    ref={searchRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher..."
                    className="w-40 md:w-56 px-3 py-1.5 text-sm border border-gray-300 focus:outline-none focus:border-primary"
                    onBlur={() => !searchQuery && setSearchOpen(false)}
                  />
                  <button
                    type="button"
                    onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                    className="p-2 text-gray-500 hover:text-gray-700"
                  >
                    <X size={16} />
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setSearchOpen(true)}
                  className="p-2 text-gray-600 hover:text-primary transition-colors"
                  title="Rechercher"
                >
                  <Search size={20} />
                </button>
              )}
            </div>

            {/* Wishlist */}
            <Link
              href="/wishlist"
              className="relative p-2 text-gray-600 hover:text-primary transition-colors hidden sm:flex"
            >
              <Heart size={20} />
              {wishlistItems.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {wishlistItems.length > 9 ? "9+" : wishlistItems.length}
                </span>
              )}
            </Link>

            {/* Compte */}
            <Link
              href="/compte"
              className="p-2 text-gray-600 hover:text-primary transition-colors hidden sm:flex items-center gap-1"
            >
              <User size={20} />
              {user && (
                <span className="text-xs font-medium text-gray-700 hidden md:block max-w-16 truncate">
                  {user.firstName}
                </span>
              )}
            </Link>

            {/* Panier */}
            <button
              onClick={() => openCart()}
              className="relative p-2 text-gray-600 hover:text-primary transition-colors"
              title="Panier"
            >
              <ShoppingCart size={20} />
              {totalItems > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-5 h-5 text-white text-xs rounded-full flex items-center justify-center font-bold"
                  style={{ backgroundColor: "#4EAADB" }}
                >
                  {totalItems > 99 ? "99+" : totalItems}
                </span>
              )}
            </button>

            {/* Menu hamburger mobile */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 text-gray-600 hover:text-primary transition-colors"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Menu mobile */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-gray-200 max-h-[80vh] overflow-y-auto">
          <div className="container py-2">
            {/* Recherche mobile */}
            <form onSubmit={handleSearch} className="flex gap-2 mb-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un produit..."
                className="flex-1 px-3 py-2 text-sm border border-gray-300 focus:outline-none focus:border-primary"
              />
              <button
                type="submit"
                className="px-3 py-2 text-white text-sm"
                style={{ backgroundColor: "#4EAADB" }}
              >
                <Search size={16} />
              </button>
            </form>

            {menuStructure.map((item) => (
              <div key={item.slug} className="border-b border-gray-100 last:border-0">
                {item.children ? (
                  <>
                    <button
                      onClick={() => toggleMobileExpand(item.slug)}
                      className={`flex items-center justify-between w-full py-3 text-sm font-semibold text-left ${
                        item.slug === "promo" ? "text-red-500" : "text-gray-800"
                      }`}
                    >
                      {item.label}
                      <ChevronDown
                        size={16}
                        className={`transition-transform ${mobileExpanded.includes(item.slug) ? "rotate-180" : ""}`}
                      />
                    </button>
                    {mobileExpanded.includes(item.slug) && (
                      <div className="pb-2 pl-3 space-y-0.5">
                        {item.slug === "marques" ? (
                          <div className="grid grid-cols-2 gap-x-2">
                            {item.children.map((brand) => (
                              <Link
                                key={brand.slug}
                                href={`/catalogue?brand=${encodeURIComponent(brand.label)}`}
                                className="py-1.5 text-xs text-gray-600 hover:text-primary"
                                onClick={() => setMobileOpen(false)}
                              >
                                {brand.label}
                              </Link>
                            ))}
                          </div>
                        ) : (
                          item.children.map((child) => (
                            <div key={child.slug}>
                              <Link
                                href={`/catalogue?category=${item.slug}&sub=${child.slug}`}
                                className="block py-1.5 text-sm text-gray-700 hover:text-primary font-medium"
                                onClick={() => setMobileOpen(false)}
                              >
                                {child.label}
                              </Link>
                              {child.children && (
                                <div className="pl-3 space-y-0.5">
                                  {child.children.map((sub) => (
                                    <Link
                                      key={sub.slug}
                                      href={`/catalogue?category=${item.slug}&sub=${child.slug}&subsub=${sub.slug}`}
                                      className="block py-1 text-xs text-gray-500 hover:text-primary"
                                      onClick={() => setMobileOpen(false)}
                                    >
                                      — {sub.label}
                                    </Link>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    href={getMenuHref(item)}
                    className={`block py-3 text-sm font-semibold ${
                      item.slug === "promo" ? "text-red-500 font-black" : "text-gray-800"
                    }`}
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                  </Link>
                )}
              </div>
            ))}

            {/* Liens compte mobile */}
            <div className="pt-3 flex gap-4 text-sm text-gray-600">
              <Link
                href="/compte"
                className="flex items-center gap-1 hover:text-primary"
                onClick={() => setMobileOpen(false)}
              >
                <User size={16} /> Compte
              </Link>
              <Link
                href="/wishlist"
                className="flex items-center gap-1 hover:text-primary"
                onClick={() => setMobileOpen(false)}
              >
                <Heart size={16} /> Wishlist{wishlistItems.length > 0 ? ` (${wishlistItems.length})` : ""}
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
