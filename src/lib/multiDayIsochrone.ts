import type { DurationMinutes } from "./types";
import {
  assembleIsochrone,
  missingContours,
} from "./isochroneCache";

export type DayIsochroneNeed = {
  departAt: string;
  needed: DurationMinutes[];
  assembled: GeoJSON.FeatureCollection;
};

export type MultiDayIsochronePlan = {
  departAts: string[];
  /** Per-day cache resolution */
  days: DayIsochroneNeed[];
  /** Flat list of (departAt, contours) that still need Mapbox */
  fetchJobs: Array<{ departAt: string; contours: DurationMinutes[] }>;
  /** True when every selected day has all requested contours cached */
  fullyCached: boolean;
  /** Per-day collections (may be partial if still loading) */
  perDayAssembled: GeoJSON.FeatureCollection[];
};

/**
 * Resolve cache state for multiple depart_at keys.
 * Only days with missing contours appear in `fetchJobs`.
 */
export function planMultiDayIsochrone(
  lng: number,
  lat: number,
  departAts: string[],
  durations: DurationMinutes[],
): MultiDayIsochronePlan {
  const days: DayIsochroneNeed[] = departAts.map((departAt) => ({
    departAt,
    needed: missingContours(lng, lat, departAt, durations),
    assembled: assembleIsochrone(lng, lat, departAt, durations),
  }));

  const fetchJobs = days
    .filter((d) => d.needed.length > 0)
    .map((d) => ({ departAt: d.departAt, contours: d.needed }));

  return {
    departAts,
    days,
    fetchJobs,
    fullyCached: fetchJobs.length === 0,
    perDayAssembled: days.map((d) => d.assembled),
  };
}

/** True when every day has a non-empty feature list for the requested durations. */
export function allDaysHaveContours(
  perDayAssembled: GeoJSON.FeatureCollection[],
  durations: DurationMinutes[],
): boolean {
  if (perDayAssembled.length === 0) return false;
  return perDayAssembled.every((c) => {
    if (durations.length === 0) return true;
    return durations.every((m) =>
      c.features.some((f) => f.properties?.contour === m),
    );
  });
}

const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

/**
 * Collection to feed `planIsochroneDisplay` while fetching.
 * - Full aggregate when provided
 * - Single-day: partial per-day contours (stale-while-revalidate)
 * - Multi-day incomplete: empty (leave/clear via display plan)
 */
export function assembledForDisplay(
  plan: MultiDayIsochronePlan,
  aggregate: GeoJSON.FeatureCollection | null,
): GeoJSON.FeatureCollection {
  if (aggregate) return aggregate;
  if (plan.departAts.length === 1) {
    return plan.perDayAssembled[0] ?? EMPTY_FC;
  }
  return EMPTY_FC;
}
