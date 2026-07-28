import { defaultDepartWhen } from "../api/departAt";
import {
  TIME_SHORTCUT_PM,
  parseDepartWhenParts,
} from "../lib/departWhen";
import { timeZoneForLngLat } from "../lib/timeZone";
import {
  DURATIONS,
  type Commitment,
  type DepartWhen,
  type SessionState,
} from "../lib/types";

const KEY = "from-here-session-v2";
const LEGACY_KEY = "from-here-session-v1";

export function toPersistableCommitment(
  c: Commitment,
): Pick<Commitment, "id" | "label" | "placeName" | "lng" | "lat"> {
  return {
    id: c.id,
    label: c.label,
    placeName: c.placeName,
    lng: c.lng,
    lat: c.lat,
  };
}

export const defaultSession = (): SessionState => ({
  root: null,
  durations: [30],
  traffic: defaultDepartWhen(),
  commitments: [],
  commitmentsOpen: false,
});

function sanitizeDurations(raw: unknown): SessionState["durations"] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return defaultSession().durations;
  }
  const filtered = raw.filter(
    (d): d is (typeof DURATIONS)[number] =>
      typeof d === "number" &&
      (DURATIONS as readonly number[]).includes(d),
  );
  return filtered.length > 0 ? filtered : defaultSession().durations;
}

/** Exported for unit tests. `timeZone` scopes “today” for legacy am/pm / fallbacks. */
export function sanitizeTraffic(
  raw: unknown,
  timeZone?: string,
): DepartWhen {
  const today = defaultDepartWhen(new Date(), timeZone);
  // Legacy am/pm presets → today + shortcut hour (am matches defaultDepartWhen)
  if (raw === "am") return today;
  if (raw === "pm") {
    return {
      weekday: today.weekday,
      hour: TIME_SHORTCUT_PM.hour,
      minute: TIME_SHORTCUT_PM.minute,
    };
  }

  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const parsed = parseDepartWhenParts(o.weekday, o.hour, o.minute);
    if (parsed) return parsed;
  }
  return today;
}

export function loadSession(): SessionState {
  try {
    const raw =
      sessionStorage.getItem(KEY) ?? sessionStorage.getItem(LEGACY_KEY);
    if (!raw) return defaultSession();
    const parsed = JSON.parse(raw) as Partial<SessionState> & {
      traffic?: unknown;
    };
    const base = defaultSession();
    const commitments = Array.isArray(parsed.commitments)
      ? parsed.commitments
          .filter(
            (c) =>
              c &&
              typeof c.id === "string" &&
              typeof c.label === "string" &&
              typeof c.placeName === "string" &&
              typeof c.lng === "number" &&
              typeof c.lat === "number",
          )
          .map(toPersistableCommitment)
      : [];
    const root =
      parsed.root &&
      typeof parsed.root.lng === "number" &&
      typeof parsed.root.lat === "number" &&
      typeof parsed.root.label === "string"
        ? parsed.root
        : null;
    const rootTz = root
      ? timeZoneForLngLat(root.lng, root.lat) ?? undefined
      : undefined;
    const state: SessionState = {
      ...base,
      root,
      durations: sanitizeDurations(parsed.durations),
      traffic: sanitizeTraffic(parsed.traffic, rootTz),
      commitments,
      commitmentsOpen: Boolean(parsed.commitmentsOpen),
    };
    // Write v2 first; only drop v1 after a successful persist
    if (sessionStorage.getItem(LEGACY_KEY) && saveSession(state)) {
      sessionStorage.removeItem(LEGACY_KEY);
    }
    return state;
  } catch {
    return defaultSession();
  }
}

export function sessionPersistKey(state: SessionState): string {
  return JSON.stringify({
    root: state.root,
    durations: state.durations,
    traffic: state.traffic,
    commitmentsOpen: state.commitmentsOpen,
    commitments: state.commitments.map(toPersistableCommitment),
  });
}

/** @returns true if the session was written to storage */
export function saveSession(state: SessionState): boolean {
  try {
    const toSave: SessionState = {
      root: state.root,
      durations: state.durations,
      traffic: state.traffic,
      commitmentsOpen: state.commitmentsOpen,
      commitments: state.commitments.map(toPersistableCommitment),
    };
    sessionStorage.setItem(KEY, JSON.stringify(toSave));
    return true;
  } catch {
    return false;
  }
}
