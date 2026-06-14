# AGENTS.md

Guidance for AI agents and human contributors working in this repository. Read this before
making changes. For the user-facing overview see [`README.md`](./README.md); for the technical
deep dive see [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## What this project is

A single-page **React 19 + TypeScript + Vite + Tailwind CSS** app that calculates and
visualizes deck-tile layouts for irregular decks. Rendering is hand-rolled **SVG**; boolean
geometry uses [`polygon-clipping`](https://github.com/mfogel/polygon-clipping). There is **no
backend** — all state lives in the browser (React state + localStorage), and decks can be
imported/exported as JSON.

## Setup & commands (verified)

```bash
npm install            # install dependencies
npm run dev            # Vite dev server on http://localhost:5173
npm run build          # tsc -b && vite build  -> dist/   (authoritative green gate)
npm run lint           # eslint
npm run test           # vitest unit/integration tests (green gate)
npm run test:e2e       # playwright e2e smoke tests
npm run preview        # serve the production build
npx tsc --noEmit       # fast type-check without emitting (authoritative green gate)
```

- **Green gates:** `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `npm run test`
  must all pass (lint currently reports **0 problems**). Treat these as the source of truth
  for "is it healthy". Don't introduce new lint errors or warnings.

## Verification convention

The fast feedback loop is the **Vitest** suite (`src/**/*.test.ts`, Node env, ~1s): pure
units/geometry/calc/normalize/storage plus a `computeProject` integration test. **Add or
update a test alongside any change to the geometry or calc pipeline** — the two worst bugs in
this repo's history (`buildShape` returning a bare `Poly`; `normalizeProject` not backfilling
partial imports) are now locked down by explicit regression tests, and new pipeline behaviour
should be too.

Browser-level behaviour is covered by **Playwright** (`e2e/smoke.spec.ts`, run via
`npm run test:e2e`), which guards the "white-screen / error-boundary" class of failures that
unit tests can't see. CI (`.github/workflows/ci.yml`) and a husky pre-commit hook enforce
these gates automatically.

For exploratory/manual UI checks, throwaway **Playwright** scripts via the bundled
`webapp-testing` helper are still fine (Windows / PowerShell):

```powershell
$env:PYTHONIOENCODING='utf-8'; $env:BROWSER='none'
$helper = "<...>/webapp-testing/scripts/with_server.py"
python $helper --server "npm run dev" --port 5173 --timeout 120 -- python tmp_verify.py
```

- The helper starts/stops the dev server itself; the Playwright script only contains browser
  logic (`sync_playwright`, headless chromium, `goto(..., wait_until="domcontentloaded")`
  then `wait_for_load_state("networkidle")`).
- Name throwaway scripts `tmp_*.py` and **delete them when done**. Don't commit them (the
  committed suite lives in `e2e/`).
- After verifying, stop any stray dev server still listening on `:5173`.

Selector notes that have bitten us before:
- "+ Add rectangle" appears twice (sidebar + canvas) → scope with
  `page.get_by_role("main")`.
- Selected shape-editor body rect = `rect[fill-opacity="0.1"][stroke="#f59e0b"]`; resize
  handles = `rect[fill="white"][stroke="#f59e0b"]` (8 of them).

## Code conventions

- **All spatial values are stored in INCHES** (see the header of `src/types.ts`). Convert to
  the user's unit **only at the UI edge** via `src/units.ts` (`toInches` / `fromInches` /
  `formatLength`). Never store display units in the model.
- **React function components + hooks** throughout; no class components except the one
  intentional `ErrorBoundary` (class is required for `componentDidCatch`).
- **Tailwind CSS** utility classes for styling; no CSS modules.
- Heavy SVG layer components are wrapped in **`React.memo`** with carefully chosen props so
  pan/zoom/hover don't re-render them. Keep memo-friendly props stable (don't pass new inline
  objects/arrays/functions into memoized layers).
- Numeric sidebar inputs **commit on blur/Enter**, not per keystroke (see `ui.tsx`), to avoid
  thrashing the compute pipeline. Preserve this when adding inputs.
- Comments explain *why*, not *what*. Match the existing concise style.
- Prefer small, surgical changes. Don't reformat or refactor unrelated code.

## Architecture map (where things live)

```
Project (types.ts)  --computeProject (compute.ts)-->  Computed
                                                          |
                                              DeckCanvas + ResultsPanel
```

- `compute.ts` is the single orchestrator: `Project -> Computed` (shape, sides, grid, tiles,
  borders, posts, bbox). It is memoized once at the App level
  (`computed = useMemo(() => computeProject(project), [project])`).
- `geometry/` is pure (no React): `shape.ts` builds the deck `MultiPoly`; `sides.ts` derives
  straight sides/corners; `grid.ts` + `optimize.ts` lay out and classify tiles; `posts.ts`,
  `inset.ts`, `pattern.ts` handle posts, footprint inset, and slat pattern.
- `calc/` turns geometry into counts (`tiles.ts`, `borders.ts`).
- `render/DeckCanvas.tsx` is the big one (~1.7k lines): the SVG canvas, the interactive shape
  editor, zoom/pan/fit, and every draw layer.
- `state/` holds the default preset, `normalizeProject` backfill, localStorage, and JSON
  import/export.

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full pipeline and coordinate
systems.

## Key gotchas (learned the hard way)

- **`buildShape` must return a `MultiPoly`, not a `Poly`.** A lone `add` rectangle must be
  wrapped as `[rectPoly]`; returning the bare `Poly` only "works" when a later union/difference
  normalizes it, and a single-rectangle deck will otherwise crash `multiPolyArea`.
- **`normalizeProject` must backfill *every* required field** (`name`, `unit`, `rects`,
  `tile.*`, `borderTypes`, `sideAssignments`, `grid.*`, `postTypes`, `posts`, pattern fields,
  `dimensionBasis`). Imported/legacy files only pass a `rects`-is-array gate; missing fields
  otherwise throw inside a render-time `useMemo`. The top-level `ErrorBoundary` is a safety
  net, not an excuse to skip backfilling.
- **Commit shape edits on pointer-up, not per frame.** During a rectangle drag, update the
  local `draftRect` for live feedback and call `onUpdateRect` (which mutates global `project`
  and re-runs `computeProject`) exactly **once** on release. Committing every animation frame
  re-runs the full geometry pipeline per frame and causes jank.
- **The DeckCanvas layout/clip math is sensitive.** The `layout` memo computes
  `scale`/`margin`/`toScreen` with clip-safe margins; `fitView` scales the fixed-width SVG into
  its container. Coordinate transforms (`clientToWorld` via `getScreenCTM()`) must stay correct
  under non-identity zoom/pan. Verify with Playwright after touching any of this.
- **Setback resolution order** is `post.margin ?? type.margin ?? 0` — keep this consistent
  across `geometry/posts.ts`, the config panel, and the dimension layer.

## Git / commits

- Make focused commits. Use a descriptive subject and body.
- Include this trailer on commits (unless the user says otherwise):

  ```
  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
  ```
