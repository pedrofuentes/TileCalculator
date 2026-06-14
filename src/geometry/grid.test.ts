import { describe, test, expect } from 'vitest';
import type { RectOp, TileConfig } from '../types';
import { buildShape } from './shape';
import { classifyGrid } from './grid';
import { optimizeOffset } from './optimize';
import { cellOrientation } from './pattern';

const tile: TileConfig = {
  width: 12,
  height: 12,
  gap: 0,
  slats: 3,
  directional: true,
};

function simpleDeck() {
  const rect: RectOp = { id: 'rect-1', x: 0, y: 0, w: 24, h: 24, op: 'add' };
  return buildShape([rect]);
}

describe('grid geometry', () => {
  test('classifies a simple rectangle into full cells', () => {
    const grid = classifyGrid(simpleDeck(), tile, 0, 0);

    expect(grid.cells.length).toBeGreaterThan(0);
    expect(grid.fullCount).toBeGreaterThan(0);
    expect(grid.cutCount).toBe(0);
    expect(grid.cells).toHaveLength(grid.fullCount);
    expect(grid.cells.every((cell) => cell.kind === 'full')).toBe(true);
  });

  test('optimizes offsets within the tile module range', () => {
    const result = optimizeOffset(simpleDeck(), tile);
    const moduleW = tile.width + tile.gap;
    const moduleH = tile.height + tile.gap;

    expect(result.offsetX).toBeGreaterThanOrEqual(0);
    expect(result.offsetX).toBeLessThan(moduleW);
    expect(result.offsetY).toBeGreaterThanOrEqual(0);
    expect(result.offsetY).toBeLessThan(moduleH);
    expect(result.grid.cells.length).toBeGreaterThan(0);
  });

  test('returns checkerboard and uniform cell orientations from cell coordinates', () => {
    expect(cellOrientation(0, 0, 'checkerboard', 'horizontal')).toBe('h');
    expect(cellOrientation(1, 0, 'checkerboard', 'horizontal')).toBe('v');
    expect(cellOrientation(0, 1, 'checkerboard', 'vertical')).toBe('h');
    expect(cellOrientation(-1, 0, 'checkerboard', 'horizontal')).toBe('v');
    expect(cellOrientation(2, 3, 'uniform', 'vertical')).toBe('v');
  });
});
