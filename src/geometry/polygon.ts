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
