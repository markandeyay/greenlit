// Status vocabulary shared by every verdict surface (Sections 2.1, 2.3, 4.2, 6.7).
// One color means one thing; color is never the only signal (glyph + words + aria-label).
import type { Direction, Verdict } from '@/lib/types';

export type CellVerdict = Verdict | 'empty';

/** Glyph per verdict: check for match, approx for close, nothing otherwise. */
export function statusGlyph(verdict: CellVerdict): string | null {
  if (verdict === 'match') return '✓';
  if (verdict === 'close') return '≈';
  return null;
}

/** Spoken verdict words for aria-labels. */
export function verdictWords(verdict: CellVerdict): string {
  switch (verdict) {
    case 'match':
      return 'match';
    case 'close':
      return 'close';
    case 'miss':
      return 'no match';
    case 'na':
      return 'not available';
    case 'empty':
      return 'empty slot';
  }
}

export type NumericAttribute = 'year' | 'boxOffice' | 'score';

const WORDS: Record<NumericAttribute, { up: string; down: string }> = {
  year: { up: 'LATER', down: 'EARLIER' },
  boxOffice: { up: 'BIGGER', down: 'SMALLER' },
  score: { up: 'HIGHER', down: 'LOWER' },
};

/**
 * Direction word for a numeric cell (Section 2.3: words, not arrows). `up` means the answer
 * is later / bigger / higher. Green cells and N/A cells show no word.
 */
export function directionWord(attr: NumericAttribute, direction: Direction, verdict: Verdict): string | null {
  if (verdict === 'match' || verdict === 'na' || direction === null) return null;
  return direction === 'up' ? WORDS[attr].up : WORDS[attr].down;
}

/** "Year 2006, close, answer is later." */
export function cellAriaLabel({
  label,
  value,
  verdict,
  direction,
  extra,
}: {
  label: string;
  value?: string | number | null;
  verdict: CellVerdict;
  /** A direction word such as "LATER"; read as "answer is later". */
  direction?: string | null;
  /** Any trailing info, e.g. "in the answer as lead". */
  extra?: string | null;
}): string {
  const parts: string[] = [];
  const head = value === undefined || value === null || value === '' ? label : `${label} ${value}`;
  parts.push(head);
  parts.push(verdictWords(verdict));
  if (direction) parts.push(`answer is ${direction.toLowerCase()}`);
  if (extra) parts.push(extra);
  return `${parts.join(', ')}.`;
}
