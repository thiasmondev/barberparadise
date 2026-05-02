import LegalPage from "@/components/LegalPage";
import { legalPages } from "@/lib/legalPages";

export const metadata = {
  title: "Mentions légales | Barber Paradise",
  description: "Mentions légales et informations d’édition du site Barber Paradise.",
};

export default function MentionsLegalesPage() {
  return <LegalPage content={legalPages.mentionsLegales} />;
}
