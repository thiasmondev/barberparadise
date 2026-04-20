"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { ShoppingBag, Search, Menu, X, User, Moon, Sun } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "NOUVEAUTÉS", href: "/catalogue?sort=newest" },
  { label: "PRODUITS", href: "/catalogue" },
  { label: "MATÉRIEL", href: "/catalogue?category=materiel" },
  { label: "MARQUES", href: "/catalogue" },
  { label: "PROMO", href: "/catalogue?promo=true" },
  { label: "CONTACT", href: "/contact" },
];

export default function Header() {
  const { itemCount } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header 
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled || !isHome 
          ? "bg-[#131313]/95 backdrop-blur-md border-b border-white/5 py-2" 
          : "bg-transparent py-4"
      }`}
    >
      <div className="max-w-[1440px] mx-auto px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Menu & Search Label */}
          <div className="flex items-center gap-6 w-1/3">
            <button
              className="p-2 -ml-2 text-white hover:opacity-70 transition-opacity"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Menu"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <span className="hidden md:block text-[10px] font-black tracking-[0.3em] text-white uppercase">
              RECHERCHE
            </span>
          </div>

          {/* Center: Logo */}
          <Link href="/" className="flex items-center justify-center w-1/3 group">
            <div className="relative flex flex-col items-center">
              <span className="font-black text-2xl tracking-tighter text-white leading-none group-hover:text-[#ffb1c4] transition-colors">
                BARBER
              </span>
              <span className="font-bold text-[10px] text-[#ff4a8d] tracking-[0.4em] leading-none mt-1">
                PARADISE
              </span>
            </div>
          </Link>

          {/* Right: Actions */}
          <div className="flex items-center justify-end gap-6 w-1/3">
            <button className="text-white hover:opacity-70 transition-opacity hidden sm:block">
              <Moon size={18} />
            </button>
            <button className="text-white hover:opacity-70 transition-opacity">
              <Search size={18} />
            </button>
            <div className="w-px h-4 bg-white/10 hidden md:block"></div>
            <Link href="/compte" className="text-white hover:opacity-70 transition-opacity hidden sm:block">
              <User size={18} />
            </Link>
            <Link href="/panier" className="relative group">
              <ShoppingBag size={22} className="text-white group-hover:text-[#ffb1c4] transition-colors" />
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] font-black text-white mt-[3px]">
                {itemCount}
              </span>
            </Link>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center justify-center gap-10 mt-4 pb-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-[10px] font-black tracking-[0.2em] text-white/70 hover:text-white transition-colors uppercase"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 top-[72px] bg-[#131313] z-40 md:hidden animate-fade-in">
          <nav className="flex flex-col p-8 gap-6">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="text-2xl font-black tracking-tighter text-white uppercase italic hover:text-[#ff4a8d] transition-colors"
              >
                {item.label}
              </Link>
            ))}
            <div className="h-px bg-white/5 my-4"></div>
            <Link
              href="/compte"
              onClick={() => setMobileOpen(false)}
              className="text-lg font-bold text-white/50 uppercase tracking-widest"
            >
              MON COMPTE
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
