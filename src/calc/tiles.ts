import type { GridResult } from '../geometry/grid';
import type { Project } from '../types';
import { cellOrientation, type Orientation } from '../geometry/pattern';

export interface TileResult {
  fullCount: number;
  cutCount: number;
  totalCells: number;
  tileArea: number;
  deckArea: number;
  cutCoveredArea: number;
  safePurchase: number;
  reusePurchase: number;
  wasteSafe: number;
  wasteReuse: number;
  /** Cut pieces that shared a tile with a complementary offcut (reused). */
  pairedOffcuts: number;
  /** Cut pieces that each required their own tile (L-cuts / double-reduced corners). */
  ownTilePieces: number;
  /** Per-grain-orientation tally of all cut pieces. */
  orientationTally: { h: number; v: number };
  /** Whether the interlock-aware pairing model produced reusePurchase. */
  interlockReuse: boolean;
}

/** Inputs the reuse model needs beyond raw geometry. */
export interface TileReuseOptions {
  width: number;
  height: number;
  pattern: Project['layoutPattern'];
  grainDirection: Project['grainDirection'];
  interlockReuse: boolean;
}

const TOL = 1e-3;

/**
 * A single straight-cut offcut that is full along one axis and reduced along the
 * other. `reducedLen` is the consumed length along the reduced axis; `capacity`
 * is the tile dimension along that same axis (the strip stock it is cut from).
 */
export interface OffcutStrip {
  orientation: Orientation;
  /** Reduced axis: 'x' => width reduced, 'y' => height reduced. */
  axis: 'x' | 'y';
  reducedLen: number;
  capacity: number;
}

interface Bin {
  remaining: number;
  count: number;
}

/**
 * Pack offcut strips into tiles.
 *
 * MODEL / ASSUMPTIONS (confirmed with the user):
 *  - Tiles interlock on all 4 sides. A single straight cut removes the connector
 *    on the cut edge only, so a straight-cut piece keeps connectors on its 3
 *    uncut sides and can still snap into the field (the cut edge faces the deck
 *    boundary, the interior-facing connector survives).
 *  - A single straight cut yields exactly TWO complementary pieces, so AT MOST 2
 *    offcuts may come from one tile — hence at most 2 pieces per bin.
 *  - Grain orientation must match for reuse, and the two pieces must be reduced
 *    along the SAME axis (they are cut from the same strip of stock). Pieces are
 *    therefore bucketed by (orientation, reduced-axis) before packing.
 *  - Within a bucket: greedy first-fit-decreasing. Sort reducedLens desc; place
 *    each into an existing bin that still has < 2 pieces and remaining capacity
 *    >= reducedLen, else open a new bin. Bin count = tiles needed for the bucket.
 */
export function packOffcuts(strips: OffcutStrip[]): { tiles: number; paired: number } {
  const buckets = new Map<string, OffcutStrip[]>();
  for (const s of strips) {
    const key = `${s.orientation}-${s.axis}`;
    const list = buckets.get(key);
    if (list) list.push(s);
    else buckets.set(key, [s]);
  }

  let tiles = 0;
  let paired = 0;
  for (const list of buckets.values()) {
    const lens = list.map((s) => s.reducedLen).sort((a, b) => b - a);
    const capacity = list[0].capacity;
    const bins: Bin[] = [];
    for (const len of lens) {
      let placed = false;
      for (const bin of bins) {
        if (bin.count < 2 && bin.remaining >= len - TOL) {
          bin.remaining -= len;
          bin.count++;
          placed = true;
          break;
        }
      }
      if (!placed) bins.push({ remaining: capacity - len, count: 1 });
    }
    tiles += bins.length;
    for (const bin of bins) if (bin.count === 2) paired += bin.count;
  }
  return { tiles, paired };
}

export function computeTiles(
  grid: GridResult,
  deckArea: number,
  opts: TileReuseOptions,
): TileResult {
  const tileArea = opts.width * opts.height;
  const cutCells = grid.cells.filter((c) => c.kind === 'cut');
  const cutCoveredArea = cutCells.reduce((acc, c) => acc + c.coverageArea, 0);

  const safePurchase = grid.fullCount + grid.cutCount;

  // Per-orientation tally over every cut piece.
  const orientationTally = { h: 0, v: 0 };

  let reusePurchase: number;
  let pairedOffcuts = 0;
  let ownTilePieces = 0;

  if (opts.interlockReuse) {
    const strips: OffcutStrip[] = [];
    for (const c of cutCells) {
      const orientation = cellOrientation(c.col, c.row, opts.pattern, opts.grainDirection);
      orientationTally[orientation]++;

      const pieceW = c.cutBBox.maxX - c.cutBBox.minX;
      const pieceH = c.cutBBox.maxY - c.cutBBox.minY;

      // L-cuts keep an interior corner connector on two perpendicular edges; the
      // remaining stock is not a clean strip, so each needs its own tile.
      if (!c.rectangular) {
        ownTilePieces++;
        continue;
      }

      const fullW = Math.abs(pieceW - opts.width) <= TOL;
      const fullH = Math.abs(pieceH - opts.height) <= TOL;
      const reducedW = pieceW < opts.width - TOL;
      const reducedH = pieceH < opts.height - TOL;

      if (fullW && reducedH) {
        // Full along X, reduced along Y: strip cut from the tile's height.
        strips.push({ orientation, axis: 'y', reducedLen: pieceH, capacity: opts.height });
      } else if (fullH && reducedW) {
        // Full along Y, reduced along X: strip cut from the tile's width.
        strips.push({ orientation, axis: 'x', reducedLen: pieceW, capacity: opts.width });
      } else {
        // Both dims reduced (corner) or degenerate: conservatively own tile.
        ownTilePieces++;
      }
    }

    const packed = packOffcuts(strips);
    pairedOffcuts = packed.paired;
    reusePurchase = grid.fullCount + packed.tiles + ownTilePieces;
  } else {
    // Optimistic legacy estimate: assume offcuts pack perfectly by area.
    for (const c of cutCells) {
      orientationTally[cellOrientation(c.col, c.row, opts.pattern, opts.grainDirection)]++;
    }
    reusePurchase =
      grid.fullCount + (tileArea > 0 ? Math.ceil(cutCoveredArea / tileArea) : 0);
  }

  return {
    fullCount: grid.fullCount,
    cutCount: grid.cutCount,
    totalCells: grid.fullCount + grid.cutCount,
    tileArea,
    deckArea,
    cutCoveredArea,
    safePurchase,
    reusePurchase,
    wasteSafe: safePurchase * tileArea - deckArea,
    wasteReuse: reusePurchase * tileArea - deckArea,
    pairedOffcuts,
    ownTilePieces,
    orientationTally,
    interlockReuse: opts.interlockReuse,
  };
}
