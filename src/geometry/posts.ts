import polygonClipping from 'polygon-clipping';
import type { Post, PostType } from '../types';
import type { MultiPoly, Pt, Ring } from './polygon';
import type { Side } from './sides';

export interface PostShape {
  post: Post;
  type: PostType;
  /** Footprint corner ring (closed) in inches. */
  ring: Ring;
  /** Footprint center point in inches. */
  center: Pt;
  /** Rotation of the footprint (degrees) so width runs along the edge. */
  angleDeg: number;
}

export interface PostsGeometry {
  shapes: PostShape[];
  /** Union of all footprints, for subtracting from the tile field. */
  footprints: MultiPoly;
}

/**
 * Build post footprint rectangles. Each post sits flush INSIDE its edge at `pos`
 * along the side: width runs along the edge, depth extends inward (opposite the
 * outward normal). Returns render shapes plus the union of all footprints.
 */
export function buildPostShapes(
  sides: Side[],
  posts: Post[],
  postTypes: PostType[],
): PostsGeometry {
  const sideMap = new Map<string, Side>();
  for (const s of sides) sideMap.set(s.id, s);
  const typeMap = new Map<string, PostType>();
  for (const t of postTypes) typeMap.set(t.id, t);

  const shapes: PostShape[] = [];
  const rings: MultiPoly = [];

  for (const post of posts) {
    const side = sideMap.get(post.sideId);
    const type = typeMap.get(post.postTypeId);
    if (!side || !type) continue;

    const len = side.length;
    if (len <= 0) continue;
    const ux = (side.b[0] - side.a[0]) / len;
    const uy = (side.b[1] - side.a[1]) / len;
    // Inward = opposite the outward normal.
    const ix = -side.outward[0];
    const iy = -side.outward[1];

    const pos = Math.max(0, Math.min(len, post.pos));
    const cx = side.a[0] + ux * pos;
    const cy = side.a[1] + uy * pos;
    const hw = type.width / 2;
    const d = type.depth;
    const m = post.margin ?? type.margin ?? 0;

    const p1: Pt = [cx - ux * hw + ix * m, cy - uy * hw + iy * m];
    const p2: Pt = [cx + ux * hw + ix * m, cy + uy * hw + iy * m];
    const p3: Pt = [p2[0] + ix * d, p2[1] + iy * d];
    const p4: Pt = [p1[0] + ix * d, p1[1] + iy * d];
    const ring: Ring = [p1, p2, p3, p4, p1];

    shapes.push({
      post,
      type,
      ring,
      center: [cx + ix * (m + d / 2), cy + iy * (m + d / 2)],
      angleDeg: (Math.atan2(uy, ux) * 180) / Math.PI,
    });
    rings.push([ring]);
  }

  let footprints: MultiPoly = [];
  if (rings.length === 1) {
    // Single post: no union needed, use the ring directly.
    footprints = [rings[0]];
  } else if (rings.length > 1) {
    // Batch all footprints into a single union call instead of accumulating
    // pairwise (which was O(P^2) in the post count).
    footprints = polygonClipping.union(
      rings[0] as never,
      ...(rings.slice(1) as never[]),
    ) as unknown as MultiPoly;
  }

  return { shapes, footprints };
}
