import { memo, useMemo } from 'react';
import type { BorderType, GridConfig, Post, PostType, Project, SideAssignment, TileConfig, Unit } from '../types';
import type { Side } from '../geometry/sides';
import { fromInches, roundDisplay, UNIT_LABELS } from '../units';
import { uid } from '../state/defaults';
import { Field, LengthInput, NumberBox, Section } from './ui';

const UNITS: Unit[] = ['in', 'ft', 'cm', 'mm', 'm'];

function UnitSelectorImpl({ unit, onChange }: { unit: Unit; onChange: (u: Unit) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-sm">
      {UNITS.map((u) => (
        <button
          key={u}
          onClick={() => onChange(u)}
          className={`rounded px-2 py-1 ${
            unit === u ? 'bg-white font-semibold text-sky-700 shadow-sm' : 'text-slate-500'
          }`}
        >
          {UNIT_LABELS[u]}
        </button>
      ))}
    </div>
  );
}

function TileConfigPanelImpl({
  tile,
  unit,
  onChange,
}: {
  tile: TileConfig;
  unit: Unit;
  onChange: (t: TileConfig) => void;
}) {
  return (
    <Section title="Tile size">
      <Field label="Width">
        <LengthInput valueInches={tile.width} unit={unit} min={0.1} onChange={(v) => onChange({ ...tile, width: v })} />
      </Field>
      <Field label="Height">
        <LengthInput valueInches={tile.height} unit={unit} min={0.1} onChange={(v) => onChange({ ...tile, height: v })} />
      </Field>
      <Field label="Gap between tiles">
        <LengthInput valueInches={tile.gap} unit={unit} min={0} onChange={(v) => onChange({ ...tile, gap: v })} />
      </Field>
      <Field label="Slats per tile">
        <NumberBox
          value={tile.slats}
          min={1}
          step="1"
          onChange={(v) => onChange({ ...tile, slats: Math.max(1, Math.round(v)) })}
        />
      </Field>
      <Field label="Directional grain">
        <input
          type="checkbox"
          checked={tile.directional}
          onChange={(e) => onChange({ ...tile, directional: e.target.checked })}
        />
      </Field>
    </Section>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-sm">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded px-2 py-1 ${
            value === o.value ? 'bg-white font-semibold text-sky-700 shadow-sm' : 'text-slate-500'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function TilePatternPanelImpl({
  layoutPattern,
  grainDirection,
  interlockReuse,
  onChange,
}: {
  layoutPattern: Project['layoutPattern'];
  grainDirection: Project['grainDirection'];
  interlockReuse: Project['interlockReuse'];
  onChange: (
    patch: Partial<Pick<Project, 'layoutPattern' | 'grainDirection' | 'interlockReuse'>>,
  ) => void;
}) {
  return (
    <Section title="Tile pattern">
      <Field label="Layout">
        <Segmented
          value={layoutPattern}
          options={[
            { value: 'none', label: 'None' },
            { value: 'uniform', label: 'Uniform' },
            { value: 'checkerboard', label: 'Checkerboard' },
          ]}
          onChange={(v) => onChange({ layoutPattern: v })}
        />
      </Field>
      <Field label="Grain direction">
        <Segmented
          value={grainDirection}
          options={[
            { value: 'horizontal', label: 'Horizontal' },
            { value: 'vertical', label: 'Vertical' },
          ]}
          onChange={(v) => onChange({ grainDirection: v })}
        />
      </Field>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={interlockReuse}
          onChange={(e) => onChange({ interlockReuse: e.target.checked })}
        />
        <span>
          <span className="font-medium text-slate-700">Tiles interlock</span>
          <span className="block text-xs text-slate-500">
            Limit offcut reuse with edge- &amp; grain-aware pairing (interlocking tiles).
          </span>
        </span>
      </label>
    </Section>
  );
}

function GridControlsImpl({
  grid,
  unit,
  appliedOffset,
  onChange,
}: {
  grid: GridConfig;
  unit: Unit;
  appliedOffset: { x: number; y: number };
  onChange: (g: GridConfig) => void;
}) {
  return (
    <Section title="Tile grid placement">
      <div className="flex gap-3 text-sm">
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={grid.mode === 'auto'}
            onChange={() => onChange({ ...grid, mode: 'auto' })}
          />
          Auto-optimize
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={grid.mode === 'manual'}
            onChange={() => onChange({ ...grid, mode: 'manual' })}
          />
          Manual
        </label>
      </div>
      {grid.mode === 'manual' ? (
        <>
          <Field label="Offset X">
            <LengthInput valueInches={grid.offsetX} unit={unit} onChange={(v) => onChange({ ...grid, offsetX: v })} />
          </Field>
          <Field label="Offset Y">
            <LengthInput valueInches={grid.offsetY} unit={unit} onChange={(v) => onChange({ ...grid, offsetY: v })} />
          </Field>
        </>
      ) : (
        <p className="text-xs text-slate-500">
          Optimized offset: X {roundDisplay(fromInches(appliedOffset.x, unit), 3)}, Y{' '}
          {roundDisplay(fromInches(appliedOffset.y, unit), 3)} {UNIT_LABELS[unit]} (minimizes cut tiles)
        </p>
      )}
    </Section>
  );
}

function BorderTypesPanelImpl({
  borderTypes,
  unit,
  onChange,
}: {
  borderTypes: BorderType[];
  unit: Unit;
  onChange: (b: BorderType[]) => void;
}) {
  const update = (id: string, patch: Partial<BorderType>) =>
    onChange(borderTypes.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const remove = (id: string) => onChange(borderTypes.filter((t) => t.id !== id));
  const add = () =>
    onChange([
      ...borderTypes,
      {
        id: uid('border'),
        name: 'New border',
        faceWidth: 2,
        pieceLength: 12,
        hasCornerPieces: true,
        color: '#6366f1',
      },
    ]);

  return (
    <Section
      title="Border types"
      right={
        <button onClick={add} className="rounded bg-sky-600 px-2 py-1 text-xs font-medium text-white hover:bg-sky-700">
          + Add type
        </button>
      }
    >
      {borderTypes.map((t) => (
        <div key={t.id} className="rounded border border-slate-200 p-2">
          <div className="mb-1 flex items-center gap-2">
            <input
              type="color"
              value={t.color}
              onChange={(e) => update(t.id, { color: e.target.value })}
              className="h-6 w-8 cursor-pointer rounded border border-slate-300"
            />
            <input
              value={t.name}
              onChange={(e) => update(t.id, { name: e.target.value })}
              className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
            />
            <button onClick={() => remove(t.id)} className="rounded px-1 text-xs text-red-500 hover:bg-red-50">
              Remove
            </button>
          </div>
          <Field label="Face width (visual)">
            <LengthInput valueInches={t.faceWidth} unit={unit} min={0} onChange={(v) => update(t.id, { faceWidth: v })} />
          </Field>
          <Field label="Piece length">
            <LengthInput valueInches={t.pieceLength} unit={unit} min={0.1} onChange={(v) => update(t.id, { pieceLength: v })} />
          </Field>
          <Field label="Has corner pieces">
            <input
              type="checkbox"
              checked={t.hasCornerPieces}
              onChange={(e) => update(t.id, { hasCornerPieces: e.target.checked })}
            />
          </Field>
        </div>
      ))}
    </Section>
  );
}

function PostTypesPanelImpl({
  postTypes,
  unit,
  onChange,
}: {
  postTypes: PostType[];
  unit: Unit;
  onChange: (p: PostType[]) => void;
}) {
  const update = (id: string, patch: Partial<PostType>) =>
    onChange(postTypes.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const remove = (id: string) => onChange(postTypes.filter((t) => t.id !== id));
  const add = () =>
    onChange([
      ...postTypes,
      { id: uid('post-type'), name: 'New post', width: 3.5, depth: 3.5, color: '#7c3aed' },
    ]);

  return (
    <Section
      title="Post types"
      right={
        <button onClick={add} className="rounded bg-sky-600 px-2 py-1 text-xs font-medium text-white hover:bg-sky-700">
          + Add type
        </button>
      }
    >
      <p className="text-xs text-slate-500">
        Tip: pick a post type in the diagram toolbar, then click a point on any edge to place it. Click a
        post to remove it.
      </p>
      {postTypes.map((t) => (
        <div key={t.id} className="rounded border border-slate-200 p-2">
          <div className="mb-1 flex items-center gap-2">
            <input
              type="color"
              value={t.color}
              onChange={(e) => update(t.id, { color: e.target.value })}
              className="h-6 w-8 cursor-pointer rounded border border-slate-300"
            />
            <input
              value={t.name}
              onChange={(e) => update(t.id, { name: e.target.value })}
              className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
            />
            <button onClick={() => remove(t.id)} className="rounded px-1 text-xs text-red-500 hover:bg-red-50">
              Remove
            </button>
          </div>
          <Field label="Width (along edge)">
            <LengthInput valueInches={t.width} unit={unit} min={0.1} onChange={(v) => update(t.id, { width: v })} />
          </Field>
          <Field label="Depth (inward)">
            <LengthInput valueInches={t.depth} unit={unit} min={0.1} onChange={(v) => update(t.id, { depth: v })} />
          </Field>
        </div>
      ))}
    </Section>
  );
}

function sideLabel(side: Side, unit: Unit): string {
  const horizontal = Math.abs(side.a[1] - side.b[1]) < 1e-6;
  const orient = horizontal ? 'H' : Math.abs(side.a[0] - side.b[0]) < 1e-6 ? 'V' : 'D';
  return `${orient} \u00b7 ${roundDisplay(fromInches(side.length, unit), 2)} ${UNIT_LABELS[unit]}`;
}

function PlacedPostsPanelImpl({
  posts,
  postTypes,
  sides,
  unit,
  hoveredSideId,
  onHover,
  onUpdate,
  onRemove,
}: {
  posts: Post[];
  postTypes: PostType[];
  sides: Side[];
  unit: Unit;
  hoveredSideId?: string | null;
  onHover?: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<Post>) => void;
  onRemove: (id: string) => void;
}) {
  const typeMap = useMemo(() => {
    const m = new Map<string, PostType>();
    for (const t of postTypes) m.set(t.id, t);
    return m;
  }, [postTypes]);

  const sideIndex = useMemo(() => {
    const m = new Map<string, number>();
    sides.forEach((s, i) => m.set(s.id, i));
    return m;
  }, [sides]);

  return (
    <Section title="Placed posts">
      {posts.length === 0 ? (
        <p className="text-sm text-slate-500">No posts placed yet.</p>
      ) : (
        <div className="space-y-1">
          {posts.map((p) => {
            const type = typeMap.get(p.postTypeId);
            const idx = sideIndex.get(p.sideId);
            const side = idx !== undefined ? sides[idx] : undefined;
            const detached = side === undefined;
            return (
              <div
                key={p.id}
                onMouseEnter={() => onHover?.(p.sideId)}
                onMouseLeave={() => onHover?.(null)}
                className={`flex flex-col gap-1 rounded px-1 py-1 text-sm transition-colors ${
                  hoveredSideId === p.sideId ? 'bg-sky-100 ring-1 ring-sky-300' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1 text-slate-600">
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-full"
                      style={{ background: type?.color ?? '#94a3b8' }}
                    />
                    <span className="truncate text-xs">
                      {type?.name ?? 'Post'}{' '}
                      <span className="text-slate-400">
                        {detached ? '(detached)' : `\u00b7 Side ${(idx ?? 0) + 1}`}
                      </span>
                    </span>
                  </span>
                  <button
                    onClick={() => onRemove(p.id)}
                    className="shrink-0 rounded px-1 text-xs text-red-500 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
                {detached ? (
                  <span className="text-xs text-amber-600">edge removed</span>
                ) : (
                  (() => {
                    const len = side!.length;
                    const w = type?.width ?? 0;
                    const clampPos = (pos: number) =>
                      len <= w ? len / 2 : Math.max(w / 2, Math.min(len - w / 2, pos));
                    const gapStart = p.pos - w / 2;
                    const gapEnd = len - p.pos - w / 2;
                    return (
                      <div className="flex flex-col gap-1">
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex min-w-0 items-center gap-1 text-[10px] text-slate-400">
                            start
                            <LengthInput
                              valueInches={gapStart}
                              unit={unit}
                              min={0}
                              fullWidth
                              ariaLabel="Gap from start"
                              onChange={(v) =>
                                onUpdate(p.id, { pos: clampPos(Math.max(0, v) + w / 2) })
                              }
                            />
                          </label>
                          <label className="flex min-w-0 items-center gap-1 text-[10px] text-slate-400">
                            end
                            <LengthInput
                              valueInches={gapEnd}
                              unit={unit}
                              min={0}
                              fullWidth
                              ariaLabel="Gap from end"
                              onChange={(v) =>
                                onUpdate(p.id, { pos: clampPos(len - Math.max(0, v) - w / 2) })
                              }
                            />
                          </label>
                        </div>
                        <label className="flex min-w-0 items-center gap-1 text-[10px] text-slate-400">
                          setback
                          <LengthInput
                            valueInches={p.margin ?? 0}
                            unit={unit}
                            min={0}
                            fullWidth
                            ariaLabel="Setback from edge"
                            onChange={(v) => onUpdate(p.id, { margin: Math.max(0, v) })}
                          />
                        </label>
                      </div>
                    );
                  })()
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-slate-400">
        "start"/"end" are the clear gaps from each corner to the post's nearest face.
        "setback" sets the post back inward from the edge/border (0 = flush).
        Hover a row to highlight its side.
      </p>
    </Section>
  );
}

function SideAssignmentPanelImpl({
  sides,
  assignments,
  borderTypes,
  unit,
  cutSides,
  gridMode,
  hoveredSideId,
  onHover,
  onChange,
  onToggleCutSide,
}: {
  sides: Side[];
  assignments: SideAssignment[];
  borderTypes: BorderType[];
  unit: Unit;
  cutSides: string[];
  gridMode: 'auto' | 'manual';
  hoveredSideId?: string | null;
  onHover?: (id: string | null) => void;
  onChange: (a: SideAssignment[]) => void;
  onToggleCutSide?: (sideId: string) => void;
}) {
  const assignMap = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const a of assignments) m.set(a.sideId, a.borderTypeId);
    return m;
  }, [assignments]);

  const cutSet = useMemo(() => new Set(cutSides), [cutSides]);

  const setSide = (sideId: string, borderTypeId: string | null) => {
    const others = assignments.filter((a) => a.sideId !== sideId);
    onChange([...others, { sideId, borderTypeId }]);
  };

  const setAll = (borderTypeId: string | null) =>
    onChange(sides.map((s) => ({ sideId: s.id, borderTypeId })));

  return (
    <Section title="Borders per side">
      <p className="text-xs text-slate-500">
        Tip: click a side on the diagram to apply the selected brush, or use the dropdowns below.
      </p>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-500">Set all sides:</span>
        <button onClick={() => setAll(null)} className="rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-50">
          None
        </button>
        {borderTypes.map((t) => (
          <button
            key={t.id}
            onClick={() => setAll(t.id)}
            className="rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-50"
          >
            {t.name}
          </button>
        ))}
      </div>
      <div className="space-y-1">
        {sides.map((s, i) => {
          const isCut = cutSet.has(s.id);
          return (
            <div
              key={s.id}
              onMouseEnter={() => onHover?.(s.id)}
              onMouseLeave={() => onHover?.(null)}
              className={`flex items-center justify-between gap-2 rounded px-1 text-sm transition-colors ${
                hoveredSideId === s.id ? 'bg-sky-100 ring-1 ring-sky-300' : ''
              }`}
            >
              <span className="flex items-center text-slate-600">
                <span
                  className={`mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                    isCut ? 'bg-pink-600' : 'bg-slate-700'
                  }`}
                >
                  {isCut ? '\u2702' : i + 1}
                </span>
                <span className="text-xs text-slate-400">({sideLabel(s, unit)})</span>
              </span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onToggleCutSide?.(s.id)}
                  title="Push cut/partial tiles to this side (keep full tiles flush on the others)"
                  className={`rounded border px-1 py-0.5 text-xs ${
                    isCut
                      ? 'border-pink-500 bg-pink-100 font-semibold text-pink-700'
                      : 'border-slate-300 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {'\u2702'}
                </button>
                <select
                  value={assignMap.get(s.id) ?? ''}
                  onChange={(e) => setSide(s.id, e.target.value === '' ? null : e.target.value)}
                  className="rounded border border-slate-300 px-1 py-0.5 text-sm"
                >
                  <option value="">None</option>
                  {borderTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-500">
        <span className="text-pink-600">{'\u2702'}</span> Cut side: leftover/partial tiles are pushed
        here, keeping full tiles flush on the other edges.
        {gridMode === 'manual' && (
          <span className="text-amber-600"> Switch the grid to Auto for this to take effect.</span>
        )}
      </p>
    </Section>
  );
}

function DimensionBasisPanelImpl({
  basis,
  onChange,
}: {
  basis: 'tileField' | 'totalFootprint';
  onChange: (b: 'tileField' | 'totalFootprint') => void;
}) {
  return (
    <Section title="Measurements represent">
      <label className="flex items-start gap-2 text-sm">
        <input
          type="radio"
          className="mt-1"
          checked={basis === 'tileField'}
          onChange={() => onChange('tileField')}
        />
        <span>
          <span className="font-medium text-slate-700">Tile field</span>
          <span className="block text-xs text-slate-500">
            Trim extends outward beyond these dimensions. Tile count is unaffected by trim width.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="radio"
          className="mt-1"
          checked={basis === 'totalFootprint'}
          onChange={() => onChange('totalFootprint')}
        />
        <span>
          <span className="font-medium text-slate-700">Total footprint (fit within)</span>
          <span className="block text-xs text-slate-500">
            Finished tiles + trim must fit inside these dimensions, so the tile field is inset by the
            trim width on every bordered side.
          </span>
        </span>
      </label>
    </Section>
  );
}

export function TileGapNote() {
  return null;
}

export const UnitSelector = memo(UnitSelectorImpl);
export const TileConfigPanel = memo(TileConfigPanelImpl);
export const TilePatternPanel = memo(TilePatternPanelImpl);
export const GridControls = memo(GridControlsImpl);
export const BorderTypesPanel = memo(BorderTypesPanelImpl);
export const PostTypesPanel = memo(PostTypesPanelImpl);
export const PlacedPostsPanel = memo(PlacedPostsPanelImpl);
export const SideAssignmentPanel = memo(SideAssignmentPanelImpl);
export const DimensionBasisPanel = memo(DimensionBasisPanelImpl);

export { NumberBox };
