import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LegalPage from "@/components/LegalPage";
import { getLegalPage } from "@/lib/api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mentions légales | Barber Paradise",
  description: "Mentions légales de Barber Paradise.",
};

export default async function Page() {
  try {
    const page = await getLegalPage("mentions-legales");
    return <LegalPage page={page} />;
  } catch {
    notFound();
  }
}
