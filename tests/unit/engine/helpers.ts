// Small self-contained library + schedule for engine tests. Does not depend on the shared
// fixture library (which another workstream owns).
import { MemoryRepo, createMemoryState } from '@/server/db/memory';
import type { LibrarySnapshot } from '@/server/db/repo';
import { dateForPuzzleNumber, puzzleNumberForDate, dateInResetZone } from '@/lib/dates';
import type { Film, FilmCertification, Hint, Person } from '@/lib/types';

export const NOW = new Date('2026-10-04T16:00:00Z');

export const ANSWER_ID = 987654;
export const ANSWER_TITLE = 'Zephyr Quartermile';
export const VAULT_ANSWER_ID = 876543;
export const FUTURE_ANSWER_ID = 765432;

// People
export const JOEL = 1223;
export const ETHAN = 1224;
export const NOLAN = 525;

export function film(overrides: Partial<Film> & { id: number; title: string }): Film {
  return {
    originalTitle: null,
    releaseYear: 2000,
    releaseDate: null,
    posterPath: null,
    backdropPath: null,
    runtimeMin: 100,
    boxOfficeUsd: 50_000_000,
    scoreSnapshot: 60,
    studioId: 2,
    directorUnit: { ids: [NOLAN], display: 'Christopher Nolan' },
    leadPersonId: 30,
    supportingIds: [31, 32],
    genreIds: [35],
    trailerYoutube: null,
    tagline: null,
    keywords: [],
    popularity: 10,
    isPlayable: true,
    isAnswerEligible: false,
    ...overrides,
  };
}

/** The daily answer: a Coens unit film with 5 supporting ids (the 5th is beyond the cap). */
export const answerFilm = film({
  id: ANSWER_ID,
  title: ANSWER_TITLE,
  releaseYear: 2007,
  boxOfficeUsd: 100_000_000,
  scoreSnapshot: 80,
  studioId: 1,
  directorUnit: { ids: [JOEL, ETHAN], display: 'The Coens' },
  leadPersonId: 10,
  supportingIds: [11, 12, 13, 14, 15],
  genreIds: [18, 80],
  tagline: 'A secret tagline nobody should see early',
  trailerYoutube: 'abc123',
  isAnswerEligible: true,
});

/** Close to the answer on many axes. */
export const nearFilm = film({
  id: 2001,
  title: 'Near Miss',
  releaseYear: 2010,
  boxOfficeUsd: 105_000_000,
  scoreSnapshot: 75,
  studioId: 1,
  directorUnit: { ids: [JOEL], display: 'Joel Coen' },
  leadPersonId: 11, // answer's supporting
  supportingIds: [10, 15, 20, 21, 22], // answer lead, beyond-cap supporting, others; 5th is capped off
  genreIds: [18, 35],
});

/** Shares nothing, unknown box office, score, studio, and certifications. */
export const farFilm = film({
  id: 2002,
  title: 'Far Away',
  releaseYear: 1990,
  boxOfficeUsd: null,
  scoreSnapshot: null,
  studioId: null,
  directorUnit: { ids: [NOLAN], display: 'Christopher Nolan' },
  leadPersonId: 30,
  supportingIds: [],
  genreIds: [35],
});

export const vaultFilm = film({ id: VAULT_ANSWER_ID, title: 'Vault Answer', isAnswerEligible: true });
export const futureFilm = film({ id: FUTURE_ANSWER_ID, title: 'Future Answer', isAnswerEligible: true });
export const unplayableFilm = film({ id: 2003, title: 'Hidden Film', isPlayable: false });

/** Twelve filler films that share nothing with the answer. */
export const fillers: Film[] = Array.from({ length: 12 }, (_, i) =>
  film({ id: 3000 + i, title: `Filler ${i + 1}`, releaseYear: 1980 + i, boxOfficeUsd: 1_000_000 + i }),
);

const people: Person[] = [
  { id: JOEL, name: 'Joel Coen', profilePath: null },
  { id: ETHAN, name: 'Ethan Coen', profilePath: null },
  { id: NOLAN, name: 'Christopher Nolan', profilePath: null },
  ...[10, 11, 12, 13, 14, 15, 20, 21, 22, 30, 31, 32].map((id) => ({ id, name: `Actor ${id}`, profilePath: null })),
];

const certifications: FilmCertification[] = [
  { filmId: ANSWER_ID, region: 'US', rating: 'R' },
  { filmId: ANSWER_ID, region: 'GB', rating: '15' },
  { filmId: 2001, region: 'US', rating: 'R' },
  { filmId: 2001, region: 'AU', rating: 'MA15+' },
  ...fillers.map((f) => ({ filmId: f.id, region: 'US' as const, rating: 'PG' })),
];

export const library: LibrarySnapshot = {
  v: 1,
  generatedAt: '2026-10-01T00:00:00Z',
  source: 'fixture',
  films: [answerFilm, nearFilm, farFilm, vaultFilm, futureFilm, unplayableFilm, ...fillers],
  people,
  studios: [
    { id: 1, name: 'Focus Features', logoPath: null },
    { id: 2, name: 'Universal', logoPath: null },
  ],
  studioAliases: [],
  genres: [
    { id: 18, name: 'Drama' },
    { id: 35, name: 'Comedy' },
    { id: 80, name: 'Crime' },
  ],
  certifications,
  awards: [],
};

export const todayHints: Hint[] = [
  { type: 'tagline', payload: { text: 'A secret tagline nobody should see early' } },
  { type: 'first_letter', payload: { letter: 'Z' } },
  { type: 'plot_keywords', payload: { keywords: ['wind', 'track', 'mile'] } },
];

export const PITCH_SLUG = 'k3x9q2ab';
export const PITCH_NO_NOTE_SLUG = 'n0n0te12';
export const PITCH_NOTE = 'Trust me on this one';

export function todayNumber(now: Date = NOW): number {
  return puzzleNumberForDate(dateInResetZone(now));
}

/** A MemoryRepo with: today = answerFilm, today-1 = vaultFilm, today+1 = futureFilm, plus pitches. */
export async function buildRepo(now: Date = NOW): Promise<MemoryRepo> {
  const repo = new MemoryRepo(createMemoryState(structuredClone(library)));
  const t = todayNumber(now);
  for (let n = 1; n <= t + 1; n++) {
    const filmId = n === t ? ANSWER_ID : n === t + 1 ? FUTURE_ANSWER_ID : VAULT_ANSWER_ID;
    await repo.upsertPuzzle({
      number: n,
      date: dateForPuzzleNumber(n),
      filmId,
      theme: n === t ? 'Coens Week' : null,
      hints: n === t ? todayHints : todayHints.map((h) => h),
    });
  }
  await repo.createPitch({ slug: PITCH_SLUG, filmId: ANSWER_ID, note: PITCH_NOTE, creatorId: null, createdAt: now.toISOString() });
  await repo.createPitch({ slug: PITCH_NO_NOTE_SLUG, filmId: ANSWER_ID, note: null, creatorId: null, createdAt: now.toISOString() });
  return repo;
}
