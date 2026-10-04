// Logline share artifact (design brief v2 principle 8): spoiler free, one verdict row.
import { describe, expect, it } from 'vitest';
import { buildLoglineArtifact } from '@/components/modes/logline/share';

const guesses = [
  { filmId: 1, title: 'Secret Title One', year: 1999, correct: false },
  { filmId: 2, title: 'Secret Title Two', year: 2001, correct: false },
  { filmId: 3, title: 'The Answer Film', year: 2016, correct: true },
];

describe('logline share artifact', () => {
  it('scores a win as takes used with misses then a match', () => {
    const a = buildLoglineArtifact({ date: '2026-10-04', status: 'won', take: 3, maxTakes: 6, guesses });
    expect(a).toMatchObject({ mode: 'logline', reelNumber: null, date: '2026-10-04', outcome: 'won', stat: '3/6', statCaption: 'takes' });
    expect(a.grid).toEqual([['miss', 'miss', 'match']]);
    expect(a.url).toMatch(/\/modes\/logline$/);
    expect(a.text).toContain('3/6');
  });

  it('scores a loss as X and never carries a title or year', () => {
    const lost = guesses.map((g) => ({ ...g, correct: false }));
    const a = buildLoglineArtifact({ date: '2026-10-04', status: 'lost', take: 6, maxTakes: 6, guesses: lost });
    expect(a.outcome).toBe('lost');
    expect(a.stat).toBe('X/6');
    expect(a.grid).toEqual([['miss', 'miss', 'miss']]);
    const json = JSON.stringify(a);
    for (const g of guesses) {
      expect(json).not.toContain(g.title);
      expect(json).not.toContain(String(g.year));
    }
    expect(a.stat.length).toBeLessThanOrEqual(12);
  });
});
