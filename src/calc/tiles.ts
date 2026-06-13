import type { GridResult } from '../geometry/grid';

export interface TileResult {
  fullCount: number;
  cutCount: number;
  totalCells: number;
  tileArea: number;
  deckArea: number;
  cutCoveredArea: number;
  safePurchase: number;
  reusePurchase: number;
  wasteSafe: number;
  wasteReuse: number;
}

export function computeTiles(
  grid: GridResult,
  deckArea: number,
  tileArea: number,
): TileResult {
  const cutCoveredArea = grid.cells
    .filter((c) => c.kind === 'cut')
    .reduce((acc, c) => acc + c.coverageArea, 0);

  const safePurchase = grid.fullCount + grid.cutCount;
  const reusePurchase =
    grid.fullCount + (tileArea > 0 ? Math.ceil(cutCoveredArea / tileArea) : 0);

  return {
    fullCount: grid.fullCount,
    cutCount: grid.cutCount,
    totalCells: grid.fullCount + grid.cutCount,
    tileArea,
    deckArea,
    cutCoveredArea,
    safePurchase,
    reusePurchase,
    wasteSafe: safePurchase * tileArea - deckArea,
    wasteReuse: reusePurchase * tileArea - deckArea,
  };
}
