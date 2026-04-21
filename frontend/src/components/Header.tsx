"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { ShoppingBag, Search, Menu, X, User } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { usePathname } from "next/navigation";

const NAV_MAIN = [
  { label: "PRODUITS", href: "/catalogue" },
  { label: "MATÉRIEL", href: "/catalogue?category=materiel" },
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

export default function Header() {
  const { itemCount } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Fermer le menu burger au changement de route
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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

        {/* ─── NAVIGATION DESKTOP : 4 items avec encadrement rose au survol ─── */}
        <nav className="hidden md:flex items-center justify-center gap-2 pb-4">
          {NAV_MAIN.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "?");
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`relative px-5 py-1.5 text-[11px] font-black tracking-[0.25em] uppercase transition-all duration-200 border ${
                  isActive
                    ? "border-[#ff4a8d] text-white"
                    : "border-transparent text-white/60 hover:border-[#ff4a8d] hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ─── MENU BURGER OVERLAY ─── */}
      {mobileOpen && (
        <div className="fixed inset-0 top-0 bg-[#0e0e0e] z-40 flex flex-col">
          {/* Header du menu */}
          <div className="flex items-center justify-between px-8 h-20 border-b border-white/5">
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

          {/* Liens */}
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

          {/* Footer du menu */}
          <div className="mt-auto px-8 py-8 border-t border-white/5">
            <p className="text-[10px] font-black tracking-[0.3em] uppercase text-gray-600">
              BARBER PARADISE — MATÉRIEL PROFESSIONNEL
            </p>
          </div>
        </div>
      )}
    </header>
  );
}
