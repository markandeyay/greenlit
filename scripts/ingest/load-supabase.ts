// Upserts a LibrarySnapshot into Supabase with the service role key.
//
//   pnpm exec tsx scripts/ingest/load-supabase.ts [path/to/library.json] [--dry-run]
//
// Default source: data/library.tmdb.json if present, else the fixture library.
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (read from .env.local).
// Idempotent: every table is upserted on its natural key. Studios are matched by their unique
// name (studios.id is serial in Postgres), and film/alias studio ids are remapped to the database
// ids. Awards have no natural key, so each loaded film's awards are replaced.
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { LibrarySnapshot } from '../../src/server/db/repo';
import { isMain, loadEnvFiles, readJson } from './io';
import { integrityProblems, parseLibrary } from './schema';
import { resolveLibraryPath } from './build-search-index';

export const BATCH_SIZE = 500;

export function chunk<T>(items: readonly T[], size: number = BATCH_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Snake_case rows per supabase/migrations/20261004000001_schema.sql. */
export function toRows(lib: LibrarySnapshot, studioIdMap: Map<number, number> = new Map(lib.studios.map((s) => [s.id, s.id]))) {
  const mapStudio = (id: number | null) => {
    if (id === null) return null;
    const mapped = studioIdMap.get(id);
    if (mapped === undefined) throw new Error(`No database id for studio ${id}`);
    return mapped;
  };
  return {
    genres: lib.genres.map((g) => ({ id: g.id, name: g.name })),
    people: lib.people.map((p) => ({ id: p.id, name: p.name, profile_path: p.profilePath })),
    studios: lib.studios.map((s) => ({ name: s.name, logo_path: s.logoPath })),
    studioAliases: lib.studioAliases.map((a) => ({ raw_company_id: a.rawCompanyId, studio_id: mapStudio(a.studioId) })),
    films: lib.films.map((f) => ({
      id: f.id,
      title: f.title,
      original_title: f.originalTitle,
      release_year: f.releaseYear,
      release_date: f.releaseDate,
      poster_path: f.posterPath,
      backdrop_path: f.backdropPath,
      runtime_min: f.runtimeMin,
      box_office_usd: f.boxOfficeUsd,
      score_snapshot: f.scoreSnapshot,
      studio_id: mapStudio(f.studioId),
      director_unit: f.directorUnit,
      lead_person_id: f.leadPersonId,
      supporting_ids: f.supportingIds,
      genre_ids: f.genreIds,
      trailer_youtube: f.trailerYoutube,
      tagline: f.tagline,
      keywords: f.keywords,
      popularity: f.popularity,
      is_playable: f.isPlayable,
      is_answer_eligible: f.isAnswerEligible,
    })),
    certifications: lib.certifications.map((c) => ({ film_id: c.filmId, region: c.region, rating: c.rating })),
    awards: lib.awards.map((a) => ({ film_id: a.filmId, text: a.text })),
  };
}

async function upsert(db: SupabaseClient, table: string, rows: object[], onConflict: string): Promise<void> {
  for (const [i, batch] of chunk(rows).entries()) {
    const { error } = await db.from(table).upsert(batch, { onConflict });
    if (error) throw new Error(`${table} batch ${i + 1}: ${error.message}`);
  }
  console.log(`  ${table}: ${rows.length}`);
}

export async function loadLibrary(db: SupabaseClient, lib: LibrarySnapshot): Promise<void> {
  const base = toRows(lib);
  await upsert(db, 'genres', base.genres, 'id');
  await upsert(db, 'people', base.people, 'id');
  await upsert(db, 'studios', base.studios, 'name');

  // Resolve database studio ids by name.
  const { data: studioRows, error } = await db.from('studios').select('id,name');
  if (error) throw new Error(`studios select: ${error.message}`);
  const dbIdByName = new Map((studioRows ?? []).map((r: { id: number; name: string }) => [r.name, r.id]));
  const studioIdMap = new Map<number, number>();
  for (const s of lib.studios) {
    const id = dbIdByName.get(s.name);
    if (id === undefined) throw new Error(`Studio "${s.name}" missing after upsert`);
    studioIdMap.set(s.id, id);
  }
  const rows = toRows(lib, studioIdMap);

  await upsert(db, 'studio_aliases', rows.studioAliases, 'raw_company_id');
  await upsert(db, 'films', rows.films, 'id');
  await upsert(db, 'film_certifications', rows.certifications, 'film_id,region');

  const awardFilmIds = [...new Set(rows.awards.map((a) => a.film_id))];
  for (const ids of chunk(awardFilmIds)) {
    const { error: delErr } = await db.from('film_awards').delete().in('film_id', ids);
    if (delErr) throw new Error(`film_awards delete: ${delErr.message}`);
  }
  for (const batch of chunk(rows.awards)) {
    const { error: insErr } = await db.from('film_awards').insert(batch);
    if (insErr) throw new Error(`film_awards insert: ${insErr.message}`);
  }
  console.log(`  film_awards: ${rows.awards.length}`);
}

if (isMain(import.meta.url)) {
  (async () => {
    loadEnvFiles();
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const source = resolveLibraryPath(args.find((a) => !a.startsWith('--')));
    const lib = parseLibrary(readJson(source));
    const problems = integrityProblems(lib);
    if (problems.length) throw new Error(`Library failed integrity checks:\n${problems.slice(0, 50).join('\n')}`);
    console.log(`Library ${path.relative(process.cwd(), source)}: ${lib.films.length} films, ${lib.people.length} people`);
    if (dryRun) {
      const rows = toRows(lib);
      console.log(`Dry run: would upsert ${Object.entries(rows).map(([k, v]) => `${k} ${v.length}`).join(', ')}`);
      return;
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    await loadLibrary(db, lib);
    console.log('Done.');
  })().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
}
