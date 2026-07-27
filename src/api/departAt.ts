import type { TrafficPreset } from "../lib/types";

const BOSTON_TZ = "America/New_York";

/**
 * Next weekday (Mon–Fri) at 09:00 or 17:00 America/New_York, formatted for
 * Mapbox Isochrone `depart_at` as YYYY-MM-DDThh:mm (local offset inferred from coords).
 *
 * Example: departAtForPreset("am") → "2026-07-28T09:00"
 */
export function departAtForPreset(preset: TrafficPreset, now = new Date()): string {
  const hour = preset === "am" ? 9 : 17;
  const next = nextWeekdayAtHour(now, hour);
  return formatLocalDepartAt(next);
}

function nextWeekdayAtHour(now: Date, hour: number): Date {
  for (let offset = 0; offset < 14; offset++) {
    const candidateLocal = bostonParts(addDays(now, offset));
    const dow = candidateLocal.weekday; // 1=Mon … 7=Sun (ISO)
    if (dow > 5) continue;

    const atSlot = zonedTimeToUtc(
      candidateLocal.year,
      candidateLocal.month,
      candidateLocal.day,
      hour,
      0,
    );
    // Mapbox depart_at must not be in the past
    if (atSlot.getTime() >= now.getTime()) {
      return atSlot;
    }
  }
  // Fallback: next Monday 9/5
  const parts = bostonParts(now);
  const daysAhead = ((8 - parts.weekday) % 7) || 7;
  const monday = addDays(now, daysAhead);
  const mp = bostonParts(monday);
  return zonedTimeToUtc(mp.year, mp.month, mp.day, hour, 0);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function bostonParts(d: Date): {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
} {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: BOSTON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(d).map((p) => [p.type, p.value]),
  );
  const weekdayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: weekdayMap[parts.weekday] ?? 1,
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
  const target = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
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
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function trafficLabel(preset: TrafficPreset): string {
  return preset === "am" ? "Weekday 9:00 AM" : "Weekday 5:00 PM";
}
