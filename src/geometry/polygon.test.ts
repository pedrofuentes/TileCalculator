import { describe, expect, test } from 'vitest';
import type { MultiPoly, Ring } from './polygon';
import {
  bboxOfRing,
  cutNotch,
  multiPolyArea,
  multiPolyBBox,
  pointInMultiPoly,
  polyArea,
  rectRing,
  ringSignedArea,
} from './polygon';

describe('polygon area helpers', () => {
  test('rectRing creates a rectangle whose polygon and multipolygon areas match', () => {
    const ring = rectRing(0, 0, 10, 20);

    expect(ring).toEqual([
      [0, 0],
      [10, 0],
      [10, 20],
      [0, 20],
      [0, 0],
    ]);
    expect(polyArea([ring])).toBeCloseTo(200);
    expect(multiPolyArea([[ring]])).toBeCloseTo(200);
  });

  test('ringSignedArea is positive for counter-clockwise rings and negative for clockwise rings', () => {
    const counterClockwise: Ring = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    const clockwise: Ring = [
      [0, 0],
      [0, 10],
      [10, 10],
      [10, 0],
    ];

    expect(ringSignedArea(counterClockwise)).toBeGreaterThan(0);
    expect(ringSignedArea(clockwise)).toBeLessThan(0);
  });
});

describe('polygon bounds and containment helpers', () => {
  test('bboxOfRing and multiPolyBBox return rectangle extents', () => {
    const ring = rectRing(-5, 2, 10, 20);
    const expectedBBox = { minX: -5, minY: 2, maxX: 5, maxY: 22 };

    expect(bboxOfRing(ring)).toEqual(expectedBBox);
    expect(multiPolyBBox([[ring]])).toEqual(expectedBBox);
  });

  test('pointInMultiPoly detects points inside and outside a rectangle', () => {
    const ring = rectRing(0, 0, 10, 20);
    const multiPoly: MultiPoly = [[ring]];

    expect(pointInMultiPoly([5, 10], multiPoly)).toBe(true);
    expect(pointInMultiPoly([15, 10], multiPoly)).toBe(false);
  });
});

describe('cutNotch', () => {
  const bbox = { minX: 0, minY: 0, maxX: 12, maxY: 12 };

  // An L outline = the 12x12 tile with a rectangular corner notch removed.
  function lShape(corner: 'tr' | 'tl' | 'br' | 'bl', w: number, h: number): MultiPoly {
    let ring: Ring;
    switch (corner) {
      case 'tr': // notch at (12,12)
        ring = [[0, 0], [12, 0], [12, 12 - h], [12 - w, 12 - h], [12 - w, 12], [0, 12]];
        break;
      case 'tl': // notch at (0,12)
        ring = [[0, 0], [12, 0], [12, 12], [w, 12], [w, 12 - h], [0, 12 - h]];
        break;
      case 'br': // notch at (12,0)
        ring = [[0, 0], [12 - w, 0], [12 - w, h], [12, h], [12, 12], [0, 12]];
        break;
      case 'bl': // notch at (0,0)
        ring = [[w, 0], [12, 0], [12, 12], [0, 12], [0, h], [w, h]];
        break;
    }
    return [[ring]];
  }

  test('returns notch dims for each corner', () => {
    expect(cutNotch(lShape('tr', 4, 3), bbox)).toEqual({ w: 4, h: 3 });
    expect(cutNotch(lShape('tl', 5, 2), bbox)).toEqual({ w: 5, h: 2 });
    expect(cutNotch(lShape('br', 3, 6), bbox)).toEqual({ w: 3, h: 6 });
    expect(cutNotch(lShape('bl', 7, 1), bbox)).toEqual({ w: 7, h: 1 });
  });

  test('returns null for a rectangular piece (no notch)', () => {
    expect(cutNotch([[rectRing(0, 0, 12, 12)]], bbox)).toBeNull();
  });

  test('returns null for a degenerate bbox', () => {
    expect(cutNotch([[rectRing(0, 0, 12, 12)]], { minX: 0, minY: 0, maxX: 0, maxY: 12 })).toBeNull();
  });

  test('returns null when more than one corner is missing', () => {
    // A plus/cross-ish outline: two opposite corners removed -> not a clean L.
    const ring: Ring = [
      [4, 0], [8, 0], [8, 12], [4, 12],
    ];
    // a thin vertical bar has no covered corners at all -> >1 uncovered corner
    expect(cutNotch([[ring]], bbox)).toBeNull();
  });

  test('returns null for a stepped notch (multiple interior vertices)', () => {
    // One uncovered corner (top-right) but a staircase notch with 3 interior
    // vertices -> not a clean single-notch L.
    const ring: Ring = [
      [0, 0], [12, 0], [12, 6], [9, 6], [9, 9], [6, 9], [6, 12], [0, 12],
    ];
    expect(cutNotch([[ring]], bbox)).toBeNull();
  });
});
