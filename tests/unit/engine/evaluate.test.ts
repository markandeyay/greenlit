import { describe, expect, it } from 'vitest';
import { evaluateGuess, INDEPENDENT_STUDIO_NAME, type FilmContext } from '@/server/evaluate';
import { RULES } from '@/config/rules';
import type { Film } from '@/lib/types';
import type { RegionCode } from '@/config/regions';
import { answerFilm, ETHAN, farFilm, film, JOEL, library, nearFilm, NOLAN } from './helpers';

function ctx(f: Film, certs?: Partial<Record<RegionCode, string>>): FilmContext {
  const certifications: Partial<Record<RegionCode, string>> = {};
  for (const c of library.certifications) if (c.filmId === f.id) certifications[c.region] = c.rating;
  return {
    film: f,
    people: new Map(library.people.map((p) => [p.id, p])),
    studio: library.studios.find((s) => s.id === f.studioId) ?? null,
    genres: library.genres.filter((g) => f.genreIds.includes(g.id)),
    certifications: certs ?? certifications,
  };
}

const A = ctx(answerFilm);

describe('director (4.4)', () => {
  it('matches a single director against a co-directing unit that contains them', () => {
    const fb = evaluateGuess(ctx(nearFilm), A, 'US');
    expect(fb.director).toEqual({ display: 'Joel Coen', verdict: 'match', personIds: [JOEL] });
  });
  it('matches two units sharing one person', () => {
    const g = film({ id: 1, title: 'x', directorUnit: { ids: [ETHAN, 999], display: 'Ethan and Friend' } });
    expect(evaluateGuess(ctx(g), A, 'US').director.verdict).toBe('match');
  });
  it('matches identical units (the Coens vs the Coens)', () => {
    const g = film({ id: 1, title: 'x', directorUnit: { ids: [ETHAN, JOEL], display: 'The Coens' } });
    expect(evaluateGuess(ctx(g), A, 'US').director.verdict).toBe('match');
  });
  it('misses with no shared director, single vs unit', () => {
    const fb = evaluateGuess(ctx(farFilm), A, 'US');
    expect(fb.director).toEqual({ display: 'Christopher Nolan', verdict: 'miss', personIds: [NOLAN] });
  });
  it('single vs single', () => {
    const ans = ctx(film({ id: 9, title: 'a', directorUnit: { ids: [NOLAN], display: 'Christopher Nolan' } }));
    expect(evaluateGuess(ctx(farFilm), ans, 'US').director.verdict).toBe('match');
    expect(evaluateGuess(ctx(nearFilm), ans, 'US').director.verdict).toBe('miss');
  });
});

describe('cast (4.2, presence-based)', () => {
  const fb = evaluateGuess(ctx(nearFilm), A, 'US');
  it("guess lead found in the answer's supporting -> match, answerRole supp", () => {
    expect(fb.lead).toMatchObject({ personId: 11, verdict: 'match', answerRole: 'supp', name: 'Actor 11' });
  });
  it("guess supporting actor who is the answer's lead -> match, answerRole lead", () => {
    expect(fb.supporting[0]).toMatchObject({ personId: 10, verdict: 'match', answerRole: 'lead' });
  });
  it('answer supporting beyond the cap does not count', () => {
    expect(fb.supporting[1]).toMatchObject({ personId: 15, verdict: 'miss' });
    expect(fb.supporting[1]!.answerRole).toBeUndefined();
  });
  it('guess supporting list is capped at RULES.maxSupportingCast', () => {
    expect(fb.supporting).toHaveLength(RULES.maxSupportingCast);
    expect(fb.supporting.map((p) => p.personId)).toEqual([10, 15, 20, 21]);
  });
  it('misses carry no answerRole', () => {
    expect(fb.supporting[2]).toEqual({ personId: 20, name: 'Actor 20', profilePath: null, verdict: 'miss' });
  });
  it('an actor who only directs the answer is a miss', () => {
    const g = film({ id: 1, title: 'x', leadPersonId: JOEL, supportingIds: [] });
    expect(evaluateGuess(ctx(g), A, 'US').lead).toMatchObject({ personId: JOEL, verdict: 'miss' });
  });
  it('null lead and empty supporting', () => {
    const g = film({ id: 1, title: 'x', leadPersonId: null, supportingIds: [] });
    const r = evaluateGuess(ctx(g), A, 'US');
    expect(r.lead).toBeNull();
    expect(r.supporting).toEqual([]);
  });
});

