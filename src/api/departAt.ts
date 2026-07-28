import type { DepartWhen, Weekday } from "../lib/types";
import { TIME_SHORTCUT_AM, pad2 } from "../lib/departWhen";
import { DEFAULT_TIME_ZONE } from "../lib/timeZone";

export { DEFAULT_TIME_ZONE };

const WEEKDAY_MAP: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let fmt = formatterCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    formatterCache.set(timeZone, fmt);
  }
  return fmt;
}

/**
 * Next occurrence of the selected weekday at hour:minute in `timeZone`,
 * formatted for Mapbox Isochrone `depart_at` as YYYY-MM-DDThh:mm
 * (Mapbox infers the offset from the request coordinates).
 *
 * If that slot already passed this week, rolls forward +7 days.
 * Times in a spring-forward gap clamp to the next valid local minute.
 */
export function departAtForWhen(
  when: DepartWhen,
  now = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): string {
  const next = nextWeekdayAtTime(
    now,
    when.weekday,
    when.hour,
    when.minute,
    timeZone,
  );
  return formatLocalDepartAt(next, timeZone);
}

/** Fresh-session default: today’s weekday in `timeZone` + 09:00. */
export function defaultDepartWhen(
  now = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): DepartWhen {
  const today = zonedParts(now, timeZone).weekday as Weekday;
  return {
    weekday: today,
    hour: TIME_SHORTCUT_AM.hour,
    minute: TIME_SHORTCUT_AM.minute,
  };
}

/** True when `when` matches the Eastern session default for `now`. */
export function matchesDefaultDepartWhen(
  when: DepartWhen,
  now = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): boolean {
  const d = defaultDepartWhen(now, timeZone);
  return (
    when.weekday === d.weekday &&
    when.hour === d.hour &&
    when.minute === d.minute
  );
}

function nextWeekdayAtTime(
  now: Date,
  weekday: Weekday,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const parts = zonedParts(now, timeZone);
  const daysAhead = (weekday - parts.weekday + 7) % 7;
  const first = slotOnOffset(now, daysAhead, hour, minute, timeZone);
  if (first.getTime() >= now.getTime()) return first;
  return slotOnOffset(now, daysAhead + 7, hour, minute, timeZone);
}

function slotOnOffset(
  now: Date,
  daysAhead: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const day = zonedParts(addDays(now, daysAhead, timeZone), timeZone);
  return zonedTimeToUtc(day.year, day.month, day.day, hour, minute, timeZone);
}

function addDays(d: Date, n: number, timeZone: string): Date {
  // Advance civil calendar days in the target zone (not UTC), so DST
  // transitions cannot skip/duplicate a weekday when iterating offsets.
  const p = zonedParts(d, timeZone);
  const anchor = new Date(Date.UTC(p.year, p.month - 1, p.day, 12, 0, 0));
  anchor.setUTCDate(anchor.getUTCDate() + n);
  return anchor;
}

function zonedParts(
  d: Date,
  timeZone: string,
): {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
} {
  const parts = Object.fromEntries(
    formatterFor(timeZone)
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  const weekday = WEEKDAY_MAP[parts.weekday ?? ""];
  if (weekday == null) {
    throw new Error(`Unexpected weekday token: ${parts.weekday}`);
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

/** Interpret Y-M-D H:M as wall time in `timeZone` → UTC Date */
function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  let lo = Date.UTC(year, month - 1, day - 1, 0, 0);
  let hi = Date.UTC(year, month - 1, day + 1, 23, 59);
  const target = `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}`;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const wall = formatLocalDepartAt(new Date(mid), timeZone);
    if (wall < target) lo = mid + 1;
    else hi = mid;
  }
  return new Date(lo);
}

function formatLocalDepartAt(d: Date, timeZone: string): string {
  const p = zonedParts(d, timeZone);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}`;
}
