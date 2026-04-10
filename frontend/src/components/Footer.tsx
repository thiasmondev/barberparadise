import Link from "next/link";
import { Mail, Phone, MapPin } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-dark-800 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center">
                <span className="text-white font-heading font-bold">BP</span>
              </div>
              <div>
                <span className="font-heading font-bold text-white text-lg leading-none block">
                  BARBER
                </span>
                <span className="font-heading text-[10px] text-primary tracking-[0.2em] block">
                  PARADISE
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Votre boutique en ligne spécialisée dans le matériel et les produits
              professionnels pour barbiers et coiffeurs.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="font-heading font-semibold text-white text-sm uppercase tracking-wider mb-4">
              Navigation
            </h3>
            <ul className="space-y-2.5">
              {[
                { label: "Accueil", href: "/" },
                { label: "Catalogue", href: "/catalogue" },
                { label: "Nouveautés", href: "/catalogue?sort=newest" },
                { label: "Promotions", href: "/catalogue?promo=true" },
                { label: "Contact", href: "/contact" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-400 hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Informations */}
          <div>
            <h3 className="font-heading font-semibold text-white text-sm uppercase tracking-wider mb-4">
              Informations
            </h3>
            <ul className="space-y-2.5">
              {[
                { label: "Mentions légales", href: "/mentions-legales" },
                { label: "CGV", href: "/cgv" },
                { label: "Politique de confidentialité", href: "/confidentialite" },
                { label: "Livraison & Retours", href: "/livraison" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-400 hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-heading font-semibold text-white text-sm uppercase tracking-wider mb-4">
              Contact
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-2.5">
                <Mail size={16} className="text-primary mt-0.5 shrink-0" />
                <span className="text-sm text-gray-400">contact@barberparadise.fr</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Phone size={16} className="text-primary mt-0.5 shrink-0" />
                <span className="text-sm text-gray-400">01 23 45 67 89</span>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin size={16} className="text-primary mt-0.5 shrink-0" />
                <span className="text-sm text-gray-400">France</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-dark-700 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} Barber Paradise. Tous droits réservés.
          </p>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500">Paiement sécurisé</span>
            <div className="flex items-center gap-2 text-gray-500">
              <span className="text-xs bg-dark-700 px-2 py-0.5 rounded">VISA</span>
              <span className="text-xs bg-dark-700 px-2 py-0.5 rounded">MC</span>
              <span className="text-xs bg-dark-700 px-2 py-0.5 rounded">CB</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
