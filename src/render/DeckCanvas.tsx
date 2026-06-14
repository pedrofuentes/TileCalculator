import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { Computed } from '../compute';
import type { Project, RectOp, Unit } from '../types';
import type { MultiPoly, Pt } from '../geometry/polygon';
import type { Side } from '../geometry/sides';
import { cellOrientation } from '../geometry/pattern';
import { formatDimension, fromInches, roundDisplay, toInches, UNIT_LABELS } from '../units';

const FULL_FILL = '#d1fae5';
const FULL_STROKE = '#34d399';
const CUT_FILL = '#fdba74';
const CUT_STROKE = '#ea580c';
const DECK_FILL = '#e2e8f0';
const SLAT_STROKE = '#059669';

interface Props {
  computed: Computed;
  project: Project;
  hoveredSideId?: string | null;
  onHover?: (id: string | null) => void;
  onAssignSide?: (sideId: string, borderTypeId: string | null) => void;
  onToggleCutSide?: (sideId: string) => void;
  onAddPost?: (sideId: string, pos: number, postTypeId: string) => void;
  onRemovePost?: (id: string) => void;
  shapeEditMode?: boolean;
  onSetShapeEditMode?: (on: boolean) => void;
  selectedRectId?: string | null;
  onSelectRect?: (id: string | null) => void;
  onUpdateRect?: (id: string, patch: Partial<RectOp>) => void;
  onAddRect?: () => void;
}

// Active click action: assign a border type, toggle a cut side, or place a post.
type Brush =
  | { kind: 'border'; borderTypeId: string | null }
  | { kind: 'cut' }
  | { kind: 'post'; postTypeId: string };

const CUT_SIDE_COLOR = '#db2777';

type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const RESIZE_HANDLES: { id: HandleId; fx: number; fy: number; cursor: string }[] = [
  { id: 'nw', fx: 0, fy: 0, cursor: 'nwse-resize' },
  { id: 'n', fx: 0.5, fy: 0, cursor: 'ns-resize' },
  { id: 'ne', fx: 1, fy: 0, cursor: 'nesw-resize' },
  { id: 'e', fx: 1, fy: 0.5, cursor: 'ew-resize' },
  { id: 'se', fx: 1, fy: 1, cursor: 'nwse-resize' },
  { id: 's', fx: 0.5, fy: 1, cursor: 'ns-resize' },
  { id: 'sw', fx: 0, fy: 1, cursor: 'nesw-resize' },
  { id: 'w', fx: 0, fy: 0.5, cursor: 'ew-resize' },
];

// Apply a move/resize drag to a rectangle, optionally snapping moved edges to a
// grid step (snapStep <= 0 disables snapping). Returns the changed fields.
function applyRectDrag(
  orig: RectOp,
  mode: HandleId | 'move',
  dx: number,
  dy: number,
  snapStep: number,
): Partial<RectOp> {
  const sn = (v: number) => (snapStep > 0 ? Math.round(v / snapStep) * snapStep : v);
  if (mode === 'move') {
    return { x: sn(orig.x + dx), y: sn(orig.y + dy) };
  }
  let left = orig.x;
  let right = orig.x + orig.w;
  let top = orig.y;
  let bottom = orig.y + orig.h;
  if (mode.includes('w')) left = sn(orig.x + dx);
  if (mode.includes('e')) right = sn(orig.x + orig.w + dx);
  if (mode.includes('n')) top = sn(orig.y + dy);
  if (mode.includes('s')) bottom = sn(orig.y + orig.h + dy);
  const MIN = 1;
  if (right - left < MIN) {
    if (mode.includes('w')) left = right - MIN;
    else right = left + MIN;
  }
  if (bottom - top < MIN) {
    if (mode.includes('n')) top = bottom - MIN;
    else bottom = top + MIN;
  }
  return { x: left, y: top, w: right - left, h: bottom - top };
}

type ToScreen = (p: Pt) => Pt;
type Cells = Computed['grid']['cells'];
type Sides = Computed['shape']['sides'];
type Corners = Computed['shape']['corners'];
type PostShapes = Computed['posts']['shapes'];
type AssignMap = Map<string, string | null>;
type BorderTypeMap = Map<string, Project['borderTypes'][number]>;
type SideMap = Map<string, Side>;
type BBox = Computed['bbox'];

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

