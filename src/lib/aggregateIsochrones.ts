import bbox from "@turf/bbox";
import cleanCoords from "@turf/clean-coords";
import { feature, featureCollection } from "@turf/helpers";
import intersect from "@turf/intersect";
import union from "@turf/union";
import type { DurationMinutes, ReachMode } from "./types";
import { pointInPolygon } from "./pointInPolygon";
import { contourPolygon, type GridScalar } from "./marchingSquares";

const CONTOUR_COLORS: Record<number, string> = {
  15: "5BA8A0",
  30: "2F7A8A",
  60: "1E4A66",
};

/** Cells along the longer bbox axis. Higher = smoother Typical rings, more CPU. */
const GRID_LONG_SIDE = 256;
/** Expand bbox so edge samples aren’t clipped to the union outline. */
const BBOX_PAD_FRAC = 0.02;
const UNREACHABLE = Number.POSITIVE_INFINITY;

export type AggregateResult = {
  collection: GeoJSON.FeatureCollection;
  /** Contour minutes that had no overlap under worst-case intersection */
  emptyContours: DurationMinutes[];
};

/**
 * Combine per-day isochrone FeatureCollections into one set of rings.
 * Single day → identity. Multi-day uses reach mode.
 */
export function aggregateIsochrones(
  dayCollections: GeoJSON.FeatureCollection[],
  durations: DurationMinutes[],
  mode: ReachMode,
): AggregateResult {
  const sorted = [...durations].sort((a, b) => b - a);
  if (dayCollections.length === 0) {
    return { collection: featureCollection([]), emptyContours: [] };
  }
  if (dayCollections.length === 1) {
    const features = sorted
      .map((m) => findContourFeature(dayCollections[0]!, m))
      .filter((f): f is GeoJSON.Feature => f != null);
    return {
      collection: { type: "FeatureCollection", features },
      emptyContours: [],
    };
  }

  if (mode === "typical") {
    return averageContours(dayCollections, sorted);
  }

  const emptyContours: DurationMinutes[] = [];
  const features: GeoJSON.Feature[] = [];

  for (const minutes of sorted) {
    const dayFeatures = dayCollections
      .map((c) => findContourFeature(c, minutes))
      .filter((f): f is GeoJSON.Feature => f != null);

    if (dayFeatures.length === 0) {
      emptyContours.push(minutes);
      continue;
    }
    // Worst case needs every day present; missing day → empty for that contour
    if (mode === "worst" && dayFeatures.length < dayCollections.length) {
      emptyContours.push(minutes);
      continue;
    }

    const merged =
      mode === "worst"
        ? intersectFeatures(dayFeatures)
        : unionFeatures(dayFeatures);

    if (!merged) {
      emptyContours.push(minutes);
      continue;
    }

    features.push(contourFeature(merged, minutes));
  }

  return {
    collection: { type: "FeatureCollection", features },
    emptyContours,
  };
}

function contourFeature(
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
  minutes: DurationMinutes,
): GeoJSON.Feature {
  const color = CONTOUR_COLORS[minutes] ?? "2F7A8A";
  return feature(geometry, {
    contour: minutes,
    color,
    fill: `#${color}`,
    fillOpacity: 0.33,
    "fill-opacity": 0.33,
    opacity: 0.33,
  });
}

function findContourFeature(
  collection: GeoJSON.FeatureCollection,
  minutes: DurationMinutes,
): GeoJSON.Feature | null {
  for (const f of collection.features) {
    const contour = Number(f.properties?.contour);
    if (contour === minutes && f.geometry) return f;
  }
  return null;
}

function asPolyFeature(
  f: GeoJSON.Feature,
): GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null {
  const g = f.geometry;
  if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) return null;
  try {
    return cleanCoords(
      feature(g),
    ) as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
  } catch {
    return feature(g) as GeoJSON.Feature<
      GeoJSON.Polygon | GeoJSON.MultiPolygon
    >;
  }
}

function intersectFeatures(
  features: GeoJSON.Feature[],
): GeoJSON.Polygon | GeoJSON.MultiPolygon | null {
  let acc = asPolyFeature(features[0]!);
  if (!acc) return null;
  for (let i = 1; i < features.length; i++) {
    const next = asPolyFeature(features[i]!);
    if (!next) return null;
    const result = intersect(featureCollection([acc, next]));
    if (!result?.geometry) return null;
    if (
      result.geometry.type !== "Polygon" &&
      result.geometry.type !== "MultiPolygon"
    ) {
      return null;
    }
    acc = result as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
  }
  return acc.geometry;
}

