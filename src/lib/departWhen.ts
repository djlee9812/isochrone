import type { DepartWhen, ReachMode, Weekday } from "./types";
import { REACH_MODES } from "./types";

/** Morning commute shortcut (default time). */
export const TIME_SHORTCUT_AM = {
  hour: 9,
  minute: 0,
  label: "9AM",
} as const;

/** Evening commute shortcut. */
export const TIME_SHORTCUT_PM = {
  hour: 17,
  minute: 0,
  label: "5PM",
} as const;

export const TIME_SHORTCUTS = [TIME_SHORTCUT_AM, TIME_SHORTCUT_PM] as const;

export const REACH_MODE_OPTIONS: {
  mode: ReachMode;
  label: string;
  title: string;
}[] = [
  {
    mode: "worst",
    label: "Worst case",
    title: "Areas you can reach on every selected day",
  },
  {
    mode: "typical",
    label: "Typical",
    title: "Average reach across selected days",
  },
  {
    mode: "best",
    label: "Best case",
    title: "Areas you can reach on at least one selected day",
  },
];

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatHhMm(hour: number, minute: number): string {
  return `${pad2(hour)}:${pad2(minute)}`;
}

/** Parse `HH:mm` or `HH:mm:ss` from `<input type="time">`. */
export function parseTimeInput(
  raw: string,
): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(raw);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!isValidHourMinute(hour, minute)) return null;
  return { hour, minute };
}

export function isValidHourMinute(hour: number, minute: number): boolean {
  return (
    Number.isInteger(hour) &&
    hour >= 0 &&
    hour <= 23 &&
    Number.isInteger(minute) &&
    minute >= 0 &&
    minute <= 59
  );
}

export function isValidWeekday(weekday: number): weekday is Weekday {
  return Number.isInteger(weekday) && weekday >= 1 && weekday <= 7;
}

export function isValidReachMode(value: unknown): value is ReachMode {
  return (
    typeof value === "string" &&
    (REACH_MODES as readonly string[]).includes(value)
  );
}

/** Unique sorted weekdays; empty input → []. */
export function normalizeWeekdays(raw: unknown): Weekday[] {
  if (!Array.isArray(raw)) return [];
  const set = new Set<Weekday>();
  for (const item of raw) {
    const n = Number(item);
    if (isValidWeekday(n)) set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}

export function sameWeekdays(a: Weekday[], b: Weekday[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((w, i) => w === b[i]);
}

/**
 * Toggle a weekday in a multi-select list. Always keeps at least one day.
 * Returns the previous array reference when unchanged.
 */
export function toggleWeekdaySelection(
  weekdays: Weekday[],
  weekday: Weekday,
): Weekday[] {
  const selected = weekdays.includes(weekday);
  if (selected) {
    if (weekdays.length === 1) return weekdays;
    return weekdays.filter((w) => w !== weekday);
  }
  return normalizeWeekdays([...weekdays, weekday]);
}

/**
 * Parse traffic from session / controls.
 * Accepts legacy `{ weekday }` or `{ weekdays }`.
 */
export function parseDepartWhenParts(
  weekdayOrWeekdays: unknown,
  hour: unknown,
  minute: unknown,
  weekdaysField?: unknown,
): DepartWhen | null {
  const h = Number(hour);
  const m = Number(minute);
  if (!isValidHourMinute(h, m)) return null;

  let weekdays = normalizeWeekdays(weekdaysField);
  if (weekdays.length === 0) {
    weekdays = normalizeWeekdays(
      Array.isArray(weekdayOrWeekdays)
        ? weekdayOrWeekdays
        : weekdayOrWeekdays != null
          ? [weekdayOrWeekdays]
          : [],
    );
  }
  if (weekdays.length === 0) return null;
  return { weekdays, hour: h, minute: m };
}

export function matchesTimeShortcut(
  when: Pick<DepartWhen, "hour" | "minute">,
  shortcut: { hour: number; minute: number },
): boolean {
  return when.hour === shortcut.hour && when.minute === shortcut.minute;
}
