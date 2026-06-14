# Deck Tile Calculator & Visualizer

A web app that calculates how many deck tiles and edge borders are needed to cover an
**irregular** deck, and shows an interactive top-down visual of the tile layout — including
which tiles must be cut, where borders and posts go, the slat/grain pattern, and architectural
dimensions on every side.

Generic by design (configurable tile size, border types, post types, and units) and
preconfigured for a NewTechWood UltraShield QuickDeck L-shaped deck.

> **Docs:** this README is the user-facing overview. See [`AGENTS.md`](./AGENTS.md) for
> contributor/AI-agent guidance and [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the
> technical deep dive.

## Features

- **Irregular shapes** built from rectangles (add/subtract → L, T, U, …), edited two ways:
  - an **interactive canvas editor** — select, drag, and resize rectangles with handles and
    snap-to-grid (hold **Alt** to bypass snapping), with live dimensions; and
  - numeric inputs in the sidebar, kept in sync with the canvas.
- **Units**: global `in / ft / cm / mm / m` selector; all values convert live (decimals
  supported). Everything is stored internally in inches.
- **Tile grid**: auto-optimized offset to minimize cut tiles, or a manual offset. Mark
  specific sides as **cut sides** to push partial tiles to chosen edges and keep full tiles
  flush elsewhere.
- **Tile counts**: full vs cut tiles, plus two purchase numbers — *Safe* (one tile per cut)
  and *With reuse* (offcut reuse, optionally edge-/grain-aware **interlock** modeling) — and
  waste.
- **Borders per side**: assign None / Trim / Fascia (or custom types) to each straight side.
  Results show linear length, piece count, and outside/inside corner counts.
- **Posts**: define post types (footprint width × depth, colour, default inward **setback**)
  and place them along any side. Setback is configurable **per post type** with an optional
  **per-post override**.
- **Slat / grain pattern**: draw the tile’s wood slats with a layout of `none`, `uniform`
  (all tiles same direction), or `checkerboard` (grain rotates 90° per tile). Grain direction
  of the origin tile is selectable.
- **Architectural dimensions**: per-edge, overall, and per-post dimension annotations rendered
  in an engineering style, with show/hide toggles **per category** (Edges / Overall / Posts).
- **Visualization** (SVG): deck outline, full tiles (green) vs cut tiles (orange) with the
  offcut footprint, border strips, corner markers, post footprints, and dimension labels.
  Supports **zoom / pan** (drag to pan, Ctrl/Cmd + wheel to zoom) and a **Fit** button; the
  view auto-fits the drawing to the canvas.
- **Cut list**: grouped piece sizes (with an L-cut flag) and quantities.
- **Dimension basis**: choose whether the deck dimensions represent the *tile field* (trim
  extends outward) or the *total footprint* (trim insets the tile field).
- **Save / Load** projects in the browser (localStorage) and **Import / Export** a deck as a
  portable JSON file.

## Run

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # type-check (tsc -b) + production build to dist/
npm run lint      # eslint
npm run test      # vitest unit/integration tests
npm run test:e2e  # playwright smoke tests (installs chromium on first run)
npm run preview   # serve the production build
```

Requirements: Node.js (ESM). Stack: **React 19 + TypeScript + Vite + Tailwind CSS**, with
SVG for rendering and [`polygon-clipping`](https://github.com/mfogel/polygon-clipping) for
boolean geometry.

## Testing & CI

- **Unit/integration tests** (Vitest, `src/**/*.test.ts`) cover the pure pipeline — unit
  conversions, polygon geometry, shape building, grid classification, tile/cut-list and
  border calculation, project normalization, JSON round-trips, and the full
  `computeProject` integration. Run with `npm run test`.
- **E2E smoke tests** (Playwright, `e2e/`) load the app and assert it mounts without hitting
  the error boundary and that unit-switch / add-rectangle don't crash. Run `npm run test:e2e`.
- **CI** (`.github/workflows/ci.yml`) runs lint → type-check → build → unit tests → e2e on
  every push and pull request.
- A **pre-commit hook** (husky + lint-staged) runs ESLint on staged files and the unit tests
  before each commit.

## How the math works

- **Deck shape** = boolean union/difference of rectangles (`polygon-clipping`), producing a
  `MultiPoly` (an L-deck, a deck with a notch, or several disconnected pieces).
- Each **tile cell** is intersected with the deck polygon → classified full / cut / none. Cut
  cells carry their clipped footprint so the diagram and cut list are exact.
- The **optimal grid offset** is searched only at offsets where grid lines align to deck edges
  (the offsets that can change the cut-tile count), keeping it exact and fast.
- **Border pieces** per side = `ceil(sideLength / pieceLength)`; a corner piece is counted
  where two bordered sides meet (outside = convex corner, inside = reflex corner).
- **Tile purchase**: *Safe* = full tiles + number of cut locations; *With reuse* = full tiles
  + `ceil(totalCutArea / tileArea)` (optimistic), refined by interlock pairing when enabled.
- **Posts** notch the tiles they overlap (their footprint is subtracted from the tile field),
  positioned along a side with an inward setback.

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full pipeline.

## Project structure

```
src/
  types.ts            domain types (all spatial values stored in INCHES)
  units.ts            unit conversions + formatting
  compute.ts          orchestrates a Project -> Computed model
  geometry/
    polygon.ts        polygon helpers (area, bbox, point-in-poly, rectRing)
    shape.ts          build the deck MultiPoly from add/subtract rects; clip a cell
    sides.ts          derive straight sides + corners from the polygon
    grid.ts           tile grid generation + cell classification
    optimize.ts       edge-aligned offset search (minimize cuts)
    posts.ts          post footprint geometry + setback
    inset.ts          inset the tile field for the totalFootprint basis
    pattern.ts        slat/grain pattern helpers
  calc/
    tiles.ts          tile counts, cut pieces, purchase + reuse
    borders.ts        border lengths, piece counts, corners
  render/
    DeckCanvas.tsx    interactive SVG canvas (shape editor, zoom/pan, all layers)
    ResultsPanel.tsx  counts + cut list
  components/
    ShapeBuilder.tsx  rectangle list (sidebar) <-> canvas selection
    ConfigPanels.tsx  tile / border / post / grid / pattern / dimension config
    ProjectBar.tsx    save / load / reset + import / export
    ErrorBoundary.tsx top-level error fallback
    ui.tsx            shared inputs (commit-on-blur numeric fields, toggles)
  state/
    defaults.ts       default NewTechWood preset + normalizeProject backfill
    storage.ts        localStorage + JSON import/export
  App.tsx             top-level state + layout
  main.tsx            React entry (wraps App in ErrorBoundary)
```

There is no automated test suite or CI in this repo. Changes are verified with
`npx tsc --noEmit`, `npm run build`, and manual Playwright checks — see
[`AGENTS.md`](./AGENTS.md).
