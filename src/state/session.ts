import { DURATIONS, type Commitment, type SessionState, type TrafficPreset } from "../lib/types";

const KEY = "from-here-session-v1";

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
  traffic: "am",
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

function sanitizeTraffic(raw: unknown): TrafficPreset {
  return raw === "pm" ? "pm" : "am";
}

export function loadSession(): SessionState {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return defaultSession();
    const parsed = JSON.parse(raw) as Partial<SessionState>;
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
    return {
      ...base,
      root,
      durations: sanitizeDurations(parsed.durations),
      traffic: sanitizeTraffic(parsed.traffic),
      commitments,
      commitmentsOpen: Boolean(parsed.commitmentsOpen),
    };
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

export function saveSession(state: SessionState): void {
  try {
    const toSave: SessionState = {
      root: state.root,
      durations: state.durations,
      traffic: state.traffic,
      commitmentsOpen: state.commitmentsOpen,
      commitments: state.commitments.map(toPersistableCommitment),
    };
    sessionStorage.setItem(KEY, JSON.stringify(toSave));
  } catch {
    // ignore quota / private mode
  }
}
