# Deck Tile Calculator & Visualizer

A web app that calculates how many deck tiles and edge borders are needed to cover an
**irregular** deck, and shows a top-down visual of the tile layout — including which tiles
must be cut, where borders go, and every side dimension.

Generic by design (configurable tile size, border types, and units) and preconfigured for
a NewTechWood UltraShield QuickDeck L-shaped deck.

## Features

- **Irregular shapes** via rectangle composition (add/subtract rectangles -> L, T, U, ...).
  The geometry layer (boolean ops + polygon clipping) is ready for a free-polygon editor later.
- **Units**: global `in / ft / cm / mm` selector; all values convert live (decimals supported).
- **Tile grid**: auto-optimized offset to minimize cut tiles (or manual offset).
- **Tile counts**: full vs cut tiles, plus two purchase numbers --
  *Safe* (one tile per cut) and *With reuse* (optimistic, area-based offcut reuse) -- and waste.
- **Borders per side**: assign None / Trim / Fascia (or custom types) to each straight side.
  Results show linear length, 12" piece count, and outside/inside corner counts.
- **Visualization** (SVG): deck outline, full tiles (green) vs cut tiles (orange) with the
  offcut footprint, border strips, corner markers, and dimension labels on every side.
- **Cut list**: grouped piece sizes (with L-cut flag) and quantities.
- **Save/Load** projects in the browser (localStorage).

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
```

## How the math works

- Deck shape = boolean union/difference of rectangles (`polygon-clipping`).
- Each tile cell is intersected with the deck polygon -> classified full / cut / none.
- The optimal grid offset is searched only at offsets where grid lines align to deck edges
  (the offsets that can change the cut-tile count), keeping it exact and fast.
- Border pieces per side = ceil(sideLength / pieceLength); a corner piece is counted where
  two bordered sides meet (outside = convex corner, inside = reflex corner).
- *With reuse* tile count = full tiles + ceil(totalCutArea / tileArea) (optimistic);
  *Safe* = full tiles + number of cut locations.

## Project structure

```
src/
  types.ts            domain types (all spatial values stored in inches)
  units.ts            unit conversions + formatting
  geometry/           polygon helpers, shape build, side/corner derivation, grid + offset optimizer
  calc/               tile and border calculations
  compute.ts          orchestrates a Project -> Computed model
  render/             DeckCanvas (SVG) + ResultsPanel
  components/         shape builder, config panels, project save/load, shared UI
  state/              default preset + localStorage
```
