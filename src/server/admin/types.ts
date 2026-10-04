// Admin API view models (WS8). These DO contain answers: only /api/admin/* (admin gated) returns
// them, and only src/components/admin renders them.
import type { Film, FilmCertification, Genre, Hint, Studio, StudioAlias } from '@/lib/types';

export interface AdminFilmSummary {
  id: number;
  title: string;
  year: number;
  posterPath: string | null;
  popularity: number | null;
  isAnswerEligible: boolean;
  /** Missing required fields (empty = schedulable as far as the film goes). */
  missing: string[];
  /** Scheduled dates of this film inside the loaded window, for cooldown awareness. */
  scheduled: { number: number; date: string }[];
}

export interface AdminPuzzle {
  number: number;
  date: string;
  theme: string | null;
  filmId: number;
  film: AdminFilmSummary | null;
  hints: Hint[];
  /** Rule problems with the stored puzzle (e.g. film lost a field, cooldown clash). */
  problems: string[];
}

export interface AdminDay {
  date: string;
  number: number;
  isPast: boolean;
  isToday: boolean;
  /** Whether schedule / swap / delete is allowed on this date right now. */
  editable: boolean;
  puzzle: AdminPuzzle | null;
}

export interface AdminScheduleResponse {
  today: string;
  launch: string;
  aheadDays: number;
  cooldownDays: number;
  hintCount: number;
  days: AdminDay[];
}

export interface AdminFilmDetail {
  film: Film;
  certifications: FilmCertification[];
  directorNames: string[];
  leadName: string | null;
  supportingNames: string[];
  studio: Studio | null;
  genres: Genre[];
  missing: string[];
}

export interface AdminFilmsResponse {
  films: AdminFilmSummary[];
}

export interface AdminStudiosResponse {
  studios: Studio[];
  aliases: StudioAlias[];
}

export interface AdminThemeResult {
  updated: number[];
  skipped: string[];
}

export interface AdminDraftResponse {
  hints: Hint[];
  problems: string[];
}

/** Editable film fields (basic form). Score is frozen at ingest and never editable. */
export interface AdminFilmPatch {
  tagline?: string | null;
  boxOfficeUsd?: number | null;
  keywords?: string[];
  genreIds?: number[];
  isAnswerEligible?: boolean;
  isPlayable?: boolean;
}
