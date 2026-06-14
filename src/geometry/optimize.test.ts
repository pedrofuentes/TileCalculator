import { describe, test, expect } from 'vitest';
import type { TileConfig } from '../types';
import type { FlushTarget } from './optimize';
import { buildShape } from './shape';
import { optimizeOffset } from './optimize';

const tile: TileConfig = {
  width: 12,
  height: 12,
  gap: 1,
  slats: 3,
  directional: true,
};

describe('optimizeOffset', () => {
  test('evaluates x and y flush targets as candidate offsets', () => {
    const deck = buildShape([{ id: 'deck', x: 0, y: 0, w: 25, h: 25, op: 'add' }]);
    const targets: FlushTarget[] = [
      { axis: 'x', L: 5, length: 100 },
      { axis: 'y', L: 7, length: 80 },
    ];

    const result = optimizeOffset(deck, tile, targets);

    expect(result.offsetX).toBe(5);
    expect(result.offsetY).toBe(7);
    expect(result.grid.cells.length).toBeGreaterThan(0);
  });

  test('keeps the first layout when later candidates have an equal score', () => {
    const equalScoreTile: TileConfig = { ...tile, width: 5, height: 5, gap: 0 };
    const deck = buildShape([{ id: 'deck', x: 0, y: 0, w: 5, h: 6, op: 'add' }]);

    const result = optimizeOffset(deck, equalScoreTile);

    expect(result.offsetX).toBe(0);
    expect(result.offsetY).toBe(0);
    expect(result.grid.cutCount).toBe(1);
    expect(result.grid.cells).toHaveLength(2);
  });

  test('returns an empty grid for an empty deck', () => {
    const result = optimizeOffset([], tile);

    expect(result).toEqual({
      offsetX: 0,
      offsetY: 0,
      grid: { cells: [], fullCount: 0, cutCount: 0, coveredArea: 0 },
    });
  });

  // The best === null fallback is unreachable in normal execution because
  // uniqueOffsets always seeds both axes with 0, so the nested loops run once even
  // for an empty deck.
});
