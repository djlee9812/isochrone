import type { DepartWhen, Weekday } from "../lib/types";
import { TIME_SHORTCUT_AM, pad2 } from "../lib/departWhen";

const BOSTON_TZ = "America/New_York";

const bostonFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: BOSTON_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const WEEKDAY_MAP: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

/**
 * Next occurrence of the selected weekday at hour:minute America/New_York,
 * formatted for Mapbox Isochrone `depart_at` as YYYY-MM-DDThh:mm
 * (local offset inferred from coords).
 *
 * If that slot already passed this week, rolls forward +7 days.
 * Times in a spring-forward gap clamp to the next valid local minute.
 */
export function departAtForWhen(when: DepartWhen, now = new Date()): string {
  const next = nextWeekdayAtTime(now, when.weekday, when.hour, when.minute);
  return formatLocalDepartAt(next);
}

/** Fresh-session default: today’s Boston weekday + 09:00. */
export function defaultDepartWhen(now = new Date()): DepartWhen {
  const today = bostonParts(now).weekday as Weekday;
  return {
    weekday: today,
    hour: TIME_SHORTCUT_AM.hour,
    minute: TIME_SHORTCUT_AM.minute,
  };
}

function nextWeekdayAtTime(
  now: Date,
  weekday: Weekday,
  hour: number,
  minute: number,
): Date {
  const parts = bostonParts(now);
  const daysAhead = (weekday - parts.weekday + 7) % 7;
  const first = slotOnOffset(now, daysAhead, hour, minute);
  if (first.getTime() >= now.getTime()) return first;
  return slotOnOffset(now, daysAhead + 7, hour, minute);
}

function slotOnOffset(
  now: Date,
  daysAhead: number,
  hour: number,
  minute: number,
): Date {
  const day = bostonParts(addDays(now, daysAhead));
  return zonedTimeToUtc(day.year, day.month, day.day, hour, minute);
}

function addDays(d: Date, n: number): Date {
  // Advance Boston civil calendar days (not UTC), so DST transitions
  // cannot skip/duplicate a weekday when iterating offsets.
  const p = bostonParts(d);
  const anchor = new Date(Date.UTC(p.year, p.month - 1, p.day, 12, 0, 0));
  anchor.setUTCDate(anchor.getUTCDate() + n);
  return anchor;
}

function bostonParts(d: Date): {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
} {
  const parts = Object.fromEntries(
    bostonFmt.formatToParts(d).map((p) => [p.type, p.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: WEEKDAY_MAP[parts.weekday] ?? 1,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

/** Interpret Y-M-D H:M as America/New_York wall time → UTC Date */
function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  let lo = Date.UTC(year, month - 1, day - 1, 0, 0);
  let hi = Date.UTC(year, month - 1, day + 1, 23, 59);
  const target = `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}`;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const wall = formatLocalDepartAt(new Date(mid));
    if (wall < target) lo = mid + 1;
    else hi = mid;
  }
  return new Date(lo);
}

function formatLocalDepartAt(d: Date): string {
  const p = bostonParts(d);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}`;
}
