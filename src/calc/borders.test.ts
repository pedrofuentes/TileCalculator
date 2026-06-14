import { describe, test, expect } from 'vitest';
import { computeProject } from '../compute';
import { TRIM, makeDefaultProject } from '../state/defaults';
import { computeBorders } from './borders';
import type { BorderResult, BorderTypeResult } from './borders';

describe('computeBorders', () => {
  test('computes trim border quantities for the default deck outside edges', () => {
    const project = makeDefaultProject();
    const computed = computeProject(project);

    const result: BorderResult = computeBorders(
      computed.shape.sides,
      computed.shape.corners,
      project.sideAssignments,
      project.borderTypes,
    );

    const trimResult: BorderTypeResult | undefined = result.byType.find(
      (entry) => entry.typeId === TRIM.id,
    );

    expect(result).toEqual(computed.borders);
    expect(result.byType).toHaveLength(1);
    expect(trimResult).toBeDefined();
    if (trimResult === undefined) {
      throw new Error('Expected default deck to include trim border results');
    }
    expect(trimResult.name).toBe(TRIM.name);
    expect(trimResult.color).toBe(TRIM.color);
    expect(trimResult.hasCornerPieces).toBe(TRIM.hasCornerPieces);
    expect(trimResult.linearLength).toBeGreaterThan(0);
    expect(trimResult.pieces).toBeGreaterThan(0);
    expect(trimResult.outsideCorners).toBeGreaterThan(0);
    expect(trimResult.insideCorners).toBeGreaterThanOrEqual(0);
    expect(result.totalOutsideCorners).toBeGreaterThan(0);
    expect(result.totalInsideCorners).toBeGreaterThanOrEqual(0);
    expect(result.mixedCorners).toBe(0);
    expect(trimResult.outsideCorners).toBe(result.totalOutsideCorners);
    expect(trimResult.insideCorners).toBe(result.totalInsideCorners);
  });

  test('returns empty totals for minimal inputs without assignments', () => {
    expect(() => computeBorders([], [], [], [])).not.toThrow();
    expect(computeBorders([], [], [], [])).toEqual({
      byType: [],
      totalOutsideCorners: 0,
      totalInsideCorners: 0,
      mixedCorners: 0,
    });
  });
});
