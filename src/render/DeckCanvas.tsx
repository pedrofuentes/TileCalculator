import { memo, useMemo, useState } from 'react';
import type { Computed } from '../compute';
import type { Project, Unit } from '../types';
import type { MultiPoly, Pt } from '../geometry/polygon';
import type { Side } from '../geometry/sides';
import { fromInches, roundDisplay, UNIT_LABELS } from '../units';

const FULL_FILL = '#d1fae5';
const FULL_STROKE = '#34d399';
const CUT_FILL = '#fdba74';
const CUT_STROKE = '#ea580c';
const DECK_FILL = '#e2e8f0';

interface Props {
  computed: Computed;
  project: Project;
  hoveredSideId?: string | null;
  onHover?: (id: string | null) => void;
  onAssignSide?: (sideId: string, borderTypeId: string | null) => void;
  onToggleCutSide?: (sideId: string) => void;
  onAddPost?: (sideId: string, pos: number, postTypeId: string) => void;
  onRemovePost?: (id: string) => void;
}

// Active click action: assign a border type, toggle a cut side, or place a post.
type Brush =
  | { kind: 'border'; borderTypeId: string | null }
  | { kind: 'cut' }
  | { kind: 'post'; postTypeId: string };

const CUT_SIDE_COLOR = '#db2777';

type ToScreen = (p: Pt) => Pt;
type Cells = Computed['grid']['cells'];
type Sides = Computed['shape']['sides'];
type Corners = Computed['shape']['corners'];
type PostShapes = Computed['posts']['shapes'];
type AssignMap = Map<string, string | null>;
type BorderTypeMap = Map<string, Project['borderTypes'][number]>;
type SideMap = Map<string, Side>;

function makeFmt(unit: Unit) {
  return (lenInches: number) =>
    `${roundDisplay(fromInches(lenInches, unit), 2)} ${UNIT_LABELS[unit]}`;
}

// --- Static, geometry-derived layers (memoized so hover never re-renders them) ---

const TileLayer = memo(function TileLayer({
  cells,
  toScreen,
  scale,
  tile,
  showGrid,
  unit,
}: {
  cells: Cells;
  toScreen: ToScreen;
  scale: number;
  tile: Project['tile'];
  showGrid: boolean;
  unit: Unit;
}) {
  const nodes = useMemo(() => {
    if (!showGrid) return null;
    const fmt = makeFmt(unit);
    const w = tile.width * scale;
    const h = tile.height * scale;
    return cells.map((cell) => {
      const [sx, sy] = toScreen([cell.x, cell.y]);
      const key = `${cell.x},${cell.y}`;
      if (cell.kind === 'full') {
        return (
          <rect
            key={key}
            x={sx}
            y={sy}
            width={w}
            height={h}
            fill={FULL_FILL}
            stroke={FULL_STROKE}
            strokeWidth={1}
          >
            <title>{`Full tile (${fmt(tile.width)} \u00d7 ${fmt(tile.height)})`}</title>
          </rect>
        );
      }
      const covered = multiPolyToPath(cell.covered, toScreen);
      const cw = cell.cutBBox.maxX - cell.cutBBox.minX;
      const ch = cell.cutBBox.maxY - cell.cutBBox.minY;
      return (
        <g key={key}>
          {/* original tile footprint (shows offcut) */}
          <rect
            x={sx}
            y={sy}
            width={w}
            height={h}
            fill="none"
            stroke="#cbd5e1"
            strokeWidth={0.75}
            strokeDasharray="3 3"
          />
          <path d={covered} fill={CUT_FILL} stroke={CUT_STROKE} strokeWidth={1} fillRule="evenodd">
            <title>{`Cut tile \u2192 piece ${fmt(cw)} \u00d7 ${fmt(ch)}${
              cell.rectangular ? '' : ' (L-cut)'
            }`}</title>
          </path>
        </g>
      );
    });
  }, [cells, toScreen, scale, tile, showGrid, unit]);
  return <>{nodes}</>;
});

