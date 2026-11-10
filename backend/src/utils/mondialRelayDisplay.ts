/** Relay display data only: never use this on customer/contact addresses. */
export function cleanRelayDisplayText(value: string): string {
  return value.replace(/'{2,}/g, "'");
}

/**
 * Preserve the snapshot shape and all non-display values (especially the relay
 * identifier). Only known top-level relay display strings are normalized;
 * nested objects, customer addresses and non-object JSON values are untouched.
 */
export function normalizeRelayPointSnapshot<T>(value: T): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const snapshot = { ...value } as Record<string, unknown>;
  for (const key of ["name", "address", "city", "fullAddress", "relayPointName", "relayPointAddress"]) {
    if (typeof snapshot[key] === "string") {
      snapshot[key] = cleanRelayDisplayText(snapshot[key]);
    }
  }
  return snapshot as T;
}
