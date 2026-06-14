import { describe, test, expect } from 'vitest';
import type { Project, RectOp } from '../types';
import { makeDefaultProject, normalizeProject, sampleProject } from './defaults';

const projectKeys: (keyof Project)[] = [
  'name',
  'unit',
  'rects',
  'tile',
  'borderTypes',
  'sideAssignments',
  'postTypes',
  'posts',
  'grid',
  'layoutPattern',
  'grainDirection',
  'interlockReuse',
  'dimensionBasis',
];

function expectNormalizedProjectShape(project: Project): void {
  for (const key of projectKeys) {
    expect(project).toHaveProperty(key);
  }
  expect(typeof project.name).toBe('string');
  expect(typeof project.unit).toBe('string');
  expect(Array.isArray(project.rects)).toBe(true);
  expect(typeof project.tile.width).toBe('number');
  expect(typeof project.tile.height).toBe('number');
  expect(typeof project.tile.gap).toBe('number');
  expect(typeof project.tile.slats).toBe('number');
  expect(typeof project.tile.directional).toBe('boolean');
  expect(Array.isArray(project.borderTypes)).toBe(true);
  expect(Array.isArray(project.sideAssignments)).toBe(true);
  expect(Array.isArray(project.postTypes)).toBe(true);
  expect(Array.isArray(project.posts)).toBe(true);
  expect(typeof project.grid.mode).toBe('string');
  expect(typeof project.grid.offsetX).toBe('number');
  expect(typeof project.grid.offsetY).toBe('number');
  expect(Array.isArray(project.grid.cutSides)).toBe(true);
  expect(typeof project.layoutPattern).toBe('string');
  expect(typeof project.grainDirection).toBe('string');
  expect(typeof project.interlockReuse).toBe('boolean');
  expect(typeof project.dimensionBasis).toBe('string');
}

describe('normalizeProject', () => {
  test('keeps a default project fully populated and idempotent', () => {
    const normalized = normalizeProject(makeDefaultProject());

    expectNormalizedProjectShape(normalized);
    expect(normalizeProject(normalized)).toEqual(normalized);
    expect(normalized.name).toBe('Tile1');
    expect(normalized.rects).toHaveLength(1);
    expect(normalized.borderTypes).toHaveLength(2);
    expect(normalized.sideAssignments.length).toBeGreaterThan(0);
    expect(normalized.postTypes).toHaveLength(2);
    expect(normalized.posts).toEqual([]);
    expect(normalized.tile).toEqual({
      width: 12,
      height: 12,
      gap: 0,
      slats: 3,
      directional: true,
    });
    expect(normalized.grid).toEqual({
      mode: 'auto',
      offsetX: 0,
      offsetY: 0,
      cutSides: [],
    });
    expect(normalized.layoutPattern).toBe('checkerboard');
    expect(normalized.grainDirection).toBe('horizontal');
    expect(normalized.interlockReuse).toBe(true);
    expect(normalized.dimensionBasis).toBe('tileField');
  });

  test('keeps the sample L-deck fixture as an irregular two-rect shape', () => {
    const normalized = normalizeProject(sampleProject());

    expectNormalizedProjectShape(normalized);
    expect(normalized.name).toBe('Sample L-Deck');
    expect(normalized.rects).toHaveLength(2);
    expect(normalized.sideAssignments.length).toBeGreaterThan(0);
  });

  test('backfills partial imports that only include rects', () => {
    const rects: RectOp[] = [
      { id: 'rect-legacy', x: 0, y: 0, w: 24, h: 24, op: 'add' },
    ];
    const legacyProject = { rects } as unknown as Project;

    // Regression: partial imports must be fully backfilled (white-screen crash otherwise).
    expect(() => normalizeProject(legacyProject)).not.toThrow();
    const normalized = normalizeProject(legacyProject);

    expectNormalizedProjectShape(normalized);
    expect(normalized.rects).toEqual(rects);
    expect(normalized.tile).toEqual({
      width: 12,
      height: 12,
      gap: 0,
      slats: 3,
      directional: true,
    });
    expect(normalized.grid).toEqual({
      mode: 'auto',
      offsetX: 0,
      offsetY: 0,
      cutSides: [],
    });
    expect(normalized.borderTypes).toEqual([]);
    expect(normalized.sideAssignments).toEqual([]);
    expect(normalized.postTypes).toEqual([]);
    expect(normalized.posts).toEqual([]);
    expect(normalized.name).toBe('Imported deck');
    expect(normalized.unit).toBe('in');
  });
});
