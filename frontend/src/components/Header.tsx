"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { ShoppingBag, Search, Menu, X, User, ChevronRight } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { usePathname } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────
interface Category {
  slug: string;
  name: string;
  parentSlug: string | null;
}

interface NavItem {
  label: string;
  href: string;
  megaMenu?: {
    rootSlug: string; // slug de la catégorie racine pour filtrer les enfants
  };
}

const NAV_MAIN: NavItem[] = [
  { label: "PRODUITS", href: "/catalogue" },
  {
    label: "MATÉRIEL",
    href: "/catalogue?category=materiel",
    megaMenu: { rootSlug: "materiel" },
  },
  { label: "MARQUES", href: "/catalogue?marques=true" },
  { label: "NOUVEAUTÉS", href: "/catalogue?sort=newest" },
];

const NAV_BURGER = [
  { label: "PRODUITS", href: "/catalogue" },
  { label: "MATÉRIEL", href: "/catalogue?category=materiel" },
  { label: "MARQUES", href: "/catalogue?marques=true" },
  { label: "NOUVEAUTÉS", href: "/catalogue?sort=newest" },
  { label: "PROMOTIONS", href: "/catalogue?promo=true" },
  { label: "CONTACT", href: "/contact" },
  { label: "MON COMPTE", href: "/compte" },
];

