import { describe, expect, it } from 'vitest';
import { RULES } from '@/config/rules';
import {
  boxOfficeBoundsFor,
  computeCallSheet,
  integerBoundsFor,
  rangeContains,
  type NumericRange,
} from '@/lib/callsheet';
import { compareBoxOffice, compareScore, compareYear } from '@/lib/verdicts';
import { film, numericOnly, simulateFeedback } from './helpers';

const Y = RULES.yearClose;
const S = RULES.scoreClose;
const G = 1 + RULES.boxOfficeGreenPct;
const R = RULES.boxOfficeCloseRatio;

function yearSheet(...pairs: [number, number][]) {
  return computeCallSheet(pairs.map(([g, a]) => numericOnly({ year: compareYear(g, a) }))).year;
}
function lohi(r: NumericRange) {
  return [r.lo?.value ?? null, r.hi?.value ?? null];
}

describe('integer bounds (year)', () => {
  it('match pins the exact value', () => {
    const r = yearSheet([2009, 2009]);
    expect(r.status).toBe('exact');
    expect(r.exact).toBe(2009);
    expect(r.confirmed).toBe(true);
  });
  it('close up -> [g+1, g+band]', () => {
    expect(lohi(yearSheet([2000, 2002]))).toEqual([2001, 2000 + Y]);
  });
  it('close down -> [g-band, g-1]', () => {
    expect(lohi(yearSheet([2000, 1998]))).toEqual([2000 - Y, 1999]);
  });
  it('miss up -> [g+band+1, inf)', () => {
    expect(lohi(yearSheet([2000, 2010]))).toEqual([2000 + Y + 1, null]);
  });
  it('miss down -> (-inf, g-band-1]', () => {
    expect(lohi(yearSheet([2000, 1980]))).toEqual([null, 2000 - Y - 1]);
  });
  it('boundary values: exactly band away is close, band+1 is miss', () => {
    const close = yearSheet([2000, 2000 + Y]);
    expect(rangeContains(close, 2000 + Y)).toBe(true);
    expect(rangeContains(close, 2000)).toBe(false);
    const miss = yearSheet([2000, 2000 + Y + 1]);
    expect(rangeContains(miss, 2000 + Y + 1)).toBe(true);
    expect(rangeContains(miss, 2000 + Y)).toBe(false);
  });
  it('intersects several guesses and tracks which guess set each bound', () => {
    const r = yearSheet([1990, 2009], [2020, 2009], [2007, 2009]);
    expect(lohi(r)).toEqual([2008, 2010]);
    expect(r.lo?.from).toBe(2);
    expect(r.hi?.from).toBe(2);
    expect(r.guessIndices).toEqual([0, 1, 2]);
    expect(r.ticks.map((t) => t.value)).toEqual([1990, 2020, 2007]);
  });
  it('na is skipped entirely', () => {
    const r = computeCallSheet([numericOnly({}), numericOnly({ year: compareYear(2000, 2001) })]).year;
    expect(r.guessIndices).toEqual([1]);
    expect(computeCallSheet([numericOnly({})]).year.status).toBe('unknown');
  });
  it('marks contradictory clues as conflict without throwing', () => {
    const r = computeCallSheet([
      numericOnly({ year: { value: 2000, verdict: 'match', direction: null } }),
      numericOnly({ year: { value: 1990, verdict: 'miss', direction: 'down' } }),
    ]);
    expect(r.year.status).toBe('conflict');
    expect(r.conflict).toBe(true);
  });
  it('close without a direction falls back to the full band', () => {
    expect(integerBoundsFor({ value: 10, verdict: 'close', direction: null }, 3)).toEqual({
      lo: { value: 7, inclusive: true },
      hi: { value: 13, inclusive: true },
    });
    expect(integerBoundsFor({ value: 10, verdict: 'miss', direction: null }, 3)).toBeNull();
  });
});

describe('integer bounds (score)', () => {
  it('uses scoreClose and clamps to 0..100', () => {
    const up = computeCallSheet([numericOnly({ score: compareScore(80, 99) })]).score;
    expect(lohi(up)).toEqual([80 + S + 1, 100]);
    const down = computeCallSheet([numericOnly({ score: compareScore(10, 2) })]).score;
    expect(lohi(down)).toEqual([0, 10 - S - 1]);
    const close = computeCallSheet([numericOnly({ score: compareScore(70, 73) })]).score;
    expect(lohi(close)).toEqual([71, 70 + S]);
  });
});

