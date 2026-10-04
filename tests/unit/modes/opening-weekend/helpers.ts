// Small self-contained library for Opening Weekend tests.
import { MemoryRepo, createMemoryState } from '@/server/db/memory';
import type { LibrarySnapshot } from '@/server/db/repo';
import type { Film } from '@/lib/types';

export const NOW = new Date('2026-10-04T16:00:00Z');
export const TODAY = '2026-10-04';

export function film(id: number, gross: number | null, extra: Partial<Film> = {}): Film {
  return {
    id,
    title: `Feature ${id}`,
    originalTitle: null,
    releaseYear: 1980 + (id % 40),
    releaseDate: null,
    posterPath: null,
    backdropPath: null,
    runtimeMin: 100,
    boxOfficeUsd: gross,
    scoreSnapshot: 60,
    studioId: null,
    directorUnit: { ids: [1], display: 'Someone' },
    leadPersonId: null,
    supportingIds: [],
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

/** 30 films whose grosses climb by 1.3x (distinct 8 to 10 digit values ending in 7). */
export const ladder: Film[] = Array.from({ length: 30 }, (_, i) => film(i + 1, Math.round(10_000_000 * 1.3 ** i) * 10 + 7));
/** Near twins of ladder films: within 5%, so never paired with their twin. */
export const twins: Film[] = [film(101, Math.round(ladder[10]!.boxOfficeUsd! * 1.04)), film(102, Math.round(ladder[20]!.boxOfficeUsd! * 0.97))];
export const noGross = film(201, null, { title: 'No Gross Film' });
export const hidden = film(202, 999_999_999, { title: 'Hidden Film', isPlayable: false });

export const allFilms = [...ladder, ...twins, noGross, hidden];

export const library: LibrarySnapshot = {
  v: 1,
  generatedAt: NOW.toISOString(),
  source: 'fixture',
  films: allFilms,
  people: [],
  studios: [],
  studioAliases: [],
  genres: [{ id: 18, name: 'Drama' }],
  certifications: [],
  awards: [],
};

export function buildRepo(): MemoryRepo {
  return new MemoryRepo(createMemoryState(structuredClone(library)));
}

/** Every gross in the library as it would appear in JSON. */
export const grossStrings = allFilms.map((f) => f.boxOfficeUsd).filter((g): g is number => g !== null).map(String);
