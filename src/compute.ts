import polygonClipping from 'polygon-clipping';
import type { Project } from './types';
import type { BBox, MultiPoly } from './geometry/polygon';
import { multiPolyArea, multiPolyBBox } from './geometry/polygon';
import { buildShape } from './geometry/shape';
import { deriveSides, type ShapeSides } from './geometry/sides';
import { classifyGrid, type GridResult } from './geometry/grid';
import { optimizeOffset, type FlushTarget } from './geometry/optimize';
import { insetTileField } from './geometry/inset';
import { buildPostShapes, type PostShape } from './geometry/posts';
import { computeTiles, type TileResult } from './calc/tiles';
import { computeBorders, type BorderResult } from './calc/borders';

const AXIS_EPS = 1e-6;

export interface PostsSummary {
  shapes: PostShape[];
  byType: { typeId: string; name: string; color: string; count: number }[];
  total: number;
}

export interface Computed {
  /** Full deck footprint (used for sides, borders and the base outline). */
  deck: MultiPoly;
  /** Region actually covered by tiles (inset by trim when basis is totalFootprint). */
  tileDeck: MultiPoly;
  bbox: BBox;
  /** Area of the full footprint. */
  footprintArea: number;
  /** Area covered by tiles. */
  tiledArea: number;
  inset: boolean;
  shape: ShapeSides;
  grid: GridResult;
  offsetX: number;
  offsetY: number;
  tiles: TileResult;
  borders: BorderResult;
  posts: PostsSummary;
}

export function computeProject(project: Project): Computed {
  const deck = buildShape(project.rects);
  const footprintArea = multiPolyArea(deck);
  const bbox =
    deck.length > 0
      ? multiPolyBBox(deck)
      : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const shape = deriveSides(deck);

  const basis = project.dimensionBasis ?? 'tileField';
  const inset = basis === 'totalFootprint';
  const insetDeck = inset
    ? insetTileField(deck, shape.sides, project.sideAssignments, project.borderTypes)
    : deck;

  // Posts notch the tiles they overlap: subtract their footprints from the tile field.
  const postGeom = buildPostShapes(
    shape.sides,
    project.posts ?? [],
    project.postTypes ?? [],
  );
  const tileDeck =
    postGeom.footprints.length > 0
      ? (polygonClipping.difference(
          insetDeck as never,
          postGeom.footprints as never,
        ) as unknown as MultiPoly)
      : insetDeck;
  const tiledArea = multiPolyArea(tileDeck);

  let offsetX = project.grid.offsetX;
  let offsetY = project.grid.offsetY;
  let grid: GridResult;
  if (project.grid.mode === 'auto') {
    const targets = buildFlushTargets(project, shape, inset);
    const opt = optimizeOffset(tileDeck, project.tile, targets);
    offsetX = opt.offsetX;
    offsetY = opt.offsetY;
    grid = opt.grid;
  } else {
    grid = classifyGrid(tileDeck, project.tile, offsetX, offsetY);
  }

  const tileArea = project.tile.width * project.tile.height;
  const tiles = computeTiles(grid, tiledArea, tileArea);
  const borders = computeBorders(
    shape.sides,
    shape.corners,
    project.sideAssignments,
    project.borderTypes,
  );
  const posts = summarizePosts(postGeom.shapes);

  return {
    deck,
    tileDeck,
    bbox,
    footprintArea,
    tiledArea,
    inset,
    shape,
    grid,
    offsetX,
    offsetY,
    tiles,
    borders,
    posts,
  };
}

function summarizePosts(shapes: PostShape[]): PostsSummary {
  const byTypeMap = new Map<string, { typeId: string; name: string; color: string; count: number }>();
  for (const s of shapes) {
    const entry = byTypeMap.get(s.type.id);
    if (entry) entry.count++;
    else byTypeMap.set(s.type.id, { typeId: s.type.id, name: s.type.name, color: s.type.color, count: 1 });
  }
  return { shapes, byType: [...byTypeMap.values()], total: shapes.length };
}

/**
 * Build the "keep-full" flush targets that bias the grid offset so full tiles
 * sit flush against edges the user did NOT mark as cut sides. Returns [] when no
 * cut sides are marked, preserving the legacy minimize-cuts behavior.
 */
function buildFlushTargets(
  project: Project,
  shape: ShapeSides,
  inset: boolean,
): FlushTarget[] {
  const cutSet = new Set(project.grid.cutSides ?? []);
  if (cutSet.size === 0) return [];

  const assignMap = new Map<string, string | null>();
  for (const a of project.sideAssignments) assignMap.set(a.sideId, a.borderTypeId);
  const typeMap = new Map<string, (typeof project.borderTypes)[number]>();
  for (const t of project.borderTypes) typeMap.set(t.id, t);

  const targets: FlushTarget[] = [];
  for (const side of shape.sides) {
    if (cutSet.has(side.id)) continue; // cut side: no flush requirement
    const vertical = Math.abs(side.a[0] - side.b[0]) < AXIS_EPS;
    const horizontal = Math.abs(side.a[1] - side.b[1]) < AXIS_EPS;
    if (!vertical && !horizontal) continue; // skip diagonals

    const axis: 'x' | 'y' = vertical ? 'x' : 'y';
    const coord = vertical ? side.a[0] : side.a[1];
    const outwardComp = vertical ? side.outward[0] : side.outward[1];

    // Trim inset moves the tile-field boundary inward on bordered sides.
    let faceWidth = 0;
    if (inset) {
      const typeId = assignMap.get(side.id);
      const t = typeId ? typeMap.get(typeId) : undefined;
      if (t && t.faceWidth > 0) faceWidth = t.faceWidth;
    }
    const cf = coord - outwardComp * faceWidth; // inward = -outward
    const tileSize = vertical ? project.tile.width : project.tile.height;
    // interior on the greater-coord side -> tile's near (min) edge sits at cf;
    // interior on the lesser-coord side -> tile's far (max) edge sits at cf.
    const interiorSign = -Math.sign(outwardComp);
    const L = interiorSign > 0 ? cf : cf - tileSize;

    targets.push({ axis, L, length: side.length });
  }
  return targets;
}
