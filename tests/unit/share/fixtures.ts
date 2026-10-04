// Feedback fixtures for share tests. Each guess is described by an 8-char code in share column
// order (Director, Lead, Supporting, Year, Box office, Rating, Studio, Genres): g=match, y=close,
// b=miss, n=na (numeric and rating only), e=empty (lead null / no supporting / no genres).
import type { GuessFeedback, PersonFeedback, Verdict } from '@/lib/types';
import type { ShareInput } from '@/components/share/types';

export const SECRET_TITLE = 'Zzyzx Secret Title';
export const SECRET_FILM_ID = 987654;

let personSeq = 1000;
const person = (verdict: 'match' | 'miss'): PersonFeedback => ({
  personId: personSeq++,
  name: `Person ${personSeq}`,
  profilePath: '/p.jpg',
  verdict,
});

const bin = (c: string): 'match' | 'miss' => (c === 'g' ? 'match' : 'miss');
const num = (c: string): Verdict => (c === 'g' ? 'match' : c === 'y' ? 'close' : c === 'n' ? 'na' : 'miss');

export function fb(code: string, opts: { correct?: boolean; filmId?: number; title?: string } = {}): GuessFeedback {
  if (code.length !== 8) throw new Error(`bad code ${code}`);
  const [d, l, s, y, bo, r, st, g] = [...code] as string[];
  return {
    filmId: opts.filmId ?? 1,
    title: opts.title ?? 'Guess Film',
    posterPath: '/poster.jpg',
    director: { display: 'Some Director', verdict: bin(d!), personIds: [1] },
    lead: l === 'e' ? null : person(bin(l!)),
    // Supporting "g": one match among misses, to prove the any-match collapse.
    supporting: s === 'e' ? [] : s === 'g' ? [person('miss'), person('match'), person('miss')] : [person('miss'), person('miss')],
    year: { value: 2001, verdict: num(y!), direction: y === 'g' ? null : 'up' },
    boxOffice: { value: bo === 'n' ? null : 1e8, verdict: num(bo!), direction: null },
    score: { value: 70, verdict: 'miss', direction: 'down' },
    rating: { value: r === 'n' ? null : 'PG-13', verdict: r === 'g' ? 'match' : r === 'n' ? 'na' : 'miss', region: 'US' },
    studio: { name: 'Studio', logoPath: null, verdict: bin(st!) },
    genres: g === 'e' ? [] : g === 'g' ? [{ id: 1, name: 'Drama', verdict: 'miss' }, { id: 2, name: 'Sci-Fi', verdict: 'match' }] : [{ id: 1, name: 'Drama', verdict: 'miss' }],
    genreCount: 3,
    isCorrect: opts.correct ?? false,
  };
}

/** The Section 7.1 example: a win in 4 on Reel 212. */
export function specExample(overrides: Partial<ShareInput> = {}): ShareInput {
  return {
    kind: 'daily',
    ref: '212',
    reelNumber: 212,
    feedback: [
      fb('bbbgybgb'),
      fb('gbbgygbb'),
      fb('ggbggggb'),
      fb('gggggggg', { correct: true, filmId: SECRET_FILM_ID, title: SECRET_TITLE }),
    ],
    status: 'won',
    hintsUsed: 0,
    ...overrides,
  };
}
