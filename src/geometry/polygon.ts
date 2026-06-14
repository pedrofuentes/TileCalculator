// Lightweight polygon helpers and shared geometry types.
// A MultiPoly is an array of polygons; each Poly's first ring is the outer
// boundary and any further rings are holes. Coordinates are [x, y] in inches.

export type Pt = [number, number];
export type Ring = Pt[];
export type Poly = Ring[];
export type MultiPoly = Poly[];

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Signed area of a ring (shoelace). Positive = counter-clockwise. */
export function ringSignedArea(ring: Ring): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

/** Absolute area of a single polygon accounting for holes. */
export function polyArea(poly: Poly): number {
  if (poly.length === 0) return 0;
  let area = Math.abs(ringSignedArea(poly[0]));
  for (let i = 1; i < poly.length; i++) {
    area -= Math.abs(ringSignedArea(poly[i]));
  }
  return area;
}

export function multiPolyArea(mp: MultiPoly): number {
  return mp.reduce((acc, p) => acc + polyArea(p), 0);
}

export function multiPolyBBox(mp: MultiPoly): BBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const poly of mp) {
    for (const ring of poly) {
      for (const [x, y] of ring) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, minY, maxX, maxY };
}

/** Even-odd point-in-polygon test against a single Poly (handles holes). */
function pointInPoly(pt: Pt, poly: Poly): boolean {
  let inside = false;
  for (const ring of poly) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      const intersect =
        yi > pt[1] !== yj > pt[1] &&
        pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
  }
  return inside;
}

/** True if the point lies inside the multipolygon (any of its polygons). */
export function pointInMultiPoly(pt: Pt, mp: MultiPoly): boolean {
  for (const poly of mp) {
    if (pointInPoly(pt, poly)) return true;
  }
  return false;
}

export function bboxOfRing(ring: Ring): BBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

export function rectRing(x: number, y: number, w: number, h: number): Ring {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
    [x, y],
  ];
}

/**
 * For an axis-aligned L-shaped cut piece (a tile clipped at a reentrant deck
 * corner), return the dimensions of the rectangular corner notch that was sawn
 * out. Returns `null` when the piece is not a clean single-notch L (e.g. it is
 * rectangular, has multiple notches, or the geometry fails validation) so the
 * caller can fall back to a plain label without risk of showing a wrong notch.
 *
 * `covered` is the kept material; `bbox` is its bounding box (the full extent of
 * the piece). The notch is the one bbox corner that is missing: its sides run
 * from that corner to the single reflex (interior) vertex of the L outline.
 */
export function cutNotch(covered: MultiPoly, bbox: BBox): { w: number; h: number } | null {
  const { minX, minY, maxX, maxY } = bbox;
  const bw = maxX - minX;
  const bh = maxY - minY;
  if (bw <= 0 || bh <= 0) return null;

  const EPS = Math.min(bw, bh) * 1e-3;
  const TOL = bw * bh * 1e-3;

  // The notch corner is the bbox corner whose interior is NOT covered. A clean
  // single-notch L has exactly one such corner.
  const corners: Pt[] = [
    [minX, minY],
    [maxX, minY],
    [maxX, maxY],
    [minX, maxY],
  ];
  let notchCorner: Pt | null = null;
  for (const [cx, cy] of corners) {
    const ix = cx + (cx === minX ? EPS : -EPS);
    const iy = cy + (cy === minY ? EPS : -EPS);
    if (!pointInMultiPoly([ix, iy], covered)) {
      if (notchCorner) return null; // more than one uncovered corner
      notchCorner = [cx, cy];
    }
  }
  if (!notchCorner) return null;

  // The reflex vertex is the lone outline vertex strictly interior to the bbox
  // on both axes.
  let reflex: Pt | null = null;
  for (const poly of covered) {
    for (const ring of poly) {
      for (const [x, y] of ring) {
        if (x > minX + EPS && x < maxX - EPS && y > minY + EPS && y < maxY - EPS) {
          if (reflex && (Math.abs(reflex[0] - x) > EPS || Math.abs(reflex[1] - y) > EPS)) {
            return null; // more than one distinct interior vertex
          }
          reflex = [x, y];
        }
      }
    }
  }
  if (!reflex) return null;

  const w = Math.abs(notchCorner[0] - reflex[0]);
  const h = Math.abs(notchCorner[1] - reflex[1]);
  if (w <= EPS || h <= EPS) return null;

  // Validate: removing the notch from the bbox must reproduce the covered area.
  if (Math.abs(bw * bh - w * h - multiPolyArea(covered)) > TOL) return null;

  return { w, h };
}
