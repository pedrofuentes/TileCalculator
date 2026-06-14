import type { Unit } from './types';

// Conversion factor: value_in_inches = value_in_unit * FACTOR[unit]
export const TO_INCHES: Record<Unit, number> = {
  in: 1,
  ft: 12,
  cm: 1 / 2.54,
  mm: 1 / 25.4,
};

export const UNIT_LABELS: Record<Unit, string> = {
  in: 'in',
  ft: 'ft',
  cm: 'cm',
  mm: 'mm',
};

export function toInches(value: number, unit: Unit): number {
  return value * TO_INCHES[unit];
}

export function fromInches(valueInches: number, unit: Unit): number {
  return valueInches / TO_INCHES[unit];
}

/** Round to a sensible number of decimals for display. */
export function roundDisplay(value: number, decimals = 3): number {
  const f = Math.pow(10, decimals);
  return Math.round(value * f) / f;
}

/** Format a length stored in inches into the target unit with a label. */
export function formatLength(valueInches: number, unit: Unit, decimals = 2): string {
  return `${roundDisplay(fromInches(valueInches, unit), decimals)} ${UNIT_LABELS[unit]}`;
}

/** Format an area stored in square inches into the target unit. */
export function formatArea(areaSqInches: number, unit: Unit, decimals = 2): string {
  const f = TO_INCHES[unit];
  const areaInUnit = areaSqInches / (f * f);
  return `${roundDisplay(areaInUnit, decimals)} ${UNIT_LABELS[unit]}\u00b2`;
}

function gcd(a: number, b: number): number {
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

/**
 * Format a length stored in inches as architectural feet-inches notation,
 * e.g. 348 -> `29'-0"`, 90.25 -> `7'-6 1/4"`, 120.875 -> `10'-0 7/8"`.
 * Inches are rounded to the nearest 1/`denom` (default sixteenth) and the
 * fraction is reduced; rounding carries into whole inches and feet.
 */
export function formatFeetInches(valueInches: number, denom = 16): string {
  const sign = valueInches < 0 ? '-' : '';
  const v = Math.abs(valueInches);
  const totalTicks = Math.round(v * denom);
  const wholeInches = Math.floor(totalTicks / denom);
  let num = totalTicks - wholeInches * denom;
  const feet = Math.floor(wholeInches / 12);
  const inches = wholeInches - feet * 12;
  let den = denom;
  if (num > 0) {
    const g = gcd(num, den);
    num /= g;
    den /= g;
  }
  const frac = num > 0 ? ` ${num}/${den}` : '';
  return `${sign}${feet}'-${inches}${frac}"`;
}

/**
 * Format a dimension for architectural/engineering drawings. Uses feet-inches
 * notation when the project unit is feet and `architectural` is on; otherwise
 * falls back to decimal in the selected unit.
 */
export function formatDimension(valueInches: number, unit: Unit, architectural = true): string {
  if (unit === 'ft' && architectural) return formatFeetInches(valueInches);
  return formatLength(valueInches, unit);
}
