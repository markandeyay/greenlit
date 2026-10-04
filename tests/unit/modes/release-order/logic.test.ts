import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { RELEASE_ORDER } from '@/config/modes';
import { addDays, daysBetween } from '@/lib/dates';
import {
  compatible,
  isPermutation,
  isWin,
  pickDailySet,
  scoreAttempt,
  servedOrder,
  setPool,
  shortDateLabel,
  sortDate,
  trueOrder,
} from '@/server/modes/release-order/logic';
import { FILMS, film, TODAY } from './helpers';

describe('daily set', () => {
  it('is deterministic for a date and independent of storage order', () => {
    const a = pickDailySet(FILMS, TODAY)!;
    const b = pickDailySet([...FILMS].reverse(), TODAY)!;
    expect(a).toHaveLength(RELEASE_ORDER.filmsPerSet);
    expect(a.map((f) => f.id)).toEqual(b.map((f) => f.id));
  });

  it('changes from day to day', () => {
    const sets = new Set(
      Array.from({ length: 10 }, (_, i) =>
        pickDailySet(FILMS, addDays(TODAY, i))!
          .map((f) => f.id)
          .sort()
          .join(','),
      ),
    );
    expect(sets.size).toBeGreaterThan(5);
  });

  it('keeps every pair at least minDaysApart and never ambiguous', () => {
    // Dense library: films a couple of months apart, every fifth one with only a year.
    const dense = Array.from({ length: 60 }, (_, i) =>
      film({
        id: 100 + i,
        title: `Film ${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26)}`,
        releaseYear: Number(addDays('1990-01-01', i * 41).slice(0, 4)),
        releaseDate: i % 5 === 0 ? null : addDays('1990-01-01', i * 41 + (i % 3) * 7),
      }),
    );
    for (let d = 0; d < 30; d++) {
      const set = pickDailySet(dense, addDays(TODAY, d));
      expect(set).not.toBeNull();
      for (const x of set!) {
        for (const y of set!) {
          if (x === y) continue;
          const dx = sortDate(x);
          const dy = sortDate(y);
          expect(Math.abs(daysBetween(dx.date, dy.date))).toBeGreaterThanOrEqual(RELEASE_ORDER.minDaysApart);
          if (!dx.precise || !dy.precise) expect(dx.year).not.toBe(dy.year);
        }
      }
    }
  });

  it('rejects ties and near ties, year-only films in the same year, and duplicate titles', () => {
    const a = film({ id: 1, title: 'A', releaseYear: 2000, releaseDate: '2000-03-01' });
    const b = film({ id: 2, title: 'B', releaseYear: 2000, releaseDate: '2000-03-20' });
    const c = film({ id: 3, title: 'C', releaseYear: 2000, releaseDate: null });
    const d = film({ id: 4, title: 'D', releaseYear: 2000, releaseDate: '2000-12-30' });
    const e = film({ id: 5, title: 'a', releaseYear: 1980, releaseDate: '1980-01-01' });
    expect(compatible(a, b)).toBe(false);
    expect(compatible(c, d)).toBe(false);
    expect(compatible(a, d)).toBe(true);
    expect(compatible(a, e)).toBe(false);
    expect(sortDate(c)).toEqual({ date: '2000-07-01', precise: false, year: 2000 });
  });

  it('returns null when the library cannot supply a valid set', () => {
    const tied = Array.from({ length: 30 }, (_, i) =>
      film({ id: i + 1, title: `T${i}`, releaseYear: 2001, releaseDate: '2001-05-05' }),
    );
    expect(pickDailySet(tied, TODAY)).toBeNull();
  });

  it('prefers well known films and falls back to the playable library when that pool is small', () => {
    const lib = [
      ...FILMS,
      film({ id: 1, title: 'Obscure', popularity: 1, releaseYear: 1930, releaseDate: '1930-01-01' }),
      film({ id: 2, title: 'Hidden', isPlayable: false, releaseYear: 1931, releaseDate: '1931-01-01' }),
    ];
    const pool = setPool(lib);
    expect(pool.some((f) => f.id === 1)).toBe(false);
    expect(pool.some((f) => f.id === 2)).toBe(false);
    const small = setPool(lib.slice(-8));
    expect(small.some((f) => f.id === 1)).toBe(true);
    expect(small.some((f) => f.id === 2)).toBe(false);
  });
});

