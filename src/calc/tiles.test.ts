import { describe, test, expect } from 'vitest';
import { computeProject } from '../compute';
import { makeDefaultProject } from '../state/defaults';
import { computeTiles, packOffcuts } from './tiles';
import type { OffcutStrip, TileResult } from './tiles';

describe('computeTiles', () => {
  test('computes positive and internally consistent totals for the default deck', () => {
    const project = makeDefaultProject();
    const computed = computeProject(project);

    const result: TileResult = computeTiles(computed.grid, computed.tiledArea, {
      width: project.tile.width,
      height: project.tile.height,
      pattern: project.layoutPattern,
      grainDirection: project.grainDirection,
      interlockReuse: project.interlockReuse,
    });

    expect(result).toEqual(computed.tiles);
    expect(result.fullCount).toBeGreaterThan(0);
    expect(result.cutCount).toBeGreaterThan(0);
    expect(result.totalCells).toBe(result.fullCount + result.cutCount);
    expect(result.safePurchase).toBe(result.totalCells);
    expect(result.safePurchase).toBeGreaterThanOrEqual(result.fullCount);
    expect(result.reusePurchase).toBeGreaterThanOrEqual(result.fullCount);
    expect(result.tileArea).toBe(project.tile.width * project.tile.height);
    expect(result.deckArea).toBe(computed.tiledArea);
    expect(result.cutCoveredArea).toBeGreaterThan(0);
    expect(result.wasteSafe).toBe(result.safePurchase * result.tileArea - result.deckArea);
    expect(result.wasteReuse).toBe(result.reusePurchase * result.tileArea - result.deckArea);
    expect(result.pairedOffcuts + result.ownTilePieces).toBeLessThanOrEqual(result.cutCount);
    expect(result.orientationTally.h + result.orientationTally.v).toBe(result.cutCount);
    expect(result.interlockReuse).toBe(project.interlockReuse);
  });
});

describe('packOffcuts', () => {
  test('pairs compatible strips while leaving non-fitting strips on their own tiles', () => {
    const strips: OffcutStrip[] = [
      { orientation: 'h', axis: 'x', reducedLen: 8, capacity: 12 },
      { orientation: 'h', axis: 'x', reducedLen: 7, capacity: 12 },
      { orientation: 'h', axis: 'x', reducedLen: 5, capacity: 12 },
      { orientation: 'v', axis: 'y', reducedLen: 6, capacity: 12 },
    ];

    expect(packOffcuts(strips)).toEqual({ tiles: 3, paired: 2 });
  });
});
