import { useEffect, useRef, useState } from "react";
import type { DepartWhen, ReachMode, Weekday } from "../lib/types";
import {
  REACH_MODE_OPTIONS,
  TIME_SHORTCUTS,
  formatHhMm,
  matchesTimeShortcut,
  parseTimeInput,
  sameWeekdays,
  toggleWeekdaySelection,
} from "../lib/departWhen";

const DAYS: { weekday: Weekday; label: string; title: string }[] = [
  { weekday: 1, label: "M", title: "Monday" },
  { weekday: 2, label: "T", title: "Tuesday" },
  { weekday: 3, label: "W", title: "Wednesday" },
  { weekday: 4, label: "T", title: "Thursday" },
  { weekday: 5, label: "F", title: "Friday" },
  { weekday: 6, label: "S", title: "Saturday" },
  { weekday: 7, label: "S", title: "Sunday" },
];

/** Debounce parent updates while scrubbing the time picker (Mapbox cost). */
const TIME_COMMIT_MS = 500;

type Props = {
  value: DepartWhen;
  reachMode: ReachMode;
  onChange: (next: DepartWhen) => void;
  onReachModeChange: (mode: ReachMode) => void;
};

export function WhenControls({
  value,
  reachMode,
  onChange,
  onReachModeChange,
}: Props) {
  const [draftTime, setDraftTime] = useState(() =>
    formatHhMm(value.hour, value.minute),
  );
  const commitTimer = useRef<number | null>(null);
  const valueRef = useRef(value);
  const draftRef = useRef(draftTime);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  draftRef.current = draftTime;
  onChangeRef.current = onChange;

  useEffect(() => {
    setDraftTime(formatHhMm(value.hour, value.minute));
  }, [value.hour, value.minute]);

  const clearCommitTimer = () => {
    if (commitTimer.current != null) {
      window.clearTimeout(commitTimer.current);
      commitTimer.current = null;
    }
  };

  const commitTime = (hour: number, minute: number) => {
    const current = valueRef.current;
    if (current.hour === hour && current.minute === minute) return;
    onChangeRef.current({ ...current, hour, minute });
  };

  /** Apply draft time onto the latest value (avoids stale weekday wipe). */
  const flushDraftTime = (): boolean => {
    const parsed = parseTimeInput(draftRef.current);
    if (!parsed) {
      const current = valueRef.current;
      setDraftTime(formatHhMm(current.hour, current.minute));
      return false;
    }
    setDraftTime(formatHhMm(parsed.hour, parsed.minute));
    commitTime(parsed.hour, parsed.minute);
    return true;
  };

  useEffect(() => {
    return () => {
      if (commitTimer.current == null) return;
      window.clearTimeout(commitTimer.current);
      commitTimer.current = null;
      const parsed = parseTimeInput(draftRef.current);
      if (!parsed) return;
      const current = valueRef.current;
      if (current.hour === parsed.hour && current.minute === parsed.minute) {
        return;
      }
      onChangeRef.current({
        ...current,
        hour: parsed.hour,
        minute: parsed.minute,
      });
    };
  }, []);

  const toggleWeekday = (weekday: Weekday) => {
    clearCommitTimer();
    const current = valueRef.current;
    const parsed = parseTimeInput(draftRef.current);
    const hour = parsed?.hour ?? current.hour;
    const minute = parsed?.minute ?? current.minute;
    const weekdays = toggleWeekdaySelection(current.weekdays, weekday);
    if (
      sameWeekdays(current.weekdays, weekdays) &&
      current.hour === hour &&
      current.minute === minute
    ) {
      return;
    }
    if (parsed) setDraftTime(formatHhMm(hour, minute));
    onChangeRef.current({ weekdays, hour, minute });
  };

  const onTimeInput = (raw: string) => {
    setDraftTime(raw);
    const parsed = parseTimeInput(raw);
    if (!parsed) return;

    clearCommitTimer();
    commitTimer.current = window.setTimeout(() => {
      commitTimer.current = null;
      setDraftTime(formatHhMm(parsed.hour, parsed.minute));
      commitTime(parsed.hour, parsed.minute);
    }, TIME_COMMIT_MS);
  };

  const onTimeBlur = () => {
    clearCommitTimer();
    flushDraftTime();
  };

  const applyShortcut = (hour: number, minute: number) => {
    clearCommitTimer();
    setDraftTime(formatHhMm(hour, minute));
    commitTime(hour, minute);
  };

  const showReachModes = value.weekdays.length > 1;
  const activeMode =
    REACH_MODE_OPTIONS.find((o) => o.mode === reachMode) ??
    REACH_MODE_OPTIONS[0]!;

  return (
    <div className="when-controls">
      <div className="day-chips" role="group" aria-label="Days of week">
        {DAYS.map((d) => {
          const active = value.weekdays.includes(d.weekday);
          return (
            <button
              key={d.weekday}
              type="button"
              className={`day-chip ${active ? "is-active" : ""}`}
              aria-pressed={active}
              aria-label={d.title}
              title={d.title}
              onClick={() => toggleWeekday(d.weekday)}
            >
              {d.label}
            </button>
          );
        })}
      </div>

      {showReachModes && (
        <div className="reach-mode">
          <div
            className="reach-mode-chips"
            role="group"
            aria-label="Multi-day reach"
          >
            {REACH_MODE_OPTIONS.map((o) => {
              const active = reachMode === o.mode;
              return (
                <button
                  key={o.mode}
                  type="button"
                  className={`reach-mode-chip ${active ? "is-active" : ""}`}
                  aria-pressed={active}
                  title={o.title}
                  onClick={() => onReachModeChange(o.mode)}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          <p className="reach-mode-hint">{activeMode.title}</p>
        </div>
      )}

      <div className="time-row">
        <label className="time-field">
          <span className="visually-hidden">Time</span>
          <input
            type="time"
            step={300}
            value={draftTime.length >= 5 ? draftTime.slice(0, 5) : draftTime}
            onChange={(e) => onTimeInput(e.target.value)}
            onBlur={onTimeBlur}
          />
        </label>
        <div className="time-shortcuts" role="group" aria-label="Quick times">
          {TIME_SHORTCUTS.map((s) => {
            const active = matchesTimeShortcut(value, s);
            return (
              <button
                key={s.label}
                type="button"
                className={`time-shortcut ${active ? "is-active" : ""}`}
                aria-pressed={active}
                onClick={() => applyShortcut(s.hour, s.minute)}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
