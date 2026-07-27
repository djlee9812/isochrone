# From Here

Map-first reachability explorer for **Boston**. Pick a starting point and see where you can drive in 15, 30, or 60 minutes under typical weekday morning or evening traffic.

Built as a session-only demo on Mapbox (Isochrone + Geocoding + Matrix). No accounts, no backend.

## Features

- Full-bleed map with a floating control dock
- Outbound **driving** isochrones (`mapbox/driving-traffic`)
- Multi-select contours: **15 / 30 / 60** minutes
- Traffic presets: weekday **9:00 AM** and **5:00 PM** (`depart_at`)
- Optional commitments (known addresses) with Inside/Outside badges and ETA
- Session-only state via `sessionStorage`

## Stack

- Vite, React, TypeScript
- Mapbox GL JS, Geocoding, Isochrone, Matrix
- [Fontsource](https://fontsource.org/) — Bricolage Grotesque + Figtree

## Getting started

### Prerequisites

- Node.js 20+
- A [Mapbox](https://account.mapbox.com/) account and **public** access token (`pk…`)

Create a public token in the [Mapbox account dashboard](https://account.mapbox.com/access-tokens/). Restrict it to your origins (e.g. `http://localhost:5173/*`). Do not use a secret (`sk…`) token in the browser.

### Setup

```bash
git clone https://github.com/<you>/isochrone.git
cd isochrone
```

Create a `.env` file in the project root with your Mapbox public token:

```
VITE_MAPBOX_TOKEN=pk.your_token_here
```

```bash
npm install
npm run dev
```

Open the local URL Vite prints (default `http://localhost:5173`).

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |

## Usage

1. Search an address or click the map to set the root
2. Toggle duration rings and AM/PM traffic
3. Optionally add commitment places to see whether they fall inside the rings

Typical traffic · outbound only · planning aid, not door-to-door ETAs.

## Scope (v1)

**In:** driving, departure/outbound, Boston-focused geocoding bias, session demo.

**Not in:** walk / bike / transit, return-trip or arrive-by isochrones, multi-home compare, auth, or server-side caching.

## License

MIT
