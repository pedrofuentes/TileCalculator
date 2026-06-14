import type { TileConfig } from '../types';
import type { BBox, MultiPoly, Pt } from './polygon';
import { multiPolyArea, multiPolyBBox, pointInMultiPoly, rectRing } from './polygon';
import { clipCell } from './shape';

export interface TileCell {
  col: number;
  row: number;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'full' | 'cut';
  coverageArea: number;
  covered: MultiPoly;
  /** Bounding box of the covered region (extent of the cut piece). */
  cutBBox: BBox;
  /** True when the covered region fully fills its bounding box (simple straight cut). */
  rectangular: boolean;
}

export interface GridResult {
  cells: TileCell[];
  fullCount: number;
  cutCount: number;
  coveredArea: number;
}

const AREA_TOL = 1e-4;

/** Minimum covered-bbox extent (inches) for a clipped cell to count as a tile. */
const MIN_TILE_DIM = 1 / 32;

/** A single ring edge plus its bbox and whether it is axis-aligned. */
interface Edge {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  axisAligned: boolean;
}

const AXIS_EPS = 1e-9;

/** Flatten every ring edge of the multipolygon (outer rings and holes). */
function collectEdges(deck: MultiPoly): Edge[] {
  const edges: Edge[] = [];
  for (const poly of deck) {
    for (const ring of poly) {
      for (let i = 0; i < ring.length - 1; i++) {
        const [ax, ay] = ring[i];
        const [bx, by] = ring[i + 1];
        edges.push({
          ax,
          ay,
          bx,
          by,
          minX: Math.min(ax, bx),
          minY: Math.min(ay, by),
          maxX: Math.max(ax, bx),
          maxY: Math.max(ay, by),
          axisAligned: Math.abs(ax - bx) < AXIS_EPS || Math.abs(ay - by) < AXIS_EPS,
        });
      }
    }
  }
  return edges;
}

function onSegment(px: number, py: number, qx: number, qy: number, rx: number, ry: number): boolean {
  return (
    Math.min(px, rx) <= qx + AXIS_EPS &&
    qx <= Math.max(px, rx) + AXIS_EPS &&
    Math.min(py, ry) <= qy + AXIS_EPS &&
    qy <= Math.max(py, ry) + AXIS_EPS
  );
}

function orient(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  const v = (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
  if (v > AXIS_EPS) return 1;
  if (v < -AXIS_EPS) return -1;
  return 0;
}

/** Robust closed segment vs closed segment intersection (handles collinear). */
function segSegIntersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const o1 = orient(ax, ay, bx, by, cx, cy);
  const o2 = orient(ax, ay, bx, by, dx, dy);
  const o3 = orient(cx, cy, dx, dy, ax, ay);
  const o4 = orient(cx, cy, dx, dy, bx, by);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(ax, ay, cx, cy, bx, by)) return true;
  if (o2 === 0 && onSegment(ax, ay, dx, dy, bx, by)) return true;
  if (o3 === 0 && onSegment(cx, cy, ax, ay, dx, dy)) return true;
  if (o4 === 0 && onSegment(cx, cy, bx, by, dx, dy)) return true;
  return false;
}

/**
 * True if the edge touches the closed cell rectangle in any way (crossing,
 * contained, or lying on its boundary). Conservative: prefers reporting contact.
 */
function edgeTouchesRect(
  e: Edge,
  rx0: number, ry0: number, rx1: number, ry1: number,
): boolean {
  // bbox quick reject
  if (e.maxX < rx0 - AXIS_EPS || e.minX > rx1 + AXIS_EPS) return false;
  if (e.maxY < ry0 - AXIS_EPS || e.minY > ry1 + AXIS_EPS) return false;
  // either endpoint inside the closed rect
  if (e.ax >= rx0 - AXIS_EPS && e.ax <= rx1 + AXIS_EPS && e.ay >= ry0 - AXIS_EPS && e.ay <= ry1 + AXIS_EPS) return true;
  if (e.bx >= rx0 - AXIS_EPS && e.bx <= rx1 + AXIS_EPS && e.by >= ry0 - AXIS_EPS && e.by <= ry1 + AXIS_EPS) return true;
  // crossing any of the four rectangle edges
  if (segSegIntersect(e.ax, e.ay, e.bx, e.by, rx0, ry0, rx1, ry0)) return true;
  if (segSegIntersect(e.ax, e.ay, e.bx, e.by, rx1, ry0, rx1, ry1)) return true;
  if (segSegIntersect(e.ax, e.ay, e.bx, e.by, rx1, ry1, rx0, ry1)) return true;
  if (segSegIntersect(e.ax, e.ay, e.bx, e.by, rx0, ry1, rx0, ry0)) return true;
  return false;
}

