import { describe, test, expect } from 'vitest';
import type { Project, RectOp } from './types';
import { computeProject } from './compute';
import { assignAllSides, makeDefaultProject } from './state/defaults';

describe('computeProject', () => {
  test('computes sensible totals for the default project', () => {
    const computed = computeProject(makeDefaultProject());

    expect(computed.footprintArea).toBeGreaterThan(0);
    expect(computed.tiledArea).toBeGreaterThan(0);
    expect(computed.tiles.totalCells).toBeGreaterThan(0);
    expect(computed.tiles.safePurchase).toBeGreaterThan(0);
    expect(computed.tiles.reusePurchase).toBeGreaterThan(0);
    expect(computed.tiles.deckArea).toBeCloseTo(computed.tiledArea);
    expect(computed.borders.byType.length).toBeGreaterThan(0);
    expect(computed.borders.byType[0]?.linearLength).toBeGreaterThan(0);
    expect(computed.borders.totalOutsideCorners).toBeGreaterThan(0);
    expect(computed.shape.sides.length).toBeGreaterThan(0);
    expect(computed.grid.coveredArea).toBeCloseTo(computed.tiledArea);
  });

  test('computes a project with a single added rectangle', () => {
    const rects: RectOp[] = [
      { id: 'rect-single', x: 0, y: 0, w: 120, h: 96, op: 'add' },
    ];
    const singleRectProject: Project = {
      ...makeDefaultProject(),
      rects,
      sideAssignments: assignAllSides(rects, 'trim'),
    };

    // Regression: 1-rect deck must not crash (buildShape MultiPoly invariant).
    expect(() => computeProject(singleRectProject)).not.toThrow();
    const computed = computeProject(singleRectProject);

    expect(computed.footprintArea).toBeGreaterThan(0);
    expect(computed.tiledArea).toBeGreaterThan(0);
    expect(computed.tiles.totalCells).toBeGreaterThan(0);
  });
});
