// Supabase-backed Repo using the service role key. SERVER ONLY. Owned by WS0.
//
// Bootstrapping: if the `films` table is empty, the bundled fixture library (public data) is
// loaded into it on first use, so a fresh project works after only running migrations.
// If the `puzzles` table is empty, the default deterministic schedule is written once.
// Once the TMDB ingest loads films (scripts/ingest/load-supabase.ts), the database is used.
import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  DailyStats,
  DirectorUnit,
  Film,
  FilmAward,
  FilmCertification,
  Genre,
  Hint,
  HintType,
  Person,
  Pitch,
  Play,
  PlayKind,
  Profile,
  Puzzle,
  RegionCode,
  SearchResult,
  Studio,
  StudioAlias,
} from '@/lib/types';
import type { LibrarySnapshot, PlayFilter, Repo } from './repo';
import { buildDefaultSchedule } from './seed';
import fixtureLibrary from './fixtures/library.json';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`supabase: ${res.error.message}`);
  return res.data;
}

const filmFromRow = (r: Row): Film => ({
  id: r.id,
  title: r.title,
  originalTitle: r.original_title,
  releaseYear: r.release_year,
  releaseDate: r.release_date,
  posterPath: r.poster_path,
  backdropPath: r.backdrop_path,
  runtimeMin: r.runtime_min,
  boxOfficeUsd: r.box_office_usd === null ? null : Number(r.box_office_usd),
  scoreSnapshot: r.score_snapshot,
  studioId: r.studio_id,
  directorUnit: r.director_unit as DirectorUnit,
  leadPersonId: r.lead_person_id,
  supportingIds: r.supporting_ids ?? [],
  genreIds: r.genre_ids ?? [],
  trailerYoutube: r.trailer_youtube,
  tagline: r.tagline,
  keywords: r.keywords ?? [],
  popularity: r.popularity,
  isPlayable: r.is_playable,
  isAnswerEligible: r.is_answer_eligible,
});

const filmToRow = (f: Film): Row => ({
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
  studio_id: f.studioId,
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
});

const puzzleFromRow = (r: Row): Puzzle => ({
  number: r.number,
  date: r.date,
  filmId: r.film_id,
  theme: r.theme,
  hints: (r.hints ?? []) as Hint[],
});
const puzzleToRow = (p: Puzzle): Row => ({
  number: p.number,
  date: p.date,
  film_id: p.filmId,
  theme: p.theme,
  hints: p.hints,
});

const pitchFromRow = (r: Row): Pitch => ({
  slug: r.slug,
  filmId: r.film_id,
  note: r.note,
  creatorId: r.creator_id,
  createdAt: r.created_at,
});

const playFromRow = (r: Row): Play => ({
  id: r.id,
  profileId: r.profile_id,
  anonId: r.anon_id,
  kind: r.kind as PlayKind,
  ref: r.ref,
  guesses: r.guesses ?? [],
  hintsUsed: (r.hints_used ?? []) as HintType[],
  status: r.status,
  takes: r.takes,
  startedAt: r.started_at,
  firstGuessAt: r.first_guess_at,
  finishedAt: r.finished_at,
});
const playToRow = (p: Play): Row => ({
  id: p.id,
  profile_id: p.profileId,
  anon_id: p.anonId,
  kind: p.kind,
  ref: p.ref,
  guesses: p.guesses,
  hints_used: p.hintsUsed,
  status: p.status,
  takes: p.takes,
  started_at: p.startedAt,
  first_guess_at: p.firstGuessAt,
  finished_at: p.finishedAt,
});

const profileFromRow = (r: Row): Profile => ({
  id: r.id,
  handle: r.handle,
  region: r.region as RegionCode | null,
  flagged: r.flagged ?? false,
  flagReason: r.flag_reason ?? null,
  createdAt: r.created_at,
});

export class SupabaseRepo implements Repo {
  readonly name = 'supabase' as const;
  private libraryReady: Promise<void> | true | null = null;
  private seeded = false;

  constructor(
    private db: SupabaseClient,
    private fallbackLibrary: LibrarySnapshot = fixtureLibrary as LibrarySnapshot,
  ) {}

  /** Load the bundled library into an empty films table, once per instance. Idempotent. */
  private async ensureLibrary(): Promise<void> {
    if (this.libraryReady === true) return;
    if (this.libraryReady) return this.libraryReady;
    this.libraryReady = (async () => {
      const { count, error } = await this.db.from('films').select('id', { count: 'exact', head: true });
      if (error) throw new Error(`supabase: ${error.message}`);
      if ((count ?? 0) === 0) await this.loadLibrary(this.fallbackLibrary);
    })();
    try {
      await this.libraryReady;
      this.libraryReady = true;
    } catch (e) {
      this.libraryReady = null;
      throw e;
    }
  }

