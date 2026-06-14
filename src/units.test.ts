import { describe, expect, test } from 'vitest';
import type { Unit } from './types';
import {
  UNIT_LABELS,
  formatArea,
  formatDimension,
  formatFeetInches,
  formatLength,
  fromInches,
  roundDisplay,
  toInches,
} from './units';

const units: Unit[] = ['in', 'ft', 'cm', 'mm', 'm'];

describe('unit conversions', () => {
  test('round-trips values through inches for every unit', () => {
    for (const unit of units) {
      expect(fromInches(toInches(5, unit), unit)).toBeCloseTo(5);
    }
  });

  test('converts common units to inches', () => {
    expect(toInches(1, 'ft')).toBeCloseTo(12);
    expect(toInches(1, 'cm')).toBeCloseTo(0.3937);
    expect(toInches(1, 'm')).toBeCloseTo(39.3700787);
    expect(toInches(1, 'mm')).toBeCloseTo(0.03937);
  });
});

describe('unit display formatting', () => {
  test('roundDisplay rounds to the requested decimal places', () => {
    expect(roundDisplay(12.3456, 2)).toBe(12.35);
    expect(roundDisplay(12.3456)).toBe(12.346);
  });

  test('formatLength includes the selected unit label', () => {
    for (const unit of units) {
      expect(formatLength(12, unit)).toContain(UNIT_LABELS[unit]);
    }
  });

  test('formatArea includes the selected squared unit label', () => {
    for (const unit of units) {
      expect(formatArea(144, unit)).toContain(`${UNIT_LABELS[unit]}²`);
    }
  });

  test('formatFeetInches formats whole feet and reduced fractions', () => {
    expect(formatFeetInches(24)).toBe('2\'-0"');
    expect(formatFeetInches(90.25)).toBe('7\'-6 1/4"');
  });

  test('formatDimension uses architectural notation only for feet when enabled', () => {
    expect(formatDimension(90.25, 'ft', true)).toBe('7\'-6 1/4"');
    expect(formatDimension(90.25, 'ft', false)).toBe('7.52 ft');
    expect(formatDimension(90.25, 'ft', true)).not.toBe(formatDimension(90.25, 'ft', false));
  });
});
