import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

type ProductRecord = {
  handle: string | null;
  slug: string | null;
};

type NextRedirect = {
  source: string;
  destination: string;
  permanent: boolean;
};

const frontendRoot = path.resolve(__dirname, "..");
const repositoryRoot = path.resolve(frontendRoot, "..");
const backendRoot = path.join(repositoryRoot, "backend");
const outputPath = path.join(frontendRoot, "src", "redirects", "products.json");
const requireFromBackend = createRequire(path.join(backendRoot, "package.json"));

function cleanSegment(value: string | null | undefined) {
  return (value ?? "").trim().replace(/^\/+|\/+$/g, "");
}

function hasValidPostgresUrl(value: string | undefined) {
  return Boolean(value && /^(postgresql|postgres):\/\//.test(value));
}

async function ensureBackendEnv() {
  try {
    const dotenv = requireFromBackend("dotenv") as { config: (options?: { path?: string; quiet?: boolean }) => void };
    dotenv.config({ path: path.join(backendRoot, ".env"), quiet: true });
    dotenv.config({ path: path.join(backendRoot, ".env.local"), quiet: true });
  } catch {
    // dotenv is a backend dependency in this project. If it is unavailable,
    // Prisma can still rely on an already exported DATABASE_URL.
  }
}

async function writeRedirects(redirects: NextRedirect[]) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(redirects, null, 2)}\n`, "utf8");
}

async function main() {
  await ensureBackendEnv();

  if (!hasValidPostgresUrl(process.env.DATABASE_URL)) {
    await writeRedirects([]);
    console.warn("DATABASE_URL est absente ou invalide : src/redirects/products.json a été généré vide.");
    return;
  }

  const { PrismaClient } = requireFromBackend("@prisma/client") as { PrismaClient: new () => any };
  const prisma = new PrismaClient();

  try {
    const products = (await prisma.product.findMany({
      select: {
        handle: true,
        slug: true,
      },
      orderBy: {
        slug: "asc",
      },
    })) as ProductRecord[];

    const seenSources = new Set<string>();
    const redirects = products.flatMap((product) => {
      const sourceSlug = cleanSegment(product.handle || product.slug);
      const destinationSlug = cleanSegment(product.slug);

      if (!sourceSlug || !destinationSlug) return [];

      const source = `/products/${sourceSlug}`;
      if (seenSources.has(source)) return [];
      seenSources.add(source);

      return [
        {
          source,
          destination: `/produit/${destinationSlug}`,
          permanent: true,
        },
      ];
    });

    await writeRedirects(redirects);
    console.log(`${redirects.length} redirection(s) produit générée(s) dans ${path.relative(repositoryRoot, outputPath)}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Erreur pendant la génération des redirections produits :", error);
  process.exit(1);
});
