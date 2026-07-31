import type { Commitment } from "../lib/types";
import { AddressSearch } from "./AddressSearch";
import type { GeocodeSuggestion } from "../lib/types";

type Props = {
  open: boolean;
  onToggle: () => void;
  commitments: Commitment[];
  proximity?: [number, number];
  onAdd: (suggestion: GeocodeSuggestion) => void;
  onRemove: (id: string) => void;
};

export function Commitments({
  open,
  onToggle,
  commitments,
  proximity,
  onAdd,
  onRemove,
}: Props) {
  return (
    <div className={`commitments ${open ? "is-open" : ""}`}>
      <button type="button" className="commitments-toggle" onClick={onToggle}>
        <span>Places</span>
        <span className="commitments-count">
          {commitments.length > 0 ? commitments.length : "+"}
        </span>
      </button>

      <div className="commitments-body" hidden={!open}>
        <p className="commitments-hint">Gym, office, friends</p>
        <AddressSearch
          placeholder="Add a place…"
          proximity={proximity}
          onSelect={onAdd}
        />
        {commitments.length === 0 ? (
          <p className="commitments-empty">None yet</p>
        ) : (
          <ul className="commitment-list">
            {commitments.map((c) => (
              <li key={c.id} className="commitment-card">
                <div className="commitment-main">
                  <strong>{c.label}</strong>
                  <span className="commitment-place">{c.placeName}</span>
                  <div className="commitment-badges">
                    {c.inside === true && (
                      <span className="badge badge-inside">Inside</span>
                    )}
                    {c.inside === false && (
                      <span className="badge badge-outside">Outside</span>
                    )}
                    {typeof c.etaMinutes === "number" && (
                      <span className="badge badge-eta">~{c.etaMinutes} min</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="commitment-remove"
                  aria-label={`Remove ${c.label}`}
                  onClick={() => onRemove(c.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
