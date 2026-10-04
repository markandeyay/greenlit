// Puzzle resolution (Sections 4.10, 9.1 item 7, 10.4). SERVER ONLY: a ResolvedTarget holds the
// answer film id and hint content, and must never be serialized to a client.
//
// - 'daily': only today's puzzle number (America/New_York). Any other number is not_found.
// - 'vault': any released past puzzle, 1 <= number < today. Never today, never the future,
//   never pre-launch.
// - 'pitch': repo.getPitch(slug).
// Refs for daily/vault are canonicalized ("007" -> "7") so one puzzle maps to one play row.
import 'server-only';
import { getRepo } from '@/server/db';
import { ApiFailure } from '@/server/http';
import { addDays, dateInResetZone, nextResetAt, puzzleNumberForDate } from '@/lib/dates';
import type { Hint, PlayKind, PublicPuzzle, TodayResponse } from '@/lib/types';

export interface ResolvedTarget {
  kind: PlayKind;
  /** Canonical ref used as the play key. */
  ref: string;
  answerFilmId: number;
  /** Daily/vault puzzle number, null for pitches. */
  puzzleNumber: number | null;
  /** Hint candidates (daily/vault) or a creator_note hint (pitch, when a note exists). */
  hints: Hint[];
}

const NUMBER_RE = /^\d{1,6}$/;
const SLUG_RE = /^[0-9a-z]{1,64}$/;

const NOT_FOUND = 'Puzzle not found.';

function parsePuzzleNumber(ref: string): number {
  if (!NUMBER_RE.test(ref)) throw new ApiFailure('bad_request', 'Puzzle reference must be a reel number.');
  return Number(ref);
}

export function todayInfo(now: Date = new Date()): { number: number; date: string } {
  const date = dateInResetZone(now);
  return { number: puzzleNumberForDate(date), date };
}

export async function resolveTarget(kind: PlayKind, ref: string, now: Date = new Date()): Promise<ResolvedTarget> {
  const repo = getRepo();
  const today = todayInfo(now);

  if (kind === 'pitch') {
    if (!SLUG_RE.test(ref)) throw new ApiFailure('not_found', 'Challenge not found.');
    const pitch = await repo.getPitch(ref);
    if (!pitch) throw new ApiFailure('not_found', 'Challenge not found.');
    return {
      kind,
      ref: pitch.slug,
      answerFilmId: pitch.filmId,
      puzzleNumber: null,
      hints: pitch.note ? [{ type: 'creator_note', payload: { text: pitch.note } }] : [],
    };
  }

  const n = parsePuzzleNumber(ref);
  if (kind === 'daily') {
    if (n !== today.number) {
      throw new ApiFailure('not_found', "Only today's puzzle can be played as the daily. Past puzzles live in the Vault.");
    }
  } else if (n < 1 || n >= today.number) {
    throw new ApiFailure('not_found', NOT_FOUND);
  }
  const puzzle = await repo.getPuzzle(n);
  if (!puzzle) throw new ApiFailure('not_found', NOT_FOUND);
  // Defense in depth against a mis-scheduled row: never serve a puzzle dated after today, and the
  // vault never serves today's.
  if (puzzle.date > today.date || (kind === 'vault' && puzzle.date >= today.date)) {
    throw new ApiFailure('not_found', NOT_FOUND);
  }
  return { kind, ref: String(n), answerFilmId: puzzle.filmId, puzzleNumber: n, hints: puzzle.hints };
}

/** GET /api/today payload. Throws not_found when no puzzle is scheduled for today (or pre-launch). */
export async function getToday(now: Date = new Date()): Promise<TodayResponse> {
  const today = todayInfo(now);
  if (today.number < 1) throw new ApiFailure('not_found', 'The first reel has not premiered yet.');
  const puzzle = await getRepo().getPuzzle(today.number);
  if (!puzzle || puzzle.date !== today.date) throw new ApiFailure('not_found', 'No puzzle is scheduled for today.');
  return {
    number: puzzle.number,
    date: puzzle.date,
    theme: puzzle.theme,
    nextResetAt: nextResetAt(now).toISOString(),
  };
}

/**
 * The Vault: every released past puzzle (1 <= number < today, date before today), newest first.
 * Public fields only. For WS5.
 */
export async function listVault(now: Date = new Date()): Promise<PublicPuzzle[]> {
  const today = todayInfo(now);
  if (today.number <= 1) return [];
  const puzzles = await getRepo().listPuzzles({ toDate: addDays(today.date, -1) });
  return puzzles
    .filter((p) => p.number >= 1 && p.number < today.number && p.date < today.date)
    .sort((a, b) => b.number - a.number)
    .map((p) => ({ number: p.number, date: p.date, theme: p.theme }));
}

/** Public info for one vault puzzle, or null if it is not released into the Vault. For WS5. */
export async function getVaultPuzzle(n: number, now: Date = new Date()): Promise<PublicPuzzle | null> {
  const today = todayInfo(now);
  if (!Number.isInteger(n) || n < 1 || n >= today.number) return null;
  const p = await getRepo().getPuzzle(n);
  if (!p || p.date >= today.date) return null;
  return { number: p.number, date: p.date, theme: p.theme };
}

/** True when a daily puzzle number is released (1 <= n <= today). */
export function isReleasedPuzzleNumber(n: number, now: Date = new Date()): boolean {
  return Number.isInteger(n) && n >= 1 && n <= todayInfo(now).number;
}
