// Casting Call graph: build, BFS, daily pair selection, step validation (WS9).
import { describe, expect, it } from 'vitest';
import { CASTING_CALL } from '@/config/modes';
import { RULES } from '@/config/rules';
import fixture from '@/server/db/fixtures/library.json';
import type { LibrarySnapshot } from '@/server/db/repo';
import type { Film, Person } from '@/lib/types';
import {
  buildCastGraph,
  distancesFrom,
  eligiblePairs,
  filmCast,
  pickDailyPair,
  shortestPath,
  validateChain,
  validateLink,
  wellKnownActors,
  type ChainLink,
} from '@/server/modes/casting-call/graph';

const lib = fixture as LibrarySnapshot;

function film(id: number, lead: number | null, supporting: number[], extra: Partial<Film> = {}): Film {
  return {
    id,
    title: `Film ${id}`,
    originalTitle: null,
    releaseYear: 2000 + id,
    releaseDate: null,
    posterPath: null,
    backdropPath: null,
    runtimeMin: 100,
    boxOfficeUsd: null,
    scoreSnapshot: 50,
    studioId: null,
    directorUnit: { ids: [999], display: 'Someone' },
    leadPersonId: lead,
    supportingIds: supporting,
    genreIds: [18],
    trailerYoutube: null,
    tagline: null,
    keywords: [],
    popularity: 10,
    isPlayable: true,
    isAnswerEligible: false,
    ...extra,
  };
}
const person = (id: number): Person => ({ id, name: `Actor ${id}`, profilePath: null });

// A - f1 - B - f2 - C - f3 - D ; plus a shortcut A - f4 - C ; E isolated in f5 alone with F.
// f6 has 6 supporting ids: the 5th and 6th (beyond the cap) must not be cast.
const films = [
  film(1, 1, [2]),
  film(2, 2, [3]),
  film(3, 3, [4]),
  film(4, 1, [3]),
  film(5, 5, [6]),
  film(6, 7, [8, 9, 10, 11, 12, 13]),
  film(7, 1, [4], { isPlayable: false }),
];
const people = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(person);
const g = buildCastGraph(films, people);

describe('buildCastGraph', () => {
  it('uses the capped billed cast (lead + RULES.maxSupportingCast supporting)', () => {
    expect(filmCast(films[5]!)).toEqual([7, 8, 9, 10, 11]);
    expect(g.films.get(6)!.cast).toHaveLength(1 + RULES.maxSupportingCast);
    expect(g.filmsByPerson.has(12)).toBe(false);
  });

  it('skips unplayable films and indexes filmographies by year', () => {
    expect(g.films.has(7)).toBe(false);
    expect(g.filmsByPerson.get(1)).toEqual([1, 4]);
    expect(g.filmsByPerson.get(3)).toEqual([2, 3, 4]);
  });

  it('builds the full fixture library', () => {
    const big = buildCastGraph(lib.films, lib.people);
    expect(big.films.size).toBeGreaterThan(90);
    for (const f of big.films.values()) for (const pid of f.cast) expect(big.filmsByPerson.get(pid)).toContain(f.id);
  });
});

describe('BFS', () => {
  it('computes distances in films', () => {
    const d = distancesFrom(g, 1);
    expect(d.get(1)).toBe(0);
    expect(d.get(2)).toBe(1);
    expect(d.get(3)).toBe(1); // via the f4 shortcut
    expect(d.get(4)).toBe(2);
    expect(d.has(5)).toBe(false);
  });

  it('returns a shortest, valid chain', () => {
    const p = shortestPath(g, 1, 4)!;
    expect(p).toEqual([
      { filmId: 4, personId: 3 },
      { filmId: 3, personId: 4 },
    ]);
    expect(validateChain(g, { startId: 1, endId: 4 }, p)).toBe(true);
  });

  it('returns null for unconnected actors and [] for the same actor', () => {
    expect(shortestPath(g, 1, 5)).toBeNull();
    expect(shortestPath(g, 1, 1)).toEqual([]);
    expect(shortestPath(g, 1, 424242)).toBeNull();
  });
});

