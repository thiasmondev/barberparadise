"use client";

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-20 text-center">
      <h1 className="font-heading font-bold text-6xl text-primary mb-4">404</h1>
      <h2 className="font-heading font-bold text-2xl text-dark-800 mb-3">
        Page non trouvée
      </h2>
      <p className="text-gray-500 mb-8">
        La page que vous recherchez n&apos;existe pas ou a été déplacée.
      </p>
      <Link href="/" className="btn-primary">
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
