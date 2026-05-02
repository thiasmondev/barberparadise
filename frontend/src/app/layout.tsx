import type { Metadata } from "next";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";
import { SITE_URL } from "@/lib/site";

const siteTitle = "Barber Paradise — Matériel & Cosmétiques Barber Professionnels";
const siteDescription =
  "Barber Paradise, la référence du matériel barber professionnel. Tondeuses, ciseaux, cosmétiques barber — Livraison rapide en France et en Europe.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: siteTitle,
    template: "%s | Barber Paradise",
  },
  description: siteDescription,
  keywords: [
    "barber",
    "tondeuse professionnelle",
    "matériel barbier",
    "ciseaux coiffeur",
    "cosmétiques barbe",
    "JRL",
    "Wahl",
    "Gamma+",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: SITE_URL,
    siteName: "Barber Paradise",
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Barber Paradise",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@barberparadise",
    title: siteTitle,
    description: siteDescription,
  },
  robots: {
    index: true,
    follow: true,
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
