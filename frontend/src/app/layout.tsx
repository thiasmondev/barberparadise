import type { Metadata } from "next";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";

export const metadata: Metadata = {
  title: "Barber Paradise - Matériel & Produits de Barbier Professionnel",
  description:
    "Boutique en ligne spécialisée dans le matériel et les produits professionnels pour barbiers et coiffeurs. Tondeuses, ciseaux, rasoirs, soins et accessoires.",
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