export function classifyGrid(
  deck: MultiPoly,
  tile: TileConfig,
  offsetX: number,
  offsetY: number,
  precomputedBBox?: BBox,
): GridResult {
  const cells: TileCell[] = [];
  if (deck.length === 0) {
    return { cells, fullCount: 0, cutCount: 0, coveredArea: 0 };
  }
  const bbox = precomputedBBox ?? multiPolyBBox(deck);
  const moduleW = tile.width + tile.gap;
  const moduleH = tile.height + tile.gap;
  const tileArea = tile.width * tile.height;

  const edges = collectEdges(deck);

  const colStart = Math.floor((bbox.minX - offsetX) / moduleW) - 1;
  const colEnd = Math.ceil((bbox.maxX - offsetX) / moduleW) + 1;
  const rowStart = Math.floor((bbox.minY - offsetY) / moduleH) - 1;
  const rowEnd = Math.ceil((bbox.maxY - offsetY) / moduleH) + 1;

  let fullCount = 0;
  let cutCount = 0;
  let coveredArea = 0;

  for (let col = colStart; col <= colEnd; col++) {
    const tx = offsetX + col * moduleW;
    if (tx >= bbox.maxX - AREA_TOL || tx + tile.width <= bbox.minX + AREA_TOL) continue;
    for (let row = rowStart; row <= rowEnd; row++) {
      const ty = offsetY + row * moduleH;
      if (ty >= bbox.maxY - AREA_TOL || ty + tile.height <= bbox.minY + AREA_TOL) continue;

      const rx1 = tx + tile.width;
      const ry1 = ty + tile.height;

      // Conservative analytic fast path: if the cell rectangle is provably fully
      // inside the filled region and clear of every boundary/hole edge, it is a
      // full tile and the polygon clip can be skipped. Any uncertainty (a non
      // axis-aligned edge near the cell, an edge touching the cell, or a corner
      // not strictly inside) falls back to clipCell.
      if (isInteriorFull(deck, edges, tx, ty, rx1, ry1)) {
        coveredArea += tileArea;
        fullCount++;
        cells.push({
          col,
          row,
          x: tx,
          y: ty,
          w: tile.width,
          h: tile.height,
          kind: 'full',
          coverageArea: tileArea,
          covered: [[rectRing(tx, ty, tile.width, tile.height)]],
          cutBBox: { minX: tx, minY: ty, maxX: rx1, maxY: ry1 },
          rectangular: true,
        });
        continue;
      }

      const covered = clipCell(deck, tx, ty, tile.width, tile.height);
      const area = multiPolyArea(covered);
      if (area <= AREA_TOL) continue;

      // Reject floating-point boundary slivers: a clipped cell whose covered
      // bounding box is near-zero in width or height is not a real tile (it would
      // render as "N x 0 in" and inflate cut/purchase counts).
      const cb = multiPolyBBox(covered);
      if (cb.maxX - cb.minX < MIN_TILE_DIM || cb.maxY - cb.minY < MIN_TILE_DIM) continue;

      coveredArea += area;
      if (area >= tileArea - AREA_TOL) {
        fullCount++;
        cells.push({
          col,
          row,
          x: tx,
          y: ty,
          w: tile.width,
          h: tile.height,
          kind: 'full',
          coverageArea: area,
          covered,
          cutBBox: { minX: tx, minY: ty, maxX: tx + tile.width, maxY: ty + tile.height },
          rectangular: true,
        });
      } else {
        cutCount++;
        const bboxArea = (cb.maxX - cb.minX) * (cb.maxY - cb.minY);
        cells.push({
          col,
          row,
          x: tx,
          y: ty,
          w: tile.width,
          h: tile.height,
          kind: 'cut',
          coverageArea: area,
          covered,
          cutBBox: cb,
          rectangular: Math.abs(bboxArea - area) <= AREA_TOL,
        });
      }
    }
  }

  return { cells, fullCount, cutCount, coveredArea };
}

/**
 * Exact (for rectilinear geometry) test that the cell rectangle [tx,ty]-[rx1,ry1]
 * is fully inside the deck's filled region: all four corners strictly inside and
 * no ring edge touching the cell. Returns false (forcing a clip) on any non
 * axis-aligned edge near the cell or any contact, so it never reports a tile full
 * unless it provably is.
 */
function isInteriorFull(
  deck: MultiPoly,
  edges: Edge[],
  tx: number,
  ty: number,
  rx1: number,
  ry1: number,
): boolean {
  for (const e of edges) {
    // Only edges whose bbox overlaps the cell can affect it.
    if (e.maxX < tx - AXIS_EPS || e.minX > rx1 + AXIS_EPS) continue;
    if (e.maxY < ty - AXIS_EPS || e.minY > ry1 + AXIS_EPS) continue;
    if (!e.axisAligned) return false; // non-rectilinear neighbour: be safe, clip
    if (edgeTouchesRect(e, tx, ty, rx1, ry1)) return false;
  }
  const corners: Pt[] = [
    [tx, ty],
    [rx1, ty],
    [rx1, ry1],
    [tx, ry1],
  ];
  for (const c of corners) {
    if (!pointInMultiPoly(c, deck)) return false;
  }
  return true;
}
