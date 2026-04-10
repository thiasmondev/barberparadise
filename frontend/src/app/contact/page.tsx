"use client";

import { Mail, Phone, MapPin, Clock } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12 sm:py-16">
      <div className="text-center mb-12">
        <h1 className="section-title">Contactez-nous</h1>
        <p className="section-subtitle mx-auto mt-3">
          Notre équipe est à votre disposition pour répondre à toutes vos questions.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Contact info */}
        <div className="space-y-6">
          {[
            {
              icon: Mail,
              title: "Email",
              content: "contact@barberparadise.fr",
              sub: "Réponse sous 24h",
            },
            {
              icon: Phone,
              title: "Téléphone",
              content: "01 23 45 67 89",
              sub: "Du lundi au vendredi",
            },
            {
              icon: Clock,
              title: "Horaires",
              content: "9h - 18h",
              sub: "Lundi au vendredi",
            },
            {
              icon: MapPin,
              title: "Adresse",
              content: "France",
              sub: "Vente en ligne uniquement",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl"
            >
              <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center shrink-0">
                <item.icon size={18} className="text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-dark-800">{item.title}</h3>
                <p className="text-sm text-dark-600">{item.content}</p>
                <p className="text-xs text-gray-500">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Contact form */}
        <div className="lg:col-span-2">
          <form className="bg-white border border-gray-100 rounded-xl p-6 sm:p-8 space-y-5" onSubmit={(e) => e.preventDefault()}>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1.5">
                  Prénom
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="Votre prénom"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-700 mb-1.5">
                  Nom
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="Votre nom"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-700 mb-1.5">
                Email
              </label>
              <input
                type="email"
                className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="votre@email.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-700 mb-1.5">
                Sujet
              </label>
              <select className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-dark-700">
                <option value="">Sélectionnez un sujet</option>
                <option value="commande">Question sur une commande</option>
                <option value="produit">Information produit</option>
                <option value="retour">Retour / Échange</option>
                <option value="partenariat">Partenariat</option>
                <option value="autre">Autre</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-700 mb-1.5">
                Message
              </label>
              <textarea
                rows={5}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                placeholder="Votre message..."
              />
            </div>
            <button type="submit" className="btn-primary w-full py-3.5">
              Envoyer le message
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
