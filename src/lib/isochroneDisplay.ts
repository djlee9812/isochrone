import type { DurationMinutes } from "./types";

export type IsochroneCommitmentsSync = "apply" | "clear" | "leave";

/**
 * How the UI should treat cached contours for a target depart_at.
 * `nextCollection === undefined` means keep the currently displayed rings.
 */
export type IsochroneDisplayPlan = {
  status: "idle" | "loading";
  nextCollection: GeoJSON.FeatureCollection | null | undefined;
  syncCommitments: IsochroneCommitmentsSync;
};

/**
 * Stale-while-revalidate plan for isochrone polygons.
 * - Full cache hit → swap immediately (idle)
 * - Partial for the new key → show that preview while loading
 * - Origin change + empty → clear
 * - Same origin + empty → keep prior rings (dimmed) until fetch lands
 */
export function planIsochroneDisplay(args: {
  originChanged: boolean;
  needed: DurationMinutes[];
  assembled: GeoJSON.FeatureCollection;
}): IsochroneDisplayPlan {
  const { originChanged, needed, assembled } = args;

  if (needed.length === 0) {
    return {
      status: "idle",
      nextCollection: assembled,
      syncCommitments: "apply",
    };
  }

  if (assembled.features.length > 0) {
    return {
      status: "loading",
      nextCollection: assembled,
      syncCommitments: "apply",
    };
  }

  if (originChanged) {
    return {
      status: "loading",
      nextCollection: null,
      syncCommitments: "clear",
    };
  }

  return {
    status: "loading",
    nextCollection: undefined,
    syncCommitments: "leave",
  };
}
