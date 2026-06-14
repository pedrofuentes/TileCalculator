import { describe, test, expect } from 'vitest';
import { defaultRects } from '../state/defaults';
import type { RectOp } from '../types';
import type { MultiPoly } from './polygon';
import { buildShape } from './shape';
import { deriveSides } from './sides';
import type { Side } from './sides';

const EPS = 1e-6;

function isHorizontal(side: Side): boolean {
  return Math.abs(side.a[1] - side.b[1]) < EPS;
}

function isVertical(side: Side): boolean {
  return Math.abs(side.a[0] - side.b[0]) < EPS;
}

function roundedOutward(side: Side): [number, number] {
  const x = Math.round(side.outward[0]);
  const y = Math.round(side.outward[1]);
  return [Object.is(x, -0) ? 0 : x, Object.is(y, -0) ? 0 : y];
}

describe('deriveSides coverage edges', () => {
  test('derives four outside corners and both axis orientations for a simple rectangle', () => {
    const rects: RectOp[] = [{ id: 'rect', x: 0, y: 0, w: 24, h: 12, op: 'add' }];
    const shape = deriveSides(buildShape(rects));

    expect(shape.sides).toHaveLength(4);
    expect(shape.corners).toHaveLength(4);
    expect(shape.sides.filter(isHorizontal)).toHaveLength(2);
    expect(shape.sides.filter(isVertical)).toHaveLength(2);
    expect(shape.corners.every((corner) => corner.type === 'outside')).toBe(true);
    expect(shape.sides.map(roundedOutward)).toEqual(
      expect.arrayContaining([
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ]),
    );
  });

  test('classifies the concave default L-shaped deck with one inside corner', () => {
    const shape = deriveSides(buildShape(defaultRects()));
    const insideCorners = shape.corners.filter((corner) => corner.type === 'inside');

    expect(shape.sides).toHaveLength(6);
    expect(shape.corners).toHaveLength(6);
    expect(shape.sides.some(isHorizontal)).toBe(true);
    expect(shape.sides.some(isVertical)).toBe(true);
    expect(insideCorners).toHaveLength(1);
    expect(insideCorners[0].point).toEqual([90.25, 120.875]);
  });

  test('handles defensive multipolygon edge cases without inventing duplicate sides', () => {
    const clockwiseOpenRectangle: MultiPoly = [
      [
        [
          [0, 0],
          [0, 10],
          [10, 10],
          [10, 0],
        ],
      ],
    ];
    const duplicateClockwiseRectangle: MultiPoly = [
      ...clockwiseOpenRectangle,
      ...clockwiseOpenRectangle,
    ];
    const degenerateRings: MultiPoly = [
      [
        [
          [20, 0],
          [20, 0],
          [30, 0],
        ],
      ],
      [[[40, 0]]],
    ];

    const clockwiseShape = deriveSides(clockwiseOpenRectangle);
    const duplicateShape = deriveSides(duplicateClockwiseRectangle);
    const degenerateShape = deriveSides(degenerateRings);

    expect(clockwiseShape.sides).toHaveLength(4);
    expect(clockwiseShape.corners.every((corner) => corner.type === 'outside')).toBe(true);
    expect(duplicateShape.sides).toHaveLength(clockwiseShape.sides.length);
    expect(degenerateShape.sides.every((side) => side.length >= EPS)).toBe(true);
  });
});
