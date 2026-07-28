import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultDepartWhen } from "../api/departAt";
import { TIME_SHORTCUT_PM } from "../lib/departWhen";
import {
  loadSession,
  sanitizeTraffic,
  saveSession,
} from "./session";

const KEY = "from-here-session-v2";
const LEGACY_KEY = "from-here-session-v1";

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
      weekday: today.weekday,
      hour: TIME_SHORTCUT_PM.hour,
      minute: TIME_SHORTCUT_PM.minute,
    });
  });

  it("scopes legacy am/pm “today” to the given timezone", () => {
    // Wed 06:00 UTC = Tue evening in LA
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T06:00:00Z"));
    expect(sanitizeTraffic("am", "America/Los_Angeles")).toEqual({
      weekday: 2,
      hour: 9,
      minute: 0,
    });
    expect(sanitizeTraffic("am")).toEqual({
      weekday: 3,
      hour: 9,
      minute: 0,
    });
    vi.useRealTimers();
  });

  it("accepts valid DepartWhen objects", () => {
    expect(sanitizeTraffic({ weekday: 2, hour: 8, minute: 15 })).toEqual({
      weekday: 2,
      hour: 8,
      minute: 15,
    });
  });

  it("falls back to default for invalid objects", () => {
    expect(sanitizeTraffic({ weekday: 0, hour: 9, minute: 0 })).toEqual(
      defaultDepartWhen(),
    );
    expect(sanitizeTraffic(null)).toEqual(defaultDepartWhen());
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
      LEGACY_KEY,
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
      weekday: 2,
      hour: 9,
      minute: 0,
    });
    vi.useRealTimers();
  });

  it("migrates v1 am/pm to v2 and removes the legacy key", () => {
    sessionStorage.setItem(
      LEGACY_KEY,
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
      weekday: today.weekday,
      hour: 17,
      minute: 0,
    });
    expect(sessionStorage.getItem(LEGACY_KEY)).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeTruthy();
    const stored = JSON.parse(sessionStorage.getItem(KEY)!);
    expect(stored.traffic).toEqual(state.traffic);
  });

  it("keeps legacy key if v2 write fails", () => {
    sessionStorage.setItem(
      LEGACY_KEY,
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
    expect(sessionStorage.getItem(LEGACY_KEY)).toBeTruthy();
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
        commitments: [],
        commitmentsOpen: false,
      }),
    ).toBe(false);
  });
});
