// Display helpers for the Call Sheet. Pure. No em dashes in any output.
import type { NumericRange } from '@/lib/callsheet';

/** Compact USD: $950, $85K, $42.5M, $420M, $1.7B. */
export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '$?';
  const sign = value < 0 ? '-' : '';
  const v = Math.abs(value);
  const units: [number, string][] = [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];
  if (v < 1e3) return `${sign}$${Math.round(v)}`;
  for (let u = units.length - 1; u >= 0; u--) {
    const [size, suffix] = units[u];
    const next = units[u - 1];
    if (next && v >= next[0]) continue;
    const x = v / size;
    let text = x >= 100 ? String(Math.round(x)) : (Math.round(x * 10) / 10).toFixed(1).replace(/\.0$/, '');
    // Rounding up into the next unit (e.g. 999.6M) reads better as the bigger unit.
    if (Number(text) >= 1000 && next) {
      text = (Math.round((v / next[0]) * 10) / 10).toFixed(1).replace(/\.0$/, '');
      return `${sign}$${text}${next[1]}`;
    }
    return `${sign}$${text}${suffix}`;
  }
  return `${sign}$${Math.round(v)}`;
}

const NUMBER_LABEL: Record<NumericRange['attribute'], string> = {
  year: 'Year',
  boxOffice: 'Box office',
  score: 'Score',
};

export function attributeLabel(attribute: NumericRange['attribute']): string {
  return NUMBER_LABEL[attribute];
}

export function formatNumericValue(attribute: NumericRange['attribute'], value: number): string {
  if (attribute === 'boxOffice') return formatUsd(value);
  return String(Math.round(value));
}

/**
 * Short visible text for a numeric row: "2007 to 2011", "2009", "2011 or later",
 * "over $420M", "$420M to $1.7B", "Clues conflict", "Unknown".
 */
export function describeRange(range: NumericRange): string {
  const fmt = (v: number) => formatNumericValue(range.attribute, v);
  const { lo, hi } = range;
  switch (range.status) {
    case 'unknown':
      return 'Unknown';
    case 'conflict':
      return 'Clues conflict';
    case 'exact':
      return range.exact === null ? 'Unknown' : fmt(range.exact);
  }
  if (lo && hi) {
    const a = fmt(lo.value);
    const b = fmt(hi.value);
    return a === b ? `about ${a}` : `${a} to ${b}`;
  }
  if (range.attribute === 'year') {
    if (lo) return `${fmt(lo.value)} or later`;
    if (hi) return `${fmt(hi.value)} or earlier`;
  }
  if (lo) return lo.inclusive ? `at least ${fmt(lo.value)}` : `over ${fmt(lo.value)}`;
  if (hi) return hi.inclusive ? `at most ${fmt(hi.value)}` : `under ${fmt(hi.value)}`;
  return 'Unknown';
}

/** Screen reader sentence: "Year between 2007 and 2011", "Box office over $420M". */
export function describeRangeAccessible(range: NumericRange): string {
  const label = attributeLabel(range.attribute);
  const fmt = (v: number) => formatNumericValue(range.attribute, v);
  const { lo, hi } = range;
  switch (range.status) {
    case 'unknown':
      return `${label} unknown`;
    case 'conflict':
      return `${label}: clues conflict`;
    case 'exact':
      return `${label} confirmed: ${range.exact === null ? 'unknown' : fmt(range.exact)}`;
  }
  if (lo && hi) return `${label} between ${fmt(lo.value)} and ${fmt(hi.value)}`;
  return `${label} ${describeRange(range)}`;
}
