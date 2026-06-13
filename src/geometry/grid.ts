import type { TileConfig } from '../types';
import type { BBox, MultiPoly } from './polygon';
import { multiPolyArea, multiPolyBBox } from './polygon';
import { clipCell } from './shape';

export interface TileCell {
  col: number;
  row: number;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'full' | 'cut';
  coverageArea: number;
  covered: MultiPoly;
  /** Bounding box of the covered region (extent of the cut piece). */
  cutBBox: BBox;
  /** True when the covered region fully fills its bounding box (simple straight cut). */
  rectangular: boolean;
}

export interface GridResult {
  cells: TileCell[];
  fullCount: number;
  cutCount: number;
  coveredArea: number;
}

const AREA_TOL = 1e-4;

export function classifyGrid(
  deck: MultiPoly,
  tile: TileConfig,
  offsetX: number,
  offsetY: number,
): GridResult {
  const cells: TileCell[] = [];
  if (deck.length === 0) {
    return { cells, fullCount: 0, cutCount: 0, coveredArea: 0 };
  }
  const bbox = multiPolyBBox(deck);
  const moduleW = tile.width + tile.gap;
  const moduleH = tile.height + tile.gap;
  const tileArea = tile.width * tile.height;

  const colStart = Math.floor((bbox.minX - offsetX) / moduleW) - 1;
  const colEnd = Math.ceil((bbox.maxX - offsetX) / moduleW) + 1;
  const rowStart = Math.floor((bbox.minY - offsetY) / moduleH) - 1;
  const rowEnd = Math.ceil((bbox.maxY - offsetY) / moduleH) + 1;

  let fullCount = 0;
  let cutCount = 0;
  let coveredArea = 0;

  for (let col = colStart; col <= colEnd; col++) {
    const tx = offsetX + col * moduleW;
    if (tx >= bbox.maxX - AREA_TOL || tx + tile.width <= bbox.minX + AREA_TOL) continue;
    for (let row = rowStart; row <= rowEnd; row++) {
      const ty = offsetY + row * moduleH;
      if (ty >= bbox.maxY - AREA_TOL || ty + tile.height <= bbox.minY + AREA_TOL) continue;

      const covered = clipCell(deck, tx, ty, tile.width, tile.height);
      const area = multiPolyArea(covered);
      if (area <= AREA_TOL) continue;

      coveredArea += area;
      if (area >= tileArea - AREA_TOL) {
        fullCount++;
        cells.push({
          col,
          row,
          x: tx,
          y: ty,
          w: tile.width,
          h: tile.height,
          kind: 'full',
          coverageArea: area,
          covered,
          cutBBox: { minX: tx, minY: ty, maxX: tx + tile.width, maxY: ty + tile.height },
          rectangular: true,
        });
      } else {
        cutCount++;
        const cb = multiPolyBBox(covered);
        const bboxArea = (cb.maxX - cb.minX) * (cb.maxY - cb.minY);
        cells.push({
          col,
          row,
          x: tx,
          y: ty,
          w: tile.width,
          h: tile.height,
          kind: 'cut',
          coverageArea: area,
          covered,
          cutBBox: cb,
          rectangular: Math.abs(bboxArea - area) <= AREA_TOL,
        });
      }
    }
  }

  return { cells, fullCount, cutCount, coveredArea };
}
