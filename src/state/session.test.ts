import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultDepartWhen } from "../api/departAt";
import { TIME_SHORTCUT_PM } from "../lib/departWhen";
import {
  loadSession,
  sanitizeReachMode,
  sanitizeTraffic,
  saveSession,
} from "./session";

const KEY = "from-here-session-v3";
const LEGACY_V2_KEY = "from-here-session-v2";
const LEGACY_V1_KEY = "from-here-session-v1";

function mockSessionStorage() {
  const store = new Map<string, string>();
  const api = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    get _store() {
      return store;
    },
  };
  vi.stubGlobal("sessionStorage", api);
  return api;
}

describe("sanitizeTraffic", () => {
  it('maps legacy "am" to defaultDepartWhen()', () => {
    expect(sanitizeTraffic("am")).toEqual(defaultDepartWhen());
  });

  it('maps legacy "pm" to today + 5PM', () => {
    const today = defaultDepartWhen();
    expect(sanitizeTraffic("pm")).toEqual({
      weekdays: today.weekdays,
      hour: TIME_SHORTCUT_PM.hour,
      minute: TIME_SHORTCUT_PM.minute,
    });
  });

  it("scopes legacy am/pm “today” to the given timezone", () => {
    // Wed 06:00 UTC = Tue evening in LA
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T06:00:00Z"));
    expect(sanitizeTraffic("am", "America/Los_Angeles")).toEqual({
      weekdays: [2],
      hour: 9,
      minute: 0,
    });
    expect(sanitizeTraffic("am")).toEqual({
      weekdays: [3],
      hour: 9,
      minute: 0,
    });
    vi.useRealTimers();
  });

  it("accepts legacy single weekday objects", () => {
    expect(sanitizeTraffic({ weekday: 2, hour: 8, minute: 15 })).toEqual({
      weekdays: [2],
      hour: 8,
      minute: 15,
    });
  });

  it("accepts weekdays arrays", () => {
    expect(
      sanitizeTraffic({ weekdays: [4, 2, 3], hour: 9, minute: 0 }),
    ).toEqual({
      weekdays: [2, 3, 4],
      hour: 9,
      minute: 0,
    });
  });

  it("falls back to default for invalid objects", () => {
    expect(sanitizeTraffic({ weekday: 0, hour: 9, minute: 0 })).toEqual(
      defaultDepartWhen(),
    );
    expect(sanitizeTraffic(null)).toEqual(defaultDepartWhen());
  });
});

describe("sanitizeReachMode", () => {
  it("defaults to worst and accepts known modes", () => {
    expect(sanitizeReachMode(undefined)).toBe("worst");
    expect(sanitizeReachMode("typical")).toBe("typical");
    expect(sanitizeReachMode("nope")).toBe("worst");
  });
});

describe("loadSession migration", () => {
  beforeEach(() => {
    mockSessionStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("migrates v1 am/pm using pin-local today when root is set", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T06:00:00Z"));
    sessionStorage.setItem(
      LEGACY_V1_KEY,
      JSON.stringify({
        root: {
          lng: -118.2437,
          lat: 34.0522,
          label: "Los Angeles",
        },
        durations: [30],
        traffic: "am",
        commitments: [],
        commitmentsOpen: false,
      }),
    );

    const state = loadSession();
    expect(state.traffic).toEqual({
      weekdays: [2],
      hour: 9,
      minute: 0,
    });
    expect(state.reachMode).toBe("worst");
    vi.useRealTimers();
  });

  it("migrates v2 single weekday to v3 weekdays", () => {
    sessionStorage.setItem(
      LEGACY_V2_KEY,
      JSON.stringify({
        root: null,
        durations: [30],
        traffic: { weekday: 5, hour: 17, minute: 0 },
        commitments: [],
        commitmentsOpen: false,
      }),
    );

    const state = loadSession();
    expect(state.traffic).toEqual({
      weekdays: [5],
      hour: 17,
      minute: 0,
    });
    expect(sessionStorage.getItem(LEGACY_V2_KEY)).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeTruthy();
  });

  it("migrates v1 am/pm to v3 and removes the legacy key", () => {
    sessionStorage.setItem(
      LEGACY_V1_KEY,
      JSON.stringify({
        root: null,
        durations: [30],
        traffic: "pm",
        commitments: [],
        commitmentsOpen: false,
      }),
    );

    const state = loadSession();
    const today = defaultDepartWhen();
    expect(state.traffic).toEqual({
      weekdays: today.weekdays,
      hour: 17,
      minute: 0,
    });
    expect(sessionStorage.getItem(LEGACY_V1_KEY)).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeTruthy();
    const stored = JSON.parse(sessionStorage.getItem(KEY)!);
    expect(stored.traffic).toEqual(state.traffic);
    expect(stored.reachMode).toBe("worst");
  });

  it("keeps legacy key if v3 write fails", () => {
    sessionStorage.setItem(
      LEGACY_V1_KEY,
      JSON.stringify({
        traffic: "am",
        durations: [15],
        commitments: [],
      }),
    );
    const original = sessionStorage.setItem.bind(sessionStorage);
    sessionStorage.setItem = (k: string, v: string) => {
      if (k === KEY) throw new Error("quota");
      return original(k, v);
    };

    const state = loadSession();
    expect(state.traffic).toEqual(defaultDepartWhen());
    expect(sessionStorage.getItem(LEGACY_V1_KEY)).toBeTruthy();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });
});

describe("saveSession", () => {
  beforeEach(() => {
    mockSessionStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns true on success and false on failure", () => {
    const ok = saveSession({
      root: null,
      durations: [30],
      traffic: defaultDepartWhen(),
      reachMode: "worst",
      commitments: [],
      commitmentsOpen: false,
    });
    expect(ok).toBe(true);
    expect(sessionStorage.getItem(KEY)).toBeTruthy();

    sessionStorage.setItem = () => {
      throw new Error("quota");
    };
    expect(
      saveSession({
        root: null,
        durations: [30],
        traffic: defaultDepartWhen(),
        reachMode: "worst",
        commitments: [],
        commitmentsOpen: false,
      }),
    ).toBe(false);
  });
});
