import { memo, useMemo } from 'react';
import type { Computed } from '../compute';
import type { Unit } from '../types';
import { formatArea, formatLength, fromInches, roundDisplay, UNIT_LABELS } from '../units';
import { cutNotch } from '../geometry/polygon';
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

export const ResultsPanel = memo(function ResultsPanel({ computed, unit }: { computed: Computed; unit: Unit }) {
  const { tiles, borders } = computed;

  const cutList = useMemo(() => {
    const groups = new Map<
      string,
      { w: number; h: number; count: number; lcut: boolean; notch: { w: number; h: number } | null }
    >();
    for (const c of computed.grid.cells) {
      if (c.kind !== 'cut') continue;
      const w = c.cutBBox.maxX - c.cutBBox.minX;
      const h = c.cutBBox.maxY - c.cutBBox.minY;
      const notch = c.rectangular ? null : cutNotch(c.covered, c.cutBBox);
      const notchKey = notch ? `${roundDisplay(notch.w, 2)}x${roundDisplay(notch.h, 2)}` : '';
      const key = `${roundDisplay(w, 2)}x${roundDisplay(h, 2)}x${c.rectangular ? 'r' : 'l'}x${notchKey}`;
      const g = groups.get(key);
      if (g) g.count++;
      else groups.set(key, { w, h, count: 1, lcut: !c.rectangular, notch });
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
            sub={
              tiles.interlockReuse
                ? `interlock pairing \u00b7 ${tiles.pairedOffcuts} offcuts reused \u00b7 waste ${roundDisplay(tiles.wasteReuse / 144, 1)} ft\u00b2`
                : `optimistic area \u00b7 waste ${roundDisplay(tiles.wasteReuse / 144, 1)} ft\u00b2`
            }
          />
        </div>
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-2">
          <div className="text-xs text-sky-700">Recommended order</div>
          <div className="text-lg font-semibold text-sky-800">
            {Math.ceil(tiles.safePurchase * 1.1)}
          </div>
          <div className="text-xs text-sky-600">
            +10% waste/contingency (industry standard for straight/grid layouts)
          </div>
        </div>
        {tiles.interlockReuse ? (
          <>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>Paired offcuts: <strong className="text-slate-700">{tiles.pairedOffcuts}</strong></span>
              <span>Own-tile pieces: <strong className="text-slate-700">{tiles.ownTilePieces}</strong></span>
              <span>Cut grain: <strong className="text-slate-700">{tiles.orientationTally.h} H</strong> / <strong className="text-slate-700">{tiles.orientationTally.v} V</strong></span>
            </div>
            <p className="text-xs text-slate-400">
              "With reuse" assumes tiles interlock on all sides. A straight-cut offcut keeps a
              connector on its uncut edges, so two complementary pieces from one tile can be reused
              when their reduced dimensions fit a single tile along the same axis and their grain
              orientation matches. L-cuts and double-reduced corner pieces each need their own tile.
              "Safe" counts one tile per cut location.
            </p>
          </>
        ) : (
          <p className="text-xs text-slate-400">
            "With reuse" is an optimistic area estimate that assumes offcuts pack perfectly where
            geometry allows. Enable interlock reuse for an edge- &amp; grain-aware count.
            "Safe" counts one tile per cut location.
          </p>
        )}
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
          <>
            <p className="text-xs text-slate-400">
              Finished pieces to cut from full tiles &mdash; one row per distinct finished size and
              how many of that size you need. Cut these from full tiles (offcut reuse may let one
              tile yield two pieces).
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="py-1">Finished piece (W {'\u00d7'} H)</th>
                  <th className="text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {cutList.map((c, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-1">
                      {roundDisplay(fromInches(c.w, unit), 2)} {'\u00d7'} {roundDisplay(fromInches(c.h, unit), 2)}{' '}
                      {UNIT_LABELS[unit]}
                      {c.lcut && c.notch && (
                        <span className="ml-1 text-xs text-slate-500">
                          {'\u00b7'} cut notch {roundDisplay(fromInches(c.notch.w, unit), 2)} {'\u00d7'}{' '}
                          {roundDisplay(fromInches(c.notch.h, unit), 2)} {UNIT_LABELS[unit]}
                        </span>
                      )}
                      {c.lcut && <span className="ml-1 text-xs text-orange-500">(L-cut)</span>}
                    </td>
                    <td className="text-right">{c.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-slate-400">
              (L-cut) = an L-shaped piece: a full-size tile with a rectangular corner notch sawn
              out (the &ldquo;cut notch&rdquo; size) to wrap an inside corner of the deck. The
              W {'\u00d7'} H is the tile&rsquo;s overall extent, not a whole tile. Not pairable,
              needs its own tile.
            </p>
          </>
        )}
      </Section>

      <Section title="Disclaimer">
        <p className="text-xs text-slate-500">
          <strong className="text-slate-600">All dimensions, tile/border/post counts, and the cut
          list are referential estimates only</strong>, generated from the entered measurements.
          Field conditions vary &mdash; verify all dimensions with on-site measurements as
          installation proceeds. Order approximately 10% extra material as a waste/contingency
          allowance (about 15% for diagonal or complex layouts) to cover miscuts, breakage, and
          future repairs.
        </p>
      </Section>
    </div>
  );
});
