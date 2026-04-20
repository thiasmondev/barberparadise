import Link from "next/link";
import { Mail, Phone, MapPin, Instagram, Facebook, Twitter } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-[#0e0e0e] text-[#e5e2e1] border-t border-white/5">
      <div className="max-w-[1440px] mx-auto px-8 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16">
          {/* Brand & Newsletter */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex flex-col mb-8 group">
              <span className="font-black text-2xl tracking-tighter text-white leading-none group-hover:text-[#ffb1c4] transition-colors">
                BARBER
              </span>
              <span className="font-bold text-[10px] text-[#ff4a8d] tracking-[0.4em] leading-none mt-1">
                PARADISE
              </span>
            </Link>
            <p className="text-xs text-gray-500 leading-relaxed mb-8 uppercase tracking-widest">
              Premium grooming essentials for the modern gentleman. Forged in tradition, refined for today.
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center hover:bg-[#ff4a8d] hover:border-[#ff4a8d] transition-all">
                <Instagram size={14} />
              </a>
              <a href="#" className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center hover:bg-[#ff4a8d] hover:border-[#ff4a8d] transition-all">
                <Facebook size={14} />
              </a>
              <a href="#" className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center hover:bg-[#ff4a8d] hover:border-[#ff4a8d] transition-all">
                <Twitter size={14} />
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="text-[10px] font-black tracking-[0.3em] text-white uppercase mb-8">MENU</h3>
            <ul className="space-y-4">
              {[
                { label: "NOUVEAUTÉS", href: "/catalogue?sort=newest" },
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
                { label: "POLITIQUE DE CONFIDENTIALITÉ", href: "/confidentialite" },
                { label: "LIVRAISON & RETOURS", href: "/livraison" },
                { label: "AFFILIATION", href: "/affiliation" },
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
              REJOIGNEZ L'ARSENAL POUR DES OFFRES EXCLUSIVES.
            </p>
            <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
              <input
                type="email"
                placeholder="VOTRE EMAIL"
                className="bg-transparent border-b border-white/10 py-3 text-[10px] tracking-widest uppercase focus:border-[#ff4a8d] outline-none transition-colors"
              />
              <button type="submit" className="bg-white text-black text-[10px] font-black tracking-[0.2em] py-4 uppercase hover:bg-[#ff4a8d] hover:text-white transition-all">
                S'ABONNER
              </button>
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
              "POLITIQUE DE REMBOURSEMENT",
              "POLITIQUE DE CONFIDENTIALITÉ",
              "CONDITIONS D'UTILISATION",
              "MENTIONS LÉGALES"
            ].map((text) => (
              <Link key={text} href="#" className="text-[9px] font-bold text-gray-600 hover:text-white transition-colors tracking-[0.1em] uppercase">
                {text}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
