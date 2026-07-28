import { DURATIONS, type DurationMinutes, type RootLocation } from "./types";

const CACHE_KEY = "from-here-iso-cache-v2";
const RECENTS_KEY = "from-here-recents-v1";
const MAX_RECENTS = 5;
/** Cap contour entries so sessionStorage / memory stay bounded. */
const MAX_CACHE_ENTRIES = 36;

/** ~1m grid — avoids conflating nearby distinct roots. */
export function coordKey(lng: number, lat: number): string {
  return `${lng.toFixed(5)},${lat.toFixed(5)}`;
}

export function sameLocation(
  a: { lng: number; lat: number },
  b: { lng: number; lat: number },
): boolean {
  return coordKey(a.lng, a.lat) === coordKey(b.lng, b.lat);
}

/** Shared key stem so clears cannot drift from contourCacheKey. */
export function locationCachePrefix(lng: number, lat: number): string {
  return `${coordKey(lng, lat)}|`;
}

export function contourCacheKey(
  lng: number,
  lat: number,
  departAt: string,
  minutes: DurationMinutes,
): string {
  return `${locationCachePrefix(lng, lat)}${departAt}|${minutes}`;
}

type CacheStore = Record<string, GeoJSON.Feature>;

function readPersistedCache(): CacheStore {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CacheStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function readPersistedRecents(): RootLocation[] {
  try {
    const raw = sessionStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RootLocation[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r) =>
        r &&
        typeof r.lng === "number" &&
        typeof r.lat === "number" &&
        typeof r.label === "string",
    );
  } catch {
    return [];
  }
}

/** In-memory source of truth; sessionStorage is best-effort mirror. */
let memoryCache: CacheStore = readPersistedCache();
let memoryRecents: RootLocation[] = readPersistedRecents();
/** Insertion order for LRU eviction (oldest first). */
let cacheOrder: string[] = Object.keys(memoryCache);

function isDuration(n: unknown): n is DurationMinutes {
  return (
    typeof n === "number" &&
    (DURATIONS as readonly number[]).includes(n)
  );
}

function touchKey(key: string): void {
  cacheOrder = cacheOrder.filter((k) => k !== key);
  cacheOrder.push(key);
}

function evictIfNeeded(): void {
  while (cacheOrder.length > MAX_CACHE_ENTRIES) {
    const oldest = cacheOrder.shift();
    if (oldest) delete memoryCache[oldest];
  }
}

function persistCache(): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(memoryCache));
  } catch {
    try {
      while (cacheOrder.length > Math.floor(MAX_CACHE_ENTRIES / 2)) {
        const oldest = cacheOrder.shift();
        if (oldest) delete memoryCache[oldest];
      }
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(memoryCache));
    } catch {
      // keep memoryCache even if storage fails
    }
  }
}

function persistRecents(): void {
  try {
    sessionStorage.setItem(RECENTS_KEY, JSON.stringify(memoryRecents));
  } catch {
    // keep memoryRecents even if storage fails
  }
}

export function getCachedContour(
  lng: number,
  lat: number,
  departAt: string,
  minutes: DurationMinutes,
): GeoJSON.Feature | null {
  const key = contourCacheKey(lng, lat, departAt, minutes);
  const feature = memoryCache[key];
  if (feature) touchKey(key);
  return feature ?? null;
}

/** Merge API features into memory (and try to persist). */
export function putCachedContours(
  lng: number,
  lat: number,
  departAt: string,
  features: GeoJSON.Feature[],
): void {
  for (const feature of features) {
    const contour = feature.properties?.contour;
    if (!isDuration(contour)) continue;
    const key = contourCacheKey(lng, lat, departAt, contour);
    memoryCache[key] = feature;
    touchKey(key);
  }
  evictIfNeeded();
  persistCache();
}

export function missingContours(
  lng: number,
  lat: number,
  departAt: string,
  durations: DurationMinutes[],
): DurationMinutes[] {
  return durations.filter(
    (m) => !memoryCache[contourCacheKey(lng, lat, departAt, m)],
  );
}

export function assembleIsochrone(
  lng: number,
  lat: number,
  departAt: string,
  durations: DurationMinutes[],
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const m of [...durations].sort((a, b) => b - a)) {
    const key = contourCacheKey(lng, lat, departAt, m);
    const f = memoryCache[key];
    if (f) {
      touchKey(key);
      features.push(f);
    }
  }
  return { type: "FeatureCollection", features };
}

export function loadRecents(): RootLocation[] {
  return memoryRecents.map((r) => ({ ...r }));
}

export function pushRecent(root: RootLocation): RootLocation[] {
  memoryRecents = [
    { ...root },
    ...memoryRecents.filter((r) => !sameLocation(r, root)),
  ].slice(0, MAX_RECENTS);
  persistRecents();
  return loadRecents();
}

export function removeRecent(root: RootLocation): RootLocation[] {
  memoryRecents = memoryRecents.filter((r) => !sameLocation(r, root));
  persistRecents();
  return loadRecents();
}

/** Drop all contour entries for a root (any depart_at / duration). */
export function clearCachedContoursForLocation(lng: number, lat: number): void {
  const prefix = locationCachePrefix(lng, lat);
  for (const key of Object.keys(memoryCache)) {
    if (key.startsWith(prefix)) {
      delete memoryCache[key];
    }
  }
  cacheOrder = cacheOrder.filter((k) => !k.startsWith(prefix));
  persistCache();
}
