import { describe, test, expect } from 'vitest';
import type { RectOp } from '../types';
import { defaultRects } from '../state/defaults';
import { multiPolyArea } from './polygon';
import { buildShape } from './shape';

describe('buildShape', () => {
  test('builds the default deck as a non-empty MultiPoly', () => {
    const result = buildShape(defaultRects());

    expect(Array.isArray(result)).toBe(true);
    expect(Array.isArray(result[0])).toBe(true);
    expect(Array.isArray(result[0][0])).toBe(true);
    expect(Array.isArray(result[0][0][0])).toBe(true);
    expect(typeof result[0][0][0][0]).toBe('number');
    expect(typeof result[0][0][0][1]).toBe('number');
    expect(multiPolyArea(result)).toBeGreaterThan(0);
  });

  test('wraps a single add rectangle as a MultiPoly', () => {
    const rect: RectOp = { id: 'rect-1', x: 0, y: 0, w: 24, h: 12, op: 'add' };

    const result = buildShape([rect]);

    // Regression: lone add-rect must be wrapped as MultiPoly, not a bare Poly (would crash multiPolyArea).
    expect(Array.isArray(result)).toBe(true);
    expect(Array.isArray(result[0])).toBe(true);
    expect(Array.isArray(result[0][0])).toBe(true);
    expect(Array.isArray(result[0][0][0])).toBe(true);
    expect(result[0][0][0]).toHaveLength(2);
    expect(typeof result[0][0][0][0]).toBe('number');
    expect(typeof result[0][0][0][1]).toBe('number');
    expect(() => multiPolyArea(result)).not.toThrow();
    expect(multiPolyArea(result)).toBe(rect.w * rect.h);
  });

  test('returns an empty zero-area shape for no rectangles', () => {
    const result = buildShape([]);

    expect(result).toEqual([]);
    expect(multiPolyArea(result)).toBe(0);
  });
});
