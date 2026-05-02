import LegalPage from "@/components/LegalPage";
import { legalPages } from "@/lib/legalPages";

export const metadata = {
  title: "Politique de confidentialité | Barber Paradise",
  description: "Politique de confidentialité, données personnelles et droits RGPD de Barber Paradise.",
};

export default function PolitiqueConfidentialitePage() {
  return <LegalPage content={legalPages.politiqueConfidentialite} />;
}
