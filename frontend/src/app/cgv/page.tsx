import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LegalPage from "@/components/LegalPage";
import { getLegalPage } from "@/lib/api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Conditions générales | Barber Paradise",
  description: "Conditions générales de vente Barber Paradise.",
};

export default async function Page() {
  try {
    const page = await getLegalPage("cgv");
    return <LegalPage page={page} />;
  } catch {
    notFound();
  }
}