describe('daily pair', () => {
  const big = buildCastGraph(lib.films, lib.people);
  const pairs = eligiblePairs(big);
  const [min, max] = CASTING_CALL.targetPathFilms;

  it('draws from well-known actors (2+ credits)', () => {
    const pool = wellKnownActors(big);
    expect(pool.length).toBeGreaterThan(10);
    for (const id of pool) expect(big.filmsByPerson.get(id)!.length).toBeGreaterThanOrEqual(2);
    expect(pairs.length).toBeGreaterThan(0);
  });

  it('is deterministic per date and connected within the target length', () => {
    for (let day = 1; day <= 60; day++) {
      const date = `2026-${String(Math.ceil(day / 28) + 9).padStart(2, '0')}-${String(((day - 1) % 28) + 1).padStart(2, '0')}`;
      const a = pickDailyPair(big, date)!;
      const b = pickDailyPair(buildCastGraph(lib.films, lib.people), date)!;
      expect(a).toEqual(b);
      expect(a.startId).not.toBe(a.endId);
      expect(a.optimal.length).toBeGreaterThanOrEqual(min);
      expect(a.optimal.length).toBeLessThanOrEqual(max);
      expect(distancesFrom(big, a.startId).get(a.endId)).toBe(a.optimal.length);
      expect(validateChain(big, a, a.optimal)).toBe(true);
      expect(a.optimal.at(-1)!.personId).toBe(a.endId);
    }
  });

  it('varies across days', () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 28; d++) {
      const p = pickDailyPair(big, `2026-11-${String(d).padStart(2, '0')}`)!;
      seen.add(`${p.startId}-${p.endId}`);
    }
    expect(seen.size).toBeGreaterThan(5);
  });

  it('returns null when no pair is eligible', () => {
    expect(pickDailyPair(g, '2026-10-04', [])).toBeNull();
  });
});

describe('validateLink', () => {
  const pair = { startId: 1, endId: 4 };

  it('accepts a film the current actor is in and an actor from that film', () => {
    expect(validateLink(g, pair, [], { filmId: 1, personId: 2 })).toBeNull();
    expect(validateLink(g, pair, [{ filmId: 1, personId: 2 }], { filmId: 2, personId: 3 })).toBeNull();
  });

  it('rejects a film without the current actor', () => {
    expect(validateLink(g, pair, [], { filmId: 3, personId: 4 })).toBe('film_not_with_actor');
    expect(validateLink(g, pair, [], { filmId: 99, personId: 2 })).toBe('film_not_with_actor');
  });

  it('rejects an actor not in the film (including uncapped billing)', () => {
    expect(validateLink(g, pair, [], { filmId: 1, personId: 3 })).toBe('actor_not_in_film');
  });

  it('rejects reused films and actors', () => {
    const chain: ChainLink[] = [{ filmId: 4, personId: 3 }];
    expect(validateLink(g, pair, chain, { filmId: 4, personId: 1 })).toBe('film_used');
    expect(validateLink(g, pair, chain, { filmId: 2, personId: 2 })).toBeNull();
    expect(validateLink(g, { startId: 1, endId: 4 }, [{ filmId: 1, personId: 2 }], { filmId: 2, personId: 2 })).toBe('actor_used');
  });

  it('rejects moves after the end actor is reached or at maxLinks', () => {
    expect(validateLink(g, pair, [{ filmId: 4, personId: 3 }, { filmId: 3, personId: 4 }], { filmId: 2, personId: 2 })).toBe('game_over');
    const long = Array.from({ length: CASTING_CALL.maxLinks }, (_, i) => ({ filmId: 100 + i, personId: 200 + i }));
    expect(validateLink(g, pair, long, { filmId: 1, personId: 2 })).toBe('game_over');
  });
});
