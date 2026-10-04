// Logline mode wire types (WS9). Client safe: no content, no answers. The server engine
// (src/server/modes/logline.ts) produces these; the routes and page serialize them.
import type { PlayStatus } from '@/lib/types';

/** One of the player's own takes. The correct take only exists once the round is over. */
export interface LoglineGuess {
  filmId: number;
  title: string;
  year: number;
  correct: boolean;
}

/** Sent only when the round is finished (won or lost). */
export interface LoglineReveal {
  title: string;
  year: number;
  posterPath: string | null;
  /** Every tier, most vague first; the last is the full logline. */
  tiers: string[];
}

export interface LoglineStateResponse {
  /** New York date of the round, YYYY-MM-DD. */
  date: string;
  maxTakes: number;
  /** How many tiers the film has in total (the count, never the text). */
  totalTiers: number;
  status: PlayStatus;
  /** Takes used so far. */
  take: number;
  /** Tiers earned so far, most vague first. */
  tiers: string[];
  guesses: LoglineGuess[];
  reveal?: LoglineReveal;
}

export interface LoglineGuessRequest {
  filmId: number;
}
