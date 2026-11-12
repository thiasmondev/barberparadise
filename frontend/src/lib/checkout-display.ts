/** Presentation only: never changes carrier IDs, relay data or shipping prices. */
export function formatShippingDisplayLabel(value: string): string {
  return value.replace(/mondial[_\s-]+relay/gi, "Mondial Relay");
}

/** Hide missing/placeholder distances instead of claiming a relay is zero metres away. */
export function formatRelayDistance(distance: number | null | undefined): string | null {
  if (typeof distance !== "number" || !Number.isFinite(distance) || distance <= 0) return null;
  return distance < 1000 ? `${distance} m` : `${(distance / 1000).toFixed(1)} km`;
}
