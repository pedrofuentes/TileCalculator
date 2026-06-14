import type { BorderType, PostType, Project, RectOp, SideAssignment } from '../types';
import { buildShape } from '../geometry/shape';
import { deriveSides } from '../geometry/sides';

let idCounter = 0;
export function uid(prefix = 'id'): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

export const TRIM: BorderType = {
  id: 'trim',
  name: 'Trim (end)',
  faceWidth: 1.5625,
  pieceLength: 12,
  hasCornerPieces: true,
  color: '#b45309',
};

export const FASCIA: BorderType = {
  id: 'fascia',
  name: 'Fascia (gradient)',
  faceWidth: 2,
  pieceLength: 12,
  hasCornerPieces: true,
  color: '#0e7490',
};

export const RAILING_POST: PostType = {
  id: 'railing-4x4',
  name: 'Railing 4\u00d74',
  width: 3.5,
  depth: 3.5,
  color: '#7c3aed',
};

export const POST_2X4: PostType = {
  id: 'post-2x4',
  name: 'Post 2\u00d74',
  width: 3.5,
  depth: 1.5,
  color: '#be123c',
};

// L-shaped deck: NewTechWood first use case.
// Outer length 348" (X), outer width 184.5" (Y).
// Horizontal arm thickness 120.875" (Y), vertical arm thickness 90.25" (X).
export function defaultRects(): RectOp[] {
  return [
    { id: uid('rect'), x: 0, y: 0, w: 348, h: 120.875, op: 'add' },
    { id: uid('rect'), x: 0, y: 0, w: 90.25, h: 184.5, op: 'add' },
  ];
}

/** Assign every derived side of the shape to the given border type id (or null). */
export function assignAllSides(
  rects: RectOp[],
  borderTypeId: string | null,
): SideAssignment[] {
  const deck = buildShape(rects);
  const { sides } = deriveSides(deck);
  return sides.map((s) => ({ sideId: s.id, borderTypeId }));
}

export function makeDefaultProject(): Project {
  const rects = defaultRects();
  return {
    name: 'NewTechWood L-Deck',
    unit: 'in',
    rects,
    tile: { width: 12, height: 12, gap: 0, slats: 3, directional: true },
    borderTypes: [TRIM, FASCIA],
    sideAssignments: assignAllSides(rects, TRIM.id),
    postTypes: [RAILING_POST, POST_2X4],
    posts: [],
    grid: { mode: 'auto', offsetX: 0, offsetY: 0, cutSides: [] },
    layoutPattern: 'checkerboard',
    grainDirection: 'horizontal',
    interlockReuse: true,
    dimensionBasis: 'tileField',
  };
}

/** Backfill fields added in later versions so older saved projects load cleanly. */
export function normalizeProject(p: Project): Project {
  return {
    ...p,
    name: p.name ?? 'Imported deck',
    rects: Array.isArray(p.rects) ? p.rects : [],
    unit: p.unit ?? 'in',
    tile: {
      ...p.tile,
      width: p.tile?.width ?? 12,
      height: p.tile?.height ?? 12,
      gap: p.tile?.gap ?? 0,
      slats: p.tile?.slats ?? 3,
      directional: p.tile?.directional ?? true,
    },
    borderTypes: p.borderTypes ?? [],
    sideAssignments: p.sideAssignments ?? [],
    postTypes: (p.postTypes ?? []).map((t) => ({ ...t, margin: t.margin ?? 0 })),
    posts: p.posts ?? [],
    grid: {
      ...p.grid,
      mode: p.grid?.mode ?? 'auto',
      offsetX: p.grid?.offsetX ?? 0,
      offsetY: p.grid?.offsetY ?? 0,
      cutSides: p.grid?.cutSides ?? [],
    },
    layoutPattern: p.layoutPattern ?? 'checkerboard',
    grainDirection: p.grainDirection ?? 'horizontal',
    interlockReuse: p.interlockReuse ?? true,
    dimensionBasis: p.dimensionBasis ?? 'tileField',
  };
}
