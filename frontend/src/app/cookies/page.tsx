import LegalPage from "@/components/LegalPage";
import { legalPages } from "@/lib/legalPages";

export const metadata = {
  title: "Politique de cookies | Barber Paradise",
  description: "Informations sur les cookies, traceurs et choix de consentement sur Barber Paradise.",
};

export default function CookiesPage() {
  return <LegalPage content={legalPages.cookies} />;
}
