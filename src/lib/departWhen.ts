import type { DepartWhen, Weekday } from "./types";

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

export function parseDepartWhenParts(
  weekday: unknown,
  hour: unknown,
  minute: unknown,
): DepartWhen | null {
  const w = Number(weekday);
  const h = Number(hour);
  const m = Number(minute);
  if (!isValidWeekday(w) || !isValidHourMinute(h, m)) return null;
  return { weekday: w, hour: h, minute: m };
}

export function matchesTimeShortcut(
  when: Pick<DepartWhen, "hour" | "minute">,
  shortcut: { hour: number; minute: number },
): boolean {
  return when.hour === shortcut.hour && when.minute === shortcut.minute;
}
