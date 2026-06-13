import type { BorderType, SideAssignment } from '../types';
import type { Corner, Side } from '../geometry/sides';

export interface BorderTypeResult {
  typeId: string;
  name: string;
  color: string;
  hasCornerPieces: boolean;
  linearLength: number;
  pieces: number;
  outsideCorners: number;
  insideCorners: number;
}

export interface BorderResult {
  byType: BorderTypeResult[];
  totalOutsideCorners: number;
  totalInsideCorners: number;
  mixedCorners: number;
}

export function computeBorders(
  sides: Side[],
  corners: Corner[],
  assignments: SideAssignment[],
  borderTypes: BorderType[],
): BorderResult {
  const assignMap = new Map<string, string | null>();
  for (const a of assignments) assignMap.set(a.sideId, a.borderTypeId);

  const typeMap = new Map<string, BorderType>();
  for (const t of borderTypes) typeMap.set(t.id, t);

  const results = new Map<string, BorderTypeResult>();
  const ensure = (t: BorderType): BorderTypeResult => {
    let r = results.get(t.id);
    if (!r) {
      r = {
        typeId: t.id,
        name: t.name,
        color: t.color,
        hasCornerPieces: t.hasCornerPieces,
        linearLength: 0,
        pieces: 0,
        outsideCorners: 0,
        insideCorners: 0,
      };
      results.set(t.id, r);
    }
    return r;
  };

  for (const side of sides) {
    const typeId = assignMap.get(side.id) ?? null;
    if (!typeId) continue;
    const t = typeMap.get(typeId);
    if (!t) continue;
    const r = ensure(t);
    r.linearLength += side.length;
    r.pieces += t.pieceLength > 0 ? Math.ceil(side.length / t.pieceLength) : 0;
  }

  let totalOutside = 0;
  let totalInside = 0;
  let mixed = 0;
  for (const corner of corners) {
    const prevType = assignMap.get(corner.prevSideId) ?? null;
    const nextType = assignMap.get(corner.nextSideId) ?? null;
    if (!prevType || !nextType) continue; // corner only needed if both sides bordered
    if (corner.type === 'outside') totalOutside++;
    else totalInside++;
    if (prevType === nextType) {
      const t = typeMap.get(prevType);
      if (t) {
        const r = ensure(t);
        if (corner.type === 'outside') r.outsideCorners++;
        else r.insideCorners++;
      }
    } else {
      mixed++;
    }
  }

  return {
    byType: [...results.values()],
    totalOutsideCorners: totalOutside,
    totalInsideCorners: totalInside,
    mixedCorners: mixed,
  };
}
