// Range bar domains for numeric Call Sheet rows. Pure.
import { RULES } from '@/config/rules';
import { SCORE_MAX, SCORE_MIN, type NumericRange } from '@/lib/callsheet';

export interface RangeBarModel {
  domain: [number, number];
  scale: 'linear' | 'log';
  /** Known range; null sides are unbounded (the bar runs to the domain edge). */
  lo: number | null;
  hi: number | null;
  ticks: { value: number; emphasized: boolean; guessIndex: number }[];
}

/** Builds the range bar model for a numeric row, or null when nothing is known yet. */
export function rangeBarModel(range: NumericRange): RangeBarModel | null {
  if (range.status === 'unknown' || range.ticks.length === 0) return null;
  const lastIndex = range.ticks[range.ticks.length - 1].guessIndex;
  const ticks = range.ticks.map((t) => ({
    value: t.value,
    emphasized: t.guessIndex === lastIndex,
    guessIndex: t.guessIndex,
  }));
  const values = [...ticks.map((t) => t.value)];
  if (range.lo) values.push(range.lo.value);
  if (range.hi) values.push(range.hi.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const lo = range.lo?.value ?? null;
  const hi = range.hi?.value ?? null;

  if (range.attribute === 'score') {
    return { domain: [SCORE_MIN, SCORE_MAX], scale: 'linear', lo, hi, ticks };
  }
  if (range.attribute === 'year') {
    const pad = RULES.yearClose + 1;
    return { domain: [Math.floor(min - pad), Math.ceil(max + pad)], scale: 'linear', lo, hi, ticks };
  }
  const ratio = RULES.boxOfficeCloseRatio;
  const dMin = Math.max(1, min / ratio);
  const dMax = Math.max(dMin * ratio, max * ratio);
  return { domain: [dMin, dMax], scale: 'log', lo, hi, ticks };
}

/** Position of `value` within the domain as a 0..1 fraction (clamped). */
export function scalePosition(value: number, domain: [number, number], scale: 'linear' | 'log'): number {
  const [d0, d1] = domain;
  let t: number;
  if (scale === 'log') {
    const a = Math.log(Math.max(d0, Number.MIN_VALUE));
    const b = Math.log(Math.max(d1, Number.MIN_VALUE));
    t = b === a ? 0.5 : (Math.log(Math.max(value, Number.MIN_VALUE)) - a) / (b - a);
  } else {
    t = d1 === d0 ? 0.5 : (value - d0) / (d1 - d0);
  }
  if (!Number.isFinite(t)) return 0.5;
  return Math.min(1, Math.max(0, t));
}
