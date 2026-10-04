// Guess evaluation (Sections 4.2 to 4.6, 10.2). Pure: no I/O, no clock.
//
// The returned GuessFeedback contains ONLY the guessed film's values plus verdicts relative to
// the answer. No answer attribute is ever copied into it.
//
// Rules and decisions:
// - Director (4.4): match if the two directing units share at least one person id. Co-directing
//   units are compared as sets, so "The Coens" matches a film by Joel Coen alone.
// - Lead and supporting (4.2): presence-based. A guessed actor is a match if they appear anywhere
//   in the answer's capped billed cast (lead + first RULES.maxSupportingCast supporting).
//   `answerRole` is set ONLY on a match: 'lead' if they are the answer's lead, else 'supp'.
//   Directing the answer does not count: an actor who only appears in the answer's director unit
//   is a miss, and 'director' is never emitted by this evaluator.
//   The guess's own supporting list is capped at RULES.maxSupportingCast as well.
// - Year, box office, score: src/lib/verdicts.ts only.
// - Rating (4.6, 9.1 item 2): compare certifications for the player's region. If the ANSWER has
//   no certification there, both sides use FALLBACK_REGION and `region` reports it. If either
//   side is still missing a certification after that, the verdict is 'na' (value is the guess's
//   certification or null). Certifications compare trimmed and case-insensitively.
// - Studio (4.5): binary on the normalized (headline) studio id. A null studio on either side is
//   a miss (two unknown studios are not evidence of the same studio). A guess with no studio is
//   displayed as INDEPENDENT_STUDIO_NAME.
// - Genres: one chip per guessed genre, match if the answer has that genre id. genreCount is the
//   answer's genre count (intended information, 4.7).
// - isCorrect: same film id.
import { RULES } from '@/config/rules';
import { FALLBACK_REGION, type RegionCode } from '@/config/regions';
import { compareBoxOffice, compareScore, compareYear } from '@/lib/verdicts';
import type { Film, Genre, GuessFeedback, Person, PersonFeedback, Studio } from '@/lib/types';

export const INDEPENDENT_STUDIO_NAME = 'Independent';
export const UNKNOWN_PERSON_NAME = 'Unknown';

/** A film plus everything needed to evaluate it, resolved server-side. */
export interface FilmContext {
  film: Film;
  /** People referenced by the film's director unit and billed cast, by id. Missing ids are tolerated. */
  people: ReadonlyMap<number, Person>;
  studio: Studio | null;
  /** Genre records for film.genreIds (any order). Missing ids get a generic name. */
  genres: readonly Genre[];
  /** Certification by region. */
  certifications: Partial<Record<RegionCode, string>>;
}

/** The answer's capped billed cast: lead first, then up to RULES.maxSupportingCast supporting. */
export function cappedCast(film: Film): { lead: number | null; supporting: number[] } {
  return { lead: film.leadPersonId, supporting: film.supportingIds.slice(0, RULES.maxSupportingCast) };
}

function personFeedback(personId: number, ctx: FilmContext, answer: Film): PersonFeedback {
  const person = ctx.people.get(personId);
  const cast = cappedCast(answer);
  const base = {
    personId,
    name: person?.name ?? UNKNOWN_PERSON_NAME,
    profilePath: person?.profilePath ?? null,
  };
  if (cast.lead === personId) return { ...base, verdict: 'match', answerRole: 'lead' };
  if (cast.supporting.includes(personId)) return { ...base, verdict: 'match', answerRole: 'supp' };
  return { ...base, verdict: 'miss' };
}

function normalizeCert(s: string): string {
  return s.trim().toUpperCase();
}

export function evaluateRating(
  guess: FilmContext,
  answer: FilmContext,
  region: RegionCode,
): GuessFeedback['rating'] {
  const compared: RegionCode = answer.certifications[region] ? region : FALLBACK_REGION;
  const g = guess.certifications[compared] ?? null;
  const a = answer.certifications[compared] ?? null;
  if (!g || !a) return { value: g, verdict: 'na', region: compared };
  return { value: g, verdict: normalizeCert(g) === normalizeCert(a) ? 'match' : 'miss', region: compared };
}

export function evaluateGuess(guess: FilmContext, answer: FilmContext, region: RegionCode): GuessFeedback {
  const gf = guess.film;
  const af = answer.film;

  const answerDirectors = new Set(af.directorUnit.ids);
  const directorMatch = gf.directorUnit.ids.some((id) => answerDirectors.has(id));

  const genreNames = new Map(guess.genres.map((g) => [g.id, g.name]));
  const answerGenres = new Set(af.genreIds);

  const studioMatch = gf.studioId !== null && af.studioId !== null && gf.studioId === af.studioId;

  return {
    filmId: gf.id,
    title: gf.title,
    posterPath: gf.posterPath,
    director: {
      display: gf.directorUnit.display,
      verdict: directorMatch ? 'match' : 'miss',
      personIds: [...gf.directorUnit.ids],
    },
    lead: gf.leadPersonId !== null ? personFeedback(gf.leadPersonId, guess, af) : null,
    supporting: gf.supportingIds.slice(0, RULES.maxSupportingCast).map((id) => personFeedback(id, guess, af)),
    year: compareYear(gf.releaseYear, af.releaseYear),
    boxOffice: compareBoxOffice(gf.boxOfficeUsd, af.boxOfficeUsd),
    score: compareScore(gf.scoreSnapshot, af.scoreSnapshot),
    rating: evaluateRating(guess, answer, region),
    studio: {
      name: guess.studio?.name ?? INDEPENDENT_STUDIO_NAME,
      logoPath: guess.studio?.logoPath ?? null,
      verdict: studioMatch ? 'match' : 'miss',
    },
    genres: gf.genreIds.map((id) => ({
      id,
      name: genreNames.get(id) ?? `Genre ${id}`,
      verdict: answerGenres.has(id) ? 'match' : 'miss',
    })),
    genreCount: af.genreIds.length,
    isCorrect: gf.id === af.id,
  };
}
