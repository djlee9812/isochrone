import type { DurationMinutes, ReachMode } from "./types";
import { aggregateIsochrones, type AggregateResult } from "./aggregateIsochrones";
import { coordKey } from "./isochroneCache";

const MAX_MEMO_ENTRIES = 8;

/** Insertion-order LRU (oldest first). */
let memoOrder: string[] = [];
let memoStore = new Map<string, AggregateResult>();

export function aggregateMemoKey(
  lng: number,
  lat: number,
  departAts: string[],
  mode: ReachMode,
  durations: DurationMinutes[],
): string {
  const durs = [...durations].sort((a, b) => a - b).join(",");
  const ats = [...departAts].join(",");
  return `${coordKey(lng, lat)}|g256|${ats}|${mode}|${durs}`;
}

function touchMemo(key: string): void {
  memoOrder = memoOrder.filter((k) => k !== key);
  memoOrder.push(key);
}

function evictMemoIfNeeded(): void {
  while (memoOrder.length > MAX_MEMO_ENTRIES) {
    const oldest = memoOrder.shift();
    if (oldest) memoStore.delete(oldest);
  }
}

export function getAggregatedIsochrone(
  lng: number,
  lat: number,
  departAts: string[],
  dayCollections: GeoJSON.FeatureCollection[],
  durations: DurationMinutes[],
  mode: ReachMode,
): AggregateResult {
  const key = aggregateMemoKey(lng, lat, departAts, mode, durations);
  const hit = memoStore.get(key);
  if (hit) {
    touchMemo(key);
    return hit;
  }
  const result = aggregateIsochrones(dayCollections, durations, mode);
  // Never memoize empty results — a prior failed contour run must not stick.
  if (result.collection.features.length > 0) {
    memoStore.set(key, result);
    touchMemo(key);
    evictMemoIfNeeded();
  }
  return result;
}

export function clearAggregateMemo(): void {
  memoStore = new Map();
  memoOrder = [];
}

export function clearAggregateMemoForLocation(lng: number, lat: number): void {
  const prefix = `${coordKey(lng, lat)}|`;
  for (const key of [...memoStore.keys()]) {
    if (key.startsWith(prefix)) memoStore.delete(key);
  }
  memoOrder = memoOrder.filter((k) => !k.startsWith(prefix));
}
