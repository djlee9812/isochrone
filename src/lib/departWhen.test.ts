import { describe, expect, it } from "vitest";
import {
  TIME_SHORTCUT_AM,
  TIME_SHORTCUT_PM,
  formatHhMm,
  parseDepartWhenParts,
  parseTimeInput,
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
  it("accepts valid parts and rejects invalid", () => {
    expect(parseDepartWhenParts(1, 9, 0)).toEqual({
      weekday: 1,
      hour: 9,
      minute: 0,
    });
    expect(parseDepartWhenParts(0, 9, 0)).toBeNull();
    expect(parseDepartWhenParts(1, 9.5, 0)).toBeNull();
  });
});
