import { describe, test, expect } from 'vitest';
import type { BorderType, SideAssignment } from '../types';
import { buildShape } from './shape';
import { deriveSides } from './sides';
import { insetTileField } from './inset';
import { multiPolyArea, multiPolyBBox } from './polygon';

const borderOne: BorderType = {
  id: 'one-inch-border',
  name: 'One inch border',
  faceWidth: 1,
  pieceLength: 12,
  hasCornerPieces: true,
  color: '#111111',
};

const borderTwo: BorderType = {
  ...borderOne,
  id: 'two-inch-border',
  name: 'Two inch border',
  faceWidth: 2,
};

function rectangleDeck(width = 20, height = 10) {
  return buildShape([{ id: 'deck', x: 0, y: 0, w: width, h: height, op: 'add' }]);
}

describe('insetTileField', () => {
  test('returns the original deck when no sides have a border assignment', () => {
    const deck = rectangleDeck();
    const { sides } = deriveSides(deck);
    const assignments: SideAssignment[] = sides.map((side) => ({
      sideId: side.id,
      borderTypeId: null,
    }));

    const result = insetTileField(deck, sides, assignments, [borderOne]);

    expect(result).toBe(deck);
    expect(multiPolyArea(result)).toBeCloseTo(200);
  });

  test('ignores missing and zero-width border types', () => {
    const deck = rectangleDeck();
    const { sides } = deriveSides(deck);
    const zeroWidth: BorderType = { ...borderOne, id: 'zero-width', faceWidth: 0 };
    const assignments: SideAssignment[] = sides.map((side, index) => ({
      sideId: side.id,
      borderTypeId: index % 2 === 0 ? 'missing-border' : zeroWidth.id,
    }));

    const result = insetTileField(deck, sides, assignments, [zeroWidth]);

    expect(result).toBe(deck);
    expect(multiPolyArea(result)).toBeCloseTo(200);
  });

  test('subtracts one inward strip when a single side is assigned', () => {
    const deck = rectangleDeck();
    const { sides } = deriveSides(deck);
    const bottomSide = sides.find((side) => side.a[1] === 0 && side.b[1] === 0);
    expect(bottomSide).toBeDefined();
    const assignments: SideAssignment[] = [{ sideId: bottomSide!.id, borderTypeId: borderOne.id }];

    const result = insetTileField(deck, sides, assignments, [borderOne]);

    expect(multiPolyArea(result)).toBeCloseTo(180);
    expect(multiPolyBBox(result)).toEqual({ minX: 0, minY: 1, maxX: 20, maxY: 10 });
  });

  test('unions per-side strips before subtracting varied border widths', () => {
    const deck = rectangleDeck();
    const { sides } = deriveSides(deck);
    const bottomSide = sides.find((side) => side.a[1] === 0 && side.b[1] === 0);
    const leftSide = sides.find((side) => side.a[0] === 0 && side.b[0] === 0);
    expect(bottomSide).toBeDefined();
    expect(leftSide).toBeDefined();
    const assignments: SideAssignment[] = [
      { sideId: bottomSide!.id, borderTypeId: borderOne.id },
      { sideId: leftSide!.id, borderTypeId: borderTwo.id },
    ];

    const result = insetTileField(deck, sides, assignments, [borderOne, borderTwo]);

    expect(multiPolyArea(result)).toBeCloseTo(162);
    expect(multiPolyArea(result)).toBeLessThan(multiPolyArea(deck));
    expect(multiPolyBBox(result)).toEqual({ minX: 2, minY: 1, maxX: 20, maxY: 10 });
  });
});