// ─── Composant MegaMenu ───────────────────────────────────────
function MegaMenu({
  rootSlug,
  allCategories,
  onClose,
}: {
  rootSlug: string;
  allCategories: Category[];
  onClose: () => void;
}) {
  const [hoveredChild, setHoveredChild] = useState<string | null>(null);

  // Enfants directs de la catégorie racine
  const level1 = allCategories.filter((c) => c.parentSlug === rootSlug);

  // Sous-enfants de l'item survolé
  const level2 = hoveredChild
    ? allCategories.filter((c) => c.parentSlug === hoveredChild)
    : [];

  // Initialiser le premier item survolé
  useEffect(() => {
    if (level1.length > 0) setHoveredChild(level1[0].slug);
  }, [rootSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  if (level1.length === 0) return null;

  return (
    <div
      className="absolute top-full left-1/2 -translate-x-1/2 mt-0 z-50 flex shadow-2xl border border-white/10"
      style={{ minWidth: 520 }}
      onMouseLeave={onClose}
    >
      {/* Colonne gauche : sous-catégories niveau 1 */}
      <div className="bg-[#1a1a1a] py-6 min-w-[220px]">
        {/* Lien "Tout voir" */}
        <Link
          href={`/catalogue?category=${rootSlug}`}
          onClick={onClose}
          className="block px-6 py-2 text-[11px] font-black tracking-[0.2em] uppercase text-[#ff4a8d] hover:text-white transition-colors"
        >
          Tout voir →
        </Link>
        <div className="h-px bg-white/10 mx-4 my-2" />
        {level1.map((cat) => (
          <button
            key={cat.slug}
            onMouseEnter={() => setHoveredChild(cat.slug)}
            onClick={() => {
              onClose();
              window.location.href = `/catalogue?category=${cat.slug}`;
            }}
            className={`w-full text-left flex items-center justify-between px-6 py-3 text-[12px] font-semibold tracking-[0.1em] uppercase transition-all duration-150 ${
              hoveredChild === cat.slug
                ? "text-white bg-white/5 border-l-2 border-[#ff4a8d]"
                : "text-white/60 hover:text-white hover:bg-white/5 border-l-2 border-transparent"
            }`}
          >
            <span>{cat.name}</span>
            {allCategories.some((c) => c.parentSlug === cat.slug) && (
              <ChevronRight size={12} className="opacity-50" />
            )}
          </button>
        ))}
      </div>

      {/* Colonne droite : sous-sous-catégories */}
      {level2.length > 0 && (
        <div className="bg-[#111111] py-6 min-w-[200px] border-l border-white/5">
          {level2.map((cat) => (
            <Link
              key={cat.slug}
              href={`/catalogue?category=${cat.slug}`}
              onClick={onClose}
              className="block px-6 py-3 text-[12px] font-semibold tracking-[0.1em] uppercase text-white/50 hover:text-white hover:bg-white/5 transition-all duration-150"
            >
              {cat.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Header principal ─────────────────────────────────────────
export default function Header() {
  const { itemCount } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const pathname = usePathname();
  const isHome = pathname === "/";
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scroll listener
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Fermer le menu burger au changement de route
  useEffect(() => {
    setMobileOpen(false);
    setOpenMenu(null);
  }, [pathname]);

  // Charger les catégories depuis l'API
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://barberparadise-backend.onrender.com"}/api/categories`)
      .then((r) => r.json())
      .then((data: Category[]) => setAllCategories(data))
      .catch(() => {});
  }, []);

  const handleNavEnter = (label: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenMenu(label);
  };

  const handleNavLeave = () => {
    closeTimer.current = setTimeout(() => setOpenMenu(null), 150);
  };

  const handleMenuEnter = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled || !isHome
          ? "bg-[#131313]/95 backdrop-blur-md border-b border-white/5"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-[1440px] mx-auto px-6 md:px-10">
        <div className="flex items-center justify-between h-20">

          {/* ─── GAUCHE : Burger ─── */}
          <div className="flex items-center w-1/4">
            <button
              className="p-2 -ml-2 text-white hover:opacity-70 transition-opacity"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Menu"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>

          {/* ─── CENTRE : Logo officiel ─── */}
          <Link href="/" className="flex items-center justify-center w-1/2">
            <Image
              src="/logo-barberparadise.png"
              alt="Barber Paradise"
              width={140}
              height={60}
              className="object-contain h-12 w-auto"
              priority
            />
          </Link>

          {/* ─── DROITE : Icônes ─── */}
          <div className="flex items-center justify-end gap-5 w-1/4">
            <button className="text-white hover:text-[#ff4a8d] transition-colors hidden sm:block">
              <Search size={18} />
            </button>
            <Link href="/compte" className="text-white hover:text-[#ff4a8d] transition-colors hidden sm:block">
              <User size={18} />
            </Link>
            <Link href="/panier" className="relative group">
              <ShoppingBag size={20} className="text-white group-hover:text-[#ff4a8d] transition-colors" />
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 w-4 h-4 bg-[#ff4a8d] text-white text-[9px] font-black flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* ─── NAVIGATION DESKTOP avec mega-menu ─── */}
        <nav className="hidden md:flex items-center justify-center gap-2 pb-4">
          {NAV_MAIN.map((item) => {
            const isActive =
              pathname === item.href ||
              pathname.startsWith(item.href.split("?")[0] + "?");
            const hasMega = !!item.megaMenu;
            const isOpen = openMenu === item.label;

            return (
              <div
                key={item.label}
                className="relative"
                onMouseEnter={() => hasMega ? handleNavEnter(item.label) : undefined}
                onMouseLeave={hasMega ? handleNavLeave : undefined}
              >
                <Link
                  href={item.href}
                  className={`relative px-5 py-1.5 text-[11px] font-black tracking-[0.25em] uppercase transition-all duration-200 border flex items-center gap-1 ${
                    isActive || isOpen
                      ? "border-[#ff4a8d] text-white"
                      : "border-transparent text-white/60 hover:border-[#ff4a8d] hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>

                {/* Mega-menu déroulant */}
                {hasMega && isOpen && (
                  <div onMouseEnter={handleMenuEnter} onMouseLeave={handleNavLeave}>
                    <MegaMenu
                      rootSlug={item.megaMenu!.rootSlug}
                      allCategories={allCategories}
                      onClose={() => setOpenMenu(null)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* ─── MENU BURGER OVERLAY ─── */}
      {mobileOpen && (
        <div className="fixed inset-0 top-0 bg-[#0e0e0e] z-40 flex flex-col overflow-y-auto">
          {/* Header du menu */}
          <div className="flex items-center justify-between px-8 h-20 border-b border-white/5 flex-shrink-0">
            <Image
              src="/logo-barberparadise.png"
              alt="Barber Paradise"
              width={120}
              height={50}
              className="object-contain h-10 w-auto"
            />
            <button
              onClick={() => setMobileOpen(false)}
              className="p-2 text-white hover:text-[#ff4a8d] transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Liens principaux */}
          <nav className="flex flex-col px-8 pt-10 gap-1">
            {NAV_BURGER.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="group flex items-center justify-between py-4 border-b border-white/5 hover:border-[#ff4a8d]/30 transition-colors"
              >
                <span className="text-2xl font-black tracking-tighter uppercase italic text-white group-hover:text-[#ff4a8d] transition-colors">
                  {item.label}
                </span>
                <span className="text-[#ff4a8d] opacity-0 group-hover:opacity-100 transition-opacity text-xl font-black">→</span>
              </Link>
            ))}
          </nav>

          {/* Sous-catégories matériel dans le burger */}
          {allCategories.filter((c) => c.parentSlug === "materiel").length > 0 && (
            <div className="px-8 pt-6 pb-4">
              <p className="text-[10px] font-black tracking-[0.3em] uppercase text-[#ff4a8d] mb-4">
                MATÉRIEL — CATÉGORIES
              </p>
              <div className="grid grid-cols-2 gap-2">
                {allCategories
                  .filter((c) => c.parentSlug === "materiel")
                  .map((cat) => (
                    <Link
                      key={cat.slug}
                      href={`/catalogue?category=${cat.slug}`}
                      onClick={() => setMobileOpen(false)}
                      className="text-[11px] font-semibold tracking-[0.1em] uppercase text-white/50 hover:text-white py-2 border-b border-white/5 transition-colors"
                    >
                      {cat.name}
                    </Link>
                  ))}
              </div>
            </div>
          )}

          {/* Footer du menu */}
          <div className="mt-auto px-8 py-8 border-t border-white/5 flex-shrink-0">
            <p className="text-[10px] font-black tracking-[0.3em] uppercase text-gray-600">
              BARBER PARADISE — MATÉRIEL PROFESSIONNEL
            </p>
          </div>
        </div>
      )}
    </header>
  );
}
