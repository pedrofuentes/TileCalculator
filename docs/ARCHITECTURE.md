# Architecture

Technical reference for the Deck Tile Calculator & Visualizer. For the feature overview see
[`../README.md`](../README.md); for contributor conventions and gotchas see
[`../AGENTS.md`](../AGENTS.md).

## Overview

A purely client-side single-page app. There is one unidirectional data flow:

```
Project (plain data)  ──►  computeProject()  ──►  Computed (derived geometry + counts)
        ▲                                                   │
        │ user edits (App state)                            ▼
   ConfigPanels / ShapeBuilder / DeckCanvas   ◄──   DeckCanvas + ResultsPanel (render)
```

- **`Project`** ([`src/types.ts`](../src/types.ts)) is the entire serializable state. All
  spatial values are stored in **inches**.
- **`computeProject(project)`** ([`src/compute.ts`](../src/compute.ts)) is the single pure
  orchestrator that turns a `Project` into a `Computed` model. It is memoized once at the App
  level: `const computed = useMemo(() => computeProject(project), [project])`.
- **`Computed`** is consumed by the renderers. Nothing downstream mutates it.

Because the whole derived model hangs off `computeProject`, **anything that calls `setProject`
re-runs the full pipeline**. Keep high-frequency interactions (drag, pan, zoom) off
`setProject` until they commit (see "Interaction" below).

## Data model (`types.ts`)

| Type | Purpose |
| --- | --- |
| `RectOp` | A rectangle with `op: 'add' \| 'subtract'`. Ordered list builds the shape. |
| `TileConfig` | Tile `width`/`height`/`gap`, slat count, and whether it's `directional`. |
| `BorderType` | Trim/Fascia/custom: face width, piece length, corner pieces, colour. |
| `SideAssignment` | Maps a derived `sideId` → a `borderTypeId` (or `null`). |
| `PostType` / `Post` | Post footprint (`width`×`depth`), colour, and inward `margin` (setback). A `Post` may override its type's `margin`. |
| `GridConfig` | `mode: 'auto' \| 'manual'`, manual `offsetX/Y`, and `cutSides` (side IDs that absorb partial tiles). |
| `Project` | Everything above + `unit`, `layoutPattern`, `grainDirection`, `interlockReuse`, `dimensionBasis`. |

Two model-wide switches change interpretation:
- **`dimensionBasis`** — `'tileField'` (dimensions = tile area; trim extends outward) vs
  `'totalFootprint'` (dimensions = bounded space; trim insets the tile field).
- **`layoutPattern`** — `'none' | 'uniform' | 'checkerboard'`; with `grainDirection` for the
  origin tile.

## The compute pipeline (`compute.ts`)

`computeProject` runs these steps in order and returns the `Computed` object:

1. **Build the shape.** `buildShape(project.rects)` folds the add/subtract rectangles into a
   `MultiPoly` via `polygon-clipping` union/difference. `footprintArea` and `bbox` come from
   `multiPolyArea` / `multiPolyBBox`.
2. **Derive sides.** `deriveSides(deck)` produces the straight `sides` and `corners` used for
   borders, posts, and dimensions.
3. **Inset for basis.** If `dimensionBasis === 'totalFootprint'`, `insetTileField` shrinks the
   tile region by the assigned border depths; otherwise the tile region equals the deck.
4. **Subtract posts.** `buildPostShapes` computes each post's footprint (placed along a side at
   `pos`, set back inward by `post.margin ?? type.margin ?? 0`). Their union is subtracted from
   the inset deck to get **`tileDeck`** (the region actually tiled). `tiledArea = area(tileDeck)`.
5. **Lay out the grid.**
   - In **`auto`** mode, `optimizeOffset(insetDeck, tile, flushTargets)` searches grid offsets
     **only at offsets where grid lines align to deck edges** (the only offsets that can change
     the cut count), against the *post-free* polygon for speed. The chosen offset then feeds a
     single `classifyGrid(tileDeck, …)`.
   - In **`manual`** mode, `classifyGrid` runs directly with the user's offsets.
   - `classifyGrid` walks the grid, intersecting each boundary cell with the polygon
     (`clipCell` → `polygon-clipping.intersection`) and classifying it **full / cut / none**;
     interior full tiles take an analytic fast path.