const BordersLayer = memo(function BordersLayer({
  sides,
  assignMap,
  borderTypeMap,
  inset,
  toScreen,
  showBorders,
  unit,
}: {
  sides: Sides;
  assignMap: AssignMap;
  borderTypeMap: BorderTypeMap;
  inset: boolean;
  toScreen: ToScreen;
  showBorders: boolean;
  unit: Unit;
}) {
  const nodes = useMemo(() => {
    if (!showBorders) return null;
    const fmt = makeFmt(unit);
    return sides.map((side) => {
      const typeId = assignMap.get(side.id);
      if (!typeId) return null;
      const t = borderTypeMap.get(typeId);
      if (!t) return null;
      const a = side.a;
      const b = side.b;
      const o = side.outward;
      const f = t.faceWidth;
      const dir = inset ? -1 : 1; // inset trim sits inward
      const p1 = toScreen(a);
      const p2 = toScreen(b);
      const p3 = toScreen([b[0] + o[0] * f * dir, b[1] + o[1] * f * dir]);
      const p4 = toScreen([a[0] + o[0] * f * dir, a[1] + o[1] * f * dir]);
      return (
        <polygon
          key={`b-${side.id}`}
          points={`${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${p3[0]},${p3[1]} ${p4[0]},${p4[1]}`}
          fill={t.color}
          fillOpacity={0.85}
          stroke={t.color}
          strokeWidth={1}
        >
          <title>{`${t.name} \u2014 ${fmt(side.length)}`}</title>
        </polygon>
      );
    });
  }, [sides, assignMap, borderTypeMap, inset, toScreen, showBorders, unit]);
  return <>{nodes}</>;
});

const CornersLayer = memo(function CornersLayer({
  corners,
  assignMap,
  sideMap,
  borderTypeMap,
  inset,
  toScreen,
  showBorders,
}: {
  corners: Corners;
  assignMap: AssignMap;
  sideMap: SideMap;
  borderTypeMap: BorderTypeMap;
  inset: boolean;
  toScreen: ToScreen;
  showBorders: boolean;
}) {
  const nodes = useMemo(() => {
    if (!showBorders) return null;
    return corners.map((corner, i) => {
      const prev = assignMap.get(corner.prevSideId);
      const next = assignMap.get(corner.nextSideId);
      if (!prev || !next) return null;
      const ps = sideMap.get(corner.prevSideId);
      const ns = sideMap.get(corner.nextSideId);
      if (!ps || !ns) return null;
      let ox = ps.outward[0] + ns.outward[0];
      let oy = ps.outward[1] + ns.outward[1];
      const m = Math.hypot(ox, oy) || 1;
      ox /= m;
      oy /= m;
      const face = borderTypeMap.get(prev)?.faceWidth ?? 1.5;
      const dir = inset ? -1 : 1;
      const [cx, cy] = toScreen([
        corner.point[0] + ox * face * 0.7 * dir,
        corner.point[1] + oy * face * 0.7 * dir,
      ]);
      const color = prev === next ? borderTypeMap.get(prev)?.color ?? '#334155' : '#7c3aed';
      const r = 4;
      return corner.type === 'outside' ? (
        <rect key={`c-${i}`} x={cx - r} y={cy - r} width={r * 2} height={r * 2} fill={color}>
          <title>{`Outside corner${prev !== next ? ' (mixed)' : ''}`}</title>
        </rect>
      ) : (
        <circle key={`c-${i}`} cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={2}>
          <title>Inside corner</title>
        </circle>
      );
    });
  }, [corners, assignMap, sideMap, borderTypeMap, inset, toScreen, showBorders]);
  return <>{nodes}</>;
});

const LabelsLayer = memo(function LabelsLayer({
  sides,
  assignMap,
  borderTypeMap,
  inset,
  toScreen,
  showLabels,
  unit,
}: {
  sides: Sides;
  assignMap: AssignMap;
  borderTypeMap: BorderTypeMap;
  inset: boolean;
  toScreen: ToScreen;
  showLabels: boolean;
  unit: Unit;
}) {
  const nodes = useMemo(() => {
    if (!showLabels) return null;
    const fmt = makeFmt(unit);
    return sides.map((side) => {
      const assigned = assignMap.get(side.id);
      const t = assigned ? borderTypeMap.get(assigned) : null;
      const face = t?.faceWidth ?? 0;
      const off = (inset ? 0 : face) + 22;
      const lx = side.mid[0] + side.outward[0] * off;
      const ly = side.mid[1] + side.outward[1] * off;
      const [sx, sy] = toScreen([lx, ly]);
      const label = fmt(side.length);
      return (
        <g key={`l-${side.id}`} style={{ pointerEvents: 'none' }}>
          <rect
            x={sx - label.length * 3.4 - 4}
            y={sy - 9}
            width={label.length * 6.8 + 8}
            height={18}
            rx={3}
            fill="white"
            fillOpacity={0.85}
            stroke="#e2e8f0"
          />
          <text x={sx} y={sy + 4} textAnchor="middle" className="fill-slate-700" fontSize={11}>
            {label}
          </text>
        </g>
      );
    });
  }, [sides, assignMap, borderTypeMap, inset, toScreen, showLabels, unit]);
  return <>{nodes}</>;
});

