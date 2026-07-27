import type { TrafficPreset } from "../lib/types";

type Props = {
  value: TrafficPreset;
  onChange: (next: TrafficPreset) => void;
};

export function TrafficPresets({ value, onChange }: Props) {
  return (
    <div className="traffic-presets" role="group" aria-label="When">
      <button
        type="button"
        className={`preset ${value === "am" ? "is-active" : ""}`}
        aria-pressed={value === "am"}
        onClick={() => onChange("am")}
      >
        <span className="preset-kicker">AM</span>
        Weekday 9:00
      </button>
      <button
        type="button"
        className={`preset ${value === "pm" ? "is-active" : ""}`}
        aria-pressed={value === "pm"}
        onClick={() => onChange("pm")}
      >
        <span className="preset-kicker">PM</span>
        Weekday 5:00
      </button>
    </div>
  );
}