  private async activeLibrary(): Promise<LibrarySnapshot> {
    await this.ensureLibrary();
    const [films, people, studios, genres, certs, awards] = await Promise.all([
      this.listFilms(),
      this.db.from('people').select('*').then((r) => check(r) as Row[]),
      this.listStudios(),
      this.listGenres(),
      this.db.from('film_certifications').select('*').then((r) => check(r) as Row[]),
      this.db.from('film_awards').select('*').then((r) => check(r) as Row[]),
    ]);
    return {
      v: 1,
      generatedAt: new Date().toISOString(),
      source: 'tmdb',
      films,
      people: people.map((p) => ({ id: p.id, name: p.name, profilePath: p.profile_path })),
      studios,
      studioAliases: [],
      genres,
      certifications: certs.map((c) => ({ filmId: c.film_id, region: c.region, rating: c.rating })),
      awards: awards.map((a) => ({ filmId: a.film_id, text: a.text })),
    };
  }

  /** Write the default schedule once if the puzzles table is empty. */
  private async ensureSchedule(): Promise<void> {
    if (this.seeded) return;
    const { count, error } = await this.db.from('puzzles').select('number', { count: 'exact', head: true });
    if (error) throw new Error(`supabase: ${error.message}`);
    if ((count ?? 0) === 0) {
      const schedule = buildDefaultSchedule(await this.activeLibrary());
      for (let i = 0; i < schedule.length; i += 200) {
        check(await this.db.from('puzzles').upsert(schedule.slice(i, i + 200).map(puzzleToRow), { onConflict: 'number', ignoreDuplicates: true }));
      }
    }
    this.seeded = true;
  }

  /** Upsert a whole LibrarySnapshot (used for bootstrapping and by the ingest loader). */
  async loadLibrary(lib: LibrarySnapshot): Promise<void> {
    const chunks = <T>(xs: T[], n = 500) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
    for (const c of chunks(lib.genres)) check(await this.db.from('genres').upsert(c.map((g) => ({ id: g.id, name: g.name }))));
    for (const c of chunks(lib.people)) check(await this.db.from('people').upsert(c.map((p) => ({ id: p.id, name: p.name, profile_path: p.profilePath }))));
    for (const c of chunks(lib.studios)) check(await this.db.from('studios').upsert(c.map((s) => ({ id: s.id, name: s.name, logo_path: s.logoPath }))));
    for (const c of chunks(lib.studioAliases)) check(await this.db.from('studio_aliases').upsert(c.map((a) => ({ raw_company_id: a.rawCompanyId, studio_id: a.studioId }))));
    for (const c of chunks(lib.films)) check(await this.db.from('films').upsert(c.map(filmToRow)));
    for (const c of chunks(lib.certifications)) check(await this.db.from('film_certifications').upsert(c.map((x) => ({ film_id: x.filmId, region: x.region, rating: x.rating }))));
    if (lib.awards.length) {
      const ids = [...new Set(lib.awards.map((a) => a.filmId))];
      check(await this.db.from('film_awards').delete().in('film_id', ids));
      for (const c of chunks(lib.awards)) check(await this.db.from('film_awards').insert(c.map((a) => ({ film_id: a.filmId, text: a.text }))));
    }
    // Keep the studios id sequence ahead of explicit ids.
    check(await this.db.rpc('sync_studios_seq'));
  }

