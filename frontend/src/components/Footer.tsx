"use client";

import Link from "next/link";
import Image from "next/image";
import { Instagram, Youtube } from "lucide-react";
import { useState } from "react";
import { API_URL } from "@/lib/api";

function TikTokIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M16.6 5.82a5.58 5.58 0 0 0 3.34 1.12v3.18a8.82 8.82 0 0 1-3.3-.66v5.48a6.08 6.08 0 1 1-5.2-6.02v3.28a2.87 2.87 0 1 0 2.02 2.74V2h3.14a5.6 5.6 0 0 0 0 3.82Z" />
    </svg>
  );
}

const socialLinks = [
  {
    label: "Instagram Barber Paradise",
    href: "https://www.instagram.com/barberparadiseoff/",
    icon: <Instagram size={14} aria-hidden="true" />,
  },
  {
    label: "TikTok Barber Paradise",
    href: "https://www.tiktok.com/@barberparadiseoff",
    icon: <TikTokIcon size={14} />,
  },
  {
    label: "YouTube Barber Paradise",
    href: "https://www.youtube.com/@Barberparadiseoff",
    icon: <Youtube size={14} aria-hidden="true" />,
  },
];

export default function Footer() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      setMessage("Veuillez saisir un email valide.");
      setMessageType("error");
      return;
    }

    setLoading(true);
    setMessage("");
    setMessageType(null);

    try {
      const res = await fetch(`${API_URL}/api/newsletter/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok) {
        setMessage("Merci pour votre inscription !");
        setMessageType("success");
        setEmail("");
      } else {
        setMessage(data?.error || "Impossible de finaliser l’inscription.");
        setMessageType("error");
      }
    } catch (error) {
      setMessage("Erreur de connexion. Veuillez réessayer.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <footer className="bg-[#0e0e0e] text-[#e5e2e1] border-t border-white/5">
      <div className="max-w-[1440px] mx-auto px-8 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16">
          {/* Brand & Newsletter */}
          <div className="lg:col-span-1">
            <Link href="/" className="inline-block mb-8 group">
              <Image
                src="/logo-barberparadise.png"
                alt="Barber Paradise"
                width={160}
                height={65}
                className="object-contain h-14 w-auto opacity-90 group-hover:opacity-100 transition-opacity"
              />
            </Link>
            <p className="text-xs text-gray-500 leading-relaxed mb-8 uppercase tracking-widest">
              Premium grooming essentials for the modern gentleman. Forged in tradition, refined for today.
            </p>
            <div className="flex gap-4" aria-label="Réseaux sociaux Barber Paradise">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center hover:bg-[#ff4a8d] hover:border-[#ff4a8d] transition-all"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="text-[10px] font-black tracking-[0.3em] text-white uppercase mb-8">MENU</h3>
            <ul className="space-y-4">
              {[
                { label: "NOUVEAUTÉS", href: "/nouveautes" },
                { label: "PRO", href: "/pro" },
                { label: "PRODUITS", href: "/catalogue" },
                { label: "MATÉRIEL", href: "/catalogue?category=materiel" },
                { label: "MARQUES", href: "/catalogue" },
                { label: "PROMO", href: "/catalogue?promo=true" },
                { label: "CONTACT", href: "/contact" },
              ].map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-[10px] font-bold text-gray-500 hover:text-[#ffb1c4] transition-colors tracking-widest uppercase"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal & Info */}
          <div>
            <h3 className="text-[10px] font-black tracking-[0.3em] text-white uppercase mb-8">AIDE</h3>
            <ul className="space-y-4">
              {[
                { label: "RECHERCHE", href: "/catalogue" },
                { label: "CONDITIONS GÉNÉRALES", href: "/cgv" },
                { label: "POLITIQUE DE CONFIDENTIALITÉ", href: "/politique-de-confidentialite" },
                { label: "COOKIES", href: "/cookies" },
                { label: "MENTIONS LÉGALES", href: "/mentions-legales" },
              ].map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-[10px] font-bold text-gray-500 hover:text-[#ffb1c4] transition-colors tracking-widest uppercase"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact & Newsletter */}
          <div>
            <h3 className="text-[10px] font-black tracking-[0.3em] text-white uppercase mb-8">S'ABONNER</h3>
            <p className="text-[10px] text-gray-500 tracking-widest uppercase mb-6">
              LET'S GO TO PARADISE POUR DES OFFRES EXCLUSIVES.
            </p>
            <form className="flex flex-col gap-4" onSubmit={handleSubscribe} noValidate>
              <input
                type="email"
                placeholder="VOTRE EMAIL"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-transparent border-b border-white/10 py-3 text-[10px] tracking-widest uppercase focus:border-[#ff4a8d] outline-none transition-colors"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-white text-black text-[10px] font-black tracking-[0.2em] py-4 uppercase hover:bg-[#ff4a8d] hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "ENVOI..." : "S'ABONNER"}
              </button>
              {message && (
                <p
                  className={`text-[9px] tracking-widest uppercase ${
                    messageType === "success" ? "text-[#ffb1c4]" : "text-red-300"
                  }`}
                  role="status"
                >
                  {message}
                </p>
              )}
            </form>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-white/5 mt-20 pt-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-[9px] font-bold text-gray-600 tracking-[0.2em] uppercase">
            © {new Date().getFullYear()} BARBER PARADISE. TOUS DROITS RÉSERVÉS.
          </p>
          <div className="flex flex-wrap justify-center gap-8">
            {[
              { label: "CGV", href: "/cgv" },
              { label: "POLITIQUE DE CONFIDENTIALITÉ", href: "/politique-de-confidentialite" },
              { label: "COOKIES", href: "/cookies" },
              { label: "MENTIONS LÉGALES", href: "/mentions-legales" },
            ].map((link) => (
              <Link key={link.label} href={link.href} className="text-[9px] font-bold text-gray-600 hover:text-white transition-colors tracking-[0.1em] uppercase">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
