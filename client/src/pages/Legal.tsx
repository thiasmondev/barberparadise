import { useParams } from "wouter";

const legalPages: Record<string, { title: string; content: React.ReactNode }> = {
  mentions: {
    title: "Mentions Légales",
    content: (
      <div className="space-y-6">
        <section>
          <h2 className="text-2xl font-black mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Informations Légales</h2>
          <p className="text-gray-700 leading-relaxed">
            Barber Paradise est une plateforme de vente en ligne de produits professionnels pour barbiers et coiffeurs. Tous les produits proposés sont des produits d'origine, garantis authentiques.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-black mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Responsabilité</h2>
          <p className="text-gray-700 leading-relaxed">
            Barber Paradise s'efforce de fournir des informations exactes et à jour sur ses produits. Cependant, nous ne pouvons être tenus responsables des erreurs, omissions ou inexactitudes dans les descriptions de produits.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-black mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>Propriété Intellectuelle</h2>
          <p className="text-gray-700 leading-relaxed">
            Tous les contenus du site (textes, images, logos, etc.) sont la propriété de Barber Paradise ou de ses partenaires. Toute reproduction ou utilisation sans autorisation est interdite.
          </p>
        </section>
      </div>
    ),
  },
  cgv: {
    title: "Conditions Générales de Vente",
    content: (
      <div className="space-y-6">
        <section>
          <h2 className="text-2xl font-black mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>1. Objet</h2>
          <p className="text-gray-700 leading-relaxed">
            Les présentes conditions générales régissent les relations commerciales entre Barber Paradise et ses clients pour la vente de produits en ligne.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-black mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>2. Commandes</h2>
          <p className="text-gray-700 leading-relaxed">
            Toute commande implique l'acceptation de ces conditions. Les commandes sont confirmées par email. Barber Paradise se réserve le droit de refuser ou d'annuler une commande.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-black mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>3. Livraison</h2>
          <p className="text-gray-700 leading-relaxed">
            La livraison est gratuite en points relais à partir de 54€. Les délais de livraison sont indicatifs et ne constituent pas un engagement contractuel.
          </p>
        </section>
      </div>
    ),
  },
  confidentialite: {
    title: "Politique de Confidentialité",
    content: (
      <div className="space-y-6">
        <section>
          <h2 className="text-2xl font-black mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>1. Collecte de Données</h2>
          <p className="text-gray-700 leading-relaxed">
            Barber Paradise collecte les données personnelles nécessaires pour traiter vos commandes et améliorer nos services.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-black mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>2. Protection des Données</h2>
          <p className="text-gray-700 leading-relaxed">
            Vos données sont protégées par un système de chiffrement SSL. Barber Paradise s'engage à ne pas partager vos données avec des tiers sans votre consentement.
          </p>
        </section>
      </div>
    ),
  },
  retours: {
    title: "Politique de Retours",
    content: (
      <div className="space-y-6">
        <section>
          <h2 className="text-2xl font-black mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>1. Délai de Rétractation</h2>
          <p className="text-gray-700 leading-relaxed">
            Vous disposez de 30 jours à compter de la réception de votre commande pour demander un retour ou un échange.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-black mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>2. Remboursement</h2>
          <p className="text-gray-700 leading-relaxed">
            Les remboursements sont traités sous 14 jours après réception et vérification du produit retourné.
          </p>
        </section>
      </div>
    ),
  },
};

export default function Legal() {
  const { page } = useParams<{ page: string }>();
  const content = legalPages[page as keyof typeof legalPages];

  if (!content) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-black text-gray-200 mb-4" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            PAGE INTROUVABLE
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-secondary text-white py-8">
        <div className="container">
          <h1 className="text-3xl md:text-4xl font-black uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            {content.title}
          </h1>
        </div>
      </div>

      <div className="container py-12">
        <div className="max-w-2xl mx-auto">
          {content.content}
        </div>
      </div>
    </div>
  );
}
