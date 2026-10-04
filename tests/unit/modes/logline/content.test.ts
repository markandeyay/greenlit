// Logline content rules (Section 5: written in-house; Section 0 rule 4: no em dashes).
import { describe, expect, it } from 'vitest';
import { LOGLINE } from '@/config/modes';
import { LOGLINES, LOGLINE_FILM_IDS } from '@/server/modes/logline-data';
import type { LibrarySnapshot } from '@/server/db/repo';
import fixture from '@/server/db/fixtures/library.json';

const lib = fixture as LibrarySnapshot;
const byId = new Map(lib.films.map((f) => [f.id, f]));

const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'in', 'on', 'at', 'to', 'for', 'me', 'if', 'you', 'vol', 'part']);

function words(s: string): string[] {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w.length > 1);
}

/** Significant title words: no stop words, no single characters. */
export function titleWords(title: string): string[] {
  return [...new Set(words(title).filter((w) => !STOP.has(w)))];
}

/** A tier word collides with a title word when equal, or equal up to a plural s / es. */
function collides(word: string, t: string): boolean {
  return word === t || word === `${t}s` || word === `${t}es` || t === `${word}s` || t === `${word}es`;
}

describe('logline content', () => {
  it('covers at least 60 films', () => {
    expect(LOGLINE_FILM_IDS.length).toBeGreaterThanOrEqual(60);
  });

  it('every id is an answer-eligible, playable film in the library', () => {
    for (const id of LOGLINE_FILM_IDS) {
      const film = byId.get(id);
      expect(film, `film ${id}`).toBeDefined();
      expect(film!.isPlayable).toBe(true);
      expect(film!.isAnswerEligible).toBe(true);
    }
  });

  it(`every entry has exactly ${LOGLINE.tiers} non-empty, distinct tiers`, () => {
    for (const id of LOGLINE_FILM_IDS) {
      const tiers = LOGLINES[id]!;
      expect(tiers).toHaveLength(LOGLINE.tiers);
      for (const t of tiers) expect(t.trim().length).toBeGreaterThan(15);
      expect(new Set(tiers).size).toBe(LOGLINE.tiers);
    }
  });

  it('no tier contains a significant word of its film title', () => {
    const problems: string[] = [];
    for (const id of LOGLINE_FILM_IDS) {
      const film = byId.get(id)!;
      const banned = [...titleWords(film.title), ...(film.originalTitle ? titleWords(film.originalTitle) : [])];
      LOGLINES[id]!.forEach((tier, i) => {
        for (const w of words(tier)) {
          for (const t of banned) if (collides(w, t)) problems.push(`${film.title} tier ${i + 1}: "${w}"`);
        }
      });
    }
    expect(problems).toEqual([]);
  });

  it('no em dashes or en dashes anywhere', () => {
    for (const id of LOGLINE_FILM_IDS) for (const t of LOGLINES[id]!) expect(t).not.toMatch(/[—–]/);
  });

  it('tier 1 names no year', () => {
    for (const id of LOGLINE_FILM_IDS) expect(LOGLINES[id]![0]).not.toMatch(/\b(18|19|20)\d{2}\b/);
  });

  it('the title helper ignores stop words and punctuation', () => {
    expect(titleWords('Catch Me If You Can')).toEqual(['catch', 'can']);
    expect(titleWords('E.T. the Extra-Terrestrial')).toEqual(['extra', 'terrestrial']);
    expect(titleWords("Schindler's List")).toEqual(['schindler', 'list']);
  });
});
