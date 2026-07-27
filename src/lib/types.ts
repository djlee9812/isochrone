export const BOSTON_CENTER: [number, number] = [-71.0589, 42.3601];

export const DURATIONS = [15, 30, 60] as const;
export type DurationMinutes = (typeof DURATIONS)[number];

export type TrafficPreset = "am" | "pm";

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
  traffic: TrafficPreset;
  commitments: Commitment[];
  commitmentsOpen: boolean;
};

export type FetchStatus = "idle" | "loading" | "error";
