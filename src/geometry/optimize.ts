import type { TileConfig } from '../types';
import type { MultiPoly } from './polygon';
import { multiPolyBBox } from './polygon';
import { classifyGrid, type GridResult } from './grid';

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

const FLUSH_TOL = 1e-3;

/**
 * A "keep-full" edge the layout should try to leave flush against full tiles.
 * `L` is the tile-left coordinate (along `axis`) a grid line must land on for a
 * full tile to sit flush against this edge. `length` weights its importance.
 */
export interface FlushTarget {
  axis: 'x' | 'y';
  L: number;
  length: number;
}

function uniqueOffsets(values: number[], moduleSize: number): number[] {
  const set = new Set<number>();
  set.add(0);
  for (const v of values) {
    set.add(Math.round(mod(v, moduleSize) * 1000) / 1000);
  }
  return [...set];
}

export interface OptimizeResult {
  offsetX: number;
  offsetY: number;
  grid: GridResult;
}

// Lexicographic score: (flush penalty, cut count, cell count) — lower is better.
function score(
  ox: number,
  oy: number,
  grid: GridResult,
  targets: FlushTarget[],
  moduleW: number,
  moduleH: number,
): [number, number, number] {
  let penalty = 0;
  for (const t of targets) {
    const o = t.axis === 'x' ? ox : oy;
    const m = t.axis === 'x' ? moduleW : moduleH;
    const r = mod(t.L - o, m);
    const aligned = r < FLUSH_TOL || r > m - FLUSH_TOL;
    if (!aligned) penalty += t.length;
  }
  return [penalty, grid.cutCount, grid.cells.length];
}

function less(a: [number, number, number], b: [number, number, number]): boolean {
  for (let i = 0; i < 3; i++) {
    if (a[i] < b[i] - 1e-9) return true;
    if (a[i] > b[i] + 1e-9) return false;
  }
  return false;
}

// The optimal grid offset occurs where grid lines align to deck edges (and, when
// cut-side preferences are given, to the flush targets), so we only evaluate
// offsets derived from the shape's vertices plus the flush targets.
export function optimizeOffset(
  deck: MultiPoly,
  tile: TileConfig,
  targets: FlushTarget[] = [],
): OptimizeResult {
  const moduleW = tile.width + tile.gap;
  const moduleH = tile.height + tile.gap;

  const xs: number[] = [];
  const ys: number[] = [];
  for (const poly of deck) {
    for (const ring of poly) {
      for (const [x, y] of ring) {
        xs.push(x);
        ys.push(y);
      }
    }
  }
  // Seed candidate offsets with the flush targets so flush-aligned layouts are
  // always evaluated, even with a non-zero gap.
  for (const t of targets) {
    if (t.axis === 'x') xs.push(t.L);
    else ys.push(t.L);
  }

  const offX = uniqueOffsets(xs, moduleW);
  const offY = uniqueOffsets(ys, moduleH);

  // Hoist the deck bbox: it is offset-independent, so compute it once and reuse
  // it for every candidate classify instead of recomputing per offset.
  const bbox = deck.length > 0 ? multiPolyBBox(deck) : undefined;

  let best: OptimizeResult | null = null;
  let bestScore: [number, number, number] | null = null;
  for (const ox of offX) {
    for (const oy of offY) {
      const grid = classifyGrid(deck, tile, ox, oy, bbox);
      const s = score(ox, oy, grid, targets, moduleW, moduleH);
      if (best === null || bestScore === null || less(s, bestScore)) {
        best = { offsetX: ox, offsetY: oy, grid };
        bestScore = s;
      }
    }
  }

  if (best === null) {
    best = { offsetX: 0, offsetY: 0, grid: classifyGrid(deck, tile, 0, 0, bbox) };
  }
  return best;
}
