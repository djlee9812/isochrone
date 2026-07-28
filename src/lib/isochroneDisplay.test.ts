import { describe, expect, it } from "vitest";
import type { DurationMinutes } from "./types";
import { planIsochroneDisplay } from "./isochroneDisplay";

function collection(
  contours: DurationMinutes[],
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: contours.map((contour) => ({
      type: "Feature",
      properties: { contour },
      geometry: { type: "Polygon", coordinates: [] },
    })),
  };
}

describe("planIsochroneDisplay", () => {
  it("swaps immediately on a full cache hit", () => {
    const assembled = collection([15, 30]);
    expect(
      planIsochroneDisplay({
        originChanged: false,
        needed: [],
        assembled,
      }),
    ).toEqual({
      status: "idle",
      nextCollection: assembled,
      syncCommitments: "apply",
    });
  });

  it("shows partial cache for the new key while loading", () => {
    const assembled = collection([30]);
    expect(
      planIsochroneDisplay({
        originChanged: false,
        needed: [15, 60],
        assembled,
      }),
    ).toEqual({
      status: "loading",
      nextCollection: assembled,
      syncCommitments: "apply",
    });
  });

  it("keeps prior rings on same-origin miss with empty preview", () => {
    expect(
      planIsochroneDisplay({
        originChanged: false,
        needed: [15, 30, 60],
        assembled: collection([]),
      }),
    ).toEqual({
      status: "loading",
      nextCollection: undefined,
      syncCommitments: "leave",
    });
  });

  it("clears on origin change with empty preview", () => {
    expect(
      planIsochroneDisplay({
        originChanged: true,
        needed: [15, 30],
        assembled: collection([]),
      }),
    ).toEqual({
      status: "loading",
      nextCollection: null,
      syncCommitments: "clear",
    });
  });

  it("previews partial cache on origin change while loading", () => {
    const assembled = collection([60]);
    expect(
      planIsochroneDisplay({
        originChanged: true,
        needed: [15, 30],
        assembled,
      }),
    ).toEqual({
      status: "loading",
      nextCollection: assembled,
      syncCommitments: "apply",
    });
  });
});
