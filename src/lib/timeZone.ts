import tzlookup from "tz-lookup";

/** Fallback when no pin is selected yet (map default center / Eastern). */
export const DEFAULT_TIME_ZONE = "America/New_York";

/**
 * IANA timezone for a map pin.
 * Returns null for invalid coordinates or lookup failure (do not guess Eastern).
 */
export function timeZoneForLngLat(lng: number, lat: number): string | null {
  if (
    !Number.isFinite(lng) ||
    !Number.isFinite(lat) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return null;
  }
  try {
    return tzlookup(lat, lng);
  } catch {
    return null;
  }
}
