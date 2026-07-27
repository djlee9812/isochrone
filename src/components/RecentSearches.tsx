import { coordKey, sameLocation } from "../lib/isochroneCache";
import type { RootLocation } from "../lib/types";

type Props = {
  items: RootLocation[];
  active: RootLocation | null;
  onSelect: (root: RootLocation) => void;
};

export function RecentSearches({ items, active, onSelect }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="recent-searches">
      <span className="recent-label">Recent</span>
      <ul className="recent-list">
        {items.map((item) => {
          const isActive = active != null && sameLocation(active, item);
          return (
            <li key={coordKey(item.lng, item.lat)}>
              <button
                type="button"
                className={`recent-chip ${isActive ? "is-active" : ""}`}
                title={item.label}
                onClick={() => onSelect(item)}
              >
                {shortLabel(item.label)}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function shortLabel(label: string): string {
  const first = label.split(",")[0]?.trim() ?? label;
  return first.length > 28 ? `${first.slice(0, 27)}…` : first;
}
