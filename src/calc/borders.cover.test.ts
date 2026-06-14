import { describe, test, expect } from 'vitest';
import { deriveSides } from '../geometry/sides';
import { buildShape } from '../geometry/shape';
import { FASCIA, TRIM, defaultRects } from '../state/defaults';
import type { BorderType, SideAssignment } from '../types';
import { computeBorders } from './borders';

const ZERO_LENGTH_BORDER: BorderType = {
  id: 'zero-length',
  name: 'Zero length pieces',
  faceWidth: 1,
  pieceLength: 0,
  hasCornerPieces: false,
  color: '#111827',
};

function defaultShape() {
  return deriveSides(buildShape(defaultRects()));
}

describe('computeBorders coverage edges', () => {
  test('computes fascia quantities when every side uses the gradient border type', () => {
    const shape = defaultShape();
    const assignments: SideAssignment[] = shape.sides.map((side) => ({
      sideId: side.id,
      borderTypeId: FASCIA.id,
    }));

    const result = computeBorders(shape.sides, shape.corners, assignments, [TRIM, FASCIA]);
    const fasciaResult = result.byType.find((entry) => entry.typeId === FASCIA.id);

    expect(result.byType).toHaveLength(1);
    expect(fasciaResult).toBeDefined();
    expect(fasciaResult?.name).toBe(FASCIA.name);
    expect(fasciaResult?.color).toBe(FASCIA.color);
    expect(fasciaResult?.hasCornerPieces).toBe(FASCIA.hasCornerPieces);
    expect(fasciaResult?.linearLength).toBeGreaterThan(0);
    expect(fasciaResult?.pieces).toBeGreaterThan(0);
    expect(fasciaResult?.outsideCorners).toBe(result.totalOutsideCorners);
    expect(fasciaResult?.insideCorners).toBe(result.totalInsideCorners);
    expect(result.mixedCorners).toBe(0);
  });

  test('counts mixed corners while tolerating null, missing, and zero-length border assignments', () => {
    const shape = defaultShape();
    const ids = shape.sides.map((side) => side.id);
    const borderIds = [
      TRIM.id,
      FASCIA.id,
      ZERO_LENGTH_BORDER.id,
      'missing-border-type',
      null,
      TRIM.id,
    ];
    const assignments: SideAssignment[] = ids.map((sideId, index) => ({
      sideId,
      borderTypeId: borderIds[index % borderIds.length],
    }));

    const result = computeBorders(shape.sides, shape.corners, assignments, [
      TRIM,
      FASCIA,
      ZERO_LENGTH_BORDER,
    ]);
    const zeroLengthResult = result.byType.find(
      (entry) => entry.typeId === ZERO_LENGTH_BORDER.id,
    );

    expect(result.byType.map((entry) => entry.typeId)).toEqual(
      expect.arrayContaining([TRIM.id, FASCIA.id, ZERO_LENGTH_BORDER.id]),
    );
    expect(zeroLengthResult?.pieces).toBe(0);
    expect(result.mixedCorners).toBeGreaterThan(0);
    expect(result.totalOutsideCorners + result.totalInsideCorners).toBeGreaterThan(
      result.mixedCorners,
    );
  });

  test('counts same-type corners even when the assigned border type is unavailable', () => {
    const shape = deriveSides(
      buildShape([{ id: 'rect', x: 0, y: 0, w: 24, h: 12, op: 'add' }]),
    );
    const assignments: SideAssignment[] = shape.sides.map((side) => ({
      sideId: side.id,
      borderTypeId: 'missing-border-type',
    }));

    const result = computeBorders(shape.sides, shape.corners, assignments, []);

    expect(result.byType).toEqual([]);
    expect(result.totalOutsideCorners).toBe(4);
    expect(result.totalInsideCorners).toBe(0);
    expect(result.mixedCorners).toBe(0);
  });
});