6. **Counts.** `computeTiles` derives full/cut counts, the cut list, and the *Safe* vs *With
   reuse* purchase numbers (interlock pairing when `interlockReuse`). `computeBorders` derives
   per-side lengths, piece counts, and outside/inside corners.

`Computed` exposes: `deck`, `tileDeck`, `bbox`, `footprintArea`, `tiledArea`, `inset`,
`shape`, `grid`, `offsetX/Y`, `tiles`, `borders`, `posts`.

## Geometry layer (`src/geometry/`, pure / no React)

| File | Responsibility |
| --- | --- |
| `polygon.ts` | `Pt`/`Ring`/`Poly`/`MultiPoly` types; `ringSignedArea`, `polyArea`, `multiPolyArea`, `multiPolyBBox`, point-in-polygon, `rectRing`. |
| `shape.ts` | `buildShape` (rects → `MultiPoly`) and `clipCell` (cell ∩ deck). |
| `sides.ts` | `deriveSides` → straight sides + corner classification (convex/reflex). |
| `grid.ts` | Grid generation + `classifyGrid` cell classification. |
| `optimize.ts` | `optimizeOffset` edge-aligned offset search + `FlushTarget`s. |
| `posts.ts` | `buildPostShapes` footprints + setback geometry. |
| `inset.ts` | `insetTileField` for the `totalFootprint` basis. |
| `pattern.ts` | Slat/grain pattern helpers. |

> **Invariant:** `buildShape` returns a **`MultiPoly`** (`Poly[]`). A lone `add` rectangle is
> wrapped as `[rectPoly]`; returning a bare `Poly` will crash area/bbox helpers for a
> single-rectangle deck. See AGENTS.md → Gotchas.

## Rendering & coordinate systems (`render/DeckCanvas.tsx`)

`DeckCanvas` draws everything as SVG and owns all canvas interaction. It is large (~1.7k lines)
and split into memoized layer components (tiles, pattern, borders, corners, dimensions, posts,
post-dimensions, and the shape-edit overlay), each `React.memo`'d so pan/zoom/hover don't
re-render them.

**Three coordinate spaces:**
1. **World** — inches, the model's native space.
2. **SVG user units** — `toScreen(worldPt)` maps world → SVG units using the `layout` memo's
   `scale` + clip-safe `margin` (derived from `bbox`). The `<svg>` has a fixed target width.
3. **Screen pixels** — the `<svg>` sits inside a CSS-transformed wrapper
   (`translate(pan) scale(zoom)`). `fitView` scales the fixed-width SVG to fit its container.

**Pointer → world** uses `getScreenCTM()`: `clientToWorld(clientX, clientY)` inverts the live
CTM (so it stays correct under any zoom/pan) and then undoes `scale`/`margin`/`bbox` offset.
This is read from refs so window-level drag handlers always see fresh transform values.

### Interaction

- **Pan**: drag the viewport (updates CSS `pan`). **Zoom**: Ctrl/Cmd + wheel about the cursor,
  plus a **Fit** button. These are cheap — they only change the CSS transform, never the model.
- **Shape edit**: select/drag/resize `RectOp`s with 8 handles and snap-to-grid (Alt bypasses).
  During a drag the moving rectangle is rendered from local **`draftRect`** state for instant
  feedback; the global `project` is updated (re-running `computeProject`) **once on
  pointer-up**. Never commit per frame.

## State & persistence (`src/state/`)

- `defaults.ts` — `makeDefaultProject()` (the NewTechWood L-deck preset) and
  **`normalizeProject(p)`**, which backfills every field with sane defaults so older/partial
  projects load cleanly. This is the single chokepoint for forward-compatibility; it runs on
  every localStorage load and every JSON import.
- `storage.ts` — localStorage save/load/delete (`deck-tile-calc:projects`) and
  `exportProjectJSON` / `parseProjectJSON`. Export wraps the project as
  `{ schemaVersion, project }`; import accepts that envelope or a bare project, validates that
  `rects` is an array, then runs `normalizeProject`.
- `main.tsx` wraps `<App/>` in an **`ErrorBoundary`** so a bad import (or any render-time
  throw) degrades to a recoverable message instead of a blank screen.

## Tech stack

- **React 19** + **TypeScript** + **Vite 8** + **Tailwind CSS 3**.
- **`polygon-clipping`** for boolean polygon ops.
- No backend, no database, no test runner, no CI. Build/type-check are the green gates;
  behaviour is verified with manual Playwright scripts (see AGENTS.md).
