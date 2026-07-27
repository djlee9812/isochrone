import { useEffect, useId, useRef, useState } from "react";
import { geocodeSuggest } from "../api/mapbox";
import type { GeocodeSuggestion } from "../lib/types";

type Props = {
  placeholder?: string;
  onSelect: (suggestion: GeocodeSuggestion) => void;
  disabled?: boolean;
};

export function AddressSearch({
  placeholder = "Search an address…",
  onSelect,
  disabled,
}: Props) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const skipSuggestRef = useRef(false);

  useEffect(() => {
    if (skipSuggestRef.current) {
      skipSuggestRef.current = false;
      return;
    }

    if (query.trim().length < 2) {
      abortRef.current?.abort();
      setResults([]);
      return;
    }

    const handle = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const suggestions = await geocodeSuggest(query, ac.signal);
        if (ac.signal.aborted) return;
        setResults(suggestions);
        setOpen(true);
        setError(null);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError("Search failed");
        setResults([]);
      }
    }, 280);

    return () => {
      window.clearTimeout(handle);
      abortRef.current?.abort();
    };
  }, [query]);

  return (
    <div className="address-search">
      <input
        type="search"
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open && results.length > 0}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150);
        }}
      />
      {error && <p className="field-error">{error}</p>}
      {open && results.length > 0 && (
        <ul id={listId} className="suggest-list" role="listbox">
          {results.map((r) => (
            <li key={r.id} role="option">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(r);
                  skipSuggestRef.current = true;
                  setQuery(r.placeName);
                  setOpen(false);
                  setResults([]);
                }}
              >
                <span className="suggest-label">{r.label}</span>
                <span className="suggest-meta">{r.placeName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
