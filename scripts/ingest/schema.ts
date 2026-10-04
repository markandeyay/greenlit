// Zod validator for a LibrarySnapshot (src/server/db/repo.ts). Used by the fixture tests, the
// TMDB library builder and the Supabase loader before anything is written.
import { z } from 'zod';
import { REGION_CODES } from '../../src/config/regions';
import { RULES } from '../../src/config/rules';
import type { LibrarySnapshot } from '../../src/server/db/repo';

const posInt = z.number().int().positive();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const directorUnitSchema = z.object({
  ids: z.array(posInt).min(1),
  display: z.string().min(1),
});

export const filmSchema = z.object({
  id: posInt,
  title: z.string().min(1),
  originalTitle: z.string().min(1).nullable(),
  releaseYear: z.number().int().min(1870).max(2100),
  releaseDate: isoDate.nullable(),
  posterPath: z.string().startsWith('/').nullable(),
  backdropPath: z.string().startsWith('/').nullable(),
  runtimeMin: posInt.nullable(),
  boxOfficeUsd: posInt.nullable(),
  scoreSnapshot: z.number().int().min(0).max(100).nullable(),
  studioId: posInt.nullable(),
  directorUnit: directorUnitSchema,
  leadPersonId: posInt.nullable(),
  supportingIds: z.array(posInt).max(RULES.maxSupportingCast),
  genreIds: z.array(posInt).min(1).max(5),
  trailerYoutube: z.string().regex(/^[A-Za-z0-9_-]{6,20}$/).nullable(),
  tagline: z.string().min(1).nullable(),
  keywords: z.array(z.string().min(1)),
  popularity: z.number().nonnegative().nullable(),
  isPlayable: z.boolean(),
  isAnswerEligible: z.boolean(),
});

export const personSchema = z.object({ id: posInt, name: z.string().min(1), profilePath: z.string().startsWith('/').nullable() });
export const studioSchema = z.object({ id: posInt, name: z.string().min(1), logoPath: z.string().startsWith('/').nullable() });
export const studioAliasSchema = z.object({ rawCompanyId: posInt, studioId: posInt });
export const genreSchema = z.object({ id: posInt, name: z.string().min(1) });
export const certificationSchema = z.object({ filmId: posInt, region: z.enum(REGION_CODES), rating: z.string().min(1) });
export const awardSchema = z.object({ filmId: posInt, text: z.string().min(1) });

export const librarySnapshotSchema = z.object({
  v: z.literal(1),
  generatedAt: z.string().min(1),
  source: z.enum(['fixture', 'tmdb']),
  films: z.array(filmSchema),
  people: z.array(personSchema),
  studios: z.array(studioSchema),
  studioAliases: z.array(studioAliasSchema),
  genres: z.array(genreSchema),
  certifications: z.array(certificationSchema),
  awards: z.array(awardSchema),
});

// Compile-time guarantee that the schema and the shared contract agree in both directions.
type Parsed = z.infer<typeof librarySnapshotSchema>;
const _toContract = (x: Parsed): LibrarySnapshot => x;
const _fromContract = (x: LibrarySnapshot): Parsed => x;
void _toContract;
void _fromContract;

export function parseLibrary(data: unknown): LibrarySnapshot {
  return librarySnapshotSchema.parse(data);
}

/**
 * Referential and uniqueness checks that a zod shape cannot express. Returns a list of problems
 * (empty = consistent).
 */
export function integrityProblems(lib: LibrarySnapshot): string[] {
  const problems: string[] = [];
  const dupes = (label: string, keys: (string | number)[]) => {
    const seen = new Set<string | number>();
    for (const k of keys) {
      if (seen.has(k)) problems.push(`duplicate ${label} ${k}`);
      seen.add(k);
    }
  };
  dupes('film id', lib.films.map((f) => f.id));
  dupes('person id', lib.people.map((p) => p.id));
  dupes('studio id', lib.studios.map((s) => s.id));
  dupes('studio name', lib.studios.map((s) => s.name));
  dupes('alias company id', lib.studioAliases.map((a) => a.rawCompanyId));
  dupes('genre id', lib.genres.map((g) => g.id));
  dupes('certification', lib.certifications.map((c) => `${c.filmId}:${c.region}`));

  const people = new Set(lib.people.map((p) => p.id));
  const studios = new Set(lib.studios.map((s) => s.id));
  const genres = new Set(lib.genres.map((g) => g.id));
  const films = new Set(lib.films.map((f) => f.id));
  for (const f of lib.films) {
    for (const id of f.directorUnit.ids) if (!people.has(id)) problems.push(`film ${f.id}: director ${id} missing`);
    if (f.leadPersonId !== null && !people.has(f.leadPersonId)) problems.push(`film ${f.id}: lead ${f.leadPersonId} missing`);
    for (const id of f.supportingIds) if (!people.has(id)) problems.push(`film ${f.id}: supporting ${id} missing`);
    const cast = [f.leadPersonId, ...f.supportingIds].filter((x) => x !== null);
    if (new Set(cast).size !== cast.length) problems.push(`film ${f.id}: duplicate cast member`);
    if (f.studioId !== null && !studios.has(f.studioId)) problems.push(`film ${f.id}: studio ${f.studioId} missing`);
    for (const g of f.genreIds) if (!genres.has(g)) problems.push(`film ${f.id}: genre ${g} missing`);
    if (new Set(f.genreIds).size !== f.genreIds.length) problems.push(`film ${f.id}: duplicate genre`);
    if (f.releaseDate && Number(f.releaseDate.slice(0, 4)) !== f.releaseYear) problems.push(`film ${f.id}: releaseDate/releaseYear mismatch`);
  }
  for (const a of lib.studioAliases) if (!studios.has(a.studioId)) problems.push(`alias ${a.rawCompanyId}: studio ${a.studioId} missing`);
  for (const c of lib.certifications) if (!films.has(c.filmId)) problems.push(`certification for missing film ${c.filmId}`);
  for (const a of lib.awards) if (!films.has(a.filmId)) problems.push(`award for missing film ${a.filmId}`);
  return problems;
}
