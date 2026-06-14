import { describe, expect, test } from 'vitest';
import type { MultiPoly, Ring } from './polygon';
import {
  bboxOfRing,
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
