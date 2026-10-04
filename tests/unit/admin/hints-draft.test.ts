// WS8 hint generator: pure, exactly N candidates, distinct types, first_letter last resort only,
// and never leaks the title.
import { describe, expect, it } from 'vitest';
import { generateHints, hintLeaksTitle, leaksTitle, maskTitle, titleTokens, MASK } from '@/server/admin/hints-draft';
import { generateHints as scriptGenerate } from '../../../scripts/schedule/generate-hints';
import { validateHints } from '@/server/admin/rules';
import { HINT_CANDIDATES_PER_PUZZLE } from '@/config/game';
import type { HintGenerator } from '@/server/db/seed';
import type { LibrarySnapshot } from '@/server/db/repo';
import type { Hint } from '@/lib/types';
import fixture from '@/server/db/fixtures/library.json';
import { HERO, LIB, film } from './helpers';

const byType = (hints: Hint[], t: Hint['type']) => hints.find((h) => h.type === t);

describe('title leak helpers', () => {
  it('finds significant title words and ignores stop words and sequel numerals', () => {
    expect([...titleTokens({ title: 'The Lord of the Rings: Part II', originalTitle: null })].sort()).toEqual(['lord', 'ring']);
    expect([...titleTokens({ title: 'Up', originalTitle: null })]).toEqual(['up']);
    expect([...titleTokens({ title: '1917', originalTitle: null })]).toEqual(['1917']);
  });

  it('detects the title and its words, case and accent insensitive, including plurals', () => {
    expect(leaksTitle('Welcome to the SILVER harbor', HERO)).toBe(true);
    expect(leaksTitle('Harbors are dangerous', HERO)).toBe(true);
    expect(leaksTitle('A quiet port town', HERO)).toBe(false);
    expect(leaksTitle('Amélie returns', { title: 'Amelie', originalTitle: null })).toBe(true);
  });

  it('masks title words but keeps the rest of the sentence', () => {
    expect(maskTitle('Nobody leaves the Silver Harbor alive.', HERO)).toBe(`Nobody leaves the ${MASK} ${MASK} alive.`);
    expect(maskTitle("You'll see it through Forrest Gump's eyes", { title: 'Forrest Gump', originalTitle: null })).toBe(
      `You'll see it through ${MASK} ${MASK} eyes`,
    );
  });
});

describe('generateHints', () => {
  const hints = generateHints(HERO, LIB);

  it('matches the HintGenerator contract and the script re-export', () => {
    const g: HintGenerator = generateHints;
    expect(g(HERO, LIB)).toEqual(hints);
    expect(scriptGenerate(HERO, LIB)).toEqual(hints);
  });

  it(`returns exactly ${HINT_CANDIDATES_PER_PUZZLE} candidates with distinct types`, () => {
    expect(hints).toHaveLength(HINT_CANDIDATES_PER_PUZZLE);
    expect(new Set(hints.map((h) => h.type)).size).toBe(hints.length);
  });

  it('prefers variety: a story clue, a people clue and a context clue', () => {
    expect(hints.map((h) => h.type)).toEqual(['tagline', 'cast_connection', 'awards']);
  });

  it('masks the title in the tagline', () => {
    const t = byType(hints, 'tagline');
    expect(t).toEqual({ type: 'tagline', payload: { text: `Nobody leaves the ${MASK} ${MASK} alive.` } });
  });

  it('drops keywords containing title words and keeps 3 to 5', () => {
    const lib = { ...LIB, awards: [] };
    const noTagline = { ...HERO, tagline: null };
    const kw = byType(generateHints(noTagline, lib), 'plot_keywords');
    expect(kw?.type).toBe('plot_keywords');
    const words = kw && kw.type === 'plot_keywords' ? kw.payload.keywords : [];
    expect(words).not.toContain('harbor');
    expect(words.length).toBeGreaterThanOrEqual(3);
    expect(words.length).toBeLessThanOrEqual(5);
  });

  it('cast connection picks the most popular non-leaking film (skips the title-sharing sequel)', () => {
    const c = byType(hints, 'cast_connection');
    expect(c).toEqual({ type: 'cast_connection', payload: { personName: 'Lena Lead', filmTitle: 'Midnight Express Lane', filmYear: 1990 } });
  });

  it('filmography lists other films by any director in the unit, without title leaks', () => {
    const lib = { ...LIB, awards: [], people: [] }; // no cast names -> no cast connection
    const out = generateHints({ ...HERO, tagline: null }, lib);
    const f = byType(out, 'filmography');
    expect(f).toEqual({ type: 'filmography', payload: { films: [{ title: 'Glass Orchard', year: 1999 }, { title: 'Copper Tide', year: 2003 }] } });
  });

  it('first_letter is never first, only last, and only as a last resort', () => {
    const bare = film({ id: 999, title: 'The Zebra', tagline: null, keywords: [], leadPersonId: null, supportingIds: [], directorUnit: { ids: [77], display: 'Solo' } });
    const out = generateHints(bare, { ...LIB, films: [...LIB.films, bare] });
    expect(out).toHaveLength(HINT_CANDIDATES_PER_PUZZLE);
    expect(out[0]!.type).not.toBe('first_letter');
    expect(out[out.length - 1]).toEqual({ type: 'first_letter', payload: { letter: 'Z' } });
    expect(out.filter((h) => h.type === 'first_letter')).toHaveLength(1);
    // A normal film never needs it.
    expect(hints.some((h) => h.type === 'first_letter')).toBe(false);
  });

  it('only claims sequel status when the title says so', () => {
    const seq = film({ id: 998, title: 'Night Train 2', tagline: null, keywords: [], leadPersonId: null, supportingIds: [], directorUnit: { ids: [78], display: 'S' } });
    const lib = { ...LIB, films: [...LIB.films, seq] };
    expect(byType(generateHints(seq, lib), 'sequel_status')).toEqual({ type: 'sequel_status', payload: { text: 'This film is a sequel.' } });
    expect(byType(generateHints(HERO, LIB), 'sequel_status')).toBeUndefined();
  });

  it('is pure: same output twice and the library is not mutated', () => {
    const before = JSON.stringify(LIB);
    expect(generateHints(HERO, LIB)).toEqual(generateHints(HERO, LIB));
    expect(JSON.stringify(LIB)).toBe(before);
  });

  it('never leaks the title for any film in the fixture library, and eligible films pass validation', () => {
    const lib = fixture as LibrarySnapshot;
    for (const f of lib.films) {
      const out = generateHints(f, lib);
      expect(out).toHaveLength(HINT_CANDIDATES_PER_PUZZLE);
      for (const h of out) expect(hintLeaksTitle(h, f), `${f.title}: ${JSON.stringify(h)}`).toBe(false);
      if (f.isAnswerEligible && f.tagline) expect(validateHints(out, f), f.title).toEqual([]);
    }
  });
});
