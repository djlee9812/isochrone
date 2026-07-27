import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import type { DurationMinutes } from "../lib/types";

const SOURCE_ID = "isochrone";
const FILL_PREFIX = "isochrone-fill-";
const LINE_PREFIX = "isochrone-line-";

const RING_COLORS: Record<DurationMinutes, string> = {
  15: "#5BA8A0",
  30: "#2F7A8A",
  60: "#1E4A66",
};

const RING_OPACITY: Record<DurationMinutes, number> = {
  15: 0.22,
  30: 0.18,
  60: 0.14,
};

export function ensureIsochroneLayers(map: MapboxMap): void {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }

  // Draw largest first (underneath), smallest on top — Mapbox paints in add order
  const order: DurationMinutes[] = [60, 30, 15];
  for (const minutes of order) {
    const fillId = `${FILL_PREFIX}${minutes}`;
    const lineId = `${LINE_PREFIX}${minutes}`;
    if (!map.getLayer(fillId)) {
      map.addLayer({
        id: fillId,
        type: "fill",
        source: SOURCE_ID,
        filter: ["==", ["get", "contour"], minutes],
        paint: {
          "fill-color": RING_COLORS[minutes],
          "fill-opacity": RING_OPACITY[minutes],
        },
      });
    }
    if (!map.getLayer(lineId)) {
      map.addLayer({
        id: lineId,
        type: "line",
        source: SOURCE_ID,
        filter: ["==", ["get", "contour"], minutes],
        paint: {
          "line-color": RING_COLORS[minutes],
          "line-width": 1.5,
          "line-opacity": 0.85,
        },
      });
    }
  }
}

export function setIsochroneData(
  map: MapboxMap,
  data: GeoJSON.FeatureCollection | null,
  visible: DurationMinutes[],
): void {
  ensureIsochroneLayers(map);
  const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
  if (!source) return;

  source.setData(data ?? { type: "FeatureCollection", features: [] });

  for (const minutes of [15, 30, 60] as DurationMinutes[]) {
    const show = visible.includes(minutes);
    const fillId = `${FILL_PREFIX}${minutes}`;
    const lineId = `${LINE_PREFIX}${minutes}`;
    if (map.getLayer(fillId)) {
      map.setLayoutProperty(fillId, "visibility", show ? "visible" : "none");
    }
    if (map.getLayer(lineId)) {
      map.setLayoutProperty(lineId, "visibility", show ? "visible" : "none");
    }
  }
}

export function setIsochroneDimmed(map: MapboxMap, dimmed: boolean): void {
  for (const minutes of [15, 30, 60] as DurationMinutes[]) {
    const fillId = `${FILL_PREFIX}${minutes}`;
    if (!map.getLayer(fillId)) continue;
    map.setPaintProperty(
      fillId,
      "fill-opacity",
      dimmed ? RING_OPACITY[minutes] * 0.45 : RING_OPACITY[minutes],
    );
  }
}
