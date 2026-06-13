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
