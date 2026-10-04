// Opening Weekend (WS9) wire contracts. Type-only and isomorphic: the client imports these types
// (erased at build time), the server builds the values. Nothing here carries a gross for a pair
// that has not been resolved yet.

/** Public face of a film card. Deliberately has no box office field. */
export interface OwCard {
  id: number;
  title: string;
  year: number;
  posterPath: string | null;
}

export type OwSide = 'left' | 'right';
export type OwMode = 'daily' | 'practice';

export interface OwPairView {
  /** 0-based step index; also the score so far. */
  step: number;
  left: OwCard;
  right: OwCard;
}

/** Both grosses of a pair the player has already answered. */
export interface OwResolved {
  left: { id: number; gross: number };
  right: { id: number; gross: number };
  higher: OwSide;
  picked: OwSide;
}

export interface OwStartedResponse {
  status: 'started' | 'resumed';
  mode: OwMode;
  token: string;
  pair: OwPairView;
  /** Daily only: milliseconds left on the server clock when this response was built. */
  remainingMs: number | null;
  date: string | null;
}

export interface OwDoneResponse {
  status: 'done';
  mode: 'daily';
  date: string;
  score: number;
  outcome: OwOutcome;
}

export type OwStartResponse = OwStartedResponse | OwDoneResponse;

/** How a daily run ended: a wrong pick, or the clock ran out with no miss. */
export type OwOutcome = 'wrong' | 'time';

export type OwAnswerResponse =
  | {
      result: 'correct';
      resolved: OwResolved;
      score: number;
      next: { token: string; pair: OwPairView };
      remainingMs: number | null;
    }
  | { result: 'wrong'; resolved: OwResolved; score: number }
  | { result: 'time'; score: number };

export interface OwFinishResponse {
  score: number;
  outcome: OwOutcome;
}

export interface OwBoardRow {
  rank: number;
  handle: string;
  score: number;
}

export interface OwStatusResponse {
  date: string;
  seconds: number;
  /** This player's daily run for today, if any. */
  today: { score: number; finished: boolean; outcome: OwOutcome | null } | null;
  board: {
    rows: OwBoardRow[];
    /** Finished runs by players without a public handle. */
    anonymousCount: number;
    totalRuns: number;
  };
}
