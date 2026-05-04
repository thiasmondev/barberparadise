"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, ReactNode, useState, useEffect, useRef } from "react";
import { ShoppingBag, Search, Menu, X, User, ChevronRight, ChevronDown, LogOut, Heart, Package } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { isExactActiveHref } from "@/utils/navigation";
import { getMegaMenuChildren, hasMegaMenuChildren } from "@/utils/megaMenu";
import type { Brand } from "@/types";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { getProStatus } from "@/lib/customer-api";
import { searchProducts } from "@/lib/api";
import type { Product } from "@/types";

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
  { label: "NOUVEAUTÉS", href: "/nouveautes" },
  { label: "PRO", href: "/pro" },
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
  const colL1 = getMegaMenuChildren(allCategories, "produit");

  const [hoveredL1, setHoveredL1] = useState<string | null>(colL1[0]?.slug || null);
  const [hoveredL2, setHoveredL2] = useState<string | null>(null);

  useEffect(() => {
    if (colL1.length > 0 && !hoveredL1) setHoveredL1(colL1[0].slug);
  }, [colL1.length, hoveredL1]);

  // Colonne centre : enfants de l'item L1 survolé
  const colL2 = hoveredL1 ? getMegaMenuChildren(allCategories, hoveredL1) : [];

  // Colonne droite : enfants de l'item L2 survolé
  const colL3 = hoveredL2 ? getMegaMenuChildren(allCategories, hoveredL2) : [];

  if (colL1.length === 0) return null;

  return (
    <div
      className="absolute top-full left-1/2 -translate-x-1/2 mt-0 z-50 flex shadow-2xl border border-white/10"
      style={{ minWidth: 720 }}
      onMouseLeave={onClose}
    >
      {/* Colonne L1 : grandes catégories */}
      <div className="bg-[#1a1a1a] py-6 min-w-[200px] border-r border-white/5">
        <Link
          href="/catalogue"
          onClick={onClose}
          className="block px-6 py-2 text-[11px] font-black tracking-[0.2em] uppercase text-[#ff4a8d] hover:text-white transition-colors"
        >
          Tous les produits →
        </Link>
        <div className="h-px bg-white/10 mx-4 my-2" />
        {colL1.map((cat) => {
          const hasChildren = hasMegaMenuChildren(allCategories, cat.slug);

          return (
            <button
              key={cat.slug}
              onMouseEnter={() => {
                setHoveredL1(cat.slug);
                setHoveredL2(null);
              }}
              onClick={() => { onClose(); window.location.href = `/catalogue?category=${cat.slug}`; }}
              className={`w-full text-left flex items-center justify-between px-6 py-3 text-[12px] font-semibold tracking-[0.1em] uppercase transition-all duration-150 ${
                hoveredL1 === cat.slug
                  ? "text-white bg-white/5 border-l-2 border-[#ff4a8d]"
                  : "text-white/60 hover:text-white hover:bg-white/5 border-l-2 border-transparent"
              }`}
            >
              <span>{cat.name}</span>
              {hasChildren && <ChevronRight size={12} className="opacity-40" />}
            </button>
          );
        })}
      </div>

      {/* Colonne L2 : sous-catégories de l'item L1 survolé */}
      {colL2.length > 0 && (
        <div className="bg-[#111111] py-6 min-w-[240px] border-r border-white/5 flex flex-col">
          <Link
            href={`/catalogue?category=${hoveredL1}`}
            onClick={onClose}
            className="block px-6 py-2 text-[11px] font-black tracking-[0.2em] uppercase text-[#ff4a8d] hover:text-white transition-colors"
          >
            Tout voir →
          </Link>
          <div className="h-px bg-white/10 mx-4 my-2" />
          {colL2.map((cat) => {
            const hasChildren = hasMegaMenuChildren(allCategories, cat.slug);

            return (
              <Link
                key={cat.slug}
                href={`/catalogue?category=${cat.slug}`}
                onMouseEnter={() => setHoveredL2(cat.slug)}
                onClick={onClose}
                className={`flex items-center justify-between px-6 py-2.5 text-[12px] font-semibold tracking-[0.1em] uppercase transition-all duration-150 ${
                  hoveredL2 === cat.slug
                    ? "text-white bg-white/5"
                    : "text-white/55 hover:text-white hover:bg-white/5"
                }`}
              >
                <span>{cat.name}</span>
                {hasChildren && <ChevronRight size={12} className="opacity-40" />}
              </Link>
            );
          })}
        </div>
      )}

      {/* Colonne L3 : enfants de l'item L2 survolé, visible seulement s'ils existent */}
      {colL3.length > 0 && (
        <div className="bg-[#0c0c0c] py-6 min-w-[220px] flex flex-col">
          <Link
            href={`/catalogue?category=${hoveredL2}`}
            onClick={onClose}
            className="block px-6 py-2 text-[11px] font-black tracking-[0.2em] uppercase text-[#ff4a8d] hover:text-white transition-colors"
          >
            Tout voir →
          </Link>
          <div className="h-px bg-white/10 mx-4 my-2" />
          {colL3.map((cat) => (
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
  const colL1 = getMegaMenuChildren(allCategories, "materiel");

  const [hoveredL1, setHoveredL1] = useState<string | null>(colL1[0]?.slug || null);
  const [hoveredL2, setHoveredL2] = useState<string | null>(null);

  useEffect(() => {
    if (colL1.length > 0 && !hoveredL1) setHoveredL1(colL1[0].slug);
  }, [colL1.length, hoveredL1]);

  const colL2 = hoveredL1 ? getMegaMenuChildren(allCategories, hoveredL1) : [];
  const colL3 = hoveredL2 ? getMegaMenuChildren(allCategories, hoveredL2) : [];

  if (colL1.length === 0) return null;

  return (
    <div
      className="absolute top-full left-1/2 -translate-x-1/2 mt-0 z-50 flex shadow-2xl border border-white/10"
      style={{ minWidth: 720 }}
      onMouseLeave={onClose}
    >
      <div className="bg-[#1a1a1a] py-6 min-w-[240px] border-r border-white/5">
        <Link
          href="/catalogue?category=materiel"
          onClick={onClose}
          className="block px-6 py-2 text-[11px] font-black tracking-[0.2em] uppercase text-[#ff4a8d] hover:text-white transition-colors"
        >
          Tout voir — Matériel →
        </Link>
        <div className="h-px bg-white/10 mx-4 my-2" />
        {colL1.map((cat) => {
          const hasChildren = hasMegaMenuChildren(allCategories, cat.slug);

          return (
            <button
              key={cat.slug}
              onMouseEnter={() => {
                setHoveredL1(cat.slug);
                setHoveredL2(null);
              }}
              onClick={() => { onClose(); window.location.href = `/catalogue?category=${cat.slug}`; }}
              className={`w-full text-left flex items-center justify-between px-6 py-3 text-[12px] font-semibold tracking-[0.1em] uppercase transition-all duration-150 ${
                hoveredL1 === cat.slug
                  ? "text-white bg-white/5 border-l-2 border-[#ff4a8d]"
                  : "text-white/60 hover:text-white hover:bg-white/5 border-l-2 border-transparent"
              }`}
            >
              <span>{cat.name}</span>
              {hasChildren && <ChevronRight size={12} className="opacity-40" />}
            </button>
          );
        })}
      </div>

      {colL2.length > 0 ? (
        <div className="bg-[#111111] py-6 min-w-[220px] border-r border-white/5 flex flex-col">
          <Link
            href={`/catalogue?category=${hoveredL1}`}
            onClick={onClose}
            className="block px-6 py-2 text-[11px] font-black tracking-[0.2em] uppercase text-[#ff4a8d] hover:text-white transition-colors"
          >
            Tout voir →
          </Link>
          <div className="h-px bg-white/10 mx-4 my-2" />
          {colL2.map((cat) => {
            const hasChildren = hasMegaMenuChildren(allCategories, cat.slug);

            return (
              <Link
                key={cat.slug}
                href={`/catalogue?category=${cat.slug}`}
                onMouseEnter={() => setHoveredL2(cat.slug)}
                onClick={onClose}
                className={`flex items-center justify-between px-6 py-2.5 text-[12px] font-semibold tracking-[0.1em] uppercase transition-all duration-150 ${
                  hoveredL2 === cat.slug
                    ? "text-white bg-white/5"
                    : "text-white/55 hover:text-white hover:bg-white/5"
                }`}
              >
                <span>{cat.name}</span>
                {hasChildren && <ChevronRight size={12} className="opacity-40" />}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="bg-[#111111] min-w-[220px] border-r border-white/5 flex flex-col justify-between p-6">
          <div>
            <p className="text-[10px] font-black tracking-[0.3em] uppercase text-[#ff4a8d] mb-3">
              {colL1.find((c) => c.slug === hoveredL1)?.name || "Matériel"}
            </p>
            <p className="text-xs text-white/30 leading-relaxed">
              Découvrez notre sélection de matériel professionnel pour barbiers et coiffeurs.
            </p>
          </div>
          <Link
            href={`/catalogue?category=${hoveredL1}`}
            onClick={onClose}
            className="mt-6 inline-block bg-[#ff4a8d] text-white text-[10px] font-black tracking-[0.2em] uppercase px-4 py-2 hover:bg-[#ff1f70] transition-colors"
          >
            Voir tout →
          </Link>
        </div>
      )}

      {colL3.length > 0 && (
        <div className="bg-[#0c0c0c] py-6 min-w-[220px] flex flex-col">
          <Link
            href={`/catalogue?category=${hoveredL2}`}
            onClick={onClose}
            className="block px-6 py-2 text-[11px] font-black tracking-[0.2em] uppercase text-[#ff4a8d] hover:text-white transition-colors"
          >
            Tout voir →
          </Link>
          <div className="h-px bg-white/10 mx-4 my-2" />
          {colL3.map((cat) => (
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
  const { customer, isAuthenticated, logout } = useCustomerAuth();
  const [isApprovedPro, setIsApprovedPro] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [allCategories, setAllCategories] = useState<ApiCategory[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [pathname, setPathname] = useState("/");
  const [currentSearchParams, setCurrentSearchParams] = useState(() => new URLSearchParams());
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [mobileProduitsOpen, setMobileProduitsOpen] = useState(true);
  const [mobileMaterielOpen, setMobileMaterielOpen] = useState(false);
  const [mobileMarquesOpen, setMobileMarquesOpen] = useState(false);
  const [mobileOpenCategories, setMobileOpenCategories] = useState<Set<string>>(() => new Set());
  const isHome = pathname === "/";
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);


  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const syncLocation = () => {
      setPathname(window.location.pathname);
      setCurrentSearchParams(new URLSearchParams(window.location.search));
    };

    syncLocation();
    window.addEventListener("popstate", syncLocation);
    return () => window.removeEventListener("popstate", syncLocation);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setOpenMenu(null);
    setAccountOpen(false);
    setMobileOpenCategories(new Set());
  }, [pathname]);

  // Charger catégories et marques
  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated) {
      setIsApprovedPro(false);
    } else {
      getProStatus()
        .then((status) => { if (!cancelled) setIsApprovedPro(status.isApprovedPro); })
        .catch(() => { if (!cancelled) setIsApprovedPro(false); });
    }
    return () => { cancelled = true; };
  }, [isAuthenticated, customer?.id]);

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

  useEffect(() => {
    const query = searchTerm.trim();
    if (!searchOpen || query.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    const timer = setTimeout(() => {
      searchProducts(query)
        .then((results) => { if (!cancelled) setSearchResults(results); })
        .catch(() => { if (!cancelled) setSearchResults([]); })
        .finally(() => { if (!cancelled) setSearchLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchOpen, searchTerm]);

  const submitSearch = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const query = searchTerm.trim();
    if (!query) return;
    setSearchOpen(false);
    setMobileOpen(false);
    window.location.assign(`/catalogue?search=${encodeURIComponent(query)}`);
  };

  const toggleMobileCategory = (slug: string) => {
    setMobileOpenCategories((current) => {
      const next = new Set(current);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  };

  const renderMobileCategoryLinks = (parentSlug: string, depth = 0): ReactNode => {
    const children = allCategories
      .filter((cat) => cat.parentSlug === parentSlug)
      .sort((a, b) => a.order - b.order);

    if (children.length === 0) return null;

    return (
      <div className={depth === 0 ? "grid gap-1 py-2 pl-3" : "grid gap-1 border-l border-white/10 py-1 pl-4"}>
        {children.map((cat) => {
          const hasChildren = hasMegaMenuChildren(allCategories, cat.slug);
          const isOpen = mobileOpenCategories.has(cat.slug);

          return (
            <div key={cat.slug} className="min-w-0 border-b border-white/5 last:border-b-0">
              {hasChildren ? (
                <>
                  <button
                    type="button"
                    onClick={() => toggleMobileCategory(cat.slug)}
                    className="flex w-full min-w-0 items-center justify-between gap-3 py-2 text-left text-[12px] font-bold uppercase tracking-[0.12em] text-white/65 transition-colors hover:text-white"
                    aria-expanded={isOpen}
                  >
                    <span className="min-w-0 truncate">{cat.name}</span>
                    <ChevronRight size={14} className={`shrink-0 text-[#ff4a8d] transition-transform ${isOpen ? "rotate-90" : ""}`} />
                  </button>
                  {isOpen && renderMobileCategoryLinks(cat.slug, depth + 1)}
                </>
              ) : (
                <Link
                  href={`/catalogue?category=${cat.slug}`}
                  onClick={() => setMobileOpen(false)}
                  className="block min-w-0 truncate py-2 text-[12px] font-bold uppercase tracking-[0.12em] text-white/55 hover:text-white"
                >
                  {cat.name}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const handleCustomerLogout = () => {
    logout();
    setAccountOpen(false);
    window.location.assign("/");
  };

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-[90] md:sticky md:left-auto md:right-auto transition-all duration-300 ${
        scrolled || !isHome
          ? "bg-[#131313]/95 backdrop-blur-md border-b border-white/5"
          : "bg-transparent"
      }`}
    >
      {isApprovedPro && (
        <div className="w-full bg-[#ff4a8d] py-1 text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white">✓ COMPTE PROFESSIONNEL ACTIF — PRIX HT AFFICHÉS</p>
        </div>
      )}
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
            <div className="relative hidden sm:block">
              <button type="button" onClick={() => setSearchOpen((open) => !open)} className="text-white hover:text-[#ff4a8d] transition-colors" aria-label="Rechercher">
                <Search size={18} />
              </button>
              {searchOpen && (
                <div className="absolute right-0 top-8 z-50 w-80 border border-white/10 bg-[#111] p-3 shadow-2xl shadow-black/50">
                  <form onSubmit={submitSearch} className="flex gap-2">
                    <input autoFocus value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Rechercher un produit, une marque..." className="min-w-0 flex-1 border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-[#ff4a8d]" />
                    <button className="bg-[#ff4a8d] px-3 text-xs font-black uppercase tracking-widest text-white">OK</button>
                  </form>
                  <div className="mt-3 max-h-80 overflow-y-auto">
                    {searchLoading && <p className="px-2 py-3 text-xs uppercase tracking-widest text-white/45">Recherche...</p>}
                    {!searchLoading && searchTerm.trim().length >= 2 && searchResults.length === 0 && <p className="px-2 py-3 text-xs uppercase tracking-widest text-white/45">Aucun résultat</p>}
                    {searchResults.map((product) => (
                      <Link key={product.id} href={`/produit/${product.slug}`} onClick={() => setSearchOpen(false)} className="block border-b border-white/5 px-2 py-3 hover:bg-white/5">
                        <span className="block text-sm font-bold text-white">{product.name}</span>
                        <span className="block text-[11px] uppercase tracking-widest text-white/45">{product.brand}</span>
                      </Link>
                    ))}
                    {searchTerm.trim().length >= 2 && (
                      <button type="button" onClick={() => submitSearch()} className="mt-2 w-full border border-[#ff4a8d]/40 px-3 py-2 text-xs font-black uppercase tracking-widest text-[#ff4a8d] hover:bg-[#ff4a8d] hover:text-white">Voir tous les résultats</button>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="relative hidden sm:block">
              {!isAuthenticated ? (
                <Link href="/connexion" className="text-white hover:text-[#ff4a8d] transition-colors" aria-label="Connexion client">
                  <User size={18} />
                </Link>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setAccountOpen((open) => !open)}
                    className="flex items-center gap-1 text-white hover:text-[#ff4a8d] transition-colors"
                    aria-label="Menu compte client"
                    aria-expanded={accountOpen}
                  >
                    <User size={18} />
                    <ChevronDown size={12} className={accountOpen ? "rotate-180 transition-transform" : "transition-transform"} />
                  </button>
                  {accountOpen && (
                    <div className="absolute right-0 top-8 z-50 w-64 border border-white/10 bg-[#111] p-2 shadow-2xl shadow-black/40">
                      <div className="border-b border-white/10 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ff4a8d]">Compte client</p>
                        <p className="mt-1 truncate text-sm font-semibold text-white">{customer?.firstName} {customer?.lastName}</p>
                      </div>
                      <Link href="/compte" className="flex items-center gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-white/65 hover:bg-white/5 hover:text-white">
                        <User size={15} /> Mon compte
                      </Link>
                      <Link href="/compte?tab=commandes" className="flex items-center gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-white/65 hover:bg-white/5 hover:text-white">
                        <Package size={15} /> Mes commandes
                      </Link>
                      <Link href="/compte?tab=wishlist" className="flex items-center gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-white/65 hover:bg-white/5 hover:text-white">
                        <Heart size={15} /> Ma wishlist
                      </Link>
                      <div className="my-2 h-px bg-white/10" />
                      <button type="button" onClick={handleCustomerLogout} className="flex w-full items-center gap-3 px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.14em] text-red-300 hover:bg-red-500/10 hover:text-red-200">
                        <LogOut size={15} /> Se déconnecter
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
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
            const isActive = isExactActiveHref(pathname, currentSearchParams, item.href);
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
        <div className="fixed inset-0 top-0 bg-[#0e0e0e] z-[100] flex flex-col overflow-y-auto">
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

          <div className="px-8 pt-8">
            <form onSubmit={submitSearch} className="flex gap-2 border border-white/10 bg-black p-2">
              <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Rechercher" className="min-w-0 flex-1 bg-transparent px-2 text-sm text-white outline-none" />
              <button className="text-[#ff4a8d]" aria-label="Rechercher"><Search size={18} /></button>
            </form>
          </div>

          <nav className="flex flex-col px-8 pt-6 gap-1">
            <div className="border-b border-white/5 py-2">
              <button type="button" onClick={() => setMobileProduitsOpen((open) => !open)} className="flex w-full items-center justify-between py-3 text-left">
                <span className="text-2xl font-black tracking-tighter uppercase italic text-white">PRODUITS</span>
                <ChevronDown size={18} className={mobileProduitsOpen ? "rotate-180 text-[#ff4a8d]" : "text-[#ff4a8d]"} />
              </button>
              {mobileProduitsOpen && renderMobileCategoryLinks("produit")}
            </div>
            <div className="border-b border-white/5 py-2">
              <button type="button" onClick={() => setMobileMaterielOpen((open) => !open)} className="flex w-full items-center justify-between py-3 text-left">
                <span className="text-2xl font-black tracking-tighter uppercase italic text-white">MATÉRIEL</span>
                <ChevronDown size={18} className={mobileMaterielOpen ? "rotate-180 text-[#ff4a8d]" : "text-[#ff4a8d]"} />
              </button>
              {mobileMaterielOpen && renderMobileCategoryLinks("materiel")}
            </div>
            <div className="border-b border-white/5 py-2">
              <button type="button" onClick={() => setMobileMarquesOpen((open) => !open)} className="flex w-full items-center justify-between py-3 text-left">
                <span className="text-2xl font-black tracking-tighter uppercase italic text-white">MARQUES</span>
                <ChevronDown size={18} className={mobileMarquesOpen ? "rotate-180 text-[#ff4a8d]" : "text-[#ff4a8d]"} />
              </button>
              {mobileMarquesOpen && (
                <div className="grid grid-cols-2 gap-2 py-2 pl-3">
                  {brands.slice(0, 16).map((brand) => (
                    <Link key={brand.id} href={`/marques/${brand.slug}`} onClick={() => setMobileOpen(false)} className="truncate border-b border-white/5 py-2 text-[12px] font-bold uppercase tracking-[0.12em] text-white/55 hover:text-white">{brand.name}</Link>
                  ))}
                  <Link href="/marques" onClick={() => setMobileOpen(false)} className="col-span-2 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#ff4a8d]">Voir toutes les marques →</Link>
                </div>
              )}
            </div>
            <Link href="/nouveautes" onClick={() => setMobileOpen(false)} className="group flex items-center justify-between py-4 border-b border-white/5 hover:border-[#ff4a8d]/30 transition-colors"><span className="text-2xl font-black tracking-tighter uppercase italic text-white group-hover:text-[#ff4a8d]">NOUVEAUTÉS</span><span className="text-[#ff4a8d]">→</span></Link>
            <Link href="/pro" onClick={() => setMobileOpen(false)} className="group flex items-center justify-between py-4 border-b border-white/5 hover:border-[#ff4a8d]/30 transition-colors"><span className="text-2xl font-black tracking-tighter uppercase italic text-white group-hover:text-[#ff4a8d]">PRO</span><span className="text-[#ff4a8d]">→</span></Link>
            <div className="my-4 h-px bg-white/10" />
            <Link href={isAuthenticated ? "/compte" : "/connexion"} onClick={() => setMobileOpen(false)} className="group flex items-center justify-between py-4 border-b border-white/5 hover:border-[#ff4a8d]/30 transition-colors"><span className="text-xl font-black tracking-tighter uppercase italic text-white group-hover:text-[#ff4a8d]">{isAuthenticated ? "MON COMPTE" : "CONNEXION"}</span><User size={18} className="text-[#ff4a8d]" /></Link>
            <Link href="/panier" onClick={() => setMobileOpen(false)} className="group flex items-center justify-between py-4 border-b border-white/5 hover:border-[#ff4a8d]/30 transition-colors"><span className="text-xl font-black tracking-tighter uppercase italic text-white group-hover:text-[#ff4a8d]">PANIER</span><ShoppingBag size={18} className="text-[#ff4a8d]" /></Link>
          </nav>


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
