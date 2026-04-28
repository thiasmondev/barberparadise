"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { ShoppingBag, Search, Menu, X, User, ChevronRight } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { usePathname, useSearchParams } from "next/navigation";
import { isExactActiveHref } from "@/utils/navigation";
import type { Brand } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://barberparadise-backend.onrender.com";

// ─── Types ────────────────────────────────────────────────────
interface ApiCategory {
  id: string;
  slug: string;
  name: string;
  parentSlug: string | null;
  order: number;
}

// Catégories racines principales (niveau 0) — exclure 'marque' qui est géré séparément
const EXCLUDED_ROOT_SLUGS = ["marque"];

interface NavItem {
  label: string;
  href: string;
  megaMenu?: "produits" | "materiel" | "marques";
}

const NAV_MAIN: NavItem[] = [
  { label: "PRODUITS", href: "/catalogue?category=produit", megaMenu: "produits" },
  { label: "MATÉRIEL", href: "/catalogue?category=materiel", megaMenu: "materiel" },
  { label: "MARQUES", href: "/marques", megaMenu: "marques" },
  { label: "NOUVEAUTÉS", href: "/catalogue?sort=newest" },
];

const NAV_BURGER = [
  { label: "PRODUITS", href: "/catalogue" },
  { label: "MATÉRIEL", href: "/catalogue?category=materiel" },
  { label: "TONDEUSES", href: "/catalogue?category=tondeuses" },
  { label: "RASAGE", href: "/catalogue?category=rasage" },
  { label: "BARBE", href: "/catalogue?category=barbe" },
  { label: "MARQUES", href: "/marques" },
  { label: "NOUVEAUTÉS", href: "/catalogue?sort=newest" },
  { label: "PROMOTIONS", href: "/catalogue?promo=true" },
];

