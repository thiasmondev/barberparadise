import { PrismaClient } from "@prisma/client";
import { legalPagesSeed } from "../src/data/legalPagesSeed";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seed des pages légales Barber Paradise...");
  console.log("Commande Render Shell : npx ts-node scripts/seedLegalPages.ts");

  let upsertedCount = 0;

  for (const page of legalPagesSeed) {
    const savedPage = await prisma.legalPage.upsert({
      where: { slug: page.slug },
      create: {
        slug: page.slug,
        title: page.title,
        content: page.content,
      },
      update: {
        title: page.title,
        content: page.content,
      },
    });

    upsertedCount += 1;
    const excerpt = savedPage.content.slice(0, 160).replace(/\s+/g, " ").trim();
    console.log(
      `✅ ${savedPage.slug} — ${savedPage.title} — ${savedPage.content.length} caractères — ${excerpt}...`,
    );
  }

  console.log(`🎉 ${upsertedCount} pages légales upsertées avec succès.`);
}

main()
  .catch((error) => {
    console.error("❌ Erreur pendant le seed des pages légales:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
