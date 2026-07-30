import { beforeEach, describe, expect, it } from "vitest";
import {
  clearCachedContoursForLocation,
  putCachedContours,
} from "./isochroneCache";
import {
  allDaysHaveContours,
  assembledForDisplay,
  planMultiDayIsochrone,
} from "./multiDayIsochrone";
import { polygon } from "@turf/helpers";

describe("planMultiDayIsochrone", () => {
  const lng = -71.05;
  const lat = 42.36;

  beforeEach(() => {
    clearCachedContoursForLocation(lng, lat);
  });

  it("lists fetch jobs only for missing day/contour keys", () => {
    const day1 = "2026-07-28T09:00";
    const day2 = "2026-07-29T09:00";
    putCachedContours(lng, lat, day1, [
      polygon(
        [
          [
            [-71.1, 42.3],
            [-71.0, 42.3],
            [-71.0, 42.4],
            [-71.1, 42.4],
            [-71.1, 42.3],
          ],
        ],
        { contour: 30 },
      ),
    ]);

    const plan = planMultiDayIsochrone(lng, lat, [day1, day2], [30]);
    expect(plan.fullyCached).toBe(false);
    expect(plan.fetchJobs).toEqual([{ departAt: day2, contours: [30] }]);
    expect(plan.days[0]?.needed).toEqual([]);
    expect(plan.days[1]?.needed).toEqual([30]);
  });

  it("reports fullyCached when all days are warm", () => {
    const day1 = "2026-07-28T09:00";
    const day2 = "2026-07-29T09:00";
    for (const departAt of [day1, day2]) {
      putCachedContours(lng, lat, departAt, [
        polygon(
          [
            [
              [-71.1, 42.3],
              [-71.0, 42.3],
              [-71.0, 42.4],
              [-71.1, 42.4],
              [-71.1, 42.3],
            ],
          ],
          { contour: 30 },
        ),
      ]);
    }
    const plan = planMultiDayIsochrone(lng, lat, [day1, day2], [30]);
    expect(plan.fullyCached).toBe(true);
    expect(plan.fetchJobs).toEqual([]);
  });
});

describe("allDaysHaveContours", () => {
  it("returns true when every day has every duration", () => {
    const day = {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: { contour: 30 },
          geometry: { type: "Polygon" as const, coordinates: [] },
        },
      ],
    };
    expect(allDaysHaveContours([day, day], [30])).toBe(true);
  });

  it("returns false when one day is missing a duration", () => {
    const with30 = {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: { contour: 30 },
          geometry: { type: "Polygon" as const, coordinates: [] },
        },
      ],
    };
    const empty = { type: "FeatureCollection" as const, features: [] };
    expect(allDaysHaveContours([with30, empty], [30])).toBe(false);
  });

  it("returns false for empty day list", () => {
    expect(allDaysHaveContours([], [30])).toBe(false);
  });
});

describe("assembledForDisplay", () => {
  it("returns single-day partial contours while loading", () => {
    const partial = {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: { contour: 30 },
          geometry: { type: "Polygon" as const, coordinates: [] },
        },
      ],
    };
    const plan = {
      departAts: ["2026-07-28T09:00"],
      days: [],
      fetchJobs: [{ departAt: "2026-07-28T09:00", contours: [60 as const] }],
      fullyCached: false,
      perDayAssembled: [partial],
    };
    expect(assembledForDisplay(plan, null)).toBe(partial);
  });

  it("returns empty for incomplete multi-day", () => {
    const plan = {
      departAts: ["a", "b"],
      days: [],
      fetchJobs: [{ departAt: "b", contours: [30 as const] }],
      fullyCached: false,
      perDayAssembled: [
        { type: "FeatureCollection" as const, features: [] },
        { type: "FeatureCollection" as const, features: [] },
      ],
    };
    expect(assembledForDisplay(plan, null).features).toEqual([]);
  });
});
