import { describe, expect, it } from "vitest";
import { DEFAULT_TIME_ZONE, timeZoneForLngLat } from "./timeZone";
import { departAtForWhen } from "../api/departAt";
import { BOSTON_CENTER } from "./types";

describe("timeZoneForLngLat", () => {
  it("resolves major US cities", () => {
    expect(timeZoneForLngLat(-71.0589, 42.3601)).toBe("America/New_York");
    expect(timeZoneForLngLat(-118.2437, 34.0522)).toBe("America/Los_Angeles");
    expect(timeZoneForLngLat(-87.6298, 41.8781)).toBe("America/Chicago");
  });

  it("returns null for invalid coordinates instead of guessing Eastern", () => {
    expect(timeZoneForLngLat(0, 91)).toBeNull();
    expect(timeZoneForLngLat(NaN, NaN)).toBeNull();
    expect(timeZoneForLngLat(1e9, 1e9)).toBeNull();
  });

  it("Boston center matches DEFAULT_TIME_ZONE used by departAt", () => {
    expect(timeZoneForLngLat(BOSTON_CENTER[0], BOSTON_CENTER[1])).toBe(
      DEFAULT_TIME_ZONE,
    );
    const now = new Date("2026-07-29T12:00:00Z");
    const when = { weekday: 3 as const, hour: 9, minute: 0 };
    const tz = timeZoneForLngLat(BOSTON_CENTER[0], BOSTON_CENTER[1])!;
    expect(departAtForWhen(when, now, tz)).toBe(departAtForWhen(when, now));
  });
});
