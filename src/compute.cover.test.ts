import { describe, expect, test } from 'vitest';
import type { Post, Project, RectOp } from './types';
import { computeProject } from './compute';
import { assignAllSides, makeDefaultProject } from './state/defaults';

type ComputedSide = ReturnType<typeof computeProject>['shape']['sides'][number];

const EPS = 1e-6;

function rectProject(rects: RectOp[]): Project {
  return {
    ...makeDefaultProject(),
    rects,
    sideAssignments: assignAllSides(rects, 'trim'),
  };
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < EPS;
}

function requireSide(project: Project, predicate: (side: ComputedSide) => boolean): ComputedSide {
  const side = computeProject(project).shape.sides.find(predicate);
  expect(side).toBeDefined();
  return side as ComputedSide;
}

function horizontalSideAt(y: number): (side: ComputedSide) => boolean {
  return (side) => nearlyEqual(side.a[1], y) && nearlyEqual(side.b[1], y);
}

function verticalSideAt(x: number): (side: ComputedSide) => boolean {
  return (side) => nearlyEqual(side.a[0], x) && nearlyEqual(side.b[0], x);
}

describe('computeProject coverage paths', () => {
  test('summarizes placed posts and subtracts their footprints in manual grid mode', () => {
    const base = rectProject([{ id: 'deck', x: 0, y: 0, w: 72, h: 48, op: 'add' }]);
    const bottomSide = requireSide(base, horizontalSideAt(0));
    const rightSide = requireSide(base, verticalSideAt(72));
    const postTypes = base.postTypes.map((type) =>
      type.id === 'post-2x4' ? { ...type, margin: 0.5 } : type,
    );
    const posts: Post[] = [
      { id: 'post-a', postTypeId: 'post-2x4', sideId: bottomSide.id, pos: 18 },
      { id: 'post-b', postTypeId: 'post-2x4', sideId: bottomSide.id, pos: 54, margin: 1 },
      { id: 'post-c', postTypeId: 'railing-4x4', sideId: rightSide.id, pos: 24 },
    ];
    const project: Project = {
      ...base,
      postTypes,
      posts,
      grid: { mode: 'manual', offsetX: 0, offsetY: 0, cutSides: [] },
    };

    const computed = computeProject(project);

    expect(computed.posts.total).toBe(3);
    expect(computed.posts.shapes).toHaveLength(3);
    expect(computed.posts.byType).toHaveLength(2);
    expect(computed.posts.byType.find((summary) => summary.typeId === 'post-2x4')?.count).toBe(2);
    expect(computed.posts.byType.find((summary) => summary.typeId === 'railing-4x4')?.count).toBe(1);
    expect(computed.tiledArea).toBeLessThan(computed.footprintArea);
    expect(computed.grid.coveredArea).toBeCloseTo(computed.tiledArea);
    expect(computed.tiles.deckArea).toBeCloseTo(computed.tiledArea);
  });

  test('dimension basis controls tile-field inset while cut sides produce flush targets', () => {
    const base = rectProject([{ id: 'deck', x: 0, y: 0, w: 60, h: 48, op: 'add' }]);
    const cutSide = requireSide(base, horizontalSideAt(0));
    const unborderedSide = requireSide(base, verticalSideAt(60));
    const sideAssignments = base.sideAssignments.map((assignment) =>
      assignment.sideId === unborderedSide.id ? { ...assignment, borderTypeId: null } : assignment,
    );
    const tileFieldProject: Project = {
      ...base,
      sideAssignments,
      grid: { ...base.grid, mode: 'auto', cutSides: [cutSide.id] },
      dimensionBasis: 'tileField',
    };
    const footprintProject: Project = {
      ...tileFieldProject,
      dimensionBasis: 'totalFootprint',
    };

    const tileField = computeProject(tileFieldProject);
    const footprint = computeProject(footprintProject);

    expect(tileField.inset).toBe(false);
    expect(tileField.tiledArea).toBeCloseTo(tileField.footprintArea);
    expect(tileField.grid.coveredArea).toBeCloseTo(tileField.tiledArea);
    expect(footprint.inset).toBe(true);
    expect(footprint.footprintArea).toBeCloseTo(60 * 48);
    expect(footprint.tiledArea).toBeGreaterThan(0);
    expect(footprint.tiledArea).toBeLessThan(footprint.footprintArea);
    expect(footprint.tileDeck.length).toBeGreaterThan(0);
    expect(footprint.grid.coveredArea).toBeCloseTo(footprint.tiledArea);
  });

  test('subtract rectangle notches reduce footprint area without throwing', () => {
    const additiveRects: RectOp[] = [
      { id: 'deck', x: 0, y: 0, w: 120, h: 96, op: 'add' },
    ];
    const notchedRects: RectOp[] = [
      ...additiveRects,
      { id: 'notch', x: 48, y: 0, w: 24, h: 24, op: 'subtract' },
    ];
    const additiveProject = rectProject(additiveRects);
    const notchedProject = rectProject(notchedRects);

    expect(() => computeProject(notchedProject)).not.toThrow();

    const additive = computeProject(additiveProject);
    const notched = computeProject(notchedProject);

    expect(additive.footprintArea).toBeCloseTo(120 * 96);
    expect(notched.footprintArea).toBeCloseTo(120 * 96 - 24 * 24);
    expect(notched.footprintArea).toBeLessThan(additive.footprintArea);
    expect(notched.tiledArea).toBeCloseTo(notched.footprintArea);
    expect(notched.grid.coveredArea).toBeCloseTo(notched.tiledArea);
  });

  test('empty manual project returns an empty computed shape', () => {
    const project: Project = {
      ...rectProject([]),
      sideAssignments: [],
      grid: { mode: 'manual', offsetX: 3, offsetY: 6, cutSides: [] },
    };

    const computed = computeProject(project);

    expect(computed.bbox).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
    expect(computed.footprintArea).toBe(0);
    expect(computed.tiledArea).toBe(0);
    expect(computed.grid.cells).toHaveLength(0);
    expect(computed.posts.total).toBe(0);
  });
});
