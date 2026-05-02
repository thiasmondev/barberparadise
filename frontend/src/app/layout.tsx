import type { Metadata } from "next";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";
import { SITE_URL } from "@/lib/site";

const siteDescription =
  "Boutique en ligne spécialisée dans le matériel et les produits professionnels pour barbiers et coiffeurs. Tondeuses, ciseaux, rasoirs, soins et accessoires.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Barber Paradise - Matériel & Produits de Barbier Professionnel",
  description: siteDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: SITE_URL,
    siteName: "Barber Paradise",
    title: "Barber Paradise - Matériel & Produits de Barbier Professionnel",
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: "Barber Paradise - Matériel & Produits de Barbier Professionnel",
    description: siteDescription,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen flex flex-col">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
