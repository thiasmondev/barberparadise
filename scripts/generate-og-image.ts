import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT_DIR = process.cwd();
const WIDTH = 1200;
const HEIGHT = 630;
const BACKGROUND = "#0A0A0A";
const PINK = "#E91E8C";
const GREY = "#A0A0A0";
const WHITE = "#FFFFFF";

const publicDir = path.join(ROOT_DIR, "frontend", "public");
const preferredLogoPath = path.join(publicDir, "logo_barber_paradise_blanc.png");
const fallbackLogoPath = path.join(publicDir, "logo-barberparadise.png");
const outputPath = path.join(publicDir, "og-image.jpg");

async function resolveLogoPath(): Promise<string> {
  try {
    await fs.access(preferredLogoPath);
    return preferredLogoPath;
  } catch {
    await fs.access(fallbackLogoPath);
    return fallbackLogoPath;
  }
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function generateOgImage() {
  const logoPath = await resolveLogoPath();
  await fs.mkdir(publicDir, { recursive: true });

  const logoHeight = Math.round(HEIGHT * 0.6);
  const logoBuffer = await sharp(logoPath)
    .resize({ height: logoHeight, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
  const logoMeta = await sharp(logoBuffer).metadata();
  const logoWidth = logoMeta.width ?? logoHeight;
  const renderedLogoHeight = logoMeta.height ?? logoHeight;

  const logoLeft = Math.round((520 - logoWidth) / 2);
  const logoTop = Math.round((HEIGHT - renderedLogoHeight) / 2);
  const separatorX = 575;
  const textX = 625;

  const overlaySvg = `
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${separatorX}" y="88" width="3" height="454" rx="1.5" fill="${PINK}" />
      <text x="${textX}" y="238" fill="${WHITE}" font-family="Arial, Helvetica, sans-serif" font-size="50" font-weight="800" letter-spacing="1.8">${escapeXml("BARBER PARADISE")}</text>
      <text x="${textX}" y="306" fill="${GREY}" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="500">${escapeXml("Matériel & Cosmétiques")}</text>
      <text x="${textX}" y="348" fill="${GREY}" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="500">${escapeXml("Barber Professionnels")}</text>
      <text x="${textX}" y="430" fill="${PINK}" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="700" letter-spacing="0.6">${escapeXml("barberparadise.fr")}</text>
    </svg>`;

  await sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 3,
      background: BACKGROUND,
    },
  })
    .composite([
      { input: logoBuffer, left: logoLeft, top: logoTop },
      { input: Buffer.from(overlaySvg), left: 0, top: 0 },
    ])
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(outputPath);

  console.log(`Open Graph image generated: ${outputPath}`);
}

generateOgImage().catch((error) => {
  console.error(error);
  process.exit(1);
});
