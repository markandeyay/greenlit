// Self-contained library for Release Order tests (does not depend on the shared fixture library).
import { MemoryRepo, createMemoryState } from '@/server/db/memory';
import type { LibrarySnapshot } from '@/server/db/repo';
import type { Film } from '@/lib/types';

export const NOW = new Date('2026-10-04T16:00:00Z'); // 2026-10-04 in New York
export const TODAY = '2026-10-04';

const WORDS = [
  'Amber', 'Blue', 'Cobalt', 'Dusk', 'Ember', 'Fable', 'Granite', 'Harbor', 'Iris', 'Juniper',
  'Kestrel', 'Lantern', 'Meadow', 'Nimbus', 'Onyx', 'Pilgrim', 'Quarry', 'Raven', 'Saffron', 'Tundra',
  'Umber', 'Velvet', 'Willow', 'Xylo', 'Yonder', 'Zenith',
];

export function film(overrides: Partial<Film> & { id: number; title: string }): Film {
  return {
    originalTitle: null,
    releaseYear: 1960,
    releaseDate: null,
    posterPath: null,
    backdropPath: null,
    runtimeMin: 100,
    boxOfficeUsd: 1,
    scoreSnapshot: 50,
    studioId: null,
    directorUnit: { ids: [1], display: 'Someone' },
    leadPersonId: null,
    supportingIds: [],
    genreIds: [18],
    trailerYoutube: null,
    tagline: null,
    keywords: [],
    popularity: 80,
    isPlayable: true,
    isAnswerEligible: false,
    ...overrides,
  };
}

/** 26 well known films, one per year 1951..1976 with precise dates; titles carry no digits. */
export const FILMS: Film[] = WORDS.map((w, i) =>
  film({
    id: 7001 + i * 3,
    title: `The ${w} Picture`,
    releaseYear: 1951 + i,
    releaseDate: `${1951 + i}-0${(i % 9) + 1}-1${i % 10}`,
  }),
);

export function library(films: Film[] = FILMS): LibrarySnapshot {
  return {
    v: 1,
    generatedAt: NOW.toISOString(),
    source: 'fixture',
    films: structuredClone(films),
    people: [],
    studios: [],
    studioAliases: [],
    genres: [],
    certifications: [],
    awards: [],
  };
}

export function buildRepo(films: Film[] = FILMS): MemoryRepo {
  return new MemoryRepo(createMemoryState(library(films)));
}