  // Library -----------------------------------------------------------------
  async getFilm(id: number) {
    await this.ensureLibrary();
    const r = check(await this.db.from('films').select('*').eq('id', id).maybeSingle());
    return r ? filmFromRow(r) : null;
  }
  async getFilms(ids: number[]) {
    await this.ensureLibrary();
    if (!ids.length) return [];
    const rows = check(await this.db.from('films').select('*').in('id', ids)) as Row[];
    const byId = new Map(rows.map((r) => [r.id, filmFromRow(r)]));
    return ids.map((id) => byId.get(id)).filter((f): f is Film => !!f);
  }
  async listFilms(opts: { playable?: boolean; answerEligible?: boolean } = {}) {
    await this.ensureLibrary();
    const out: Film[] = [];
    for (let from = 0; ; from += 1000) {
      let q = this.db.from('films').select('*').order('id').range(from, from + 999);
      if (opts.playable !== undefined) q = q.eq('is_playable', opts.playable);
      if (opts.answerEligible !== undefined) q = q.eq('is_answer_eligible', opts.answerEligible);
      const rows = check(await q) as Row[];
      out.push(...rows.map(filmFromRow));
      if (rows.length < 1000) break;
    }
    return out;
  }
  async searchFilms(q: string, limit: number): Promise<SearchResult[]> {
    await this.ensureLibrary();
    const rows = check(await this.db.rpc('search_films', { q, max_results: limit })) as Row[];
    return rows.map((r) => ({ id: r.id, title: r.title, year: r.release_year, posterPath: r.poster_path }));
  }
  async upsertFilms(films: Film[]) {
    check(await this.db.from('films').upsert(films.map(filmToRow)));
  }
  async getPeople(ids: number[]) {
    await this.ensureLibrary();
    if (!ids.length) return [];
    const rows = check(await this.db.from('people').select('*').in('id', ids)) as Row[];
    const byId = new Map<number, Person>(rows.map((r) => [r.id, { id: r.id, name: r.name, profilePath: r.profile_path }]));
    return ids.map((id) => byId.get(id)).filter((p): p is Person => !!p);
  }
  async upsertPeople(people: Person[]) {
    check(await this.db.from('people').upsert(people.map((p) => ({ id: p.id, name: p.name, profile_path: p.profilePath }))));
  }
  async getStudio(id: number) {
    await this.ensureLibrary();
    const r = check(await this.db.from('studios').select('*').eq('id', id).maybeSingle());
    return r ? { id: r.id, name: r.name, logoPath: r.logo_path } : null;
  }
  async listStudios(): Promise<Studio[]> {
    await this.ensureLibrary();
    const rows = check(await this.db.from('studios').select('*').order('name')) as Row[];
    return rows.map((r) => ({ id: r.id, name: r.name, logoPath: r.logo_path }));
  }
  async upsertStudio(studio: Omit<Studio, 'id'> & { id?: number }) {
    const row: Row = { name: studio.name, logo_path: studio.logoPath ?? null };
    if (studio.id !== undefined) row.id = studio.id;
    const r = check(await this.db.from('studios').upsert(row, { onConflict: studio.id !== undefined ? 'id' : 'name' }).select('*').single()) as Row;
    return { id: r.id, name: r.name, logoPath: r.logo_path };
  }
  async listStudioAliases(): Promise<StudioAlias[]> {
    await this.ensureLibrary();
    const rows = check(await this.db.from('studio_aliases').select('*')) as Row[];
    return rows.map((r) => ({ rawCompanyId: r.raw_company_id, studioId: r.studio_id }));
  }
  async setStudioAlias(alias: StudioAlias) {
    check(await this.db.from('studio_aliases').upsert({ raw_company_id: alias.rawCompanyId, studio_id: alias.studioId }));
  }
  async deleteStudioAlias(rawCompanyId: number) {
    check(await this.db.from('studio_aliases').delete().eq('raw_company_id', rawCompanyId));
  }
  async listGenres(): Promise<Genre[]> {
    await this.ensureLibrary();
    const rows = check(await this.db.from('genres').select('*')) as Row[];
    return rows.map((r) => ({ id: r.id, name: r.name }));
  }
  async getCertifications(filmId: number): Promise<FilmCertification[]> {
    await this.ensureLibrary();
    const rows = check(await this.db.from('film_certifications').select('*').eq('film_id', filmId)) as Row[];
    return rows.map((r) => ({ filmId: r.film_id, region: r.region, rating: r.rating }));
  }
  async getAwards(filmId: number): Promise<FilmAward[]> {
    await this.ensureLibrary();
    const rows = check(await this.db.from('film_awards').select('*').eq('film_id', filmId)) as Row[];
    return rows.map((r) => ({ filmId: r.film_id, text: r.text }));
  }

  // Puzzles -----------------------------------------------------------------
  async getPuzzle(number: number) {
    await this.ensureSchedule();
    const r = check(await this.db.from('puzzles').select('*').eq('number', number).maybeSingle());
    return r ? puzzleFromRow(r) : null;
  }
  async getPuzzleByDate(date: string) {
    await this.ensureSchedule();
    const r = check(await this.db.from('puzzles').select('*').eq('date', date).maybeSingle());
    return r ? puzzleFromRow(r) : null;
  }
  async listPuzzles(range: { fromDate?: string; toDate?: string }) {
    await this.ensureSchedule();
    let q = this.db.from('puzzles').select('*').order('number');
    if (range.fromDate) q = q.gte('date', range.fromDate);
    if (range.toDate) q = q.lte('date', range.toDate);
    return (check(await q) as Row[]).map(puzzleFromRow);
  }
  async upsertPuzzle(puzzle: Puzzle) {
    await this.ensureSchedule();
    check(await this.db.from('puzzles').upsert(puzzleToRow(puzzle), { onConflict: 'number' }));
  }
  async deletePuzzle(number: number) {
    check(await this.db.from('puzzles').delete().eq('number', number));
  }

