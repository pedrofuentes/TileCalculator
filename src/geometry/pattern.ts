import type { Project } from '../types';

export type Orientation = 'h' | 'v';

/** Grain orientation of the even/origin tile. */
function baseOrientation(grainDirection: Project['grainDirection']): Orientation {
  return grainDirection === 'vertical' ? 'v' : 'h';
}

function perpendicular(o: Orientation): Orientation {
  return o === 'h' ? 'v' : 'h';
}

/**
 * Grain orientation of the tile at grid cell (col, row).
 *  - 'uniform': always the base direction.
 *  - 'checkerboard': flips with (col + row) parity (handles negative indices).
 */
export function cellOrientation(
  col: number,
  row: number,
  pattern: Project['layoutPattern'],
  grainDirection: Project['grainDirection'],
): Orientation {
  const base = baseOrientation(grainDirection);
  if (pattern !== 'checkerboard') return base;
  const parity = (((col + row) % 2) + 2) % 2;
  return parity === 0 ? base : perpendicular(base);
}
