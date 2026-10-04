import type { GuessFeedback } from '@/lib/types';

export function fb(overrides: Partial<GuessFeedback> = {}): GuessFeedback {
  return {
    filmId: 1,
    title: 'Heat',
    posterPath: null,
    director: { display: 'Michael Mann', verdict: 'miss', personIds: [10] },
    lead: { personId: 20, name: 'Al Pacino', profilePath: null, verdict: 'miss' },
    supporting: [
      { personId: 21, name: 'Robert De Niro', profilePath: null, verdict: 'match', answerRole: 'lead' },
      { personId: 22, name: 'Val Kilmer', profilePath: null, verdict: 'miss' },
    ],
    year: { value: 1995, verdict: 'close', direction: 'up' },
    boxOffice: { value: 187_000_000, verdict: 'miss', direction: 'down' },
    score: { value: 79, verdict: 'match', direction: null },
    rating: { value: 'R', verdict: 'match', region: 'US' },
    studio: { name: 'Warner Bros.', logoPath: null, verdict: 'miss' },
    genres: [
      { id: 1, name: 'Crime', verdict: 'match' },
      { id: 2, name: 'Drama', verdict: 'miss' },
    ],
    genreCount: 3,
    isCorrect: false,
    ...overrides,
  };
}