describe('box office bounds', () => {
  const g = 100_000_000;
  const bo = (answer: number) => computeCallSheet([numericOnly({ boxOffice: compareBoxOffice(g, answer) })]).boxOffice;
  it('match -> [g/(1+p), g*(1+p)], confirmed, not exact', () => {
    const r = bo(105_000_000);
    expect(r.confirmed).toBe(true);
    expect(r.status).toBe('range');
    expect(r.lo!.value).toBeCloseTo(g / G, -1);
    expect(r.hi!.value).toBeCloseTo(g * G, -1);
  });
  it('close up -> (g*(1+p), g*r]', () => {
    const r = bo(150_000_000);
    expect(r.lo!.inclusive).toBe(false);
    expect(r.lo!.value).toBeCloseTo(g * G, -1);
    expect(r.hi!.value).toBeCloseTo(g * R, -1);
  });
  it('close down -> [g/r, g/(1+p))', () => {
    const r = bo(60_000_000);
    expect(r.lo!.value).toBeCloseTo(g / R, -1);
    expect(r.hi!.value).toBeCloseTo(g / G, -1);
    expect(r.hi!.inclusive).toBe(false);
  });
  it('miss up -> (g*r, inf); miss down -> (0, g/r)', () => {
    const up = bo(500_000_000);
    expect(up.hi).toBeNull();
    expect(up.lo!.value).toBeCloseTo(g * R, -1);
    const down = bo(10_000_000);
    expect(down.lo).toBeNull();
    expect(down.hi!.value).toBeCloseTo(g / R, -1);
  });
  it('exact thresholds stay inside the derived range', () => {
    for (const answer of [g * G, g / G, g * R, g / R, 110_000_000, 200_000_000, 50_000_000]) {
      expect(rangeContains(bo(answer), answer)).toBe(true);
    }
  });
  it('ignores non-positive or null values', () => {
    expect(boxOfficeBoundsFor({ value: 0, verdict: 'miss', direction: 'up' })).toBeNull();
    expect(boxOfficeBoundsFor({ value: null, verdict: 'na', direction: null })).toBeNull();
  });
});

describe('sets', () => {
  const answer = film({
    id: 1,
    directorIds: [7, 8],
    directorDisplay: 'The Coens',
    leadId: 100,
    supportingIds: [101, 102],
    studio: 'Focus',
    rating: 'R',
    genres: [1, 2, 3],
  });

  it('confirms the director and cuts others', () => {
    const fb = [
      simulateFeedback(answer, film({ id: 2, directorIds: [50], directorDisplay: 'Someone' })),
      simulateFeedback(answer, film({ id: 3, directorIds: [50], directorDisplay: 'Someone' })),
      simulateFeedback(answer, film({ id: 4, directorIds: [8], directorDisplay: 'Ethan Coen' })),
    ];
    const s = computeCallSheet(fb);
    expect(s.director.confirmed?.display).toBe('Ethan Coen');
    expect(s.director.confirmed?.guessIndices).toEqual([2]);
    expect(s.director.cut).toHaveLength(1);
    expect(s.director.cut[0].guessIndices).toEqual([0, 1]);
  });

  it('dedupes cast by personId, keeps answerRole on confirmed', () => {
    const fb = [
      simulateFeedback(answer, film({ id: 2, leadId: 101, supportingIds: [500, 501] })),
      simulateFeedback(answer, film({ id: 3, leadId: 500, supportingIds: [100] })),
    ];
    const s = computeCallSheet(fb);
    expect(s.cast.confirmed.map((c) => [c.personId, c.answerRole])).toEqual([
      [101, 'supp'],
      [100, 'lead'],
    ]);
    expect(s.cast.cut.map((c) => c.personId)).toEqual([500, 501]);
    expect(s.cast.cut[0].guessIndices).toEqual([0, 1]);
  });

  it('rating, studio and genres', () => {
    const fb = [
      simulateFeedback(answer, film({ id: 2, rating: 'PG', studio: 'A24', genres: [1, 9] })),
      simulateFeedback(answer, film({ id: 3, rating: 'PG', studio: 'Universal', genres: [9, 10] })),
      simulateFeedback(answer, film({ id: 4, rating: null, studio: 'A24', genres: [2] })),
    ];
    const s = computeCallSheet(fb);
    expect(s.rating.confirmed).toBeNull();
    expect(s.rating.cut.map((r) => r.value)).toEqual(['PG']);
    expect(s.rating.guessIndices).toEqual([0, 1]);
    expect(s.studio.cut.map((x) => x.name)).toEqual(['A24', 'Universal']);
    expect(s.genres.confirmed.map((x) => x.id)).toEqual([1, 2]);
    expect(s.genres.cut.map((x) => x.id)).toEqual([9, 10]);
    expect(s.genres.total).toBe(3);
    expect(s.genres.remaining).toBe(1);

    const won = computeCallSheet([...fb, simulateFeedback(answer, answer)]);
    expect(won.rating.confirmed).toMatchObject({ value: 'R', region: 'US', guessIndices: [3] });
    expect(won.studio.confirmed?.name).toBe('Focus');
    expect(won.solved).toBe(true);
    expect(won.genres.remaining).toBe(0);
  });

  it('counts confirmed facts for the strip', () => {
    const s = computeCallSheet([simulateFeedback(answer, answer)]);
    // director + 3 cast + year + box office + score + rating + studio + 3 genres
    expect(s.counts.confirmed).toBe(1 + 3 + 3 + 1 + 1 + 3);
    expect(s.counts.cut).toBe(0);
  });

  it('empty feedback is a clean empty state', () => {
    const s = computeCallSheet([]);
    expect(s.guessCount).toBe(0);
    expect(s.year.status).toBe('unknown');
    expect(s.genres.total).toBeNull();
    expect(s.counts).toEqual({ confirmed: 0, cut: 0 });
  });
});
