// Release Order (WS9, Section 5) wire types. Isomorphic: the client imports these as types only.
//
// The set's films are public (title, poster) but their ORDER and DATES are the answer. Until the
// round finishes, films are identified only by their slot in a deterministic, date independent
// shuffle (`key` 0..n-1). No film id, release date, release year or other sortable field is sent.
import type { PlayStatus } from '@/lib/types';

/** Per position verdict: right slot, one slot off, or neither. */
export type SlotVerdict = 'match' | 'close' | 'miss';

/** A film of today's set as shown before the round ends. */
export interface ReleaseOrderCard {
  /** Index into the served (shuffled) order. Opaque: not correlated with release order. */
  key: number;
  title: string;
  posterPath: string | null;
}

export interface ReleaseOrderAttempt {
  /** Card keys, earliest first, as the player submitted them. */
  order: number[];
  /** feedback[i] is the verdict for position i of `order`. */
  feedback: SlotVerdict[];
}

/** Sent only once the round is over. */
export interface ReleaseOrderRevealEntry {
  key: number;
  title: string;
  posterPath: string | null;
  /** YYYY-MM-DD, or null when only the year is known. */
  releaseDate: string | null;
  releaseYear: number;
}

export interface ReleaseOrderState {
  /** New York date of the set, YYYY-MM-DD. */
  date: string;
  /** Short date label for headings and share text, e.g. "Oct 4". */
  dateLabel: string;
  cards: ReleaseOrderCard[];
  attempts: ReleaseOrderAttempt[];
  maxAttempts: number;
  status: PlayStatus;
  /** ISO instant of the next daily reset. */
  nextResetAt: string;
  /** True release order, earliest first. Present only when status is won or lost. */
  reveal?: ReleaseOrderRevealEntry[];
}

export interface ReleaseOrderAttemptRequest {
  date: string;
  order: number[];
}