// Slat / wood-stripe overlay. Each tile is split into `tile.slats` parallel
// planks along its grain; we draw the `slats - 1` divider lines between them.
// Orientation is per-cell via cellOrientation; cut tiles are clipped to their
// covered region. Kept independent of hover state so it never re-renders on hover.
const PatternLayer = memo(function PatternLayer({
  cells,
  toScreen,
  scale,
  tile,
  layoutPattern,
  grainDirection,
  showPattern,
}: {
  cells: Cells;
  toScreen: ToScreen;
  scale: number;
  tile: Project['tile'];
  layoutPattern: Project['layoutPattern'];
  grainDirection: Project['grainDirection'];
  showPattern: boolean;
}) {
  const nodes = useMemo(() => {
    // 'none' draws no slat stripes at all. cellOrientation only special-cases
    // 'checkerboard', so we must gate on the pattern value here, not on it.
    if (!showPattern || layoutPattern === 'none' || !tile.directional) return null;
    const slats = Math.max(1, Math.floor(tile.slats));
    if (slats < 2) return null; // a single slat has no divider lines
    const w = tile.width * scale;
    const h = tile.height * scale;
    const out: React.ReactNode[] = [];
    for (const cell of cells) {
      const [sx, sy] = toScreen([cell.x, cell.y]);
      const orient = cellOrientation(cell.col, cell.row, layoutPattern, grainDirection);
      // 'h' grain => slats stacked vertically => horizontal divider lines.
      // 'v' grain => slats side by side => vertical divider lines.
      const lines: React.ReactNode[] = [];
      for (let i = 1; i < slats; i++) {
        if (orient === 'h') {
          const y = sy + (h * i) / slats;
          lines.push(
            <line key={i} x1={sx} y1={y} x2={sx + w} y2={y} stroke={SLAT_STROKE} strokeWidth={0.75} strokeOpacity={0.5} />,
          );
        } else {
          const x = sx + (w * i) / slats;
          lines.push(
            <line key={i} x1={x} y1={sy} x2={x} y2={sy + h} stroke={SLAT_STROKE} strokeWidth={0.75} strokeOpacity={0.5} />,
          );
        }
      }
      const key = `p-${cell.x},${cell.y}`;
      if (cell.kind === 'full') {
        out.push(
          <g key={key} style={{ pointerEvents: 'none' }}>
            {lines}
          </g>,
        );
      } else {
        // Clip the full-tile stripe set to the covered (cut) region.
        const clipId = `clip-${cell.x}-${cell.y}`;
        const covered = multiPolyToPath(cell.covered, toScreen);
        out.push(
          <g key={key} style={{ pointerEvents: 'none' }}>
            <clipPath id={clipId} clipRule="evenodd">
              <path d={covered} />
            </clipPath>
            <g clipPath={`url(#${clipId})`}>{lines}</g>
          </g>,
        );
      }
    }
    return out;
  }, [cells, toScreen, scale, tile, layoutPattern, grainDirection, showPattern]);
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

// --- Architectural dimension annotations (AIA / ANSI Y14.2 style) -------------
// Extension (witness) lines, an offset dimension line parallel to the edge,
// tick/arrow terminators, and rotated, legible text. All terminator/gap/text
// metrics are in SCREEN pixels; the dimension-line OFFSET is in world inches so
// it can clear the border face. Pure (no hover state) -> safe to memoize.

type Terminator = 'tick' | 'arrow';

const DIM_LINE = '#475569'; // slate-600 (per-edge)
const DIM_TEXT = '#334155'; // slate-700
const DIM_OVERALL_LINE = '#334155'; // slate-700 (overall chain, slightly heavier)
const DIM_OVERALL_TEXT = '#1e293b'; // slate-800

const EXT_GAP = 3; // gap between geometry and start of extension line (px)
const EXT_OVER = 3; // overshoot of extension line past the dimension line (px)
const TICK_LEN = 10; // length of a 45deg architectural tick (px)
const ARROW_LEN = 9; // engineering arrowhead length (px)
const ARROW_HALF = 3; // engineering arrowhead half-width (px)
const TEXT_NUDGE = 11; // outward nudge of text above the dimension line (px)

function unitVec(from: Pt, to: Pt): Pt {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const m = Math.hypot(dx, dy) || 1;
  return [dx / m, dy / m];
}

// 45deg slash centered on the dimension line at point P.
function tickMark(P: Pt, dl: Pt, color: string, sw: number, key: string): ReactElement {
  const c = Math.SQRT1_2; // cos45 == sin45
  const tx = dl[0] * c - dl[1] * c;
  const ty = dl[0] * c + dl[1] * c;
  const h = TICK_LEN / 2;
  return (
    <line
      key={key}
      x1={P[0] - tx * h}
      y1={P[1] - ty * h}
      x2={P[0] + tx * h}
      y2={P[1] + ty * h}
      stroke={color}
      strokeWidth={sw}
    />
  );
}

// Filled triangle with its tip at P pointing outward along d (toward the witness line).
function arrowMark(P: Pt, d: Pt, color: string, key: string): ReactElement {
  const perp: Pt = [-d[1], d[0]];
  const bx = P[0] - d[0] * ARROW_LEN;
  const by = P[1] - d[1] * ARROW_LEN;
  const p1x = bx + perp[0] * ARROW_HALF;
  const p1y = by + perp[1] * ARROW_HALF;
  const p2x = bx - perp[0] * ARROW_HALF;
  const p2y = by - perp[1] * ARROW_HALF;
  return (
    <polygon
      key={key}
      points={`${P[0].toFixed(2)},${P[1].toFixed(2)} ${p1x.toFixed(2)},${p1y.toFixed(2)} ${p2x.toFixed(2)},${p2y.toFixed(2)}`}
      fill={color}
    />
  );
}

// Build a single dimension annotation between world points aW/bW, with the
// dimension line offset `off` inches along the `outward` unit normal.
function buildDim(
  key: string,
  aW: Pt,
  bW: Pt,
  outward: Pt,
  off: number,
  label: string,
  toScreen: ToScreen,
  terminator: Terminator,
  lineColor: string,
  textColor: string,
  strokeW: number,
  fontSize: number,
  fontWeight: number,
): ReactElement {
  const aOut: Pt = [aW[0] + outward[0] * off, aW[1] + outward[1] * off];
  const bOut: Pt = [bW[0] + outward[0] * off, bW[1] + outward[1] * off];
  const sa = toScreen(aW);
  const sb = toScreen(bW);
  const sAo = toScreen(aOut);
  const sBo = toScreen(bOut);
  const ea = unitVec(sa, sAo); // outward (perpendicular) direction in screen px
  const eb = unitVec(sb, sBo);
  const dl = unitVec(sAo, sBo); // along the dimension line

  const mid: Pt = [(sAo[0] + sBo[0]) / 2, (sAo[1] + sBo[1]) / 2];
  const tn: Pt = [mid[0] + ea[0] * TEXT_NUDGE, mid[1] + ea[1] * TEXT_NUDGE];

  let angle = (Math.atan2(dl[1], dl[0]) * 180) / Math.PI;
  if (angle >= 90) angle -= 180;
  else if (angle < -90) angle += 180;

  const tw = label.length * fontSize * 0.6 + 8;
  const th = fontSize + 6;

  return (
    <g key={key}>
      {/* extension (witness) lines */}
      <line
        x1={sa[0] + ea[0] * EXT_GAP}
        y1={sa[1] + ea[1] * EXT_GAP}
        x2={sAo[0] + ea[0] * EXT_OVER}
        y2={sAo[1] + ea[1] * EXT_OVER}
        stroke={lineColor}
        strokeWidth={strokeW}
      />
      <line
        x1={sb[0] + eb[0] * EXT_GAP}
        y1={sb[1] + eb[1] * EXT_GAP}
        x2={sBo[0] + eb[0] * EXT_OVER}
        y2={sBo[1] + eb[1] * EXT_OVER}
        stroke={lineColor}
        strokeWidth={strokeW}
      />
      {/* dimension line */}
      <line x1={sAo[0]} y1={sAo[1]} x2={sBo[0]} y2={sBo[1]} stroke={lineColor} strokeWidth={strokeW} />
      {/* terminators */}
      {terminator === 'tick' ? (
        <>
          {tickMark(sAo, dl, lineColor, strokeW, `${key}-ta`)}
          {tickMark(sBo, dl, lineColor, strokeW, `${key}-tb`)}
        </>
      ) : (
        <>
          {arrowMark(sAo, [-dl[0], -dl[1]], lineColor, `${key}-aa`)}
          {arrowMark(sBo, dl, lineColor, `${key}-ab`)}
        </>
      )}
      {/* rotated text with a white backing rect */}
      <g transform={`translate(${tn[0].toFixed(2)},${tn[1].toFixed(2)}) rotate(${angle.toFixed(2)})`}>
        <rect
          x={-tw / 2}
          y={-th / 2}
          width={tw}
          height={th}
          rx={2}
          fill="white"
          fillOpacity={0.9}
          stroke="#e2e8f0"
        />
        <text
          x={0}
          y={0}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fontSize}
          fontWeight={fontWeight}
          fill={textColor}
        >
          {label}
        </text>
      </g>
    </g>
  );
}

const DimensionsLayer = memo(function DimensionsLayer({
  sides,
  bbox,
  assignMap,
  borderTypeMap,
  inset,
  toScreen,
  showEdges,
  showOverall,
  unit,
  terminator,
}: {
  sides: Sides;
  bbox: BBox;
  assignMap: AssignMap;
  borderTypeMap: BorderTypeMap;
  inset: boolean;
  toScreen: ToScreen;
  showEdges: boolean;
  showOverall: boolean;
  unit: Unit;
  terminator: Terminator;
}) {
  const nodes = useMemo(() => {
    if (!showEdges && !showOverall) return null;
    let maxFace = 0;
    for (const t of borderTypeMap.values()) maxFace = Math.max(maxFace, t.faceWidth);
    const overallOff = maxFace + 46;

    const out: ReactElement[] = [];

    // Per-edge dimensions: each placed along its own outward normal so the
    // L-shape's reflex corner is handled naturally.
    if (showEdges) {
      for (const side of sides) {
        const assigned = assignMap.get(side.id);
        const t = assigned ? borderTypeMap.get(assigned) : null;
        const face = t?.faceWidth ?? 0;
        const off = (inset ? 0 : face) + 16;
        out.push(
          buildDim(
            `d-${side.id}`,
            side.a,
            side.b,
            side.outward,
            off,
            formatDimension(side.length, unit, true),
            toScreen,
            terminator,
            DIM_LINE,
            DIM_TEXT,
            0.85,
            10,
            400,
          ),
        );
      }
    }

    // Overall bounding dimensions on an OUTER chain (larger offset).
    if (showOverall) {
      out.push(
        buildDim(
          'd-overall-w',
          [bbox.minX, bbox.maxY] as Pt,
          [bbox.maxX, bbox.maxY] as Pt,
          [0, 1] as Pt,
          overallOff,
          formatDimension(bbox.maxX - bbox.minX, unit, true),
          toScreen,
          terminator,
          DIM_OVERALL_LINE,
          DIM_OVERALL_TEXT,
          1.1,
          11,
          600,
        ),
      );
      out.push(
        buildDim(
          'd-overall-h',
          [bbox.minX, bbox.minY] as Pt,
          [bbox.minX, bbox.maxY] as Pt,
          [-1, 0] as Pt,
          overallOff,
          formatDimension(bbox.maxY - bbox.minY, unit, true),
          toScreen,
          terminator,
          DIM_OVERALL_LINE,
          DIM_OVERALL_TEXT,
          1.1,
          11,
          600,
        ),
      );
    }

    return out;
  }, [sides, bbox, assignMap, borderTypeMap, inset, toScreen, showEdges, showOverall, unit, terminator]);

  return <g style={{ pointerEvents: 'none' }}>{nodes}</g>;
});

// Per-post gap dimensions: for each placed post, annotate the two corner gaps
// along its side (start corner -> near face, and far face -> end corner). These
// mirror the sidebar "from start" / "from end" gap inputs:
//   gapStart = pos - width/2   gapEnd = sideLen - pos - width/2
// Drawn with the SAME architectural vocabulary as the edge dimensions, but
// offset INWARD (opposite the outward normal) so they sit clear of the post
// footprint and never collide with the outward edge/overall dimension chains.
// Pure (no hover state) -> memoized; re-renders only when posts/sides/toggle
// state change.
const PostDimensionsLayer = memo(function PostDimensionsLayer({
  posts,
  sideMap,
  toScreen,
  show,
  unit,
  terminator,
}: {
  posts: PostShapes;
  sideMap: SideMap;
  toScreen: ToScreen;
  show: boolean;
  unit: Unit;
  terminator: Terminator;
}) {
  const nodes = useMemo(() => {
    if (!show || posts.length === 0) return null;
    const out: ReactElement[] = [];
    const off = 14; // inches inward from the edge: distinct from the outward edge dims
    for (const ps of posts) {
      const side = sideMap.get(ps.post.sideId);
      if (!side) continue; // post's side no longer exists -> skip gracefully
      const len = side.length;
      if (len <= 0) continue;
      const ux = (side.b[0] - side.a[0]) / len;
      const uy = (side.b[1] - side.a[1]) / len;
      const hw = ps.type.width / 2; // post half-span along the edge
      const pos = Math.max(0, Math.min(len, ps.post.pos));
      const gapStart = pos - hw; // start corner -> near face
      const gapEnd = len - pos - hw; // far face -> end corner
      const inward: Pt = [-side.outward[0], -side.outward[1]];

      if (gapStart > 0.01) {
        const nearFace: Pt = [side.a[0] + ux * (pos - hw), side.a[1] + uy * (pos - hw)];
        out.push(
          buildDim(
            `pd-${ps.post.id}-s`,
            side.a,
            nearFace,
            inward,
            off,
            formatDimension(gapStart, unit, true),
            toScreen,
            terminator,
            DIM_LINE,
            DIM_TEXT,
            0.85,
            10,
            400,
          ),
        );
      }
      if (gapEnd > 0.01) {
        const farFace: Pt = [side.a[0] + ux * (pos + hw), side.a[1] + uy * (pos + hw)];
        out.push(
          buildDim(
            `pd-${ps.post.id}-e`,
            farFace,
            side.b,
            inward,
            off,
            formatDimension(gapEnd, unit, true),
            toScreen,
            terminator,
            DIM_LINE,
            DIM_TEXT,
            0.85,
            10,
            400,
          ),
        );
      }

      // Inward setback annotation: when the post is set back from the edge by a
      // margin, draw a small dimension along the INWARD normal from the edge
      // line to the post's outer face, shifted laterally (along the edge) so it
      // clears the post footprint.
      const setback = ps.post.margin ?? ps.type.margin ?? 0;
      if (setback > 0.01) {
        const edgePt: Pt = [side.a[0] + ux * pos, side.a[1] + uy * pos];
        const outerFace: Pt = [edgePt[0] + inward[0] * setback, edgePt[1] + inward[1] * setback];
        const along: Pt = [ux, uy]; // lateral offset direction (along the edge)
        out.push(
          buildDim(
            `pd-${ps.post.id}-m`,
            edgePt,
            outerFace,
            along,
            hw + 8,
            formatDimension(setback, unit, true),
            toScreen,
            terminator,
            DIM_LINE,
            DIM_TEXT,
            0.85,
            10,
            400,
          ),
        );
      }
    }
    return out;
  }, [posts, sideMap, toScreen, show, unit, terminator]);

  return <g style={{ pointerEvents: 'none' }}>{nodes}</g>;
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
  shapeEditMode = false,
  onSetShapeEditMode,
  selectedRectId = null,
  onSelectRect,
  onUpdateRect,
  onAddRect,
}: Props) {
  const { unit, tile } = project;
  const [showGrid, setShowGrid] = useState(true);
  const [showBorders, setShowBorders] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showEdgeDims, setShowEdgeDims] = useState(true);
  const [showOverallDims, setShowOverallDims] = useState(true);
  const [showPostDims, setShowPostDims] = useState(true);
  const [showPattern, setShowPattern] = useState(true);
  const [terminator, setTerminator] = useState<Terminator>('tick');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [brush, setBrush] = useState<Brush>({
    kind: 'border',
    borderTypeId: project.borderTypes[0]?.id ?? null,
  });
  const [snap, setSnap] = useState(true);
  const [snapStep, setSnapStep] = useState(() => Math.max(1, project.tile.width || 12));

  // Refs mirror zoom/pan so the non-passive wheel handler reads the latest
  // values without re-subscribing (avoids stale-closure bugs).
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  // Drag-to-pan bookkeeping. `moved` distinguishes a pan-drag from a click so
  // side hit-lines still fire on a genuine click.
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; panX: number; panY: number; moved: boolean }>(
    { active: false, startX: 0, startY: 0, panX: 0, panY: 0, moved: false },
  );

  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 6;
  const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

  // Zoom about the viewport center, keeping that point fixed on screen.
  const zoomAboutCenter = useCallback((factor: number) => {
    const el = viewportRef.current;
    const z = zoomRef.current;
    const p = panRef.current;
    const z2 = clampZoom(z * factor);
    if (z2 === z) return;
    const rect = el?.getBoundingClientRect();
    const cx = rect ? rect.width / 2 : 0;
    const cy = rect ? rect.height / 2 : 0;
    const panX2 = cx - (cx - p.x) * (z2 / z);
    const panY2 = cy - (cy - p.y) * (z2 / z);
    setZoom(z2);
    setPan({ x: panX2, y: panY2 });
  }, []);

  // Real fit-to-container: scale the (fixed-width) svg down so the whole drawing
  // fits the viewport, and reset pan. Defined after `width`/`height` below via a
  // size ref so it can read the current svg dimensions without re-creating.
  const sizeRef = useRef({ width: 0, height: 0 });
  const fitView = useCallback(() => {
    const el = viewportRef.current;
    const { width: w, height: h } = sizeRef.current;
    if (!el || !w || !h) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    const availW = el.clientWidth - 32;
    const availH = el.clientHeight - 32;
    if (availW <= 0 || availH <= 0) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    const z = Math.max(ZOOM_MIN, Math.min(1, availW / w, availH / h));
    setZoom(z);
    setPan({ x: 0, y: 0 });
  }, []);

  // Non-passive wheel listener for Ctrl/Cmd + wheel zoom toward the cursor.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return; // let normal wheel scroll pass
      e.preventDefault();
      const z = zoomRef.current;
      const p = panRef.current;
      const factor = Math.exp(-e.deltaY * 0.0015);
      const z2 = clampZoom(z * factor);
      if (z2 === z) return;
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const panX2 = cx - (cx - p.x) * (z2 / z);
      const panY2 = cy - (cy - p.y) * (z2 / z);
      setZoom(z2);
      setPan({ x: panX2, y: panY2 });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const onViewportPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      panX: panRef.current.x,
      panY: panRef.current.y,
      moved: false,
    };
  }, []);

  const onViewportPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d.active) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) > 4) {
      d.moved = true;
      setDragging(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    if (d.moved) {
      setPan({ x: d.panX + dx, y: d.panY + dy });
    }
  }, []);

  const onViewportPointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    d.active = false;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  // If the drag actually moved, swallow the click so it doesn't reach the side
  // hit-lines; a stationary click passes through to place border/cut/post.
  const onViewportClickCapture = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (dragRef.current.moved) {
      e.stopPropagation();
      e.preventDefault();
      dragRef.current.moved = false;
    }
  }, []);

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
    const m = new Map<string, Project['borderTypes'][number]>();
    for (const t of project.borderTypes) m.set(t.id, t);
    return m;
  }, [project.borderTypes]);

  const postTypeMap = useMemo(() => {
    const m = new Map<string, Project['postTypes'][number]>();
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
    const targetW = 820;
    const bboxW = bbox.maxX - bbox.minX;
    // World-inch offset of the OUTERMOST dimension LINE (the overall chain).
    // Must stay in sync with `overallOff` in DimensionsLayer (maxFace + 46).
    const outerLineOff = maxFace + 46;
    // Outward extent (in SCREEN px) of the dimension TEXT beyond that line:
    // TEXT_NUDGE (center nudge) + half the text box height (fontSize 11 -> th 17
    // -> 8.5) + backing-rect stroke, with a few px of slack. This is scale-
    // independent, so in WORLD inches it is textExtentPx / scale.
    const textExtentPx = TEXT_NUDGE + 11 + 6; // ~28px, dominates terminator extent
    // We need: margin >= outerLineOff + textExtentPx / scale, where
    // scale = targetW / (bboxW + 2*margin). Substituting and solving the linear
    // equation for margin yields equality (margin == outerLineOff + textExtentPx/scale),
    // which provably contains the outermost text at ANY scale.
    const denom = 1 - (2 * textExtentPx) / targetW;
    const margin =
      denom > 0
        ? (outerLineOff + (textExtentPx * bboxW) / targetW) / denom
        : outerLineOff + textExtentPx;
    const worldW = bboxW + margin * 2;
    const worldH = bbox.maxY - bbox.minY + margin * 2;
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

  // Keep the svg size in a ref for fitView; auto-fit on mount and whenever the
  // number of shape rectangles changes (e.g. after "+ Add rectangle") so newly
  // placed geometry is always within the visible (un-clipped) area.
  useEffect(() => {
    sizeRef.current = { width, height };
  }, [width, height]);
  const prevRectCountRef = useRef<number | null>(null);
  useEffect(() => {
    const n = project.rects.length;
    if (prevRectCountRef.current === null || prevRectCountRef.current !== n) {
      prevRectCountRef.current = n;
      fitView();
    }
  }, [project.rects.length, width, height, fitView]);

  // Keep the current world<->screen transform in a ref so window-level drag
  // handlers (registered once per drag) always read fresh values.
  const xformRef = useRef({ scale, margin, minX: bbox.minX, minY: bbox.minY });
  useEffect(() => {
    xformRef.current = { scale, margin, minX: bbox.minX, minY: bbox.minY };
  }, [scale, margin, bbox.minX, bbox.minY]);
  const svgRef = useRef<SVGSVGElement | null>(null);

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

  // Client(px) -> world(inch) using the live SVG ref + transform ref. Stable
  // across renders so it can be used inside window event listeners.
  const clientToWorld = useCallback((clientX: number, clientY: number): Pt | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const u = pt.matrixTransform(ctm.inverse());
    const { scale: sc, margin: mg, minX, minY } = xformRef.current;
    return [u.x / sc - mg + minX, u.y / sc - mg + minY];
  }, []);

  const deckPath = useMemo(() => multiPolyToPath(computed.deck, toScreen), [computed.deck, toScreen]);

  const fmt = makeFmt(unit);

  // --- Interactive shape editing (drag-move / resize rectangles) ---
  const rects = project.rects;
  const shapeDragRef = useRef<
    null | { mode: HandleId | 'move'; rectId: string; orig: RectOp; startWorld: Pt }
  >(null);
  const rectPendingRef = useRef<{ id: string; patch: Partial<RectOp> } | null>(null);
  const [draftRect, setDraftRect] = useState<RectOp | null>(null);
  const snapRef = useRef(snap);
  const snapStepRef = useRef(snapStep);
  useEffect(() => {
    snapRef.current = snap;
  }, [snap]);
  useEffect(() => {
    snapStepRef.current = snapStep;
  }, [snapStep]);

  // Commit the final dragged/resized rectangle to global project state. Called
  // once on pointer-up so computeProject (tile/border/post re-flow) runs a single
  // time per drag rather than every frame.
  const flushRectUpdate = useCallback(() => {
    const p = rectPendingRef.current;
    if (p) {
      rectPendingRef.current = null;
      onUpdateRect?.(p.id, p.patch);
    }
  }, [onUpdateRect]);

  // Begin a rect drag. Move/up are handled at the WINDOW level (not via element
  // pointer-capture) so dragging small handles/rectangles keeps tracking even
  // when the cursor leaves the element.
  const beginRectDrag = useCallback(
    (e: ReactPointerEvent<SVGElement>, rectId: string, mode: HandleId | 'move') => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const w = clientToWorld(e.clientX, e.clientY);
      const orig = rects.find((r) => r.id === rectId);
      if (!w || !orig) return;
      onSelectRect?.(rectId);
      shapeDragRef.current = { mode, rectId, orig: { ...orig }, startWorld: w };
      setDraftRect({ ...orig });

      const onMove = (ev: PointerEvent) => {
        const d = shapeDragRef.current;
        if (!d) return;
        const wp = clientToWorld(ev.clientX, ev.clientY);
        if (!wp) return;
        const dx = wp[0] - d.startWorld[0];
        const dy = wp[1] - d.startWorld[1];
        const snapOn = snapRef.current && !ev.altKey;
        const next = applyRectDrag(d.orig, d.mode, dx, dy, snapOn ? snapStepRef.current : 0);
        // Only update the local draft overlay during the drag — this drives the
        // live visual without re-running computeProject. The expensive global
        // commit (which re-flows tiles/borders/posts) happens once on release.
        setDraftRect({ ...d.orig, ...next });
        rectPendingRef.current = { id: d.rectId, patch: next };
      };
      const onUp = () => {
        flushRectUpdate();
        shapeDragRef.current = null;
        setDraftRect(null);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [rects, onSelectRect, clientToWorld, flushRectUpdate],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-3 py-2 text-xs">
        <span className="font-semibold text-slate-600">Layers:</span>
        <Toggle label="Tiles" on={showGrid} set={setShowGrid} />
        <Toggle label="Pattern" on={showPattern} set={setShowPattern} />
        <Toggle label="Borders" on={showBorders} set={setShowBorders} />
        <Toggle label="Dimensions" on={showLabels} set={setShowLabels} />
        <span className="flex items-center gap-1" title="Which dimension categories to show">
          {([
            ['Edges', showEdgeDims, setShowEdgeDims] as const,
            ['Overall', showOverallDims, setShowOverallDims] as const,
            ['Posts', showPostDims, setShowPostDims] as const,
          ]).map(([lbl, on, set]) => (
            <button
              key={lbl}
              aria-label={lbl}
              onClick={() => set(!on)}
              disabled={!showLabels}
              className={`rounded border px-2 py-0.5 ${
                on
                  ? 'border-slate-500 bg-slate-200 font-semibold text-slate-700'
                  : 'border-slate-300 text-slate-600'
              } ${!showLabels ? 'opacity-40' : ''}`}
            >
              {lbl}
            </button>
          ))}
        </span>
        <span className="flex items-center gap-1" title="Dimension terminator style">
          <button
            onClick={() => setTerminator('tick')}
            disabled={!showLabels}
            className={`rounded border px-2 py-0.5 ${
              terminator === 'tick'
                ? 'border-slate-500 bg-slate-200 font-semibold text-slate-700'
                : 'border-slate-300 text-slate-600'
            } ${!showLabels ? 'opacity-40' : ''}`}
          >
            Tick
          </button>
          <button
            onClick={() => setTerminator('arrow')}
            disabled={!showLabels}
            className={`rounded border px-2 py-0.5 ${
              terminator === 'arrow'
                ? 'border-slate-500 bg-slate-200 font-semibold text-slate-700'
                : 'border-slate-300 text-slate-600'
            } ${!showLabels ? 'opacity-40' : ''}`}
          >
            Arrow
          </button>
        </span>
        <span className="ml-auto flex items-center gap-3">
          <span className="flex items-center gap-1" title="Zoom">
            <button
              onClick={() => zoomAboutCenter(1 / 1.2)}
              className="rounded border border-slate-300 px-2 py-0.5 text-slate-600"
              aria-label="Zoom out"
            >
              {'\u2212'}
            </button>
            <span className="w-10 text-center tabular-nums text-slate-600">{`${Math.round(zoom * 100)}%`}</span>
            <button
              onClick={() => zoomAboutCenter(1.2)}
              className="rounded border border-slate-300 px-2 py-0.5 text-slate-600"
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              onClick={fitView}
              className="rounded border border-slate-300 px-2 py-0.5 text-slate-600"
              aria-label="Fit"
            >
              Fit
            </button>
          </span>
          <Legend swatch={FULL_FILL} stroke={FULL_STROKE} label="Full tile" />
          <Legend swatch={CUT_FILL} stroke={CUT_STROKE} label="Cut tile" />
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs">
        <button
          onClick={() => onSetShapeEditMode?.(!shapeEditMode)}
          title="Toggle direct editing of the deck's rectangles on the diagram"
          className={`flex items-center gap-1 rounded border px-2 py-0.5 ${
            shapeEditMode
              ? 'border-amber-500 bg-amber-100 font-semibold text-amber-700'
              : 'border-slate-300 text-slate-600'
          }`}
        >
          {'\u270e'} Edit shape
        </button>
        <span className="mx-1 h-4 w-px bg-slate-300" />
        {shapeEditMode ? (
          <>
            <button
              onClick={() => onAddRect?.()}
              className="rounded bg-sky-600 px-2 py-0.5 font-medium text-white hover:bg-sky-700"
            >
              + Add rectangle
            </button>
            <label className="flex items-center gap-1 text-slate-600">
              <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
              Snap
            </label>
            <label className="flex items-center gap-1 text-slate-500">
              step
              <input
                type="number"
                min={0.25}
                step={0.25}
                value={roundDisplay(fromInches(snapStep, unit), 3)}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!Number.isNaN(v) && v > 0) setSnapStep(toInches(v, unit));
                }}
                className="w-16 rounded border border-slate-300 px-1 py-0.5"
              />
              {UNIT_LABELS[unit]}
            </label>
            <span className="text-slate-400">
              Drag a rectangle to move; drag a handle to resize. Hold Alt to bypass snap.
            </span>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      <div
        ref={viewportRef}
        className={`flex-1 overflow-hidden bg-slate-50 p-4 ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onPointerDown={onViewportPointerDown}
        onPointerMove={onViewportPointerMove}
        onPointerUp={onViewportPointerUp}
        onPointerCancel={onViewportPointerUp}
        onClickCapture={onViewportClickCapture}
      >
        <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
          <svg
            ref={svgRef}
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

          {/* Slat / wood-grain pattern overlay (above fills, below borders) */}
          <PatternLayer
            cells={computed.grid.cells}
            toScreen={toScreen}
            scale={scale}
            tile={tile}
            layoutPattern={project.layoutPattern}
            grainDirection={project.grainDirection}
            showPattern={showPattern}
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

          {/* Architectural dimension annotations (per-edge + overall) */}
          <DimensionsLayer
            sides={computed.shape.sides}
            bbox={bbox}
            assignMap={assignMap}
            borderTypeMap={borderTypeMap}
            inset={computed.inset}
            toScreen={toScreen}
            showEdges={showLabels && showEdgeDims}
            showOverall={showLabels && showOverallDims}
            unit={unit}
            terminator={terminator}
          />

          {/* Per-post corner-gap dimensions (gated by the same Dimensions toggle) */}
          <PostDimensionsLayer
            posts={computed.posts.shapes}
            sideMap={sideMap}
            toScreen={toScreen}
            show={showLabels && showPostDims}
            unit={unit}
            terminator={terminator}
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
                  style={{ cursor: shapeEditMode ? 'default' : 'pointer', pointerEvents: shapeEditMode ? 'none' : 'stroke' }}
                  onMouseEnter={() => !shapeEditMode && onHover?.(side.id)}
                  onMouseLeave={() => !shapeEditMode && onHover?.(null)}
                  onClick={(e) => {
                    if (shapeEditMode) return;
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
            onRemovePost={shapeEditMode ? undefined : onRemovePost}
          />

          {/* Interactive rectangle editing overlay (top-most) */}
          {shapeEditMode && (
            <ShapeEditLayer
              rects={rects}
              draftRect={draftRect}
              selectedRectId={selectedRectId}
              toScreen={toScreen}
              width={width}
              height={height}
              unit={unit}
              onBackgroundClick={() => onSelectRect?.(null)}
              onRectPointerDown={beginRectDrag}
            />
          )}
        </svg>
        </div>
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

const ADD_STROKE = '#0284c7';
const SUB_STROKE = '#dc2626';

// Interactive overlay for editing the deck's defining rectangles. Each rect can
// be dragged (move) or resized via its 8 handles. Drawn top-most in edit mode.
function ShapeEditLayer({
  rects,
  draftRect,
  selectedRectId,
  toScreen,
  width,
  height,
  unit,
  onBackgroundClick,
  onRectPointerDown,
}: {
  rects: RectOp[];
  draftRect: RectOp | null;
  selectedRectId: string | null;
  toScreen: ToScreen;
  width: number;
  height: number;
  unit: Unit;
  onBackgroundClick: () => void;
  onRectPointerDown: (e: ReactPointerEvent<SVGElement>, id: string, mode: HandleId | 'move') => void;
}) {
  return (
    <g>
      {/* Background: click empty space to deselect */}
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="transparent"
        onClick={onBackgroundClick}
      />
      {rects.map((base) => {
        const r = draftRect && draftRect.id === base.id ? draftRect : base;
        const selected = selectedRectId === r.id;
        const tl = toScreen([r.x, r.y]);
        const br = toScreen([r.x + r.w, r.y + r.h]);
        const sx = tl[0];
        const sy = tl[1];
        const sw = br[0] - tl[0];
        const sh = br[1] - tl[1];
        const isSub = r.op === 'subtract';
        const stroke = selected ? '#f59e0b' : isSub ? SUB_STROKE : ADD_STROKE;
        return (
          <g key={`edit-${r.id}`}>
            <rect
              x={sx}
              y={sy}
              width={sw}
              height={sh}
              fill={isSub ? '#ef4444' : '#0ea5e9'}
              fillOpacity={0.1}
              stroke={stroke}
              strokeWidth={selected ? 2 : 1.5}
              strokeDasharray={isSub ? '6 4' : undefined}
              style={{ cursor: 'move' }}
              onPointerDown={(e) => onRectPointerDown(e, r.id, 'move')}
            />
            {/* Live size label */}
            <text
              x={sx + sw / 2}
              y={sy + sh / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={11}
              fontWeight={600}
              fill={selected ? '#b45309' : '#334155'}
              style={{ pointerEvents: 'none' }}
            >
              {`${roundDisplay(fromInches(r.w, unit), 2)} \u00d7 ${roundDisplay(fromInches(r.h, unit), 2)} ${UNIT_LABELS[unit]}`}
            </text>
            {selected &&
              RESIZE_HANDLES.map((hdl) => {
                const hx = sx + hdl.fx * sw;
                const hy = sy + hdl.fy * sh;
                const s = 8;
                return (
                  <rect
                    key={hdl.id}
                    x={hx - s / 2}
                    y={hy - s / 2}
                    width={s}
                    height={s}
                    fill="white"
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    style={{ cursor: hdl.cursor }}
                    onPointerDown={(e) => onRectPointerDown(e, r.id, hdl.id)}
                  />
                );
              })}
          </g>
        );
      })}
    </g>
  );
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
