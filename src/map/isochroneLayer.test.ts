import { describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import {
  ISOCHRONE_DIM_FILL,
  ISOCHRONE_DIM_LINE,
  ISOCHRONE_LINE_OPACITY,
  ISOCHRONE_RING_OPACITY,
  setIsochroneDimmed,
} from "./isochroneLayer";
import type { DurationMinutes } from "../lib/types";

function mockMap(layers: Set<string>) {
  const setPaintProperty = vi.fn();
  const map = {
    getLayer: (id: string) => (layers.has(id) ? {} : undefined),
    setPaintProperty,
  };
  return { map: map as unknown as MapboxMap, setPaintProperty };
}

describe("setIsochroneDimmed", () => {
  const durations: DurationMinutes[] = [15, 30, 60];

  it("dims fill and line opacity for each duration layer", () => {
    const layers = new Set(
      durations.flatMap((m) => [`isochrone-fill-${m}`, `isochrone-line-${m}`]),
    );
    const { map, setPaintProperty } = mockMap(layers);

    setIsochroneDimmed(map, true);

    for (const minutes of durations) {
      expect(setPaintProperty).toHaveBeenCalledWith(
        `isochrone-fill-${minutes}`,
        "fill-opacity",
        ISOCHRONE_RING_OPACITY[minutes] * ISOCHRONE_DIM_FILL,
      );
      expect(setPaintProperty).toHaveBeenCalledWith(
        `isochrone-line-${minutes}`,
        "line-opacity",
        ISOCHRONE_LINE_OPACITY * ISOCHRONE_DIM_LINE,
      );
    }
  });

  it("restores full fill and line opacity when undimmed", () => {
    const layers = new Set(
      durations.flatMap((m) => [`isochrone-fill-${m}`, `isochrone-line-${m}`]),
    );
    const { map, setPaintProperty } = mockMap(layers);

    setIsochroneDimmed(map, false);

    for (const minutes of durations) {
      expect(setPaintProperty).toHaveBeenCalledWith(
        `isochrone-fill-${minutes}`,
        "fill-opacity",
        ISOCHRONE_RING_OPACITY[minutes],
      );
      expect(setPaintProperty).toHaveBeenCalledWith(
        `isochrone-line-${minutes}`,
        "line-opacity",
        ISOCHRONE_LINE_OPACITY,
      );
    }
  });

  it("skips missing fill or line layers", () => {
    const layers = new Set(["isochrone-fill-30", "isochrone-line-15"]);
    const { map, setPaintProperty } = mockMap(layers);

    setIsochroneDimmed(map, true);

    expect(setPaintProperty).toHaveBeenCalledTimes(2);
    expect(setPaintProperty).toHaveBeenCalledWith(
      "isochrone-fill-30",
      "fill-opacity",
      ISOCHRONE_RING_OPACITY[30] * ISOCHRONE_DIM_FILL,
    );
    expect(setPaintProperty).toHaveBeenCalledWith(
      "isochrone-line-15",
      "line-opacity",
      ISOCHRONE_LINE_OPACITY * ISOCHRONE_DIM_LINE,
    );
  });
});
