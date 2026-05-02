import LegalPage from "@/components/LegalPage";
import { legalPages } from "@/lib/legalPages";

export const metadata = {
  title: "Conditions générales | Barber Paradise",
  description: "Conditions d’utilisation, procédure de retour et politique de remboursement de Barber Paradise.",
};

export default function CgvPage() {
  return <LegalPage content={legalPages.cgv} />;
}
