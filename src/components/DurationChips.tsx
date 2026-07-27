import { DURATIONS, type DurationMinutes } from "../lib/types";

type Props = {
  value: DurationMinutes[];
  onChange: (next: DurationMinutes[]) => void;
};

export function DurationChips({ value, onChange }: Props) {
  const toggle = (minutes: DurationMinutes) => {
    if (value.includes(minutes)) {
      if (value.length === 1) return; // keep at least one
      onChange(value.filter((v) => v !== minutes));
      return;
    }
    onChange([...value, minutes].sort((a, b) => a - b) as DurationMinutes[]);
  };

  return (
    <div className="duration-chips" role="group" aria-label="Travel time">
      {DURATIONS.map((m) => {
        const active = value.includes(m);
        return (
          <button
            key={m}
            type="button"
            className={`chip ${active ? "is-active" : ""}`}
            aria-pressed={active}
            onClick={() => toggle(m)}
          >
            {m}
            <span className="chip-unit">m</span>
          </button>
        );
      })}
    </div>
  );
}
