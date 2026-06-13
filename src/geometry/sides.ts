import type { MultiPoly, Pt, Ring } from './polygon';
import { ringSignedArea, pointInMultiPoly } from './polygon';

export interface Side {
  id: string;
  a: Pt;
  b: Pt;
  length: number;
  mid: Pt;
  /** Unit vector pointing away from the deck material (where borders attach). */
  outward: Pt;
}

export interface Corner {
  point: Pt;
  type: 'outside' | 'inside';
  prevSideId: string;
  nextSideId: string;
}

export interface ShapeSides {
  sides: Side[];
  corners: Corner[];
}

const EPS = 1e-6;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Stable id independent of traversal direction. */
function sideId(a: Pt, b: Pt): string {
  const ka = `${round2(a[0])},${round2(a[1])}`;
  const kb = `${round2(b[0])},${round2(b[1])}`;
  return ka < kb ? `${ka}_${kb}` : `${kb}_${ka}`;
}

/** Remove the repeated closing vertex and merge collinear runs into corners. */
function cleanRing(ring: Ring): Pt[] {
  const pts = ring.slice();
  if (pts.length > 1) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (Math.abs(first[0] - last[0]) < EPS && Math.abs(first[1] - last[1]) < EPS) {
      pts.pop();
    }
  }
  const n = pts.length;
  if (n < 3) return pts;
  const kept: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const cur = pts[i];
    const next = pts[(i + 1) % n];
    const v1x = cur[0] - prev[0];
    const v1y = cur[1] - prev[1];
    const v2x = next[0] - cur[0];
    const v2y = next[1] - cur[1];
    const cross = v1x * v2y - v1y * v2x;
    if (Math.abs(cross) > EPS) kept.push(cur); // genuine corner
  }
  return kept.length >= 3 ? kept : pts;
}

export function deriveSides(deck: MultiPoly): ShapeSides {
  const sides: Side[] = [];
  const corners: Corner[] = [];
  const seen = new Set<string>();

  for (const poly of deck) {
    for (const ring of poly) {
      const pts = cleanRing(ring);
      const n = pts.length;
      if (n < 3) continue;
      const ccw = ringSignedArea(ring) > 0;

      const ringSideIds: string[] = [];
      for (let i = 0; i < n; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % n];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const len = Math.hypot(dx, dy);
        const id = sideId(a, b);
        ringSideIds.push(id);
        if (len < EPS || seen.has(id)) continue;
        seen.add(id);
        const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        // Candidate normal; flip so it points away from the deck.
        let nx = -dy / len;
        let ny = dx / len;
        const probe: Pt = [mid[0] + nx * 0.05, mid[1] + ny * 0.05];
        if (pointInMultiPoly(probe, deck)) {
          nx = -nx;
          ny = -ny;
        }
        sides.push({ id, a, b, length: len, mid, outward: [nx, ny] });
      }

      // Corners: classify each vertex as convex (outside) or reflex (inside).
      for (let i = 0; i < n; i++) {
        const prev = pts[(i - 1 + n) % n];
        const cur = pts[i];
        const next = pts[(i + 1) % n];
        const ax = cur[0] - prev[0];
        const ay = cur[1] - prev[1];
        const bx = next[0] - cur[0];
        const by = next[1] - cur[1];
        const cross = ax * by - ay * bx;
        const convex = ccw ? cross > 0 : cross < 0;
        corners.push({
          point: cur,
          type: convex ? 'outside' : 'inside',
          prevSideId: ringSideIds[(i - 1 + n) % n],
          nextSideId: ringSideIds[i],
        });
      }
    }
  }

  return { sides, corners };
}
