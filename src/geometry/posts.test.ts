import { describe, test, expect } from 'vitest';
import type { Post, PostType } from '../types';
import type { Side } from './sides';
import { POST_2X4, RAILING_POST } from '../state/defaults';
import { buildShape } from './shape';
import { deriveSides } from './sides';
import { buildPostShapes } from './posts';
import { multiPolyArea } from './polygon';

function rectangleSides(): Side[] {
  const deck = buildShape([{ id: 'deck', x: 0, y: 0, w: 40, h: 20, op: 'add' }]);
  return deriveSides(deck).sides;
}

function horizontalSide(sides: Side[]): Side {
  const side = sides.find((candidate) => candidate.a[1] === 0 && candidate.b[1] === 0);
  expect(side).toBeDefined();
  return side!;
}

function verticalSide(sides: Side[]): Side {
  const side = sides.find((candidate) => candidate.a[0] === 40 && candidate.b[0] === 40);
  expect(side).toBeDefined();
  return side!;
}

describe('buildPostShapes', () => {
  test('builds a single post footprint flush inside its side', () => {
    const sides = rectangleSides();
    const side = horizontalSide(sides);
    const posts: Post[] = [{ id: 'post-1', sideId: side.id, postTypeId: RAILING_POST.id, pos: 10 }];

    const geometry = buildPostShapes(sides, posts, [RAILING_POST]);

    expect(geometry.shapes).toHaveLength(1);
    expect(geometry.footprints).toHaveLength(1);
    expect(multiPolyArea(geometry.footprints)).toBeCloseTo(RAILING_POST.width * RAILING_POST.depth);
    expect(geometry.shapes[0].center).toEqual([10, RAILING_POST.depth / 2]);
    expect(geometry.shapes[0].angleDeg).toBeCloseTo(0);
  });

  test('skips posts with unknown sides, unknown types, or zero-length sides', () => {
    const sides = rectangleSides();
    const side = horizontalSide(sides);
    const zeroLengthSide: Side = {
      id: 'zero-length',
      a: [5, 5],
      b: [5, 5],
      length: 0,
      mid: [5, 5],
      outward: [0, -1],
    };
    const posts: Post[] = [
      { id: 'unknown-side', sideId: 'missing-side', postTypeId: RAILING_POST.id, pos: 4 },
      { id: 'unknown-type', sideId: side.id, postTypeId: 'missing-type', pos: 8 },
      { id: 'zero-side-post', sideId: zeroLengthSide.id, postTypeId: RAILING_POST.id, pos: 0 },
    ];

    const geometry = buildPostShapes([...sides, zeroLengthSide], posts, [RAILING_POST]);

    expect(geometry.shapes).toEqual([]);
    expect(geometry.footprints).toEqual([]);
  });

  test('unions multiple clamped posts using type and post margins', () => {
    const sides = rectangleSides();
    const bottom = horizontalSide(sides);
    const right = verticalSide(sides);
    const postTypeWithMargin: PostType = { ...POST_2X4, id: 'setback-2x4', margin: 0.5 };
    const posts: Post[] = [
      { id: 'bottom-post', sideId: bottom.id, postTypeId: RAILING_POST.id, pos: -10, margin: 1 },
      { id: 'right-post', sideId: right.id, postTypeId: postTypeWithMargin.id, pos: 999 },
    ];

    const geometry = buildPostShapes(sides, posts, [RAILING_POST, postTypeWithMargin]);

    expect(geometry.shapes).toHaveLength(2);
    expect(geometry.footprints.length).toBeGreaterThan(0);
    expect(multiPolyArea(geometry.footprints)).toBeCloseTo(
      RAILING_POST.width * RAILING_POST.depth + postTypeWithMargin.width * postTypeWithMargin.depth,
    );
    expect(geometry.shapes[0].center).toEqual([0, 1 + RAILING_POST.depth / 2]);
    expect(geometry.shapes[1].center[0]).toBeCloseTo(40 - (0.5 + postTypeWithMargin.depth / 2));
  });
});
