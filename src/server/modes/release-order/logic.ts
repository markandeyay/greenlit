// Release Order pure logic (WS9): daily set selection, served order, scoring. No I/O, no secrets.
//
// Decisions:
// - Pool = playable films at or above the "Popular" band cutoff (UNLIMITED.bands.popular), so the
//   set is well known. If that pool is too small to build sets reliably (under 4 sets worth), the
//   whole playable library is used instead.
// - A film's sort date is releaseDate, or releaseYear-07-01 when only the year is known. Any two
//   films in a set are at least RELEASE_ORDER.minDaysApart apart by that date. When either film
//   has only a year, they must also be in different calendar years, so the true order is never
//   ambiguous. Titles in a set are distinct (case and punctuation insensitive).
// - Everything is seeded from the New York date with a string hash, so every serverless instance
//   builds the same set for the same day without shared state.
// - The served order is a seeded Fisher-Yates shuffle of the set's ids sorted ascending. It reads
//   only ids and the date, never a date field, so it is independent of release order. It may by
//   chance equal the true order (1 in 120 for five films); excluding that would itself leak.
// - Feedback is Wordle style per position: 'match' (right slot), 'close' (exactly one slot off,
//   shown amber with the ≈ glyph), 'miss'. One slot off is a numeric closeness on position, which
//   keeps amber's single meaning ("numerically close", Section 2) and makes three attempts fair.
import { RELEASE_ORDER, UNLIMITED } from '@/config/modes';
import { daysBetween } from '@/lib/dates';
import type { Film } from '@/lib/types';
import type { SlotVerdict } from './types';

/** FNV-1a 32 bit string hash. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Small deterministic PRNG (mulberry32), same style as src/server/db/seed.ts. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], r: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export interface SortDate {
  date: string;
  /** False when only the release year is known (date is the mid-year fallback). */
  precise: boolean;
  year: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function sortDate(film: Pick<Film, 'releaseDate' | 'releaseYear'>): SortDate {
  if (film.releaseDate && DATE_RE.test(film.releaseDate)) {
    return { date: film.releaseDate, precise: true, year: Number(film.releaseDate.slice(0, 4)) };
  }
  return { date: `${String(film.releaseYear).padStart(4, '0')}-07-01`, precise: false, year: film.releaseYear };
}

const normTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '');

/** True when two films can share a set without an ambiguous order. */
export function compatible(a: Film, b: Film, minDaysApart: number = RELEASE_ORDER.minDaysApart): boolean {
  if (a.id === b.id || normTitle(a.title) === normTitle(b.title)) return false;
  const da = sortDate(a);
  const db = sortDate(b);
  if (Math.abs(daysBetween(da.date, db.date)) < minDaysApart) return false;
  if ((!da.precise || !db.precise) && da.year === db.year) return false;
  return true;
}

/** Candidate films for daily sets, sorted by id so the result does not depend on storage order. */
export function setPool(films: Film[], filmsPerSet: number = RELEASE_ORDER.filmsPerSet): Film[] {
  const playable = films.filter((f) => f.isPlayable).sort((a, b) => a.id - b.id);
  const known = playable.filter((f) => (f.popularity ?? 0) >= UNLIMITED.bands.popular.minPopularity);
  return known.length >= filmsPerSet * 4 ? known : playable;
}

/**
 * The day's set: RELEASE_ORDER.filmsPerSet mutually compatible films, deterministic for `date`.
 * Returned in pick order (not release order, not served order). Null if the library cannot
 * supply a valid set.
 */
export function pickDailySet(
  films: Film[],
  date: string,
  opts: { filmsPerSet?: number; minDaysApart?: number } = {},
): Film[] | null {
  const n = opts.filmsPerSet ?? RELEASE_ORDER.filmsPerSet;
  const gap = opts.minDaysApart ?? RELEASE_ORDER.minDaysApart;
  const pool = shuffleInPlace([...setPool(films, n)], rng(hashSeed(`release_order:set:${date}`)));
  const picked: Film[] = [];
  for (const f of pool) {
    if (picked.every((p) => compatible(p, f, gap))) picked.push(f);
    if (picked.length === n) return picked;
  }
  return null;
}

/** Served order: ids sorted ascending, then a seeded shuffle. Reads only ids and the date. */
export function servedOrder(ids: readonly number[], date: string): number[] {
  const sorted = [...ids].sort((a, b) => a - b);
  return shuffleInPlace(sorted, rng(hashSeed(`release_order:serve:${date}`)));
}

/** Film ids sorted earliest to latest. */
export function trueOrder(films: Film[]): number[] {
  return [...films]
    .sort((a, b) => {
      const d = daysBetween(sortDate(b).date, sortDate(a).date);
      return d !== 0 ? d : a.id - b.id;
    })
    .map((f) => f.id);
}

/** True when `order` is a permutation of 0..n-1. */
export function isPermutation(order: readonly unknown[], n: number): order is number[] {
  if (order.length !== n) return false;
  const seen = new Set<number>();
  for (const k of order) {
    if (typeof k !== 'number' || !Number.isInteger(k) || k < 0 || k >= n || seen.has(k)) return false;
    seen.add(k);
  }
  return true;
}

/**
 * Score a submitted order. `order` and `truth` hold the same items; position i of the result is
 * the verdict for order[i]: match if it belongs at i, close if it belongs one slot away.
 */
export function scoreAttempt<T>(order: readonly T[], truth: readonly T[]): SlotVerdict[] {
  return order.map((item, i) => {
    const rank = truth.indexOf(item);
    if (rank === i) return 'match';
    if (rank >= 0 && Math.abs(rank - i) === 1) return 'close';
    return 'miss';
  });
}

export const isWin = (feedback: readonly SlotVerdict[]) => feedback.length > 0 && feedback.every((v) => v === 'match');

/** "Oct 4" for 2026-10-04. */
export function shortDateLabel(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
