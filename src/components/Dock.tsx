import { AddressSearch } from "./AddressSearch";
import { DurationChips } from "./DurationChips";
import { WhenControls } from "./WhenControls";
import { Commitments } from "./Commitments";
import { RecentSearches } from "./RecentSearches";
import type {
  Commitment,
  DepartWhen,
  DurationMinutes,
  FetchStatus,
  GeocodeSuggestion,
  RootLocation,
} from "../lib/types";

type Props = {
  root: RootLocation | null;
  durations: DurationMinutes[];
  traffic: DepartWhen;
  status: FetchStatus;
  statusMessage: string | null;
  commitments: Commitment[];
  commitmentsOpen: boolean;
  recents: RootLocation[];
  /** Map-center bias for address autocomplete. */
  searchProximity: [number, number];
  onSelectRoot: (s: GeocodeSuggestion) => void;
  onSelectRecent: (root: RootLocation) => void;
  onRemoveRecent: (root: RootLocation) => void;
  onDurationsChange: (d: DurationMinutes[]) => void;
  onTrafficChange: (t: DepartWhen) => void;
  onToggleCommitments: () => void;
  onAddCommitment: (s: GeocodeSuggestion) => void;
  onRemoveCommitment: (id: string) => void;
};

export function Dock({
  root,
  durations,
  traffic,
  status,
  statusMessage,
  commitments,
  commitmentsOpen,
  recents,
  searchProximity,
  onSelectRoot,
  onSelectRecent,
  onRemoveRecent,
  onDurationsChange,
  onTrafficChange,
  onToggleCommitments,
  onAddCommitment,
  onRemoveCommitment,
}: Props) {
  return (
    <aside className="dock" aria-label="Map controls">
      <header className="dock-header">
        <h1 className="wordmark">From Here</h1>
        <p className="mode-label">Driving</p>
      </header>

      <section className="dock-section">
        <label className="section-label" htmlFor="root-search">
          Start
        </label>
        <AddressSearch
          placeholder="Search an address…"
          proximity={searchProximity}
          onSelect={onSelectRoot}
        />
        <RecentSearches
          items={recents}
          active={root}
          onSelect={onSelectRecent}
          onRemove={onRemoveRecent}
        />
        {root && (
          <p className="root-current" title={root.label}>
            {root.label}
          </p>
        )}
      </section>

      <section className="dock-section">
        <span className="section-label">Drive time</span>
        <DurationChips value={durations} onChange={onDurationsChange} />
      </section>

      <section className="dock-section">
        <span className="section-label">When</span>
        <WhenControls value={traffic} onChange={onTrafficChange} />
      </section>

      <div
        className={`dock-status ${status === "loading" ? "is-loading" : ""} ${status === "error" ? "is-error" : ""}`}
        role="status"
        aria-live="polite"
      >
        {status === "loading" && (
          <>
            <span className="dock-spinner" aria-hidden="true" />
            <span>Updating…</span>
          </>
        )}
        {status === "error" && (
          <span>{statusMessage ?? "Something went wrong. Try again."}</span>
        )}
        {status === "idle" && !root && (
          <span>Search an address or click the map to begin.</span>
        )}
      </div>

      <Commitments
        open={commitmentsOpen}
        onToggle={onToggleCommitments}
        commitments={commitments}
        proximity={searchProximity}
        onAdd={onAddCommitment}
        onRemove={onRemoveCommitment}
      />
    </aside>
  );
}
