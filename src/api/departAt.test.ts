import { describe, expect, it } from "vitest";
import { defaultDepartWhen, departAtForWhen } from "./departAt";

describe("departAtForWhen", () => {
  it("same weekday with future time → today", () => {
    // Wednesday 2026-07-29 08:00 EDT
    const now = new Date("2026-07-29T12:00:00Z");
    expect(
      departAtForWhen({ weekday: 3, hour: 9, minute: 0 }, now),
    ).toBe("2026-07-29T09:00");
  });

  it("same weekday with past time → +7 days", () => {
    // Wednesday 2026-07-29 10:00 EDT (after 9:00)
    const now = new Date("2026-07-29T14:00:00Z");
    expect(
      departAtForWhen({ weekday: 3, hour: 9, minute: 0 }, now),
    ).toBe("2026-08-05T09:00");
  });

  it("other weekday resolves to the next matching day", () => {
    // Wednesday → Friday 17:00
    const now = new Date("2026-07-29T12:00:00Z");
    expect(
      departAtForWhen({ weekday: 5, hour: 17, minute: 0 }, now),
    ).toBe("2026-07-31T17:00");
  });

  it("weekend selection works", () => {
    // Wednesday → Sunday 09:00
    const now = new Date("2026-07-29T12:00:00Z");
    expect(
      departAtForWhen({ weekday: 7, hour: 9, minute: 0 }, now),
    ).toBe("2026-08-02T09:00");
  });

  it("does not skip Sunday across spring-forward DST", () => {
    // Sat 2026-03-07 23:30 EST — UTC addDays previously skipped Sunday
    const now = new Date("2026-03-08T04:30:00Z");
    expect(
      departAtForWhen({ weekday: 7, hour: 9, minute: 0 }, now),
    ).toBe("2026-03-08T09:00");
  });

  it("clamps spring-forward gap times to the next valid minute", () => {
    // Sun 2026-03-08 02:30 does not exist (2am → 3am)
    const now = new Date("2026-03-08T05:00:00Z"); // Sun 00:00 EST
    expect(
      departAtForWhen({ weekday: 7, hour: 2, minute: 30 }, now),
    ).toBe("2026-03-08T03:00");
  });

  it("resolves across fall-back weekend without skipping the day", () => {
    // Sat before fall-back 2026-11-01 → Sunday 09:00
    const now = new Date("2026-10-31T16:00:00Z"); // Sat noon EDT
    expect(
      departAtForWhen({ weekday: 7, hour: 9, minute: 0 }, now),
    ).toBe("2026-11-01T09:00");
  });

  it("uses the pin timezone wall clock, not Boston", () => {
    // Wednesday 2026-07-29 08:00 PDT — still before 9AM local in LA
    const now = new Date("2026-07-29T15:00:00Z");
    expect(
      departAtForWhen(
        { weekday: 3, hour: 9, minute: 0 },
        now,
        "America/Los_Angeles",
      ),
    ).toBe("2026-07-29T09:00");

    // Same UTC instant is already 11:00 in Boston → would roll +7 there
    expect(
      departAtForWhen({ weekday: 3, hour: 9, minute: 0 }, now),
    ).toBe("2026-08-05T09:00");
  });
});

describe("defaultDepartWhen", () => {
  it("uses today in the given timezone + 9AM", () => {
    // Wednesday morning UTC is still Tuesday evening in LA
    const now = new Date("2026-07-29T06:00:00Z");
    expect(defaultDepartWhen(now, "America/Los_Angeles")).toEqual({
      weekday: 2,
      hour: 9,
      minute: 0,
    });
    expect(defaultDepartWhen(now)).toEqual({
      weekday: 3,
      hour: 9,
      minute: 0,
    });
  });
});