// ─── Mega-menu PRODUITS ───────────────────────────────────────
function MegaMenuProduits({
  allCategories,
  onClose,
}: {
  allCategories: ApiCategory[];
  onClose: () => void;
}) {
  // Colonne gauche : enfants directs de 'produit' (CHEVEUX, BARBE...)
  const produitChildren = allCategories
    .filter((c) => c.parentSlug === "produit")
    .sort((a, b) => a.order - b.order);

  const [hoveredItem, setHoveredItem] = useState<string>(produitChildren[0]?.slug || "");

  useEffect(() => {
    if (produitChildren.length > 0 && !hoveredItem) setHoveredItem(produitChildren[0].slug);
  }, [produitChildren.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Colonne droite : enfants de l'item survolé en colonne gauche
  const subItems = allCategories
    .filter((c) => c.parentSlug === hoveredItem)
    .sort((a, b) => a.order - b.order);

  if (produitChildren.length === 0) return null;

  return (
    <div
      className="absolute top-full left-1/2 -translate-x-1/2 mt-0 z-50 flex shadow-2xl border border-white/10"
      style={{ minWidth: 680 }}
      onMouseLeave={onClose}
    >
      {/* Colonne gauche : grandes catégories */}
      <div className="bg-[#1a1a1a] py-6 min-w-[200px] border-r border-white/5">
        <Link
          href="/catalogue"
          onClick={onClose}
          className="block px-6 py-2 text-[11px] font-black tracking-[0.2em] uppercase text-[#ff4a8d] hover:text-white transition-colors"
        >
          Tous les produits →
        </Link>
        <div className="h-px bg-white/10 mx-4 my-2" />
        {produitChildren.map((cat) => (
          <button
            key={cat.slug}
            onMouseEnter={() => setHoveredItem(cat.slug)}
            onClick={() => { onClose(); window.location.href = `/catalogue?category=${cat.slug}`; }}
            className={`w-full text-left flex items-center justify-between px-6 py-3 text-[12px] font-semibold tracking-[0.1em] uppercase transition-all duration-150 ${
              hoveredItem === cat.slug
                ? "text-white bg-white/5 border-l-2 border-[#ff4a8d]"
                : "text-white/60 hover:text-white hover:bg-white/5 border-l-2 border-transparent"
            }`}
          >
            <span>{cat.name}</span>
            {allCategories.some((c) => c.parentSlug === cat.slug) && (
              <ChevronRight size={12} className="opacity-40" />
            )}
          </button>
        ))}
      </div>

      {/* Colonne droite : sous-catégories de l'item survolé */}
      {subItems.length > 0 && (
        <div className="bg-[#111111] py-6 min-w-[240px] flex flex-col">
          <Link
            href={`/catalogue?category=${hoveredItem}`}
            onClick={onClose}
            className="block px-6 py-2 text-[11px] font-black tracking-[0.2em] uppercase text-[#ff4a8d] hover:text-white transition-colors"
          >
            Tout voir →
          </Link>
          <div className="h-px bg-white/10 mx-4 my-2" />
          {subItems.map((cat) => (
            <Link
              key={cat.slug}
              href={`/catalogue?category=${cat.slug}`}
              onClick={onClose}
              className="block px-6 py-2.5 text-[12px] font-semibold tracking-[0.1em] uppercase text-white/55 hover:text-white hover:bg-white/5 transition-all duration-150"
            >
              {cat.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Mega-menu MATÉRIEL ───────────────────────────────────────
function MegaMenuMateriel({
  allCategories,
  onClose,
}: {
  allCategories: ApiCategory[];
  onClose: () => void;
}) {
  const level1 = allCategories
    .filter((c) => c.parentSlug === "materiel")
    .sort((a, b) => a.order - b.order);

  const [hoveredSub, setHoveredSub] = useState<string>(level1[0]?.slug || "");

  useEffect(() => {
    if (level1.length > 0) setHoveredSub(level1[0].slug);
  }, [level1.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const level2 = allCategories
    .filter((c) => c.parentSlug === hoveredSub)
    .sort((a, b) => a.order - b.order);

  if (level1.length === 0) return null;

  return (
    <div
      className="absolute top-full left-1/2 -translate-x-1/2 mt-0 z-50 flex shadow-2xl border border-white/10"
      style={{ minWidth: 520 }}
      onMouseLeave={onClose}
    >
      <div className="bg-[#1a1a1a] py-6 min-w-[240px]">
        <Link
          href="/catalogue?category=materiel"
          onClick={onClose}
          className="block px-6 py-2 text-[11px] font-black tracking-[0.2em] uppercase text-[#ff4a8d] hover:text-white transition-colors"
        >
          Tout voir — Matériel →
        </Link>
        <div className="h-px bg-white/10 mx-4 my-2" />
        {level1.map((cat) => (
          <button
            key={cat.slug}
            onMouseEnter={() => setHoveredSub(cat.slug)}
            onClick={() => { onClose(); window.location.href = `/catalogue?category=${cat.slug}`; }}
            className={`w-full text-left flex items-center justify-between px-6 py-3 text-[12px] font-semibold tracking-[0.1em] uppercase transition-all duration-150 ${
              hoveredSub === cat.slug
                ? "text-white bg-white/5 border-l-2 border-[#ff4a8d]"
                : "text-white/60 hover:text-white hover:bg-white/5 border-l-2 border-transparent"
            }`}
          >
            <span>{cat.name}</span>
            {allCategories.some((c) => c.parentSlug === cat.slug) && (
              <ChevronRight size={12} className="opacity-40" />
            )}
          </button>
        ))}
      </div>

      <div className="bg-[#111111] py-6 min-w-[200px] border-l border-white/5">
        {level2.length > 0 ? (
          <>
            <Link
              href={`/catalogue?category=${hoveredSub}`}
              onClick={onClose}
              className="block px-6 py-2 text-[11px] font-black tracking-[0.2em] uppercase text-[#ff4a8d] hover:text-white transition-colors"
            >
              Tout voir →
            </Link>
            <div className="h-px bg-white/10 mx-4 my-2" />
            {level2.map((cat) => (
              <Link
                key={cat.slug}
                href={`/catalogue?category=${cat.slug}`}
                onClick={onClose}
                className="block px-6 py-2.5 text-[12px] font-semibold tracking-[0.1em] uppercase text-white/55 hover:text-white hover:bg-white/5 transition-all duration-150"
              >
                {cat.name}
              </Link>
            ))}
          </>
        ) : (
          <div className="flex flex-col justify-between h-full p-6">
            <div>
              <p className="text-[10px] font-black tracking-[0.3em] uppercase text-[#ff4a8d] mb-3">
                {level1.find((c) => c.slug === hoveredSub)?.name || "Matériel"}
              </p>
              <p className="text-xs text-white/30 leading-relaxed">
                Découvrez notre sélection de matériel professionnel pour barbiers et coiffeurs.
              </p>
            </div>
            <Link
              href={`/catalogue?category=${hoveredSub}`}
              onClick={onClose}
              className="mt-6 inline-block bg-[#ff4a8d] text-white text-[10px] font-black tracking-[0.2em] uppercase px-4 py-2 hover:bg-[#ff1f70] transition-colors"
            >
              Voir tout →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Mega-menu MARQUES ────────────────────────────────────────
function MegaMenuMarques({
  brands,
  onClose,
}: {
  brands: Brand[];
  onClose: () => void;
}) {
  // Afficher les 20 premières marques (triées par nb de produits)
  const topBrands = [...brands]
    .sort((a, b) => b.productCount - a.productCount)
    .slice(0, 20);

  if (topBrands.length === 0) return null;

  return (
    <div
      className="absolute top-full left-1/2 -translate-x-1/2 mt-0 z-50 shadow-2xl border border-white/10 bg-[#1a1a1a]"
      style={{ minWidth: 560 }}
      onMouseLeave={onClose}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <p className="text-[10px] font-black tracking-[0.3em] uppercase text-[#ff4a8d]">
          NOS MARQUES
        </p>
        <Link
          href="/marques"
          onClick={onClose}
          className="text-[10px] font-black tracking-[0.2em] uppercase text-white/40 hover:text-white transition-colors"
        >
          Voir toutes →
        </Link>
      </div>

      {/* Grille marques */}
      <div className="grid grid-cols-4 gap-px bg-white/5 p-px">
        {topBrands.map((brand) => (
          <Link
            key={brand.id}
            href={`/marques/${brand.slug}`}
            onClick={onClose}
            className="group bg-[#1a1a1a] hover:bg-[#222] transition-colors p-4 flex flex-col items-center gap-2"
          >
            {brand.logo ? (
              <div className="relative w-12 h-8">
                <Image
                  src={brand.logo}
                  alt={brand.name}
                  fill
                  className="object-contain filter brightness-75 group-hover:brightness-110 transition-all"
                  sizes="48px"
                  unoptimized
                />
              </div>
            ) : (
              <div className="w-12 h-8 flex items-center justify-center">
                <span className="text-[11px] font-black text-white/25 group-hover:text-[#ff4a8d] transition-colors uppercase tracking-tighter text-center leading-tight">
                  {brand.name.slice(0, 4)}
                </span>
              </div>
            )}
            <p className="text-[9px] font-black tracking-[0.1em] uppercase text-white/40 group-hover:text-white transition-colors text-center leading-tight line-clamp-2">
              {brand.name}
            </p>
          </Link>
        ))}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-white/5">
        <Link
          href="/marques"
          onClick={onClose}
          className="block text-center text-[11px] font-black tracking-[0.3em] uppercase text-white/30 hover:text-[#ff4a8d] transition-colors"
        >
          Voir toutes les marques ({brands.length}) →
        </Link>
      </div>
    </div>
  );
}

// ─── Header principal ─────────────────────────────────────────
export default function Header() {
  const { itemCount } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [allCategories, setAllCategories] = useState<ApiCategory[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isHome = pathname === "/";
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);


  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setOpenMenu(null);
  }, [pathname]);

  // Charger catégories et marques
  useEffect(() => {
    fetch(`${API_URL}/api/categories`)
      .then((r) => r.json())
      .then((data: ApiCategory[]) => setAllCategories(data))
      .catch(() => {});

    fetch(`${API_URL}/api/brands`)
      .then((r) => r.json())
      .then((data: Brand[]) => setBrands(Array.isArray(data) ? data.filter((b) => b.productCount > 0) : []))
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

          {/* ─── CENTRE : Logo ─── */}
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

        {/* ─── NAVIGATION DESKTOP ─── */}
        <nav className="hidden md:flex items-center justify-center gap-2 pb-4">
          {NAV_MAIN.map((item) => {
            const isActive = isExactActiveHref(pathname, searchParams, item.href);
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

                {hasMega && isOpen && (
                  <div onMouseEnter={handleMenuEnter} onMouseLeave={handleNavLeave}>
                    {item.megaMenu === "produits" && (
                      <MegaMenuProduits allCategories={allCategories} onClose={() => setOpenMenu(null)} />
                    )}
                    {item.megaMenu === "materiel" && (
                      <MegaMenuMateriel allCategories={allCategories} onClose={() => setOpenMenu(null)} />
                    )}
                    {item.megaMenu === "marques" && (
                      <MegaMenuMarques brands={brands} onClose={() => setOpenMenu(null)} />
                    )}
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

          {/* Sous-catégories matériel */}
          {allCategories.filter((c) => c.parentSlug === "materiel").length > 0 && (
            <div className="px-8 pt-6 pb-4">
              <p className="text-[10px] font-black tracking-[0.3em] uppercase text-[#ff4a8d] mb-4">
                MATÉRIEL — CATÉGORIES
              </p>
              <div className="grid grid-cols-2 gap-2">
                {allCategories
                  .filter((c) => c.parentSlug === "materiel")
                  .sort((a, b) => a.order - b.order)
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

          {/* Marques dans le burger */}
          {brands.length > 0 && (
            <div className="px-8 pt-6 pb-4">
              <p className="text-[10px] font-black tracking-[0.3em] uppercase text-[#ff4a8d] mb-4">
                MARQUES
              </p>
              <div className="grid grid-cols-3 gap-2">
                {brands.slice(0, 9).map((brand) => (
                  <Link
                    key={brand.id}
                    href={`/marques/${brand.slug}`}
                    onClick={() => setMobileOpen(false)}
                    className="text-[11px] font-semibold tracking-[0.1em] uppercase text-white/50 hover:text-white py-2 border-b border-white/5 transition-colors truncate"
                  >
                    {brand.name}
                  </Link>
                ))}
              </div>
              <Link
                href="/marques"
                onClick={() => setMobileOpen(false)}
                className="mt-3 block text-[10px] font-black tracking-[0.2em] uppercase text-[#ff4a8d] hover:text-white transition-colors"
              >
                Voir toutes les marques →
              </Link>
            </div>
          )}

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
