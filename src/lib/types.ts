// Shared contracts. Source of truth: docs/greenlit-system-design.md, Sections 8 and 9.
// Owned by WS0. Other workstreams import from here and never edit it.
// Contract additions beyond Section 9 are documented in Section 9.1 of the design doc.

import type { RegionCode } from '@/config/regions';

export type { RegionCode };

// ---------------------------------------------------------------------------
// Section 9: feedback contracts (verbatim, plus documented additions)
// ---------------------------------------------------------------------------

export type Verdict = 'match' | 'close' | 'miss' | 'na';
export type Direction = 'up' | 'down' | null; // up = answer is later/bigger/higher

export interface PersonFeedback {
  personId: number;
  name: string;
  profilePath: string | null;
  verdict: 'match' | 'miss';
  answerRole?: 'lead' | 'supp' | 'director';
}

export interface NumberFeedback {
  value: number | null;
  verdict: Verdict;
  direction: Direction;
}

export interface GuessFeedback {
  filmId: number;
  title: string;
  // 9.1: Section 9 also listed `year: number` here, which collides with `year: NumberFeedback`.
  // The guessed film's year is `year.value`.
  posterPath: string | null;
  director: { display: string; verdict: 'match' | 'miss'; personIds: number[] };
  lead: PersonFeedback | null;
  supporting: PersonFeedback[]; // 0..4
  year: NumberFeedback;
  boxOffice: NumberFeedback;
  score: NumberFeedback;
  /**
   * Addition (9.1): `region` is the region whose certifications were compared. It equals the
   * player's region unless the answer had no certification there, in which case it is
   * FALLBACK_REGION ('US') and the UI shows a tiny region tag.
   */
  rating: { value: string | null; verdict: 'match' | 'miss' | 'na'; region: RegionCode };
  studio: { name: string; logoPath: string | null; verdict: 'match' | 'miss' };
  genres: { id: number; name: string; verdict: 'match' | 'miss' }[];
  genreCount: number; // answer's genre count
  isCorrect: boolean;
}

export interface Reveal {
  filmId: number;
  title: string;
  year: number;
  posterPath: string | null;
  director: string; // director unit display name
  tagline: string | null;
  trailerYoutube: string | null;
}

// ---------------------------------------------------------------------------
// Hints ("Script Notes", Section 4.8)
// ---------------------------------------------------------------------------

export type HintType =
  | 'tagline'
  | 'plot_keywords'
  | 'cast_connection'
  | 'filmography'
  | 'awards'
  | 'sequel_status'
  | 'decade_vibe'
  | 'first_letter'
  | 'creator_note'; // addition (9.1): a pitch's optional note, unlocks at PITCH.noteUnlockAfter

export type Hint =
  | { type: 'tagline'; payload: { text: string } }
  | { type: 'plot_keywords'; payload: { keywords: string[] } } // 3..5
  | { type: 'cast_connection'; payload: { personName: string; filmTitle: string; filmYear: number } }
  | { type: 'filmography'; payload: { films: { title: string; year: number }[] } }
  | { type: 'awards'; payload: { text: string } }
  | { type: 'sequel_status'; payload: { text: string } }
  | { type: 'decade_vibe'; payload: { text: string } }
  | { type: 'first_letter'; payload: { letter: string } }
  | { type: 'creator_note'; payload: { text: string } };

export type HintSlot = 1 | 2;

export interface UsedHint {
  slot: HintSlot;
  hint: Hint;
}

// ---------------------------------------------------------------------------
// Plays
// ---------------------------------------------------------------------------

/** Phase 1 kinds. Extra modes (Phase 2+) extend this union. */
export type PlayKind = 'daily' | 'vault' | 'pitch';
export type PlayStatus = 'in_progress' | 'won' | 'lost';

// ---------------------------------------------------------------------------
// Section 9: API request / response shapes
// ---------------------------------------------------------------------------

export interface SearchResult {
  id: number;
  title: string;
  year: number;
  posterPath: string | null;
}
export interface SearchResponse {
  results: SearchResult[];
}

/** Shape of public/search-index.json (built by WS1). Every playable film; reveals nothing. */
export interface SearchIndexEntry extends SearchResult {
  originalTitle?: string;
}
export interface SearchIndexFile {
  v: 1;
  films: SearchIndexEntry[];
}

export interface TodayResponse {
  number: number;
  date: string; // YYYY-MM-DD in America/New_York
  theme: string | null;
  nextResetAt: string; // ISO 8601 instant
}

export interface GuessRequest {
  kind: PlayKind;
  ref: string; // puzzle number (as string) or pitch slug
  filmId: number;
}
export interface GuessResponse {
  feedback: GuessFeedback;
  take: number;
  status: PlayStatus;
  reveal?: Reveal; // only when status becomes won/lost
}

export interface GiveUpRequest {
  kind: PlayKind;
  ref: string;
}
export interface GiveUpResponse {
  status: 'lost';
  reveal: Reveal;
}

export interface HintRequest {
  kind: PlayKind;
  ref: string;
  slot: HintSlot;
  hintType: HintType;
}
export interface HintResponse {
  hint: Hint;
}

/** Type ids only (labels from HINT_TYPE_LABELS in src/config/hints.ts). Never content. */
export interface HintOptionsResponse {
  slot1: HintType[];
  slot2: HintType[];
}

/** GET /api/play: current play state, guesses re-evaluated to feedback. */
export interface PlayStateResponse {
  kind: PlayKind;
  ref: string;
  status: PlayStatus;
  take: number; // guesses made so far
  feedback: GuessFeedback[]; // oldest first
  hints: UsedHint[];
  reveal?: Reveal; // only when status is won/lost
}

