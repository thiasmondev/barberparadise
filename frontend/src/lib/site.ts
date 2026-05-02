export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://barberparadise.fr").replace(/\/$/, "");

export function absoluteUrl(path = "/"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalizedPath}`;
}
