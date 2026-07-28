import { useRef } from "react";
import { coordKey, sameLocation } from "../lib/isochroneCache";
import type { RootLocation } from "../lib/types";

type Props = {
  items: RootLocation[];
  active: RootLocation | null;
  onSelect: (root: RootLocation) => void;
  onRemove: (root: RootLocation) => void;
};

export function RecentSearches({ items, active, onSelect, onRemove }: Props) {
  const listRef = useRef<HTMLUListElement>(null);

  if (items.length === 0) return null;

  function focusAfterRemove(removed: RootLocation) {
    const idx = items.findIndex((i) => sameLocation(i, removed));
    const next = items[idx + 1] ?? items[idx - 1];
    queueMicrotask(() => {
      if (next) {
        const el = listRef.current?.querySelector<HTMLButtonElement>(
          `[data-coord="${coordKey(next.lng, next.lat)}"] .recent-chip-select`,
        );
        el?.focus();
        return;
      }
      document
        .querySelector<HTMLInputElement>(".dock .address-search input")
        ?.focus();
    });
  }

  return (
    <div className="recent-searches">
      <span className="recent-label">Recent</span>
      <ul className="recent-list" ref={listRef}>
        {items.map((item) => {
          const isActive = active != null && sameLocation(active, item);
          return (
            <li
              key={coordKey(item.lng, item.lat)}
              data-coord={coordKey(item.lng, item.lat)}
              className={`recent-chip ${isActive ? "is-active" : ""}`}
            >
              <button
                type="button"
                className="recent-chip-select"
                title={item.label}
                onClick={() => onSelect(item)}
              >
                {shortLabel(item.label)}
              </button>
              <button
                type="button"
                className="recent-chip-remove"
                aria-label={`Remove ${item.label}`}
                onClick={() => {
                  focusAfterRemove(item);
                  onRemove(item);
                }}
              >
                ×
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