  // Pitches -----------------------------------------------------------------
  async createPitch(pitch: Pitch) {
    await this.ensureLibrary();
    check(await this.db.from('pitches').insert({ slug: pitch.slug, film_id: pitch.filmId, note: pitch.note, creator_id: pitch.creatorId, created_at: pitch.createdAt }));
    return { ...pitch };
  }
  async getPitch(slug: string) {
    const r = check(await this.db.from('pitches').select('*').eq('slug', slug).maybeSingle());
    return r ? pitchFromRow(r) : null;
  }
  async listPitchesByCreator(creatorId: string) {
    const rows = check(await this.db.from('pitches').select('*').eq('creator_id', creatorId).order('created_at', { ascending: false })) as Row[];
    return rows.map(pitchFromRow);
  }

  // Plays -------------------------------------------------------------------
  async getPlay(anonId: string, kind: PlayKind, ref: string) {
    const r = check(await this.db.from('plays').select('*').eq('anon_id', anonId).eq('kind', kind).eq('ref', ref).maybeSingle());
    return r ? playFromRow(r) : null;
  }
  async getPlayByProfile(profileId: string, kind: PlayKind, ref: string) {
    const rows = check(await this.db.from('plays').select('*').eq('profile_id', profileId).eq('kind', kind).eq('ref', ref).order('updated_at', { ascending: false }).limit(1)) as Row[];
    return rows[0] ? playFromRow(rows[0]) : null;
  }
  async savePlay(play: Play) {
    check(await this.db.from('plays').upsert(playToRow(play), { onConflict: 'id' }));
  }
  async listPlays(f: PlayFilter) {
    const out: Play[] = [];
    for (let from = 0; ; from += 1000) {
      let q = this.db.from('plays').select('*').order('started_at').range(from, from + 999);
      if (f.kind) q = q.eq('kind', f.kind);
      if (f.ref) q = q.eq('ref', f.ref);
      if (f.refs) q = q.in('ref', f.refs);
      if (f.profileId) q = q.eq('profile_id', f.profileId);
      if (f.anonId) q = q.eq('anon_id', f.anonId);
      if (f.status) q = q.eq('status', f.status);
      if (f.finishedSince) q = q.gte('finished_at', f.finishedSince);
      const rows = check(await q) as Row[];
      out.push(...rows.map(playFromRow));
      if (rows.length < 1000) break;
    }
    return out;
  }
  async assignPlaysToProfile(anonId: string, profileId: string) {
    const rows = check(await this.db.from('plays').update({ profile_id: profileId }).eq('anon_id', anonId).is('profile_id', null).select('id')) as Row[];
    return rows.length;
  }

  // Profiles ----------------------------------------------------------------
  async getProfile(id: string) {
    const r = check(await this.db.from('profiles').select('*').eq('id', id).maybeSingle());
    return r ? profileFromRow(r) : null;
  }
  async getProfileByHandle(handle: string) {
    const r = check(await this.db.from('profiles').select('*').ilike('handle', handle).maybeSingle());
    return r ? profileFromRow(r) : null;
  }
  async listProfiles(ids: string[]) {
    if (!ids.length) return [];
    return (check(await this.db.from('profiles').select('*').in('id', ids)) as Row[]).map(profileFromRow);
  }
  async upsertProfile(p: Profile) {
    check(await this.db.from('profiles').upsert({ id: p.id, handle: p.handle, region: p.region, flagged: p.flagged, flag_reason: p.flagReason }));
  }

  // Aggregates --------------------------------------------------------------
  async getDailyStats(puzzleNumber: number): Promise<DailyStats | null> {
    const r = check(await this.db.from('daily_stats').select('*').eq('puzzle_number', puzzleNumber).maybeSingle());
    return r ? { puzzleNumber: r.puzzle_number, distribution: r.distribution, plays: r.plays, wins: r.wins } : null;
  }
  async recordDailyResult(puzzleNumber: number, takes: number | null) {
    check(await this.db.rpc('record_daily_result', { p_puzzle_number: puzzleNumber, p_takes: takes }));
  }
}

export function createSupabaseRepo(): Repo {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing');
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return new SupabaseRepo(db);
}
