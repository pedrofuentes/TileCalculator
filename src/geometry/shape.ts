import polygonClipping from 'polygon-clipping';
import type { RectOp } from '../types';
import type { MultiPoly } from './polygon';
import { rectRing } from './polygon';

// Build the deck shape by applying rectangle add/subtract operations in order.
// Returns a MultiPoly (array of polygons, each with an outer ring + holes).
export function buildShape(rects: RectOp[]): MultiPoly {
  let result: MultiPoly = [];
  for (const r of rects) {
    if (r.w <= 0 || r.h <= 0) continue;
    const rectPoly = [rectRing(r.x, r.y, r.w, r.h)];
    if (r.op === 'add') {
      result =
        result.length === 0
          ? (rectPoly as unknown as MultiPoly)
          : (polygonClipping.union(result as never, rectPoly as never) as unknown as MultiPoly);
    } else {
      if (result.length === 0) continue;
      result = polygonClipping.difference(
        result as never,
        rectPoly as never,
      ) as unknown as MultiPoly;
    }
  }
  return result;
}

/** Intersection of a cell rectangle with the deck shape. */
export function clipCell(
  deck: MultiPoly,
  x: number,
  y: number,
  w: number,
  h: number,
): MultiPoly {
  const cell = [rectRing(x, y, w, h)];
  return polygonClipping.intersection(
    deck as never,
    cell as never,
  ) as unknown as MultiPoly;
}
