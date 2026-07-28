import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DurationMinutes, RootLocation } from "./types";

const CACHE_KEY = "from-here-iso-cache-v2";
const RECENTS_KEY = "from-here-recents-v1";

function mockSessionStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  });
  return store;
}

function feature(contour: DurationMinutes): GeoJSON.Feature {
  return {
    type: "Feature",
    properties: { contour },
    geometry: { type: "Polygon", coordinates: [] },
  };
}

describe("isochroneCache recents + location clear", () => {
  beforeEach(() => {
    mockSessionStorage();
    vi.resetModules();
  });

  async function load() {
    return import("./isochroneCache");
  }

  it("removeRecent filters by sameLocation and persists", async () => {
    const cache = await load();
    const a: RootLocation = { lng: -71.05, lat: 42.36, label: "A" };
    const b: RootLocation = { lng: -71.06, lat: 42.37, label: "B" };
    cache.pushRecent(a);
    cache.pushRecent(b);

    const next = cache.removeRecent(a);
    expect(next).toEqual([b]);
    expect(cache.loadRecents()).toEqual([b]);
    expect(JSON.parse(sessionStorage.getItem(RECENTS_KEY)!)).toEqual([b]);
  });

  it("removeRecent treats nearby coords within the same grid as equal", async () => {
    const cache = await load();
    const a: RootLocation = { lng: -71.058_01, lat: 42.360_01, label: "A" };
    // Same 5-decimal grid as a
    const twin: RootLocation = {
      lng: -71.058_014,
      lat: 42.360_014,
      label: "twin",
    };
    cache.pushRecent(a);
    expect(cache.removeRecent(twin)).toEqual([]);
  });

  it("clearCachedContoursForLocation drops keys for that coord only", async () => {
    const cache = await load();
    const depart = "2026-07-29T09:00";
    cache.putCachedContours(-71.05, 42.36, depart, [
      feature(15),
      feature(30),
    ]);
    cache.putCachedContours(-71.1, 42.4, depart, [feature(15)]);

    cache.clearCachedContoursForLocation(-71.05, 42.36);

    expect(cache.getCachedContour(-71.05, 42.36, depart, 15)).toBeNull();
    expect(cache.getCachedContour(-71.05, 42.36, depart, 30)).toBeNull();
    expect(cache.getCachedContour(-71.1, 42.4, depart, 15)).not.toBeNull();

    const persisted = JSON.parse(sessionStorage.getItem(CACHE_KEY)!) as Record<
      string,
      unknown
    >;
    const prefix = cache.locationCachePrefix(-71.05, 42.36);
    expect(Object.keys(persisted).every((k) => !k.startsWith(prefix))).toBe(
      true,
    );
  });

  it("locationCachePrefix matches contourCacheKey stem", async () => {
    const cache = await load();
    const key = cache.contourCacheKey(-71.05, 42.36, "2026-07-29T09:00", 30);
    expect(key.startsWith(cache.locationCachePrefix(-71.05, 42.36))).toBe(true);
  });
});
