import { describe, test, expect } from 'vitest';
import type { GridResult, TileCell } from '../geometry/grid';
import type { MultiPoly } from '../geometry/polygon';
import { computeTiles } from './tiles';

function cutCell(col: number, row: number, coverageArea: number): TileCell {
  const covered: MultiPoly = [];
  return {
    col,
    row,
    x: col * 10,
    y: row * 10,
    w: 10,
    h: 10,
    kind: 'cut',
    coverageArea,
    covered,
    cutBBox: { minX: 0, minY: 0, maxX: 10, maxY: coverageArea / 10 },
    rectangular: true,
  };
}

describe('computeTiles legacy reuse coverage edge', () => {
  test('tallies cut orientations and packs by area when interlock reuse is disabled', () => {
    const grid: GridResult = {
      cells: [cutCell(0, 0, 25), cutCell(1, 0, 50)],
      fullCount: 2,
      cutCount: 2,
      coveredArea: 275,
    };

    const result = computeTiles(grid, grid.coveredArea, {
      width: 10,
      height: 10,
      pattern: 'checkerboard',
      grainDirection: 'horizontal',
      interlockReuse: false,
    });

    expect(result.interlockReuse).toBe(false);
    expect(result.orientationTally).toEqual({ h: 1, v: 1 });
    expect(result.pairedOffcuts).toBe(0);
    expect(result.ownTilePieces).toBe(0);
    expect(result.safePurchase).toBe(4);
    expect(result.reusePurchase).toBe(3);
    expect(result.wasteReuse).toBe(25);
  });

  test('keeps legacy reuse from dividing by zero when tile area is zero', () => {
    const grid: GridResult = {
      cells: [cutCell(0, 0, 25)],
      fullCount: 2,
      cutCount: 1,
      coveredArea: 225,
    };

    const result = computeTiles(grid, grid.coveredArea, {
      width: 0,
      height: 10,
      pattern: 'uniform',
      grainDirection: 'vertical',
      interlockReuse: false,
    });

    expect(result.tileArea).toBe(0);
    expect(result.orientationTally).toEqual({ h: 0, v: 1 });
    expect(result.reusePurchase).toBe(2);
    expect(result.wasteReuse).toBe(-225);
  });
});
