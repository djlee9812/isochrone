import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dock } from "./components/Dock";
import { MapView } from "./map/MapView";
import {
  fetchIsochrone,
  fetchMatrixDurations,
  reverseGeocode,
} from "./api/mapbox";
import { departAtForWhen } from "./api/departAt";
import { pointInsideContour } from "./lib/pointInPolygon";
import {
  assembleIsochrone,
  clearCachedContoursForLocation,
  coordKey,
  loadRecents,
  missingContours,
  putCachedContours,
  pushRecent,
  removeRecent,
  sameLocation,
} from "./lib/isochroneCache";
import {
  loadSession,
  saveSession,
  sessionPersistKey,
  toPersistableCommitment,
} from "./state/session";
import { DURATIONS } from "./lib/types";
import type {
  Commitment,
  DepartWhen,
  DurationMinutes,
  FetchStatus,
  GeocodeSuggestion,
  RootLocation,
} from "./lib/types";

function newId(): string {
  return crypto.randomUUID();
}

function clearAnnotations(list: Commitment[]): Commitment[] {
  return list.map(toPersistableCommitment);
}

export default function App() {
  const initial = useMemo(() => loadSession(), []);
  const [root, setRoot] = useState<RootLocation | null>(initial.root);
  const [durations, setDurations] = useState<DurationMinutes[]>(
    initial.durations,
  );
  const [traffic, setTraffic] = useState<DepartWhen>(initial.traffic);
  const [commitments, setCommitments] = useState<Commitment[]>(
    initial.commitments,
  );
  const [commitmentsOpen, setCommitmentsOpen] = useState(
    initial.commitmentsOpen,
  );
  const [recents, setRecents] = useState<RootLocation[]>(() => loadRecents());
  const [isochrone, setIsochrone] =
    useState<GeoJSON.FeatureCollection | null>(null);
  /** Shared depart_at used by isochrone cache keys and Matrix. */
  const [activeDepartAt, setActiveDepartAt] = useState<string | null>(null);
  const [status, setStatus] = useState<FetchStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isoAbort = useRef<AbortController | null>(null);
  const matrixAbort = useRef<AbortController | null>(null);
  const reverseAbort = useRef<AbortController | null>(null);
  const isoSeq = useRef(0);
  const matrixSeq = useRef(0);
  const isoOriginKey = useRef<string | null>(null);
  const lastPersistKey = useRef<string>("");
  const isochroneRef = useRef(isochrone);
  isochroneRef.current = isochrone;

  const rootLng = root?.lng;
  const rootLat = root?.lat;

  const persistKey = useMemo(
    () =>
      sessionPersistKey({
        root,
        durations,
        traffic,
        commitments,
        commitmentsOpen,
      }),
    [root, durations, traffic, commitments, commitmentsOpen],
  );

  useEffect(() => {
    if (persistKey === lastPersistKey.current) return;
    lastPersistKey.current = persistKey;
    saveSession({
      root,
      durations,
      traffic,
      commitments,
      commitmentsOpen,
    });
  }, [persistKey, root, durations, traffic, commitments, commitmentsOpen]);

  const rememberRoot = useCallback((next: RootLocation) => {
    setRoot((prev) => {
      if (prev && sameLocation(prev, next) && prev.label === next.label) {
        return prev;
      }
      return next;
    });
    setRecents(pushRecent(next));
  }, []);

  const effectiveDurations = useMemo(() => {
    return durations.length > 0 ? durations : ([30] as DurationMinutes[]);
  }, [durations]);

  const maxDuration = useMemo(
    () => Math.max(...effectiveDurations) as DurationMinutes,
    [effectiveDurations],
  );

  const applyInside = useCallback(
    (
      list: Commitment[],
      collection: GeoJSON.FeatureCollection | null,
    ): Commitment[] =>
      list.map((c) => ({
        ...c,
        inside: collection
          ? pointInsideContour([c.lng, c.lat], collection, maxDuration)
          : null,
      })),
    [maxDuration],
  );

  const { weekday: trafficWeekday, hour: trafficHour, minute: trafficMinute } =
    traffic;

  // Clear derived badges when origin or traffic window changes
  useEffect(() => {
    setCommitments((prev) => clearAnnotations(prev));
  }, [rootLng, rootLat, trafficWeekday, trafficHour, trafficMinute]);

  const commitmentKey = commitments
    .map((c) => `${c.id}:${c.lng},${c.lat}`)
    .join("|");

  // Fetch only missing contours; toggle on/off uses cache
  useEffect(() => {
    if (rootLng == null || rootLat == null || !root) {
      isoAbort.current?.abort();
      isoOriginKey.current = null;
      setIsochrone(null);
      setActiveDepartAt(null);
      setStatus("idle");
      return;
    }

    const when: DepartWhen = {
      weekday: trafficWeekday,
      hour: trafficHour,
      minute: trafficMinute,
    };

    const seq = ++isoSeq.current;
    isoAbort.current?.abort();

    const originKey = coordKey(rootLng, rootLat);
    const originChanged = isoOriginKey.current !== originKey;
    isoOriginKey.current = originKey;

    // Drop previous origin's rings immediately; show cache for new key if any.
    // Same-origin cache miss keeps prior rings until fetch settles (e.g. after dismiss).
    const previewDepartAt = departAtForWhen(when);
    const preview = assembleIsochrone(
      rootLng,
      rootLat,
      previewDepartAt,
      effectiveDurations,
    );
    if (preview.features.length > 0) {
      setIsochrone(preview);
      setCommitments((prev) => applyInside(prev, preview));
    } else if (originChanged) {
      setIsochrone(null);
    }
    setActiveDepartAt(previewDepartAt);

    const handle = window.setTimeout(async () => {
      if (seq !== isoSeq.current) return;

      // Recompute at fetch time so we never send a past depart_at
      const departAt = departAtForWhen(when);
      setActiveDepartAt(departAt);

      const needed = missingContours(
        rootLng,
        rootLat,
        departAt,
        effectiveDurations,
      );

      isoAbort.current?.abort();

      if (needed.length === 0) {
        const assembled = assembleIsochrone(
          rootLng,
          rootLat,
          departAt,
          effectiveDurations,
        );
        if (seq !== isoSeq.current) return;
        setIsochrone(assembled);
        setCommitments((prev) => applyInside(prev, assembled));
        setStatus("idle");
        setStatusMessage(null);
        return;
      }

      const ac = new AbortController();
      isoAbort.current = ac;
      setStatus("loading");
      setStatusMessage(null);

      const partial = assembleIsochrone(
        rootLng,
        rootLat,
        departAt,
        effectiveDurations.filter((d) => !needed.includes(d)),
      );
      if (seq !== isoSeq.current) return;
      if (partial.features.length > 0) {
        setIsochrone(partial);
        setCommitments((prev) => applyInside(prev, partial));
      } else if (originChanged) {
        setIsochrone(null);
      }

      try {
        const data = await fetchIsochrone({
          lng: rootLng,
          lat: rootLat,
          contours: needed,
          departAt,
          signal: ac.signal,
        });
        if (ac.signal.aborted || seq !== isoSeq.current) return;

        putCachedContours(rootLng, rootLat, departAt, data.features);
        const assembled = assembleIsochrone(
          rootLng,
          rootLat,
          departAt,
          effectiveDurations,
        );
        setIsochrone(assembled);
        setCommitments((prev) => applyInside(prev, assembled));
        setStatus("idle");
      } catch (e) {
        if ((e as Error).name === "AbortError" || ac.signal.aborted) return;
        if (seq !== isoSeq.current) return;
        setStatus("error");
        setStatusMessage(
          e instanceof Error ? e.message : "Isochrone request failed",
        );
        setIsochrone(null);
        setCommitments((prev) => clearAnnotations(prev));
      }
    }, 280);

    return () => {
      window.clearTimeout(handle);
      isoAbort.current?.abort();
    };
  }, [
    root,
    rootLng,
    rootLat,
    effectiveDurations,
    trafficWeekday,
    trafficHour,
    trafficMinute,
    applyInside,
  ]);

  // Matrix ETAs only — uses the same depart_at as the visible rings
  useEffect(() => {
    if (
      rootLng == null ||
      rootLat == null ||
      !activeDepartAt ||
      commitments.length === 0
    ) {
      return;
    }

    const destinations = commitments.map((c) => ({
      lng: c.lng,
      lat: c.lat,
    }));
    const ids = commitments.map((c) => c.id);
    const seq = ++matrixSeq.current;
    const departAt = activeDepartAt;

    const handle = window.setTimeout(async () => {
      matrixAbort.current?.abort();
      const ac = new AbortController();
      matrixAbort.current = ac;
      try {
        const etas = await fetchMatrixDurations({
          origin: { lng: rootLng, lat: rootLat },
          destinations,
          departAt,
          signal: ac.signal,
        });
        if (ac.signal.aborted || seq !== matrixSeq.current) return;
        setCommitments((prev) =>
          prev.map((c) => {
            const idx = ids.indexOf(c.id);
            if (idx < 0) return c;
            return { ...c, etaMinutes: etas[idx] ?? null };
          }),
        );
      } catch {
        // Matrix is optional
      }
    }, 450);

    return () => {
      window.clearTimeout(handle);
      matrixAbort.current?.abort();
    };
  }, [rootLng, rootLat, activeDepartAt, commitmentKey]);

  const setRootFromCoords = useCallback(
    async (lng: number, lat: number, label?: string) => {
      reverseAbort.current?.abort();
      const ac = new AbortController();
      reverseAbort.current = ac;

      let resolved = label;
      if (!resolved) {
        try {
          resolved = await reverseGeocode(lng, lat, ac.signal);
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
          resolved = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        }
      }
      if (ac.signal.aborted) return;
      rememberRoot({ lng, lat, label: resolved });
    },
    [rememberRoot],
  );

  const onSelectRoot = useCallback(
    (s: GeocodeSuggestion) => {
      reverseAbort.current?.abort();
      rememberRoot({ lng: s.lng, lat: s.lat, label: s.placeName });
    },
    [rememberRoot],
  );

  const onSelectRecent = useCallback(
    (item: RootLocation) => {
      reverseAbort.current?.abort();
      rememberRoot(item);
    },
    [rememberRoot],
  );

  const onRemoveRecent = useCallback(
    (item: RootLocation) => {
      clearCachedContoursForLocation(item.lng, item.lat);
      setRecents(removeRecent(item));
      // Invalidate in-flight / debounced fetch so putCachedContours cannot refill.
      if (root && sameLocation(root, item)) {
        isoAbort.current?.abort();
        isoSeq.current += 1;
        setStatus("idle");
      }
    },
    [root],
  );

  const onMapClick = useCallback(
    (lng: number, lat: number) => {
      void setRootFromCoords(lng, lat);
    },
    [setRootFromCoords],
  );

  const onRootDragEnd = useCallback(
    (lng: number, lat: number) => {
      void setRootFromCoords(lng, lat);
    },
    [setRootFromCoords],
  );

  const onAddCommitment = useCallback(
    (s: GeocodeSuggestion) => {
      setCommitments((prev) => {
        if (prev.length >= 9) return prev;
        if (prev.some((c) => sameLocation(c, s))) return prev;
        const next: Commitment[] = [
          ...prev,
          {
            id: newId(),
            label: s.label,
            placeName: s.placeName,
            lng: s.lng,
            lat: s.lat,
          },
        ];
        return applyInside(next, isochroneRef.current);
      });
      setCommitmentsOpen(true);
    },
    [applyInside],
  );

  const onRemoveCommitment = useCallback((id: string) => {
    setCommitments((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return (
    <div className="app-shell">
      <MapView
        root={root}
        isochrone={isochrone}
        durations={effectiveDurations}
        loading={status === "loading"}
        commitments={commitments}
        onMapClick={onMapClick}
        onRootDragEnd={onRootDragEnd}
      />
      <Dock
        root={root}
        durations={effectiveDurations}
        traffic={traffic}
        status={status}
        statusMessage={statusMessage}
        commitments={commitments}
        commitmentsOpen={commitmentsOpen}
        recents={recents}
        onSelectRoot={onSelectRoot}
        onSelectRecent={onSelectRecent}
        onRemoveRecent={onRemoveRecent}
        onDurationsChange={setDurations}
        onTrafficChange={setTraffic}
        onToggleCommitments={() => setCommitmentsOpen((o) => !o)}
        onAddCommitment={onAddCommitment}
        onRemoveCommitment={onRemoveCommitment}
      />
      <div className="map-legend" aria-hidden={effectiveDurations.length === 0}>
        {DURATIONS.filter((m) => effectiveDurations.includes(m)).map((m) => (
          <span key={m} className={`legend-item legend-${m}`}>
            {m} min
          </span>
        ))}
      </div>
    </div>
  );
}
