import { useMemo } from 'react';
import type { Computed } from '../compute';
import type { Unit } from '../types';
import { formatArea, formatLength, fromInches, roundDisplay, UNIT_LABELS } from '../units';
import { Section } from '../components/ui';

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold text-slate-800">{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export function ResultsPanel({ computed, unit }: { computed: Computed; unit: Unit }) {
  const { tiles, borders } = computed;

  const cutList = useMemo(() => {
    const groups = new Map<string, { w: number; h: number; count: number; lcut: boolean }>();
    for (const c of computed.grid.cells) {
      if (c.kind !== 'cut') continue;
      const w = c.cutBBox.maxX - c.cutBBox.minX;
      const h = c.cutBBox.maxY - c.cutBBox.minY;
      const key = `${roundDisplay(w, 2)}x${roundDisplay(h, 2)}x${c.rectangular ? 'r' : 'l'}`;
      const g = groups.get(key);
      if (g) g.count++;
      else groups.set(key, { w, h, count: 1, lcut: !c.rectangular });
    }
    return [...groups.values()].sort((a, b) => b.count - a.count);
  }, [computed.grid.cells]);

  return (
    <div className="space-y-3">
      <Section title="Tiles">
        <div className="grid grid-cols-2 gap-2">
          <Stat
            label={computed.inset ? 'Footprint area' : 'Deck area'}
            value={formatArea(computed.footprintArea, unit)}
            sub={`${roundDisplay(computed.footprintArea / 144, 2)} ft\u00b2`}
          />
          {computed.inset ? (
            <Stat
              label="Tiled area"
              value={formatArea(computed.tiledArea, unit)}
              sub="after trim inset"
            />
          ) : (
            <Stat label="Tiles laid" value={String(tiles.totalCells)} />
          )}
          <Stat label="Full tiles" value={String(tiles.fullCount)} />
          <Stat label="Cut tiles" value={String(tiles.cutCount)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat
            label="Buy (safe)"
            value={String(tiles.safePurchase)}
            sub={`no offcut reuse \u00b7 waste ${roundDisplay(tiles.wasteSafe / 144, 1)} ft\u00b2`}
          />
          <Stat
            label="Buy (with reuse)"
            value={String(tiles.reusePurchase)}
            sub={`optimistic \u00b7 waste ${roundDisplay(tiles.wasteReuse / 144, 1)} ft\u00b2`}
          />
        </div>
        <p className="text-xs text-slate-400">
          "With reuse" is an optimistic estimate that assumes offcuts can be reused where geometry allows.
          "Safe" counts one tile per cut location.
        </p>
      </Section>

      <Section title="Borders">
        {borders.byType.length === 0 ? (
          <p className="text-sm text-slate-500">No borders assigned.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="py-1">Type</th>
                <th>Length</th>
                <th className="text-right">Pieces</th>
                <th className="text-right">Corners</th>
              </tr>
            </thead>
            <tbody>
              {borders.byType.map((b) => (
                <tr key={b.typeId} className="border-t border-slate-100">
                  <td className="py-1">
                    <span className="mr-1 inline-block h-3 w-3 rounded-sm align-middle" style={{ background: b.color }} />
                    {b.name}
                  </td>
                  <td>{formatLength(b.linearLength, unit)}</td>
                  <td className="text-right">{b.pieces}</td>
                  <td className="text-right">
                    {b.hasCornerPieces ? `${b.outsideCorners} out / ${b.insideCorners} in` : '\u2014'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-xs text-slate-400">
          Total bordered corners: {borders.totalOutsideCorners} outside, {borders.totalInsideCorners} inside
          {borders.mixedCorners > 0 ? ` (${borders.mixedCorners} mixed-type)` : ''}.
        </p>
      </Section>

      <Section title="Posts">
        {computed.posts.total === 0 ? (
          <p className="text-sm text-slate-500">
            No posts placed. Pick a post type in the diagram toolbar, then click an edge to place one.
          </p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="py-1">Type</th>
                  <th className="text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                {computed.posts.byType.map((p) => (
                  <tr key={p.typeId} className="border-t border-slate-100">
                    <td className="py-1">
                      <span className="mr-1 inline-block h-3 w-3 rounded-sm align-middle" style={{ background: p.color }} />
                      {p.name}
                    </td>
                    <td className="text-right">{p.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-slate-400">Total posts: {computed.posts.total}.</p>
          </>
        )}
      </Section>

      <Section title="Cut list">
        {cutList.length === 0 ? (
          <p className="text-sm text-slate-500">No cut tiles needed.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="py-1">Piece size</th>
                <th className="text-right">Qty</th>
              </tr>
            </thead>
            <tbody>
              {cutList.map((c, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="py-1">
                    {roundDisplay(fromInches(c.w, unit), 2)} {'\u00d7'} {roundDisplay(fromInches(c.h, unit), 2)}{' '}
                    {UNIT_LABELS[unit]}
                    {c.lcut && <span className="ml-1 text-xs text-orange-500">(L-cut)</span>}
                  </td>
                  <td className="text-right">{c.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}