describe('numbers (4.2, 4.3 via verdicts.ts)', () => {
  const at = (o: Partial<Film>) => evaluateGuess(ctx(film({ id: 1, title: 'x', ...o })), A, 'US');
  it('year boundaries', () => {
    expect(at({ releaseYear: 2007 }).year).toEqual({ value: 2007, verdict: 'match', direction: null });
    expect(at({ releaseYear: 2007 - RULES.yearClose }).year).toEqual({ value: 2004, verdict: 'close', direction: 'up' });
    expect(at({ releaseYear: 2007 + RULES.yearClose }).year).toEqual({ value: 2010, verdict: 'close', direction: 'down' });
    expect(at({ releaseYear: 2007 - RULES.yearClose - 1 }).year).toEqual({ value: 2003, verdict: 'miss', direction: 'up' });
  });
  it('score boundaries', () => {
    expect(at({ scoreSnapshot: 80 }).score.verdict).toBe('match');
    expect(at({ scoreSnapshot: 80 + RULES.scoreClose }).score).toEqual({ value: 85, verdict: 'close', direction: 'down' });
    expect(at({ scoreSnapshot: 80 - RULES.scoreClose - 1 }).score).toEqual({ value: 74, verdict: 'miss', direction: 'up' });
    expect(at({ scoreSnapshot: null }).score).toEqual({ value: null, verdict: 'na', direction: null });
  });
  it('box office boundaries (ratio based)', () => {
    expect(at({ boxOfficeUsd: 110_000_000 }).boxOffice.verdict).toBe('match');
    expect(at({ boxOfficeUsd: 91_000_000 }).boxOffice.verdict).toBe('match');
    expect(at({ boxOfficeUsd: 120_000_000 }).boxOffice).toEqual({ value: 120_000_000, verdict: 'close', direction: 'down' });
    expect(at({ boxOfficeUsd: 50_000_000 }).boxOffice).toEqual({ value: 50_000_000, verdict: 'close', direction: 'up' });
    expect(at({ boxOfficeUsd: 49_000_000 }).boxOffice.verdict).toBe('miss');
  });
  it('null box office on the guess side -> na', () => {
    expect(at({ boxOfficeUsd: null }).boxOffice).toEqual({ value: null, verdict: 'na', direction: null });
  });
  it('null box office on the answer side -> na, and the guess value is still shown', () => {
    const ans = ctx({ ...answerFilm, boxOfficeUsd: null });
    expect(evaluateGuess(ctx(nearFilm), ans, 'US').boxOffice).toEqual({ value: 105_000_000, verdict: 'na', direction: null });
  });
  it('null on both sides -> na', () => {
    const ans = ctx({ ...answerFilm, boxOfficeUsd: null });
    expect(evaluateGuess(ctx(farFilm), ans, 'US').boxOffice.verdict).toBe('na');
  });
});

describe('rating (4.6)', () => {
  it('compares in the player region when the answer has a certification there', () => {
    expect(evaluateGuess(ctx(nearFilm), A, 'US').rating).toEqual({ value: 'R', verdict: 'match', region: 'US' });
  });
  it('different certification -> miss', () => {
    const g = ctx(nearFilm, { US: 'PG-13' });
    expect(evaluateGuess(g, A, 'US').rating).toEqual({ value: 'PG-13', verdict: 'miss', region: 'US' });
  });
  it('answer missing the player region -> falls back to US for both sides and tags US', () => {
    // nearFilm has AU 'MA15+' but the answer has no AU certification.
    expect(evaluateGuess(ctx(nearFilm), A, 'AU').rating).toEqual({ value: 'R', verdict: 'match', region: 'US' });
  });
  it('guess missing a certification in the compared region -> na with null value', () => {
    expect(evaluateGuess(ctx(nearFilm), A, 'GB').rating).toEqual({ value: null, verdict: 'na', region: 'GB' });
    expect(evaluateGuess(ctx(farFilm), A, 'US').rating).toEqual({ value: null, verdict: 'na', region: 'US' });
  });
  it('answer missing both player region and US -> na, region US', () => {
    const ans = ctx(answerFilm, { GB: '15' });
    expect(evaluateGuess(ctx(nearFilm), ans, 'AU').rating).toEqual({ value: 'R', verdict: 'na', region: 'US' });
  });
  it('compares case and whitespace insensitively', () => {
    expect(evaluateGuess(ctx(nearFilm, { US: ' r ' }), A, 'US').rating.verdict).toBe('match');
  });
});

describe('studio (4.5, binary)', () => {
  it('same normalized studio id -> match', () => {
    expect(evaluateGuess(ctx(nearFilm), A, 'US').studio).toEqual({ name: 'Focus Features', logoPath: null, verdict: 'match' });
  });
  it('different studio -> miss', () => {
    const g = film({ id: 1, title: 'x', studioId: 2 });
    expect(evaluateGuess(ctx(g), A, 'US').studio).toEqual({ name: 'Universal', logoPath: null, verdict: 'miss' });
  });
  it('guess with no studio shows Independent and misses', () => {
    expect(evaluateGuess(ctx(farFilm), A, 'US').studio).toEqual({ name: INDEPENDENT_STUDIO_NAME, logoPath: null, verdict: 'miss' });
  });
  it('two null studios are a miss, not a match', () => {
    const ans = ctx({ ...answerFilm, studioId: null });
    expect(evaluateGuess(ctx(farFilm), ans, 'US').studio.verdict).toBe('miss');
  });
});

describe('genres', () => {
  it('per chip verdicts and the answer genre count', () => {
    const fb = evaluateGuess(ctx(nearFilm), A, 'US');
    expect(fb.genres).toEqual([
      { id: 18, name: 'Drama', verdict: 'match' },
      { id: 35, name: 'Comedy', verdict: 'miss' },
    ]);
    expect(fb.genreCount).toBe(2);
  });
});

describe('correctness and leak shape', () => {
  it('isCorrect only for the same film id', () => {
    expect(evaluateGuess(ctx(nearFilm), A, 'US').isCorrect).toBe(false);
    const fb = evaluateGuess(A, A, 'US');
    expect(fb.isCorrect).toBe(true);
    expect(fb.year.verdict).toBe('match');
  });
  it('feedback for a wrong guess contains no answer values', () => {
    const body = JSON.stringify(evaluateGuess(ctx(nearFilm), A, 'US'));
    expect(body).not.toContain(answerFilm.title);
    expect(body).not.toContain(String(answerFilm.id));
    expect(body).not.toContain('The Coens');
    expect(body).not.toContain('2007');
    expect(body).not.toContain('100000000');
    expect(body).not.toContain('Crime');
  });
});
