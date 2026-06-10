import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LegalPage from "@/components/LegalPage";
import { getLegalPage } from "@/lib/api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Politique de cookies | Barber Paradise",
  description: "Informations relatives aux cookies Barber Paradise.",
};

export default async function Page() {
  try {
    const page = await getLegalPage("cookies");
    return <LegalPage page={page} />;
  } catch {
    notFound();
  }
}
