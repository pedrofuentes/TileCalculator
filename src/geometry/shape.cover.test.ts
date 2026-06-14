import { describe, test, expect } from 'vitest';
import type { RectOp } from '../types';
import { multiPolyArea } from './polygon';
import { buildShape } from './shape';

describe('buildShape subtract operations', () => {
  test('ignores subtract rectangles before any add operation', () => {
    const rects: RectOp[] = [
      { id: 'early-subtract', x: 0, y: 0, w: 4, h: 4, op: 'subtract' },
    ];

    const result = buildShape(rects);

    expect(result).toEqual([]);
    expect(multiPolyArea(result)).toBe(0);
  });

  test('subtracts a later rectangle from the accumulated shape', () => {
    const rects: RectOp[] = [
      { id: 'outer', x: 0, y: 0, w: 10, h: 10, op: 'add' },
      { id: 'inner-cutout', x: 3, y: 3, w: 4, h: 4, op: 'subtract' },
    ];

    const result = buildShape(rects);

    expect(multiPolyArea(result)).toBeCloseTo(84);
    expect(result[0]).toHaveLength(2);
  });
});
