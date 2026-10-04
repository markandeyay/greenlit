import { describe, expect, it } from 'vitest';
import { computeCallSheet } from '@/lib/callsheet';
import { rangeBarModel, scalePosition } from '@/lib/callsheet/domain';
import { describeRange, describeRangeAccessible, formatUsd } from '@/lib/callsheet/format';
import { compareBoxOffice, compareYear } from '@/lib/verdicts';
import { numericOnly } from './helpers';

describe('formatUsd', () => {
  it.each([
    [950, '$950'],
    [85_000, '$85K'],
    [42_500_000, '$42.5M'],
    [420_000_000, '$420M'],
    [1_700_000_000, '$1.7B'],
    [1_000_000_000, '$1B'],
    [999_960_000, '$1B'],
    [999_960, '$1M'],
    [2_799_000_000, '$2.8B'],
  ])('%d -> %s', (v, out) => {
    expect(formatUsd(v)).toBe(out);
  });
});

describe('range descriptions', () => {
  it('year range, open ends, exact', () => {
    const both = computeCallSheet([
      numericOnly({ year: compareYear(2004, 2009) }),
      numericOnly({ year: compareYear(2014, 2009) }),
    ]).year;
    expect(describeRange(both)).toBe('2008 to 2010');
    expect(describeRangeAccessible(both)).toBe('Year between 2008 and 2010');
    const later = computeCallSheet([numericOnly({ year: compareYear(1990, 2009) })]).year;
    expect(describeRange(later)).toBe('1994 or later');
    const exact = computeCallSheet([numericOnly({ year: compareYear(2009, 2009) })]).year;
    expect(describeRange(exact)).toBe('2009');
  });
  it('box office uses compact dollars and never an em dash', () => {
    const r = computeCallSheet([
      numericOnly({ boxOffice: compareBoxOffice(210_000_000, 800_000_000) }),
      numericOnly({ boxOffice: compareBoxOffice(3_400_000_000, 800_000_000) }),
    ]).boxOffice;
    expect(describeRange(r)).toBe('$420M to $1.7B');
    expect(describeRangeAccessible(r)).toBe('Box office between $420M and $1.7B');
    const over = computeCallSheet([numericOnly({ boxOffice: compareBoxOffice(210_000_000, 800_000_000) })]).boxOffice;
    expect(describeRange(over)).toBe('over $420M');
    expect(describeRange(over)).not.toMatch(/—/);
  });
});

describe('range bar model', () => {
  it('log scale for box office, last guess emphasized', () => {
    const r = computeCallSheet([
      numericOnly({ boxOffice: compareBoxOffice(210_000_000, 800_000_000) }),
      numericOnly({ boxOffice: compareBoxOffice(3_400_000_000, 800_000_000) }),
    ]).boxOffice;
    const m = rangeBarModel(r)!;
    expect(m.scale).toBe('log');
    expect(m.ticks.map((t) => t.emphasized)).toEqual([false, true]);
    expect(m.domain[0]).toBeLessThan(m.lo!);
    expect(m.domain[1]).toBeGreaterThan(m.hi!);
  });
  it('null before any guess', () => {
    expect(rangeBarModel(computeCallSheet([]).year)).toBeNull();
  });
  it('scalePosition clamps and handles log', () => {
    expect(scalePosition(5, [0, 10], 'linear')).toBe(0.5);
    expect(scalePosition(-5, [0, 10], 'linear')).toBe(0);
    expect(scalePosition(100, [10, 1000], 'log')).toBeCloseTo(0.5);
    expect(scalePosition(1, [1, 1], 'linear')).toBe(0.5);
  });
});
