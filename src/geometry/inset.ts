import polygonClipping from 'polygon-clipping';
import type { BorderType, SideAssignment } from '../types';
import type { MultiPoly, Ring } from './polygon';
import type { Side } from './sides';

// When the deck dimensions represent the TOTAL footprint (tiles + trim must fit
// within them), the tile field is inset inward on every bordered side by that
// border's face width. We do this by subtracting a thin inward strip along each
// bordered edge from the deck polygon.
export function insetTileField(
  deck: MultiPoly,
  sides: Side[],
  assignments: SideAssignment[],
  borderTypes: BorderType[],
): MultiPoly {
  const assignMap = new Map<string, string | null>();
  for (const a of assignments) assignMap.set(a.sideId, a.borderTypeId);
  const typeMap = new Map<string, BorderType>();
  for (const t of borderTypes) typeMap.set(t.id, t);

  const strips: MultiPoly = [];
  for (const side of sides) {
    const typeId = assignMap.get(side.id);
    if (!typeId) continue;
    const t = typeMap.get(typeId);
    if (!t || t.faceWidth <= 0) continue;
    const f = t.faceWidth;
    // Inward = opposite of the outward normal.
    const ix = -side.outward[0] * f;
    const iy = -side.outward[1] * f;
    const [ax, ay] = side.a;
    const [bx, by] = side.b;
    const ring: Ring = [
      [ax, ay],
      [bx, by],
      [bx + ix, by + iy],
      [ax + ix, ay + iy],
      [ax, ay],
    ];
    strips.push([ring]);
  }

  if (strips.length === 0) return deck;

  let union: MultiPoly = [strips[0]];
  for (let i = 1; i < strips.length; i++) {
    union = polygonClipping.union(union as never, [strips[i]] as never) as unknown as MultiPoly;
  }

  return polygonClipping.difference(deck as never, union as never) as unknown as MultiPoly;
}
