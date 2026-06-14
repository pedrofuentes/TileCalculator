import { describe, test, expect } from 'vitest';
import type { Project } from '../types';
import { makeDefaultProject, normalizeProject } from '../state/defaults';
import { exportProjectJSON, parseProjectJSON } from './storage';

function expectProjectDefaults(project: Project): void {
  expect(typeof project.name).toBe('string');
  expect(typeof project.unit).toBe('string');
  expect(Array.isArray(project.rects)).toBe(true);
  expect(project.tile).toEqual({
    width: 12,
    height: 12,
    gap: 0,
    slats: 3,
    directional: true,
  });
  expect(Array.isArray(project.borderTypes)).toBe(true);
  expect(Array.isArray(project.sideAssignments)).toBe(true);
  expect(Array.isArray(project.postTypes)).toBe(true);
  expect(Array.isArray(project.posts)).toBe(true);
  expect(project.grid).toEqual({
    mode: 'auto',
    offsetX: 0,
    offsetY: 0,
    cutSides: [],
  });
  expect(typeof project.layoutPattern).toBe('string');
  expect(typeof project.grainDirection).toBe('string');
  expect(typeof project.interlockReuse).toBe('boolean');
  expect(typeof project.dimensionBasis).toBe('string');
}

describe('project JSON storage helpers', () => {
  test('round-trips an exported default project as normalized data', () => {
    const project = makeDefaultProject();
    const parsed = parseProjectJSON(exportProjectJSON(project));

    expect(parsed).toEqual(normalizeProject(project));
  });

  test('parses partial project JSON as a normalized project', () => {
    expect(() => parseProjectJSON('{"rects":[]}')).not.toThrow();
    const parsed = parseProjectJSON('{"rects":[]}');

    expectProjectDefaults(parsed);
    expect(parsed.rects).toEqual([]);
    expect(parsed.name).toBe('Imported deck');
    expect(parsed.unit).toBe('in');
  });

  test('throws a friendly error for malformed JSON', () => {
    expect(() => parseProjectJSON('not json')).toThrow('File is not valid JSON.');
  });
});
