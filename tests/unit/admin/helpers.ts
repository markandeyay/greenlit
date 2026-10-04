// Self-contained library for WS8 tests (does not depend on the shared fixture library).
import { MemoryRepo, createMemoryState } from '@/server/db/memory';
import type { LibrarySnapshot } from '@/server/db/repo';
import type { Film, FilmCertification, Hint, Pitch } from '@/lib/types';

export const NOW = new Date('2026-10-04T16:00:00Z'); // 12:00 in New York, 2026-10-04
export const TODAY = '2026-10-04';

export function film(overrides: Partial<Film> & { id: number; title: string }): Film {
  return {
    originalTitle: null,
    releaseYear: 2000,
    releaseDate: null,
    posterPath: null,
    backdropPath: null,
    runtimeMin: 100,
    boxOfficeUsd: 100_000_000,
    scoreSnapshot: 70,
    studioId: 1,
    directorUnit: { ids: [999], display: 'Default Director' },
    leadPersonId: 50,
    supportingIds: [51, 52],
    genreIds: [18],
    trailerYoutube: null,
    tagline: 'Every story has a beginning.',
    keywords: ['heist', 'betrayal', 'desert', 'train'],
    popularity: 10,
    isPlayable: true,
    isAnswerEligible: true,
    ...overrides,
  };
}

/** The main subject film. Its title words appear in the tagline and one keyword on purpose. */
export const HERO = film({
  id: 100,
  title: 'The Silver Harbor',
  releaseYear: 1994,
  tagline: 'Nobody leaves the Silver Harbor alive.',
  keywords: ['harbor', 'smuggling', 'fog', 'lighthouse', 'detective', 'storm'],
  leadPersonId: 1,
  supportingIds: [2, 3],
  directorUnit: { ids: [900, 901], display: 'The Twins' },
  popularity: 50,
});

export const FILMS: Film[] = [
  HERO,
  // Shares the lead; popular. A good cast connection.
  film({ id: 101, title: 'Midnight Express Lane', releaseYear: 1990, leadPersonId: 1, supportingIds: [7], popularity: 80, directorUnit: { ids: [905], display: 'Other' } }),
  // Shares a supporting actor; even more popular, but its title leaks the hero title (sequel).
  film({ id: 102, title: 'The Silver Harbor II', releaseYear: 1998, leadPersonId: 8, supportingIds: [2], popularity: 99, directorUnit: { ids: [900], display: 'Ada Director' } }),
  // Shares a supporting actor; less popular.
  film({ id: 103, title: 'Paper Moons', releaseYear: 2001, leadPersonId: 9, supportingIds: [3], popularity: 20, directorUnit: { ids: [906], display: 'Other' } }),
  // Same director unit member (901): filmography.
  film({ id: 104, title: 'Glass Orchard', releaseYear: 1999, leadPersonId: 10, supportingIds: [], popularity: 30, directorUnit: { ids: [901], display: 'Bo Twin' } }),
  film({ id: 105, title: 'Copper Tide', releaseYear: 2003, leadPersonId: 11, supportingIds: [], popularity: 15, directorUnit: { ids: [900], display: 'Ada Director' } }),
  // Incomplete films for rule tests.
  film({ id: 200, title: 'No Box Office', boxOfficeUsd: null, popularity: 90 }),
  film({ id: 201, title: 'No Tagline', tagline: null, popularity: 5 }),
  film({ id: 202, title: 'Not Eligible', isAnswerEligible: false, popularity: 5 }),
  film({ id: 203, title: 'No Lead', leadPersonId: null, popularity: 5 }),
  film({ id: 204, title: 'No Genres', genreIds: [], popularity: 5 }),
  film({ id: 205, title: 'No Director', directorUnit: { ids: [], display: '' }, popularity: 5 }),
  film({ id: 206, title: 'No US Cert', popularity: 5 }),
  film({ id: 207, title: 'Hidden Gem', isPlayable: false, isAnswerEligible: false }),
];

export const CERTS: FilmCertification[] = FILMS.filter((f) => f.id !== 206).map((f) => ({ filmId: f.id, region: 'US', rating: 'PG-13' }));

export const LIB: LibrarySnapshot = {
  v: 1,
  generatedAt: '2026-10-01T00:00:00.000Z',
  source: 'fixture',
  films: FILMS,
  people: [
    { id: 1, name: 'Lena Lead', profilePath: null },
    { id: 2, name: 'Sam Support', profilePath: null },
    { id: 3, name: 'Rae Reed', profilePath: null },
    { id: 7, name: 'X', profilePath: null },
    { id: 900, name: 'Ada Director', profilePath: null },
    { id: 901, name: 'Bo Twin', profilePath: null },
  ],
  studios: [
    { id: 1, name: 'Northlight', logoPath: null },
    { id: 2, name: 'Southfield', logoPath: null },
  ],
  studioAliases: [{ rawCompanyId: 5001, studioId: 1 }],
  genres: [
    { id: 18, name: 'Drama' },
    { id: 35, name: 'Comedy' },
    { id: 80, name: 'Crime' },
  ],
  certifications: CERTS,
  awards: [{ filmId: 100, text: 'Won Best Cinematography' }],
};

export function validHints(): Hint[] {
  return [
    { type: 'tagline', payload: { text: 'Nobody leaves alive.' } },
    { type: 'plot_keywords', payload: { keywords: ['smuggling', 'fog', 'lighthouse'] } },
    { type: 'awards', payload: { text: 'Won Best Cinematography' } },
  ];
}

export function buildRepo(): MemoryRepo {
  return new MemoryRepo(createMemoryState(structuredClone(LIB)));
}

/** Behaves like the Supabase repo for pitches: stores and returns the caller's slug as-is. */
export class SupabaseLikeRepo extends MemoryRepo {
  private store = new Map<string, Pitch>();
  async createPitch(p: Pitch) {
    if (this.store.has(p.slug)) throw new Error('duplicate key value violates unique constraint');
    this.store.set(p.slug, structuredClone(p));
    return structuredClone(p);
  }
  async getPitch(slug: string) {
    const p = this.store.get(slug);
    return p ? structuredClone(p) : null;
  }
  async listPitchesByCreator(creatorId: string) {
    return [...this.store.values()].filter((p) => p.creatorId === creatorId);
  }
}

export function buildSupabaseLikeRepo(): SupabaseLikeRepo {
  return new SupabaseLikeRepo(createMemoryState(structuredClone(LIB)));
}
