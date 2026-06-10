import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LegalPage from "@/components/LegalPage";
import { getLegalPage } from "@/lib/api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Politique de confidentialité | Barber Paradise",
  description: "Politique de confidentialité Barber Paradise.",
};

export default async function Page() {
  try {
    const page = await getLegalPage("politique-de-confidentialite");
    return <LegalPage page={page} />;
  } catch {
    notFound();
  }
}
