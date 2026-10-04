import { describe, expect, it } from 'vitest';
import { OPENING_WEEKEND } from '@/config/modes';
import { buildPool, buildSequence, higherSide, isFairPair, MAX_TENURE, seededRandom } from '@/server/modes/opening-weekend/sequence';
import { allFilms, hidden, noGross, twins } from './helpers';

const pool = buildPool(allFilms);

describe('buildPool', () => {
  it('keeps only playable films with a known gross', () => {
    const ids = pool.map((f) => f.id);
    expect(ids).not.toContain(noGross.id);
    expect(ids).not.toContain(hidden.id);
    expect(ids).toContain(twins[0]!.id);
    expect(pool).toHaveLength(32);
  });
});

describe('isFairPair', () => {
  it('uses OPENING_WEEKEND.minRatio', () => {
    expect(isFairPair(100, 100 * OPENING_WEEKEND.minRatio)).toBe(true);
    expect(isFairPair(100, 100 * (OPENING_WEEKEND.minRatio - 0.01))).toBe(false);
    expect(isFairPair(100, 100)).toBe(false);
  });
});

describe('buildSequence', () => {
  it('is deterministic for a seed and differs across seeds', () => {
    const a = buildSequence(pool, 'seed-a', 40);
    const b = buildSequence(pool, 'seed-a', 40);
    const c = buildSequence(pool, 'seed-b', 40);
    const ids = (s: typeof a) => s.map((p) => `${p.left.id}:${p.right.id}`);
    expect(ids(a)).toEqual(ids(b));
    expect(ids(a)).not.toEqual(ids(c));
    // A prefix request returns the same prefix.
    expect(ids(buildSequence(pool, 'seed-a', 7))).toEqual(ids(a).slice(0, 7));
  });

  it('never deals a pair within minRatio (twins are skipped)', () => {
    for (let s = 0; s < 50; s++) {
      for (const p of buildSequence(pool, `seed-${s}`, 60)) {
        expect(isFairPair(p.left.gross, p.right.gross)).toBe(true);
        expect(p.left.id).not.toBe(p.right.id);
      }
    }
  });

  it('keeps the winner in its slot and brings a challenger into the other, with a tenure cap', () => {
    for (let s = 0; s < 20; s++) {
      const seq = buildSequence(pool, `slot-${s}`, 50);
      // Consecutive pairs each card has been on screen.
      let run = new Map<number, number>([[seq[0]!.left.id, 1], [seq[0]!.right.id, 1]]);
      for (let i = 1; i < seq.length; i++) {
        const prev = seq[i - 1]!;
        const cur = seq[i]!;
        const w = higherSide(prev);
        const winner = prev[w];
        const next = new Map<number, number>();
        if (cur[w].id === winner.id) {
          const other = w === 'left' ? 'right' : 'left';
          expect(cur[other].id).not.toBe(prev[other].id);
          next.set(winner.id, (run.get(winner.id) ?? 0) + 1);
          next.set(cur[other].id, 1);
        } else {
          // Fresh pair: only once the winner has been on screen for MAX_TENURE pairs.
          expect(run.get(winner.id)).toBe(MAX_TENURE);
          expect([cur.left.id, cur.right.id]).not.toContain(winner.id);
          next.set(cur.left.id, 1);
          next.set(cur.right.id, 1);
        }
        for (const v of next.values()) expect(v).toBeLessThanOrEqual(MAX_TENURE);
        run = next;
      }
    }
  });

  it('handles tiny pools', () => {
    expect(buildSequence(pool.slice(0, 1), 'x', 5)).toEqual([]);
    const two = buildSequence(pool.slice(0, 2), 'x', 5);
    expect(two.length).toBeGreaterThan(0);
  });

  it('seededRandom is stable', () => {
    const r1 = seededRandom('abc');
    const r2 = seededRandom('abc');
    expect([r1(), r1(), r1()]).toEqual([r2(), r2(), r2()]);
  });
});