export interface PitchRequest {
  filmId: number;
  note?: string;
}
export interface PitchResponse {
  slug: string;
  url: string;
}

export interface PitchResultRow {
  handle: string | null; // null for anonymous players
  status: PlayStatus;
  takes: number | null;
  hintsUsed: number;
  finishedAt: string | null;
}
export interface PitchResultsResponse {
  slug: string;
  film: Reveal; // the creator chose it, so they may see it
  results: PitchResultRow[];
}

export type LeaderboardPeriod = 'week' | 'all' | 'streak';
export interface LeaderboardRow {
  rank: number;
  handle: string;
  /** week/all: average takes (loss = LOSS_SCORE). streak: current daily win streak. */
  value: number;
  played: number;
  wins: number;
}
export interface LeaderboardResponse {
  period: LeaderboardPeriod;
  noNotes: boolean;
  rows: LeaderboardRow[];
}

/** distribution has 11 entries: index 0..9 = won in 1..10 takes, index 10 = sent to turnaround. */
export interface DailyStatsResponse {
  puzzleNumber: number;
  distribution: number[];
  plays: number;
  wins: number;
}

export type ApiErrorCode =
  | 'bad_request'
  | 'not_found'
  | 'already_guessed'
  | 'game_over'
  | 'hint_locked'
  | 'hint_unavailable'
  | 'rate_limited'
  | 'unauthorized'
  | 'forbidden'
  | 'internal';
export interface ApiError {
  error: { code: ApiErrorCode; message: string };
}

// ---------------------------------------------------------------------------
// Section 8: domain records (camelCase mirrors of the SQL tables)
// ---------------------------------------------------------------------------

export interface DirectorUnit {
  ids: number[]; // ordered person ids; length > 1 for co-directing units
  display: string; // "Christopher Nolan", "The Coens", "Daniels"
}

export interface Film {
  id: number; // TMDB movie id
  title: string;
  originalTitle: string | null;
  releaseYear: number;
  releaseDate: string | null; // YYYY-MM-DD
  posterPath: string | null;
  backdropPath: string | null;
  runtimeMin: number | null;
  boxOfficeUsd: number | null;
  scoreSnapshot: number | null; // 0..100, frozen at ingest
  studioId: number | null;
  directorUnit: DirectorUnit;
  leadPersonId: number | null;
  supportingIds: number[]; // 0..RULES.maxSupportingCast
  genreIds: number[]; // 1..5
  trailerYoutube: string | null;
  tagline: string | null;
  keywords: string[]; // addition (9.1): TMDB keywords, for hint generation
  popularity: number | null;
  isPlayable: boolean;
  isAnswerEligible: boolean;
}

export interface FilmCertification {
  filmId: number;
  region: RegionCode;
  rating: string;
}

export interface Person {
  id: number;
  name: string;
  profilePath: string | null;
}

export interface Studio {
  id: number;
  name: string;
  logoPath: string | null;
}

export interface StudioAlias {
  rawCompanyId: number; // TMDB production company id
  studioId: number;
}

export interface Genre {
  id: number;
  name: string;
}

/** Addition (9.1): curated awards blurbs, written in-house, used by the hint generator. */
export interface FilmAward {
  filmId: number;
  text: string; // e.g. "Won Best Original Screenplay"
}

/** SERVER ONLY. Contains the answer. Never serialize to a client before the play finishes. */
export interface Puzzle {
  number: number; // Reel number
  date: string; // YYYY-MM-DD in America/New_York
  filmId: number;
  theme: string | null;
  hints: Hint[]; // HINT_CANDIDATES_PER_PUZZLE candidates
}

/** Safe-to-publish view of a puzzle. */
export interface PublicPuzzle {
  number: number;
  date: string;
  theme: string | null;
}

/** SERVER ONLY. Contains the answer. */
export interface Pitch {
  slug: string;
  filmId: number;
  note: string | null;
  creatorId: string | null;
  createdAt: string;
}

export interface Profile {
  id: string; // uuid, equals auth user id
  handle: string | null;
  region: RegionCode | null;
  flagged: boolean; // addition (9.1): hidden from leaderboards pending review
  flagReason: string | null;
  createdAt: string;
}

export interface Play {
  id: string;
  profileId: string | null;
  anonId: string;
  kind: PlayKind;
  ref: string;
  guesses: number[]; // film ids in order
  hintsUsed: HintType[]; // index 0 = slot 1, index 1 = slot 2
  status: PlayStatus;
  takes: number | null;
  startedAt: string;
  firstGuessAt: string | null; // addition (9.1): for the time-to-first-guess anti-cheat flag
  finishedAt: string | null;
}

export interface DailyStats {
  puzzleNumber: number;
  distribution: number[]; // 11 entries, see DailyStatsResponse
  plays: number;
  wins: number;
}

// ---------------------------------------------------------------------------
// Client-side persistence contracts (shared by WS4, WS5, WS7)
// ---------------------------------------------------------------------------

export interface ClientSettings {
  region: RegionCode | null; // null = auto
  colorblind: boolean;
  reducedMotion: 'system' | 'on' | 'off';
}

/** One finished play, stored in localStorage under LOCAL_STATS_KEY, keyed by `${kind}:${ref}`. */
export interface LocalPlayRecord {
  kind: PlayKind;
  ref: string;
  status: Exclude<PlayStatus, 'in_progress'>;
  takes: number; // takes used; LOSS_SCORE is applied only when averaging
  hintsUsed: number;
  finishedAt: string; // ISO
}
export interface LocalStatsFile {
  v: 1;
  records: Record<string, LocalPlayRecord>;
}
