# Tile Calculator

A web app that calculates how many tiles and edge borders are needed to cover an **irregular**
area (decks, patios, floors, …), and shows an interactive top-down visual of the tile layout —
including which tiles must be cut, where borders and posts go, the slat/grain pattern, and
architectural dimensions on every side.

Generic by design (configurable tile size, border types, post types, and units). It starts from
a simple **8 × 8 ft square** (project **"Tile1"**); a NewTechWood UltraShield QuickDeck L-shaped
layout ships as a built-in sample (`sampleProject()`).

**Live demo:** https://pedrofuentes.github.io/TileCalculator/

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
- **Cut list**: grouped finished-piece sizes (W × H bounding box) and quantities. **L-cut**
  rows are full-extent tiles with a rectangular corner notch sawn out to wrap an inside corner;
  the notch size is shown (e.g. `12 × 12 in · cut notch 4 × 3 (L-cut)`).
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
- **Coverage** (`npm run test:coverage`) is measured on the pure pipeline only
  (`units`, `compute`, `geometry`, `calc`, `state`) — the React/SVG UI is excluded because
  it's covered by the e2e smoke. The suite currently sits at **~99% lines / 93% branches**
  and CI enforces thresholds (95% lines/statements/functions, 90% branches).
- **CI** (`.github/workflows/ci.yml`) runs lint → type-check → build → tests+coverage → e2e
  on every push and pull request.
- A **pre-commit hook** (husky + lint-staged) runs ESLint on staged files and the unit tests
  before each commit.

## Deployment (GitHub Pages)

The app is a static SPA deployed to **GitHub Pages** at
https://pedrofuentes.github.io/TileCalculator/.

- `.github/workflows/deploy.yml` builds on every push to `main` and publishes `dist/` via the
  official Pages actions (`configure-pages` → `upload-pages-artifact` → `deploy-pages`).
- `vite.config.ts` sets `base: '/TileCalculator/'` for production builds (and `/` for local
  dev), so asset URLs resolve under the project-pages subpath.
- To enable on a fork: in **Settings → Pages**, set **Source: GitHub Actions**, then push to
  `main`.

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
    defaults.ts       Tile1 square default + L-deck sampleProject + normalizeProject backfill
    storage.ts        localStorage + JSON import/export
  App.tsx             top-level state + layout
  main.tsx            React entry (wraps App in ErrorBoundary)
```

Changes are verified with `npm run lint`, `npx tsc --noEmit`, `npm run build`,
`npm run test`/`npm run test:coverage`, and `npm run test:e2e` — all gated in CI. See
[`AGENTS.md`](./AGENTS.md).

## License

Released under the [MIT License](./LICENSE) — © 2026 pedrofuentes. The license is also linked
from the app footer.
