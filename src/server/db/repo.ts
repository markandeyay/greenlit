// Data access contract (WS0). Every server module talks to storage ONLY through this interface.
// Implementations: memory.ts (fixtures, no keys needed) and supabase.ts (service role).
// Select one with getRepo() from ./index.ts. Owned by WS0; do not edit from a workstream.
import type {
  DailyStats,
  Film,
  FilmAward,
  FilmCertification,
  Genre,
  Person,
  Pitch,
  Play,
  PlayKind,
  Profile,
  Puzzle,
  SearchResult,
  Studio,
  StudioAlias,
} from '@/lib/types';

/** A complete film library. Fixture files and the TMDB ingest both produce this shape. */
export interface LibrarySnapshot {
  v: 1;
  generatedAt: string;
  source: 'fixture' | 'tmdb';
  films: Film[];
  people: Person[];
  studios: Studio[];
  studioAliases: StudioAlias[];
  genres: Genre[];
  certifications: FilmCertification[];
  awards: FilmAward[];
}

export interface PlayFilter {
  kind?: PlayKind;
  ref?: string;
  refs?: string[];
  profileId?: string;
  anonId?: string;
  status?: Play['status'];
  finishedSince?: string; // ISO instant
}

export interface Repo {
  readonly name: 'memory' | 'supabase';

  // Library (public data) -------------------------------------------------
  getFilm(id: number): Promise<Film | null>;
  getFilms(ids: number[]): Promise<Film[]>;
  listFilms(opts?: { playable?: boolean; answerEligible?: boolean }): Promise<Film[]>;
  searchFilms(q: string, limit: number): Promise<SearchResult[]>;
  upsertFilms(films: Film[]): Promise<void>;
  getPeople(ids: number[]): Promise<Person[]>;
  upsertPeople(people: Person[]): Promise<void>;
  getStudio(id: number): Promise<Studio | null>;
  listStudios(): Promise<Studio[]>;
  upsertStudio(studio: Omit<Studio, 'id'> & { id?: number }): Promise<Studio>;
  listStudioAliases(): Promise<StudioAlias[]>;
  setStudioAlias(alias: StudioAlias): Promise<void>;
  deleteStudioAlias(rawCompanyId: number): Promise<void>;
  listGenres(): Promise<Genre[]>;
  getCertifications(filmId: number): Promise<FilmCertification[]>;
  getAwards(filmId: number): Promise<FilmAward[]>;

  // Puzzles (SERVER ONLY: contain answers) --------------------------------
  getPuzzle(number: number): Promise<Puzzle | null>;
  getPuzzleByDate(date: string): Promise<Puzzle | null>;
  /** Inclusive date range, ordered by number. */
  listPuzzles(range: { fromDate?: string; toDate?: string }): Promise<Puzzle[]>;
  upsertPuzzle(puzzle: Puzzle): Promise<void>;
  deletePuzzle(number: number): Promise<void>;

  // Pitches (SERVER ONLY) ---------------------------------------------------
  /**
   * Store a pitch and return it as stored. The returned slug may differ from the input: the
   * in-memory repo (keyless deployments) replaces it with an opaque encrypted token so the
   * pitch resolves on any serverless instance. Always use the returned slug.
   */
  createPitch(pitch: Pitch): Promise<Pitch>;
  getPitch(slug: string): Promise<Pitch | null>;
  listPitchesByCreator(creatorId: string): Promise<Pitch[]>;

  // Plays -------------------------------------------------------------------
  getPlay(anonId: string, kind: PlayKind, ref: string): Promise<Play | null>;
  getPlayByProfile(profileId: string, kind: PlayKind, ref: string): Promise<Play | null>;
  /** Insert or update by id (unique on anonId+kind+ref). */
  savePlay(play: Play): Promise<void>;
  listPlays(filter: PlayFilter): Promise<Play[]>;
  /** Attach every play of anonId to profileId (anon merge on sign-in, Section 10.8). */
  assignPlaysToProfile(anonId: string, profileId: string): Promise<number>;

  // Profiles ----------------------------------------------------------------
  getProfile(id: string): Promise<Profile | null>;
  getProfileByHandle(handle: string): Promise<Profile | null>;
  listProfiles(ids: string[]): Promise<Profile[]>;
  upsertProfile(profile: Profile): Promise<void>;

  // Aggregates --------------------------------------------------------------
  getDailyStats(puzzleNumber: number): Promise<DailyStats | null>;
  /** Record one finished daily play. takes = 1..10 for a win, null for a loss. */
  recordDailyResult(puzzleNumber: number, takes: number | null): Promise<void>;
}