function unionFeatures(
  features: GeoJSON.Feature[],
): GeoJSON.Polygon | GeoJSON.MultiPolygon | null {
  let acc = asPolyFeature(features[0]!);
  if (!acc) return null;
  for (let i = 1; i < features.length; i++) {
    const next = asPolyFeature(features[i]!);
    if (!next) continue;
    const result = union(featureCollection([acc, next]));
    if (!result?.geometry) continue;
    if (
      result.geometry.type !== "Polygon" &&
      result.geometry.type !== "MultiPolygon"
    ) {
      continue;
    }
    acc = result as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
  }
  return acc.geometry;
}

function averageContours(
  dayCollections: GeoJSON.FeatureCollection[],
  sortedLargeToSmall: DurationMinutes[],
): AggregateResult {
  const allFeatures = dayCollections.flatMap((c) => c.features);
  if (allFeatures.length === 0) {
    return { collection: featureCollection([]), emptyContours: [] };
  }

  const [rawWest, rawSouth, rawEast, rawNorth] = bbox(
    featureCollection(allFeatures),
  );
  const rawWidth = Math.max(rawEast - rawWest, 1e-9);
  const rawHeight = Math.max(rawNorth - rawSouth, 1e-9);
  const padX = rawWidth * BBOX_PAD_FRAC;
  const padY = rawHeight * BBOX_PAD_FRAC;
  const west = rawWest - padX;
  const south = rawSouth - padY;
  const east = rawEast + padX;
  const north = rawNorth + padY;
  const width = east - west;
  const height = north - south;
  const aspect = width / height;
  let cols: number;
  let rows: number;
  if (aspect >= 1) {
    cols = GRID_LONG_SIDE;
    rows = Math.max(16, Math.round(GRID_LONG_SIDE / aspect));
  } else {
    rows = GRID_LONG_SIDE;
    cols = Math.max(16, Math.round(GRID_LONG_SIDE * aspect));
  }
  // True cell size: samples at centers, contours at cell corners.
  const cellWidth = width / cols;
  const cellHeight = height / rows;

  const values = new Float64Array(cols * rows);
  const ascending = [...sortedLargeToSmall].sort((a, b) => a - b);
  const descending = [...ascending].reverse();
  // Hoist per-day contour geometries once (avoids rescanning features per cell).
  const dayGeoms = dayCollections.map((day) => {
    const byMinutes = new Map<
      DurationMinutes,
      GeoJSON.Polygon | GeoJSON.MultiPolygon
    >();
    for (const minutes of ascending) {
      const f = findContourFeature(day, minutes);
      if (
        f?.geometry &&
        (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon")
      ) {
        byMinutes.set(minutes, f.geometry);
      }
    }
    return byMinutes;
  });

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lng = west + (c + 0.5) * cellWidth;
      const lat = south + (r + 0.5) * cellHeight;
      let sum = 0;
      let count = 0;
      for (const byMinutes of dayGeoms) {
        const t = travelTimeAtGeoms(
          byMinutes,
          [lng, lat],
          ascending,
          descending,
        );
        // Only finite travel times enter the mean. Infinity would poison the
        // average and make Typical collapse toward Worst on partial overlap.
        if (Number.isFinite(t)) {
          sum += t;
          count += 1;
        }
      }
      values[r * cols + c] = count > 0 ? sum / count : UNREACHABLE;
    }
  }

  const grid: GridScalar = {
    values,
    cols,
    rows,
    west,
    south,
    cellWidth,
    cellHeight,
  };

  const emptyContours: DurationMinutes[] = [];
  const features: GeoJSON.Feature[] = [];

  for (const minutes of sortedLargeToSmall) {
    const geometry = contourPolygon(grid, minutes);
    if (!geometry) {
      emptyContours.push(minutes);
      continue;
    }
    features.push(contourFeature(geometry, minutes));
  }

  return {
    collection: { type: "FeatureCollection", features },
    emptyContours,
  };
}

/**
 * Finest selected contour containing the point, or +Infinity.
 * Uses nested isochrone structure: outside the largest ring ⇒ unreachable.
 */
function travelTimeAtGeoms(
  byMinutes: Map<DurationMinutes, GeoJSON.Polygon | GeoJSON.MultiPolygon>,
  point: [number, number],
  ascendingMinutes: DurationMinutes[],
  descendingMinutes: DurationMinutes[],
): number {
  let insideLargest = false;
  for (const minutes of descendingMinutes) {
    const g = byMinutes.get(minutes);
    if (!g) continue;
    if (pointInPolygon(point, g)) {
      insideLargest = true;
      break;
    }
    // Outside the largest present ring ⇒ unreachable (rings nest).
    return UNREACHABLE;
  }
  if (!insideLargest) return UNREACHABLE;

  for (const minutes of ascendingMinutes) {
    const g = byMinutes.get(minutes);
    if (g && pointInPolygon(point, g)) return minutes;
  }
  return UNREACHABLE;
}
