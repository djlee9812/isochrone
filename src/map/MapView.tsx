import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { BOSTON_CENTER } from "../lib/types";
import type { Commitment, DurationMinutes, RootLocation } from "../lib/types";
import {
  ensureIsochroneLayers,
  setIsochroneData,
  setIsochroneDimmed,
} from "./isochroneLayer";
import { hasMapboxToken } from "../api/mapbox";

type Props = {
  root: RootLocation | null;
  isochrone: GeoJSON.FeatureCollection | null;
  durations: DurationMinutes[];
  /** Dim fill/line while rings are stale or a fetch failed with retained rings. */
  dimmed: boolean;
  commitments: Commitment[];
  onMapClick: (lng: number, lat: number) => void;
  onRootDragEnd: (lng: number, lat: number) => void;
};

export function MapView({
  root,
  isochrone,
  durations,
  dimmed,
  commitments,
  onMapClick,
  onRootDragEnd,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const rootMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const commitmentMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const onMapClickRef = useRef(onMapClick);
  const onRootDragEndRef = useRef(onRootDragEnd);
  const skipNextFlyRef = useRef(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);
  useEffect(() => {
    onRootDragEndRef.current = onRootDragEnd;
  }, [onRootDragEnd]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !hasMapboxToken()) return;

    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

    let map: mapboxgl.Map;
    try {
      map = new mapboxgl.Map({
        container,
        style: "mapbox://styles/mapbox/light-v11",
        center: BOSTON_CENTER,
        zoom: 11.2,
        attributionControl: true,
      });
    } catch (e) {
      setMapError(
        e instanceof Error ? e.message : "Failed to create Mapbox map",
      );
      return;
    }

    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      "bottom-right",
    );

    const resize = () => {
      try {
        map.resize();
      } catch {
        // map may already be removed
      }
    };

    const onLoad = () => {
      ensureIsochroneLayers(map);
      resize();
      setMapReady(true);
      setMapError(null);
    };

    const onError = (e: { error?: Error | { message?: string } }) => {
      const msg =
        e.error instanceof Error
          ? e.error.message
          : e.error?.message ?? "Map failed to load tiles or style";
      if (/abort|cancel/i.test(msg)) return;
      setMapError(msg);
    };

    map.on("load", onLoad);
    map.on("error", onError);
    map.on("click", (e) => {
      onMapClickRef.current(e.lngLat.lng, e.lngLat.lat);
    });

    mapRef.current = map;

    const ro = new ResizeObserver(() => resize());
    ro.observe(container);
    requestAnimationFrame(resize);
    window.setTimeout(resize, 100);

    return () => {
      ro.disconnect();
      map.off("load", onLoad);
      map.off("error", onError);
      rootMarkerRef.current?.remove();
      rootMarkerRef.current = null;
      commitmentMarkersRef.current.forEach((m) => m.remove());
      commitmentMarkersRef.current.clear();
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Root marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (!root) {
      rootMarkerRef.current?.remove();
      rootMarkerRef.current = null;
      return;
    }

    if (!rootMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "root-pin";
      el.title = "Drag to move root";
      const marker = new mapboxgl.Marker({ element: el, draggable: true })
        .setLngLat([root.lng, root.lat])
        .addTo(map);
      marker.on("dragend", () => {
        const { lng, lat } = marker.getLngLat();
        skipNextFlyRef.current = true;
        onRootDragEndRef.current(lng, lat);
      });
      rootMarkerRef.current = marker;
    } else {
      rootMarkerRef.current.setLngLat([root.lng, root.lat]);
    }

    if (skipNextFlyRef.current) {
      skipNextFlyRef.current = false;
      return;
    }

    const center = map.getCenter();
    const alreadyThere =
      Math.abs(center.lng - root.lng) < 0.00005 &&
      Math.abs(center.lat - root.lat) < 0.00005;
    if (alreadyThere) return;

    map.flyTo({
      center: [root.lng, root.lat],
      zoom: Math.max(map.getZoom(), 11),
      essential: true,
      duration: 900,
    });
  }, [root?.lng, root?.lat, mapReady]);

  // Isochrone polygons
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    setIsochroneData(map, isochrone, durations);
  }, [isochrone, durations, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    setIsochroneDimmed(map, dimmed);
  }, [dimmed, mapReady]);

  // Commitment markers — update in place when possible
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const nextIds = new Set(commitments.map((c) => c.id));
    for (const [id, marker] of commitmentMarkersRef.current) {
      if (!nextIds.has(id)) {
        marker.remove();
        commitmentMarkersRef.current.delete(id);
      }
    }

    for (const c of commitments) {
      const existing = commitmentMarkersRef.current.get(c.id);
      const className = [
        "commitment-pin",
        c.inside === true ? "is-inside" : "",
        c.inside === false ? "is-outside" : "",
      ]
        .filter(Boolean)
        .join(" ");

      if (existing) {
        existing.setLngLat([c.lng, c.lat]);
        const el = existing.getElement();
        el.className = className;
        el.title = c.placeName;
        continue;
      }

      const el = document.createElement("div");
      el.className = className;
      el.title = c.placeName;
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([c.lng, c.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 16 }).setHTML(
            `<strong>${escapeHtml(c.label)}</strong><br/><span style="opacity:.8">${escapeHtml(c.placeName)}</span>`,
          ),
        )
        .addTo(map);
      commitmentMarkersRef.current.set(c.id, marker);
    }
  }, [commitments, mapReady]);

  if (!hasMapboxToken()) {
    return (
      <div className="map-missing-token">
        <p>
          Add your Mapbox public token to <code>.env</code> as{" "}
          <code>VITE_MAPBOX_TOKEN</code>, then restart the dev server.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="map-root" ref={containerRef} />
      {mapError && (
        <div className="map-error-banner" role="alert">
          <strong>Map failed to load.</strong> {mapError}
          <span className="map-error-hint">
            Check the token URL allowlist includes{" "}
            <code>http://localhost:5173/*</code>, then hard-refresh.
          </span>
        </div>
      )}
    </>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
