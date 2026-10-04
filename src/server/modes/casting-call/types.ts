// Casting Call wire types (WS9). Type-only module: safe for client components to import.
import type { PlayStatus } from '@/lib/types';

export interface CastingPerson {
  id: number;
  name: string;
  profilePath: string | null;
}

export interface CastingFilm {
  id: number;
  title: string;
  year: number;
  posterPath: string | null;
}

/** One link of a chain: a film, then the actor cast from it. */
export interface CastingLink {
  film: CastingFilm;
  person: CastingPerson;
}

/** A cast member of an option film, as seen from the current actor. */
export interface CastingOptionPerson extends CastingPerson {
  billing: 'lead' | 'supp';
  /** Already on the call sheet (start actor or an earlier link): not selectable. */
  used: boolean;
  /** Their other films not yet used in the chain (local degree, not a distance). */
  onward: number;
}

/** A film from the current actor's filmography with its capped cast (current actor excluded). */
export interface CastingOptionFilm extends CastingFilm {
  cast: CastingOptionPerson[];
}

export interface CastingResult {
  /** Films in the shortest possible chain. */
  optimalFilms: number;
  /** One shortest chain. Sent only once the round is finished. */
  optimalPath: CastingLink[];
}

/** GET /api/modes/casting-call and the POST routes all return this. */
export interface CastingCallState {
  date: string; // YYYY-MM-DD, America/New_York
  start: CastingPerson;
  end: CastingPerson;
  status: PlayStatus;
  chain: CastingLink[];
  maxLinks: number;
  /** Current actor's filmography (unused films only). null once the round is finished. */
  options: CastingOptionFilm[] | null;
  /** Present only when status is won or lost. */
  result?: CastingResult;
}

export interface CastingLinkRequest {
  date: string;
  filmId: number;
  personId: number;
}

export interface CastingGiveUpRequest {
  date: string;
}
