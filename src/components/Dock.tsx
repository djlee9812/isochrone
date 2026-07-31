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
  ReachMode,
  RootLocation,
} from "../lib/types";

type Props = {
  root: RootLocation | null;
  durations: DurationMinutes[];
  traffic: DepartWhen;
  reachMode: ReachMode;
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
  onReachModeChange: (mode: ReachMode) => void;
  onToggleCommitments: () => void;
  onAddCommitment: (s: GeocodeSuggestion) => void;
  onRemoveCommitment: (id: string) => void;
};

export function Dock({
  root,
  durations,
  traffic,
  reachMode,
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
  onReachModeChange,
  onToggleCommitments,
  onAddCommitment,
  onRemoveCommitment,
}: Props) {
  const statusText =
    status === "loading"
      ? "Updating…"
      : status === "error"
        ? (statusMessage ?? "Something went wrong. Try again.")
        : status === "idle" && root && statusMessage
          ? statusMessage
          : "";
  const statusVisible =
    status === "error" || (status === "idle" && !!root && !!statusMessage);

  return (
    <aside className="dock" aria-label="Map controls">
      <header className="dock-header">
        <h1 className="wordmark">
          From Here
          {status === "loading" && (
            <span className="dock-spinner" aria-hidden="true" />
          )}
        </h1>
      </header>

      <section className="dock-section">
        <AddressSearch
          placeholder="Search an address…"
          proximity={searchProximity}
          onSelect={onSelectRoot}
        />
        {root && (
          <p className="root-current" title={root.label}>
            {root.label}
          </p>
        )}
        <RecentSearches
          items={recents}
          active={root}
          onSelect={onSelectRecent}
          onRemove={onRemoveRecent}
        />
      </section>

      <section className="dock-section">
        <span className="section-label">Drive time</span>
        <DurationChips value={durations} onChange={onDurationsChange} />
      </section>

      <section className="dock-section">
        <span className="section-label">When</span>
        <WhenControls
          value={traffic}
          reachMode={reachMode}
          onChange={onTrafficChange}
          onReachModeChange={onReachModeChange}
        />
      </section>

      <div
        className={
          statusVisible
            ? `dock-status${status === "error" ? " is-error" : ""}`
            : "visually-hidden"
        }
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {statusText}
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