describe('served order', () => {
  it('is a deterministic permutation that reads only ids and the date', () => {
    const ids = [9, 3, 7, 1, 5];
    expect(servedOrder(ids, TODAY)).toEqual(servedOrder([1, 3, 5, 7, 9], TODAY));
    expect([...servedOrder(ids, TODAY)].sort((a, b) => a - b)).toEqual([1, 3, 5, 7, 9]);
  });

  it('does not depend on release dates', () => {
    const set = pickDailySet(FILMS, TODAY)!;
    const before = servedOrder(set.map((f) => f.id), TODAY);
    // Same films with different dates: the served order must not move.
    const redated = set.map((f, i) => ({ ...f, releaseDate: `19${40 + ((i * 17) % 50)}-01-01` }));
    expect(servedOrder(redated.map((f) => f.id), TODAY)).toEqual(before);
    expect(trueOrder(redated)).not.toEqual(trueOrder(set));
  });

  it('is uncorrelated with release order across many days', () => {
    // Mean Spearman correlation between served position and true rank stays near zero.
    let sum = 0;
    const days = 300;
    for (let d = 0; d < days; d++) {
      const date = addDays('2027-01-01', d);
      const set = pickDailySet(FILMS, date)!;
      const served = servedOrder(set.map((f) => f.id), date);
      const truth = trueOrder(set);
      const n = served.length;
      const dsq = served.reduce((acc, id, i) => acc + (truth.indexOf(id) - i) ** 2, 0);
      sum += 1 - (6 * dsq) / (n * (n * n - 1));
    }
    expect(Math.abs(sum / days)).toBeLessThan(0.12);
  });
});

describe('scoring', () => {
  it('marks right slot, one slot off, and wrong', () => {
    const truth = [0, 1, 2, 3, 4];
    expect(scoreAttempt([0, 1, 2, 3, 4], truth)).toEqual(['match', 'match', 'match', 'match', 'match']);
    expect(scoreAttempt([1, 0, 2, 4, 3], truth)).toEqual(['close', 'close', 'match', 'close', 'close']);
    expect(scoreAttempt([4, 1, 2, 3, 0], truth)).toEqual(['miss', 'match', 'match', 'match', 'miss']);
    expect(scoreAttempt([2, 0, 4, 1, 3], truth)).toEqual(['miss', 'close', 'miss', 'miss', 'close']);
    expect(isWin(scoreAttempt(truth, truth))).toBe(true);
    expect(isWin(scoreAttempt([1, 0, 2, 3, 4], truth))).toBe(false);
  });

  it('is a win exactly when the order equals the truth (property)', () => {
    fc.assert(
      fc.property(fc.shuffledSubarray([0, 1, 2, 3, 4], { minLength: 5, maxLength: 5 }), (order) => {
        const fb = scoreAttempt(order, [0, 1, 2, 3, 4]);
        expect(isWin(fb)).toBe(order.join() === '0,1,2,3,4');
        expect(fb.filter((v) => v === 'match').length).toBe(order.filter((k, i) => k === i).length);
      }),
    );
  });

  it('validates permutations', () => {
    expect(isPermutation([4, 3, 2, 1, 0], 5)).toBe(true);
    expect(isPermutation([0, 1, 2, 3], 5)).toBe(false);
    expect(isPermutation([0, 1, 2, 3, 3], 5)).toBe(false);
    expect(isPermutation([0, 1, 2, 3, 5], 5)).toBe(false);
    expect(isPermutation([0, 1, 2, 3, 1.5], 5)).toBe(false);
    expect(isPermutation(['0', 1, 2, 3, 4], 5)).toBe(false);
  });

  it('labels dates', () => {
    expect(shortDateLabel('2026-10-04')).toBe('Oct 4');
  });
});
