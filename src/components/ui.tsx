import { useEffect, useState } from 'react';
import type { Unit } from '../types';
import { fromInches, roundDisplay, toInches, UNIT_LABELS } from '../units';

export function Section({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        {right}
      </header>
      <div className="space-y-3 p-3">{children}</div>
    </section>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span className="text-slate-600">{label}</span>
      {children}
    </label>
  );
}

/**
 * Numeric input whose underlying value is stored in inches but displayed/edited
 * in the active unit. Keeps a local string draft so decimals can be typed.
 */
export function LengthInput({
  valueInches,
  unit,
  onChange,
  className = '',
  min,
  ariaLabel,
  fullWidth = false,
}: {
  valueInches: number;
  unit: Unit;
  onChange: (inches: number) => void;
  className?: string;
  min?: number;
  ariaLabel?: string;
  fullWidth?: boolean;
}) {
  const display = () => String(roundDisplay(fromInches(valueInches, unit), 4));
  const [draft, setDraft] = useState(display);

  useEffect(() => {
    setDraft(display());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueInches, unit]);

  const commit = (raw: string) => {
    const parsed = parseFloat(raw);
    if (!Number.isNaN(parsed)) {
      let inches = toInches(parsed, unit);
      if (min !== undefined && inches < min) inches = min;
      onChange(inches);
    } else {
      setDraft(display());
    }
  };

  return (
    <span className={`items-center gap-1 ${fullWidth ? 'flex w-full' : 'inline-flex'}`}>
      <input
        type="number"
        step="any"
        aria-label={ariaLabel}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className={`${fullWidth ? 'w-full min-w-0' : 'w-24'} rounded border border-slate-300 px-2 py-1 text-right text-sm focus:border-sky-500 focus:outline-none ${className}`}
      />
      <span className="w-6 text-xs text-slate-400">{UNIT_LABELS[unit]}</span>
    </span>
  );
}

export function NumberBox({
  value,
  onChange,
  className = '',
  step = 'any',
  min,
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  step?: string;
  min?: number;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <input
      type="number"
      step={step}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        const p = parseFloat(e.target.value);
        if (!Number.isNaN(p)) onChange(min !== undefined ? Math.max(min, p) : p);
        else setDraft(String(value));
      }}
      className={`w-20 rounded border border-slate-300 px-2 py-1 text-right text-sm focus:border-sky-500 focus:outline-none ${className}`}
    />
  );
}
