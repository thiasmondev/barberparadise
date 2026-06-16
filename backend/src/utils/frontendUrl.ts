const OFFICIAL_FRONTEND_URL = "https://www.barberparadise.fr";

function normalizeUrl(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\/$/, "");
  return trimmed || null;
}

export function getFrontendUrl(): string {
  const configured = normalizeUrl(process.env.FRONTEND_URL) || normalizeUrl(process.env.CORS_ORIGIN);

  if (configured && configured !== OFFICIAL_FRONTEND_URL) {
    console.warn(
      `[frontend-url] FRONTEND_URL/CORS_ORIGIN pointe vers ${configured}. ` +
        `Utilisation du domaine officiel ${OFFICIAL_FRONTEND_URL} pour les liens transactionnels.`
    );
  }

  return OFFICIAL_FRONTEND_URL;
}

export { OFFICIAL_FRONTEND_URL };
