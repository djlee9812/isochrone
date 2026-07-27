import type { DurationMinutes, GeocodeSuggestion } from "../lib/types";
import { BOSTON_CENTER } from "../lib/types";

const TOKEN = () => {
  const t = (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined)?.trim();
  if (!t) {
    throw new Error(
      "Missing VITE_MAPBOX_TOKEN. Add a public Mapbox token (pk…) to .env and restart the dev server.",
    );
  }
  if (t.startsWith("sk.")) {
    throw new Error(
      "VITE_MAPBOX_TOKEN must be a public token (pk…), not a secret token (sk…).",
    );
  }
  return t;
};

/**
 * Forward geocode with Boston proximity bias.
 * curl "https://api.mapbox.com/geocoding/v5/mapbox.places/Boston%20Common.json?proximity=-71.0589,42.3601&access_token=TOKEN"
 */
export async function geocodeSuggest(
  query: string,
  signal?: AbortSignal,
): Promise<GeocodeSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`,
  );
  url.searchParams.set("access_token", TOKEN());
  url.searchParams.set("proximity", `${BOSTON_CENTER[0]},${BOSTON_CENTER[1]}`);
  url.searchParams.set("country", "us");
  url.searchParams.set("limit", "5");
  url.searchParams.set("types", "address,poi,place,locality,neighborhood");

  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Geocoding failed (${res.status})`);
  }
  const data = (await res.json()) as {
    features: Array<{
      id: string;
      text: string;
      place_name: string;
      center: [number, number];
    }>;
  };
  return data.features.map((f) => ({
    id: f.id,
    label: f.text,
    placeName: f.place_name,
    lng: f.center[0],
    lat: f.center[1],
  }));
}

/**
 * Reverse geocode for map click / pin drag.
 * curl "https://api.mapbox.com/geocoding/v5/mapbox.places/-71.06,42.36.json?access_token=TOKEN"
 */
export async function reverseGeocode(
  lng: number,
  lat: number,
  signal?: AbortSignal,
): Promise<string> {
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`,
  );
  url.searchParams.set("access_token", TOKEN());
  url.searchParams.set("limit", "1");

  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Reverse geocoding failed (${res.status})`);
  }
  const data = (await res.json()) as {
    features: Array<{ place_name?: string; text?: string }>;
  };
  const f = data.features[0];
  return f?.place_name ?? f?.text ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/**
 * Driving-traffic isochrones. Up to 4 contours; we use 15/30/60.
 * curl "https://api.mapbox.com/isochrone/v1/mapbox/driving-traffic/-71.0589,42.3601?contours_minutes=15,30,60&polygons=true&depart_at=2026-07-28T09:00&access_token=TOKEN"
 */
export async function fetchIsochrone(opts: {
  lng: number;
  lat: number;
  contours: DurationMinutes[];
  departAt: string;
  signal?: AbortSignal;
}): Promise<GeoJSON.FeatureCollection> {
  const contours = [...opts.contours].sort((a, b) => a - b);
  if (contours.length === 0) {
    return { type: "FeatureCollection", features: [] };
  }

  const profile = "mapbox/driving-traffic";
  const url = new URL(
    `https://api.mapbox.com/isochrone/v1/${profile}/${opts.lng},${opts.lat}`,
  );
  url.searchParams.set("contours_minutes", contours.join(","));
  url.searchParams.set("polygons", "true");
  url.searchParams.set("depart_at", opts.departAt);
  url.searchParams.set("access_token", TOKEN());
  const colors = contours.map((m) => {
    if (m <= 15) return "5BA8A0";
    if (m <= 30) return "2F7A8A";
    return "1E4A66";
  });
  url.searchParams.set("contours_colors", colors.join(","));

  const res = await fetch(url, { signal: opts.signal });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Isochrone failed (${res.status})${body ? `: ${body.slice(0, 200)}` : ""}`,
    );
  }
  return (await res.json()) as GeoJSON.FeatureCollection;
}

/**
 * Matrix durations from root → destinations (driving-traffic).
 * curl "https://api.mapbox.com/directions-matrix/v1/mapbox/driving-traffic/-71.05,42.36;-71.09,42.34?annotations=duration&depart_at=2026-07-28T09:00&access_token=TOKEN"
 */
export async function fetchMatrixDurations(opts: {
  origin: { lng: number; lat: number };
  destinations: Array<{ lng: number; lat: number }>;
  departAt: string;
  signal?: AbortSignal;
}): Promise<(number | null)[]> {
  if (opts.destinations.length === 0) return [];

  const coords = [
    `${opts.origin.lng},${opts.origin.lat}`,
    ...opts.destinations.map((d) => `${d.lng},${d.lat}`),
  ];
  if (coords.length > 10) {
    throw new Error("Matrix supports at most 9 destinations with driving-traffic");
  }

  const url = new URL(
    `https://api.mapbox.com/directions-matrix/v1/mapbox/driving-traffic/${coords.join(";")}`,
  );
  url.searchParams.set("annotations", "duration");
  url.searchParams.set("sources", "0");
  url.searchParams.set(
    "destinations",
    opts.destinations.map((_, i) => String(i + 1)).join(";"),
  );
  url.searchParams.set("depart_at", opts.departAt);
  url.searchParams.set("access_token", TOKEN());

  const res = await fetch(url, { signal: opts.signal });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Matrix failed (${res.status})${body ? `: ${body.slice(0, 200)}` : ""}`,
    );
  }
  const data = (await res.json()) as {
    durations?: (number | null)[][] | null;
  };
  const row = data.durations?.[0] ?? [];
  return row.map((sec) => (sec == null ? null : Math.round(sec / 60)));
}

export function hasMapboxToken(): boolean {
  const t = (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined)?.trim();
  return Boolean(t) && !t!.startsWith("sk.");
}
