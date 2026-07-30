export const BOSTON_CENTER: [number, number] = [-71.0589, 42.3601];

export const DURATIONS = [15, 30, 60] as const;
export type DurationMinutes = (typeof DURATIONS)[number];

/** ISO weekday: Mon=1 … Sun=7 */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** How multi-day isochrones are combined. */
export type ReachMode = "worst" | "typical" | "best";

export const REACH_MODES = ["worst", "typical", "best"] as const;

export type DepartWhen = {
  /** Sorted unique weekdays; length >= 1 */
  weekdays: Weekday[];
  hour: number;
  minute: number;
};

export type LngLat = {
  lng: number;
  lat: number;
};

export type RootLocation = {
  lng: number;
  lat: number;
  label: string;
};

export type GeocodeSuggestion = {
  id: string;
  label: string;
  placeName: string;
  lng: number;
  lat: number;
};

export type Commitment = {
  id: string;
  label: string;
  placeName: string;
  lng: number;
  lat: number;
  /** Minutes from Matrix, if available */
  etaMinutes?: number | null;
  /** Relative to the largest selected contour that contains the point */
  inside?: boolean | null;
};

export type SessionState = {
  root: RootLocation | null;
  durations: DurationMinutes[];
  traffic: DepartWhen;
  reachMode: ReachMode;
  commitments: Commitment[];
  commitmentsOpen: boolean;
};

export type FetchStatus = "idle" | "loading" | "error";
