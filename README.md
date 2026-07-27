# From Here

A small Boston map tool: pick a starting point and see how far you can **drive** in 15, 30, or 60 minutes under typical traffic for a chosen day and time.

Session-only demo on Mapbox (GL JS, Geocoding, Isochrone, Matrix). No accounts or backend.

## Features

- Full-bleed map with a floating control dock
- Driving isochrones (`mapbox/driving-traffic`) with 15 / 30 / 60 min rings
- Day-of-week + time controls, with **9AM** / **5PM** shortcuts
- Recent starts (session) with cached rings for fast toggles
- Optional places with Inside/Outside badges and drive-time ETAs

## Setup

1. Clone and install:

```bash
git clone https://github.com/djlee9812/isochrone.git
cd isochrone
npm install
```

2. Create a `.env` in the project root with a **public** Mapbox token (`pk…`) from [account.mapbox.com](https://account.mapbox.com/access-tokens/). Restrict the token to `http://localhost:5173/*` (and your deploy origin). Do not use a secret (`sk…`) token.

```
VITE_MAPBOX_TOKEN=pk.your_token_here
```

3. Run:

```bash
npm run develop
```

Open the URL Vite prints (default `http://localhost:5173`).

| Script | Description |
| --- | --- |
| `npm run develop` | Dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |

## Stack

Vite, React, TypeScript, Mapbox GL JS, Fontsource (Bricolage Grotesque + Figtree).

## License

MIT
