import type { RectOp, Unit } from '../types';
import { uid } from '../state/defaults';
import { Field, LengthInput, Section } from './ui';

export function ShapeBuilder({
  rects,
  unit,
  onChange,
}: {
  rects: RectOp[];
  unit: Unit;
  onChange: (rects: RectOp[]) => void;
}) {
  const update = (id: string, patch: Partial<RectOp>) =>
    onChange(rects.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: string) => onChange(rects.filter((r) => r.id !== id));
  const add = () =>
    onChange([...rects, { id: uid('rect'), x: 0, y: 0, w: 60, h: 60, op: 'add' }]);

  return (
    <Section
      title="Deck shape (rectangles)"
      right={
        <button
          onClick={add}
          className="rounded bg-sky-600 px-2 py-1 text-xs font-medium text-white hover:bg-sky-700"
        >
          + Add rectangle
        </button>
      }
    >
      <p className="text-xs text-slate-500">
        Build any shape by adding/subtracting rectangles. An L-shape uses two added rectangles.
      </p>
      {rects.map((r, i) => (
        <div key={r.id} className="rounded border border-slate-200 p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Rect {i + 1}</span>
            <div className="flex items-center gap-2">
              <select
                value={r.op}
                onChange={(e) => update(r.id, { op: e.target.value as RectOp['op'] })}
                className="rounded border border-slate-300 px-1 py-0.5 text-xs"
              >
                <option value="add">Add</option>
                <option value="subtract">Subtract</option>
              </select>
              <button
                onClick={() => remove(r.id)}
                className="rounded px-1 text-xs text-red-500 hover:bg-red-50"
              >
                Remove
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <Field label="X">
              <LengthInput valueInches={r.x} unit={unit} onChange={(v) => update(r.id, { x: v })} />
            </Field>
            <Field label="Y">
              <LengthInput valueInches={r.y} unit={unit} onChange={(v) => update(r.id, { y: v })} />
            </Field>
            <Field label="Width">
              <LengthInput valueInches={r.w} unit={unit} min={0} onChange={(v) => update(r.id, { w: v })} />
            </Field>
            <Field label="Height">
              <LengthInput valueInches={r.h} unit={unit} min={0} onChange={(v) => update(r.id, { h: v })} />
            </Field>
          </div>
        </div>
      ))}
    </Section>
  );
}
