import { describe, expect, it } from "vitest";
import { polygon } from "@turf/helpers";
import { aggregateIsochrones } from "./aggregateIsochrones";
import { pointInPolygon } from "./pointInPolygon";
import type { DurationMinutes } from "./types";

function square(
  west: number,
  south: number,
  east: number,
  north: number,
  contour: DurationMinutes,
): GeoJSON.Feature {
  return polygon(
    [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
    { contour },
  );
}

function collection(
  ...features: GeoJSON.Feature[]
): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features };
}

describe("aggregateIsochrones", () => {
  const dayA = collection(square(-71.1, 42.3, -71.0, 42.4, 30));
  const dayB = collection(square(-71.05, 42.32, -70.95, 42.42, 30));

  it("returns identity for a single day", () => {
    const result = aggregateIsochrones([dayA], [30], "worst");
    expect(result.collection.features).toHaveLength(1);
    expect(result.collection.features[0]?.properties?.contour).toBe(30);
    expect(result.emptyContours).toEqual([]);
  });

  it("worst case intersects and shrinks reach", () => {
    const worst = aggregateIsochrones([dayA, dayB], [30], "worst");
    expect(worst.collection.features).toHaveLength(1);
    const g = worst.collection.features[0]!.geometry as
      | GeoJSON.Polygon
      | GeoJSON.MultiPolygon;
    // Overlap center should be inside
    expect(pointInPolygon([-71.025, 42.35], g)).toBe(true);
    // Far corner of A-only should be outside intersection
    expect(pointInPolygon([-71.09, 42.31], g)).toBe(false);
  });

  it("best case unions and grows reach", () => {
    const best = aggregateIsochrones([dayA, dayB], [30], "best");
    const g = best.collection.features[0]!.geometry as
      | GeoJSON.Polygon
      | GeoJSON.MultiPolygon;
    expect(pointInPolygon([-71.09, 42.31], g)).toBe(true);
    expect(pointInPolygon([-70.96, 42.41], g)).toBe(true);
  });

  it("typical includes day-only regions (finite mean, not Infinity-poisoned)", () => {
    const typical = aggregateIsochrones([dayA, dayB], [30], "typical");
    const worst = aggregateIsochrones([dayA, dayB], [30], "worst");
    expect(typical.collection.features.length).toBeGreaterThan(0);
    const typicalGeom = typical.collection.features[0]!.geometry as
      | GeoJSON.Polygon
      | GeoJSON.MultiPolygon;
    const worstGeom = worst.collection.features[0]!.geometry as
      | GeoJSON.Polygon
      | GeoJSON.MultiPolygon;
    // A-only corner: outside worst intersection, but reachable on one day →
    // finite mean 30 → inside Typical 30.
    const aOnly: [number, number] = [-71.09, 42.31];
    expect(pointInPolygon(aOnly, worstGeom)).toBe(false);
    expect(pointInPolygon(aOnly, typicalGeom)).toBe(true);
  });

  it("records empty contours when worst has no overlap", () => {
    const left = collection(square(-71.2, 42.3, -71.15, 42.35, 30));
    const right = collection(square(-71.0, 42.3, -70.95, 42.35, 30));
    const result = aggregateIsochrones([left, right], [30], "worst");
    expect(result.collection.features).toHaveLength(0);
    expect(result.emptyContours).toEqual([30]);
  });
});
