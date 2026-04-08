// ============================================================
// BARBER PARADISE — Footer
// Couleurs: Secondary #252525 bg / White text
// ============================================================

import { Link } from "wouter";
import { MapPin, Phone, Mail, Instagram, Facebook, Youtube } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-secondary text-white">
      {/* Main footer */}
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <span className="text-white font-black text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>BP</span>
              </div>
              <span className="font-black text-xl tracking-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                BARBER<span className="text-primary">PARADISE</span>
              </span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              La meilleure sélection de produits professionnels pour barbiers et coiffeurs. Matériel haut de gamme, produits de soins et accessoires.
            </p>
            <div className="flex gap-3">
              <a href="#" className="w-9 h-9 bg-white/10 hover:bg-primary flex items-center justify-center transition-colors rounded-sm" aria-label="Instagram">
                <Instagram size={16} />
              </a>
              <a href="#" className="w-9 h-9 bg-white/10 hover:bg-primary flex items-center justify-center transition-colors rounded-sm" aria-label="Facebook">
                <Facebook size={16} />
              </a>
              <a href="#" className="w-9 h-9 bg-white/10 hover:bg-primary flex items-center justify-center transition-colors rounded-sm" aria-label="Youtube">
                <Youtube size={16} />
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="font-black uppercase tracking-wider mb-4 text-white" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1rem" }}>
              Navigation
            </h3>
            <ul className="space-y-2">
              {[
                { label: "Nouveautés", href: "/catalogue?filter=new" },
                { label: "Produits", href: "/catalogue?category=produits" },
                { label: "Matériel", href: "/catalogue?category=materiel" },
                { label: "Marques", href: "/marques" },
                { label: "Promotions", href: "/catalogue?filter=promo" },
                { label: "Blog", href: "/blog" },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-gray-400 hover:text-primary transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Mon compte */}
          <div>
            <h3 className="font-black uppercase tracking-wider mb-4 text-white" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1rem" }}>
              Mon Compte
            </h3>
            <ul className="space-y-2">
              {[
                { label: "Se connecter", href: "/connexion" },
                { label: "Créer un compte", href: "/inscription" },
                { label: "Mon profil", href: "/compte" },
                { label: "Mes commandes", href: "/compte/commandes" },
                { label: "Ma wishlist", href: "/wishlist" },
                { label: "Contact", href: "/contact" },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-gray-400 hover:text-primary transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact & Infos */}
          <div>
            <h3 className="font-black uppercase tracking-wider mb-4 text-white" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1rem" }}>
              Informations
            </h3>
            <div className="space-y-3 text-sm text-gray-400">
              <div className="flex items-start gap-2">
                <MapPin size={15} className="text-primary flex-shrink-0 mt-0.5" />
                <span>France Métropolitaine<br />Livraison dans toute la France</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={15} className="text-primary flex-shrink-0" />
                <a href="tel:+33000000000" className="hover:text-primary transition-colors">+33 (0)X XX XX XX XX</a>
              </div>
              <div className="flex items-center gap-2">
                <Mail size={15} className="text-primary flex-shrink-0" />
                <a href="mailto:contact@barberparadise.fr" className="hover:text-primary transition-colors">contact@barberparadise.fr</a>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Paiement sécurisé</p>
              <div className="flex gap-2">
                {["VISA", "MC", "CB", "PP"].map((card) => (
                  <div key={card} className="bg-white/10 px-2 py-1 text-xs font-bold text-gray-300 rounded-sm">
                    {card}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="container py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500">
          <p>© {new Date().getFullYear()} Barber Paradise. Tous droits réservés.</p>
          <div className="flex gap-4">
            <Link href="/mentions-legales" className="hover:text-primary transition-colors">Mentions légales</Link>
            <Link href="/cgv" className="hover:text-primary transition-colors">CGV</Link>
            <Link href="/confidentialite" className="hover:text-primary transition-colors">Confidentialité</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
