import { describe, expect, it } from "vitest";
import {
  TIME_SHORTCUT_AM,
  TIME_SHORTCUT_PM,
  formatHhMm,
  normalizeWeekdays,
  parseDepartWhenParts,
  parseTimeInput,
  toggleWeekdaySelection,
} from "./departWhen";

describe("parseTimeInput", () => {
  it("accepts HH:mm and HH:mm:ss", () => {
    expect(parseTimeInput("09:00")).toEqual({ hour: 9, minute: 0 });
    expect(parseTimeInput("17:00:00")).toEqual({ hour: 17, minute: 0 });
  });

  it("rejects empty and out-of-range", () => {
    expect(parseTimeInput("")).toBeNull();
    expect(parseTimeInput("25:00")).toBeNull();
  });
});

describe("formatHhMm / shortcuts", () => {
  it("zero-pads and matches shortcut constants", () => {
    expect(formatHhMm(TIME_SHORTCUT_AM.hour, TIME_SHORTCUT_AM.minute)).toBe(
      "09:00",
    );
    expect(formatHhMm(TIME_SHORTCUT_PM.hour, TIME_SHORTCUT_PM.minute)).toBe(
      "17:00",
    );
    expect(TIME_SHORTCUT_AM.label).toBe("9AM");
    expect(TIME_SHORTCUT_PM.label).toBe("5PM");
  });
});

describe("parseDepartWhenParts", () => {
  it("accepts legacy single weekday", () => {
    expect(parseDepartWhenParts(1, 9, 0)).toEqual({
      weekdays: [1],
      hour: 9,
      minute: 0,
    });
  });

  it("accepts weekdays array field", () => {
    expect(parseDepartWhenParts(undefined, 8, 15, [4, 2, 2, 3])).toEqual({
      weekdays: [2, 3, 4],
      hour: 8,
      minute: 15,
    });
  });

  it("rejects invalid", () => {
    expect(parseDepartWhenParts(0, 9, 0)).toBeNull();
    expect(parseDepartWhenParts(1, 9.5, 0)).toBeNull();
    expect(parseDepartWhenParts([], 9, 0)).toBeNull();
  });
});

describe("normalizeWeekdays", () => {
  it("dedupes and sorts", () => {
    expect(normalizeWeekdays([5, 1, 5, 3])).toEqual([1, 3, 5]);
    expect(normalizeWeekdays("nope")).toEqual([]);
  });
});

describe("toggleWeekdaySelection", () => {
  it("keeps at least one weekday", () => {
    expect(toggleWeekdaySelection([3], 3)).toEqual([3]);
  });

  it("adds and removes weekdays", () => {
    expect(toggleWeekdaySelection([2], 4)).toEqual([2, 4]);
    expect(toggleWeekdaySelection([2, 4], 2)).toEqual([4]);
  });
});
