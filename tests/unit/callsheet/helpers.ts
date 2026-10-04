// Test-only simulator: builds GuessFeedback the way the server would, using the shared
// comparison math in src/lib/verdicts.ts plus presence rules for people/genres/studio/rating.
import { compareBoxOffice, compareScore, compareYear } from '@/lib/verdicts';
import type { GuessFeedback, NumberFeedback, RegionCode } from '@/lib/types';

export interface SimFilm {
  id: number;
  title: string;
  year: number | null;
  boxOffice: number | null;
  score: number | null;
  directorIds: number[];
  directorDisplay: string;
  leadId: number | null;
  supportingIds: number[];
  studio: string;
  rating: string | null;
  genres: number[];
}

export const personName = (id: number) => `Person ${id}`;
export const genreName = (id: number) => `Genre ${id}`;

export function simulateFeedback(answer: SimFilm, guess: SimFilm, region: RegionCode = 'US'): GuessFeedback {
  const answerCast = [answer.leadId, ...answer.supportingIds].filter((x): x is number => x !== null);
  const person = (id: number) => {
    const match = answerCast.includes(id);
    return {
      personId: id,
      name: personName(id),
      profilePath: null,
      verdict: match ? ('match' as const) : ('miss' as const),
      ...(match ? { answerRole: id === answer.leadId ? ('lead' as const) : ('supp' as const) } : {}),
    };
  };
  const ratingVerdict =
    guess.rating === null || answer.rating === null ? 'na' : guess.rating === answer.rating ? 'match' : 'miss';
  return {
    filmId: guess.id,
    title: guess.title,
    posterPath: null,
    director: {
      display: guess.directorDisplay,
      personIds: guess.directorIds,
      verdict: guess.directorIds.some((d) => answer.directorIds.includes(d)) ? 'match' : 'miss',
    },
    lead: guess.leadId === null ? null : person(guess.leadId),
    supporting: guess.supportingIds.map(person),
    year: compareYear(guess.year, answer.year),
    boxOffice: compareBoxOffice(guess.boxOffice, answer.boxOffice),
    score: compareScore(guess.score, answer.score),
    rating: { value: guess.rating, verdict: ratingVerdict, region },
    studio: { name: guess.studio, logoPath: null, verdict: guess.studio === answer.studio ? 'match' : 'miss' },
    genres: guess.genres.map((g) => ({
      id: g,
      name: genreName(g),
      verdict: answer.genres.includes(g) ? ('match' as const) : ('miss' as const),
    })),
    genreCount: answer.genres.length,
    isCorrect: guess.id === answer.id,
  };
}

/** Minimal feedback with only the numeric cells set (others empty). */
export function numericOnly(partial: Partial<Pick<GuessFeedback, 'year' | 'boxOffice' | 'score'>>): GuessFeedback {
  const na: NumberFeedback = { value: null, verdict: 'na', direction: null };
  return {
    filmId: 1,
    title: 'T',
    posterPath: null,
    director: { display: 'D', verdict: 'miss', personIds: [9999] },
    lead: null,
    supporting: [],
    year: partial.year ?? na,
    boxOffice: partial.boxOffice ?? na,
    score: partial.score ?? na,
    rating: { value: null, verdict: 'na', region: 'US' },
    studio: { name: 'S', logoPath: null, verdict: 'miss' },
    genres: [],
    genreCount: 2,
    isCorrect: false,
  };
}

export function film(overrides: Partial<SimFilm> & { id: number }): SimFilm {
  return {
    title: `Film ${overrides.id}`,
    year: 2000,
    boxOffice: 100_000_000,
    score: 70,
    directorIds: [overrides.id + 10_000],
    directorDisplay: `Director ${overrides.id}`,
    leadId: overrides.id + 20_000,
    supportingIds: [],
    studio: 'Studio A',
    rating: 'PG-13',
    genres: [1],
    ...overrides,
  };
}