const PostsLayer = memo(function PostsLayer({
  posts,
  toScreen,
  unit,
  onRemovePost,
}: {
  posts: PostShapes;
  toScreen: ToScreen;
  unit: Unit;
  onRemovePost?: (id: string) => void;
}) {
  const fmt = makeFmt(unit);
  return (
    <>
      {posts.map((ps) => {
        const pts = ps.ring
          .map((p) => {
            const s = toScreen(p);
            return `${s[0]},${s[1]}`;
          })
          .join(' ');
        return (
          <polygon
            key={`post-${ps.post.id}`}
            points={pts}
            fill={ps.type.color}
            fillOpacity={0.9}
            stroke="#1e293b"
            strokeWidth={1}
            style={{ cursor: 'pointer' }}
            onClick={() => onRemovePost?.(ps.post.id)}
          >
            <title>{`${ps.type.name} (${fmt(ps.type.width)} \u00d7 ${fmt(ps.type.depth)}) \u2014 click to remove`}</title>
          </polygon>
        );
      })}
    </>
  );
});

export const DeckCanvas = memo(function DeckCanvas({
  computed,
  project,
  hoveredSideId,
  onHover,
  onAssignSide,
  onToggleCutSide,
  onAddPost,
  onRemovePost,
}: Props) {
  const { unit, tile } = project;
  const [showGrid, setShowGrid] = useState(true);
  const [showBorders, setShowBorders] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [brush, setBrush] = useState<Brush>({
    kind: 'border',
    borderTypeId: project.borderTypes[0]?.id ?? null,
  });

  const cutSides = useMemo(
    () => new Set(project.grid.cutSides ?? []),
    [project.grid.cutSides],
  );

  const assignMap = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const a of project.sideAssignments) m.set(a.sideId, a.borderTypeId);
    return m;
  }, [project.sideAssignments]);

  const borderTypeMap = useMemo(() => {
    const m = new Map<string, (typeof project.borderTypes)[number]>();
    for (const t of project.borderTypes) m.set(t.id, t);
    return m;
  }, [project.borderTypes]);

  const postTypeMap = useMemo(() => {
    const m = new Map<string, (typeof project.postTypes)[number]>();
    for (const t of project.postTypes ?? []) m.set(t.id, t);
    return m;
  }, [project.postTypes]);

  const sideMap = useMemo(() => {
    const m = new Map<string, Side>();
    for (const s of computed.shape.sides) m.set(s.id, s);
    return m;
  }, [computed.shape.sides]);

  const layout = useMemo(() => {
    const { bbox } = computed;
    const maxFace = project.borderTypes.reduce((mx, t) => Math.max(mx, t.faceWidth), 0);
    const margin = maxFace + 28; // world units (inches) for borders + labels
    const worldW = bbox.maxX - bbox.minX + margin * 2;
    const worldH = bbox.maxY - bbox.minY + margin * 2;
    const targetW = 820;
    const scale = worldW > 0 ? targetW / worldW : 1;
    const toScreen = (p: Pt): Pt => [
      (p[0] - bbox.minX + margin) * scale,
      (p[1] - bbox.minY + margin) * scale,
    ];
    return {
      scale,
      toScreen,
      margin,
      bbox,
      width: worldW * scale,
      height: worldH * scale,
    };
  }, [computed, project.borderTypes]);

  const { toScreen, scale, margin, bbox, width, height } = layout;

  // Convert a pointer event to world (inch) coordinates within the SVG.
  const eventToWorld = (e: { clientX: number; clientY: number; currentTarget: SVGElement }): Pt | null => {
    const svg = e.currentTarget.ownerSVGElement ?? (e.currentTarget as unknown as SVGSVGElement);
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const u = pt.matrixTransform(ctm.inverse()); // svg user units (== toScreen output space)
    return [u.x / scale - margin + bbox.minX, u.y / scale - margin + bbox.minY];
  };

  const deckPath = useMemo(() => multiPolyToPath(computed.deck, toScreen), [computed.deck, toScreen]);

  const fmt = makeFmt(unit);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-3 py-2 text-xs">
        <span className="font-semibold text-slate-600">Layers:</span>
        <Toggle label="Tiles" on={showGrid} set={setShowGrid} />
        <Toggle label="Borders" on={showBorders} set={setShowBorders} />
        <Toggle label="Dimensions" on={showLabels} set={setShowLabels} />
        <span className="ml-auto flex items-center gap-3">
          <Legend swatch={FULL_FILL} stroke={FULL_STROKE} label="Full tile" />
          <Legend swatch={CUT_FILL} stroke={CUT_STROKE} label="Cut tile" />
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs">
        <span className="font-semibold text-slate-600">Click a side to apply:</span>
        <button
          onClick={() => setBrush({ kind: 'border', borderTypeId: null })}
          className={`rounded border px-2 py-0.5 ${
            brush.kind === 'border' && brush.borderTypeId === null
              ? 'border-sky-500 bg-sky-100 font-semibold text-sky-700'
              : 'border-slate-300 text-slate-600'
          }`}
        >
          None
        </button>
        {project.borderTypes.map((t) => (
          <button
            key={t.id}
            onClick={() => setBrush({ kind: 'border', borderTypeId: t.id })}
            className={`flex items-center gap-1 rounded border px-2 py-0.5 ${
              brush.kind === 'border' && brush.borderTypeId === t.id
                ? 'border-sky-500 bg-sky-100 font-semibold text-sky-700'
                : 'border-slate-300 text-slate-600'
            }`}
          >
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: t.color }} />
            {t.name}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-slate-300" />
        <button
          onClick={() => setBrush({ kind: 'cut' })}
          title="Mark a side as a cut side: leftover/partial tiles are pushed here, keeping full tiles flush on the other sides (auto grid mode)."
          className={`flex items-center gap-1 rounded border px-2 py-0.5 ${
            brush.kind === 'cut'
              ? 'border-pink-500 bg-pink-100 font-semibold text-pink-700'
              : 'border-slate-300 text-slate-600'
          }`}
        >
          <span style={{ color: CUT_SIDE_COLOR }}>{'\u2702'}</span> Cut side
        </button>
        {(project.postTypes ?? []).length > 0 && <span className="mx-1 h-4 w-px bg-slate-300" />}
        {(project.postTypes ?? []).map((t) => (
          <button
            key={t.id}
            onClick={() => setBrush({ kind: 'post', postTypeId: t.id })}
            title={`Place ${t.name} posts: click a point on any edge.`}
            className={`flex items-center gap-1 rounded border px-2 py-0.5 ${
              brush.kind === 'post' && brush.postTypeId === t.id
                ? 'border-violet-500 bg-violet-100 font-semibold text-violet-700'
                : 'border-slate-300 text-slate-600'
            }`}
          >
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
            {t.name}
          </button>
        ))}
        <span className="text-slate-400">then click any side on the diagram.</span>
      </div>

      <div className="flex-1 overflow-auto bg-slate-50 p-4">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="mx-auto block bg-white shadow-sm"
        >
          {/* Deck base */}
          <path d={deckPath} fill={DECK_FILL} stroke="#94a3b8" strokeWidth={1.5} fillRule="evenodd" />

          {/* Tiles */}
          <TileLayer
            cells={computed.grid.cells}
            toScreen={toScreen}
            scale={scale}
            tile={tile}
            showGrid={showGrid}
            unit={unit}
          />

          {/* Borders */}
          <BordersLayer
            sides={computed.shape.sides}
            assignMap={assignMap}
            borderTypeMap={borderTypeMap}
            inset={computed.inset}
            toScreen={toScreen}
            showBorders={showBorders}
            unit={unit}
          />

          {/* Corner markers */}
          <CornersLayer
            corners={computed.shape.corners}
            assignMap={assignMap}
            sideMap={sideMap}
            borderTypeMap={borderTypeMap}
            inset={computed.inset}
            toScreen={toScreen}
            showBorders={showBorders}
          />

          {/* Dimension labels per side */}
          <LabelsLayer
            sides={computed.shape.sides}
            assignMap={assignMap}
            borderTypeMap={borderTypeMap}
            inset={computed.inset}
            toScreen={toScreen}
            showLabels={showLabels}
            unit={unit}
          />

          {/* Interactive side hit-targets, hover highlight, and numbered badges */}
          {computed.shape.sides.map((side, i) => {
            const p1 = toScreen(side.a);
            const p2 = toScreen(side.b);
            const hovered = hoveredSideId === side.id;
            const isCut = cutSides.has(side.id);
            const [bx, by] = toScreen(side.mid);
            const brushLabel =
              brush.kind === 'cut'
                ? isCut
                  ? 'remove cut side'
                  : 'cut side'
                : brush.kind === 'post'
                  ? `place ${postTypeMap.get(brush.postTypeId)?.name ?? 'post'}`
                  : brush.borderTypeId
                    ? borderTypeMap.get(brush.borderTypeId)?.name ?? 'border'
                    : 'None';
            return (
              <g key={`hit-${side.id}`}>
                {isCut && (
                  <line
                    x1={p1[0]}
                    y1={p1[1]}
                    x2={p2[0]}
                    y2={p2[1]}
                    stroke={CUT_SIDE_COLOR}
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeDasharray="7 5"
                    opacity={0.95}
                  />
                )}
                {hovered && (
                  <line
                    x1={p1[0]}
                    y1={p1[1]}
                    x2={p2[0]}
                    y2={p2[1]}
                    stroke="#0ea5e9"
                    strokeWidth={6}
                    strokeLinecap="round"
                    opacity={0.9}
                  />
                )}
                <line
                  x1={p1[0]}
                  y1={p1[1]}
                  x2={p2[0]}
                  y2={p2[1]}
                  stroke="transparent"
                  strokeWidth={16}
                  strokeLinecap="round"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => onHover?.(side.id)}
                  onMouseLeave={() => onHover?.(null)}
                  onClick={(e) => {
                    if (brush.kind === 'cut') return onToggleCutSide?.(side.id);
                    if (brush.kind === 'border') return onAssignSide?.(side.id, brush.borderTypeId);
                    const w = eventToWorld(e);
                    if (!w) return;
                    onAddPost?.(side.id, projectOntoSide(side, w), brush.postTypeId);
                  }}
                >
                  <title>{`Side ${i + 1} \u2014 ${fmt(side.length)} (click to apply ${brushLabel})`}</title>
                </line>
                <g style={{ pointerEvents: 'none' }}>
                  <circle
                    cx={bx}
                    cy={by}
                    r={8}
                    fill={hovered ? '#0ea5e9' : isCut ? CUT_SIDE_COLOR : '#1e293b'}
                    stroke="white"
                    strokeWidth={1.5}
                  />
                  <text x={bx} y={by + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill="white">
                    {isCut ? '\u2702' : i + 1}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Posts (footprints) — rendered on top; click to remove */}
          <PostsLayer
            posts={computed.posts.shapes}
            toScreen={toScreen}
            unit={unit}
            onRemovePost={onRemovePost}
          />
        </svg>
      </div>
    </div>
  );
});

function projectOntoSide(side: Side, world: Pt): number {
  const len = side.length;
  if (len <= 0) return 0;
  const ux = (side.b[0] - side.a[0]) / len;
  const uy = (side.b[1] - side.a[1]) / len;
  const pos = (world[0] - side.a[0]) * ux + (world[1] - side.a[1]) * uy;
  return Math.max(0, Math.min(len, pos));
}

function Toggle({
  label,
  on,
  set,
}: {
  label: string;
  on: boolean;
  set: (b: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-1 text-slate-600">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
      {label}
    </label>
  );
}

function Legend({ swatch, stroke, label }: { swatch: string; stroke: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-slate-600">
      <span
        className="inline-block h-3 w-3 rounded-sm"
        style={{ background: swatch, border: `1px solid ${stroke}` }}
      />
      {label}
    </span>
  );
}

function multiPolyToPath(mp: MultiPoly, toScreen: (p: Pt) => Pt): string {
  let d = '';
  for (const poly of mp) {
    for (const ring of poly) {
      ring.forEach((pt, i) => {
        const [x, y] = toScreen(pt);
        d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)} `;
      });
      d += 'Z ';
    }
  }
  return d.trim();
}
