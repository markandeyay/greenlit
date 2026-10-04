// Unlimited / Dailies Reel (Section 5, 9.1 item 19, WS9). SERVER ONLY.
//
// Endless practice with the classic engine (kind 'unlimited'). The player picks a difficulty
// band, the server picks a random answer-eligible film in that band and returns an OPAQUE ref:
// AES-256-GCM (src/server/db/secret.ts) over "u1:<filmId>:<band>:<nonce>". The ref is never
// derivable from the film without SESSION_SECRET, and two reels of the same film get different
// refs (random IV plus nonce). The ref is the play key, so each reel is its own play row.
//
// Decisions:
// - Bands (UNLIMITED.bands) are popularity tiers over answer-eligible, playable films with known
//   box office (the same pool rule as scheduled dailies): a band holds films with popularity in
//   [its minPopularity, the next higher band's minPopularity). Null popularity counts as 0.
// - If a band's tier is empty (small or skewed libraries, e.g. the fixture has no film under 30),
//   the band falls back to its popularity-rank third of the pool (Popular = top third,
//   Cinephile = middle, Deep cut = bottom), so every band always deals a film.
// - `after` (the previous ref) is excluded from the draw when the pool has another film, so
//   "Next reel" never deals the same film twice in a row.
// - Resolution validates the decrypted film is still answer-eligible and playable. Every failure
//   is the same generic not_found, never naming the film or its id.
// - Script Notes: unlimited offers the same two notes as dailies, drafted by generateHints over
//   the active library (cached per film id per instance; the draft is deterministic).
import 'server-only';
import { randomBytes, randomInt } from 'node:crypto';
import { UNLIMITED, type UnlimitedBand } from '@/config/modes';
import { getRepo } from '@/server/db';
import { decrypt, encrypt } from '@/server/db/secret';
import { ApiFailure } from '@/server/http';
import { generateHints } from '@/server/admin/hints-draft';
import { hintLibraryFor } from '@/server/admin/library';
import type { ResolvedTarget } from '@/server/puzzles';
import type { Film, Hint } from '@/lib/types';

export const UNLIMITED_BANDS = Object.keys(UNLIMITED.bands) as [UnlimitedBand, ...UnlimitedBand[]];
const REF_VERSION = 'u1';
export const REEL_NOT_FOUND = 'Reel not found. Roll a new one.';

export function isUnlimitedBand(v: unknown): v is UnlimitedBand {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(UNLIMITED.bands, v);
}

// ---------------------------------------------------------------------------
// Opaque refs
// ---------------------------------------------------------------------------

export interface UnlimitedRefPayload {
  filmId: number;
  band: UnlimitedBand;
}

/** Encrypt a film id and band into an opaque, single-use-looking ref. */
export function encodeUnlimitedRef(filmId: number, band: UnlimitedBand): string {
  const nonce = randomBytes(6).toString('base64url');
  return encrypt(`${REF_VERSION}:${filmId}:${band}:${nonce}`);
}

/** Decrypt and validate a ref's shape. Null for anything tampered, foreign or malformed. */
export function decodeUnlimitedRef(ref: string): UnlimitedRefPayload | null {
  if (typeof ref !== 'string' || ref.length === 0 || ref.length > 512 || !/^[A-Za-z0-9_-]+$/.test(ref)) return null;
  const plain = decrypt(ref);
  if (!plain) return null;
  const parts = plain.split(':');
  if (parts.length !== 4 || parts[0] !== REF_VERSION) return null;
  const [, id, band] = parts;
  if (!/^[1-9][0-9]{0,9}$/.test(id!)) return null;
  const filmId = Number(id);
  if (!Number.isSafeInteger(filmId) || filmId > 2_147_483_647) return null;
  if (!isUnlimitedBand(band)) return null;
  return { filmId, band };
}

// ---------------------------------------------------------------------------
// Band selection (pure)
// ---------------------------------------------------------------------------

const pop = (f: Pick<Film, 'popularity'>) => f.popularity ?? 0;

/** Films that may be dealt at all: answer-eligible, playable, known box office. */
export function answerPool(films: Film[]): Film[] {
  return films.filter((f) => f.isAnswerEligible && f.isPlayable && f.boxOfficeUsd !== null);
}

/** [min, max) popularity bounds of a band; max is the next higher band's cutoff. */
export function bandBounds(band: UnlimitedBand): { min: number; max: number } {
  const min = UNLIMITED.bands[band].minPopularity;
  const higher = UNLIMITED_BANDS.map((b) => UNLIMITED.bands[b].minPopularity).filter((m) => m > min);
  return { min, max: higher.length ? Math.min(...higher) : Infinity };
}

/** The films a band can deal from (see the fallback rule at the top of this file). */
export function bandFilms(films: Film[], band: UnlimitedBand): Film[] {
  const pool = answerPool(films);
  const { min, max } = bandBounds(band);
  const tier = pool.filter((f) => pop(f) >= min && pop(f) < max);
  if (tier.length > 0 || pool.length === 0) return tier;
  // Fallback: the band's rank slice of the pool, most popular first.
  const ranked = [...pool].sort((a, b) => pop(b) - pop(a) || a.id - b.id);
  const order = [...UNLIMITED_BANDS].sort((a, b) => UNLIMITED.bands[b].minPopularity - UNLIMITED.bands[a].minPopularity);
  const i = order.indexOf(band);
  const n = order.length;
  const start = Math.floor((i * ranked.length) / n);
  const end = Math.max(start + 1, Math.floor(((i + 1) * ranked.length) / n));
  return ranked.slice(start, end);
}

/** Pick one film from a band, avoiding `excludeId` when the band has any other film. */
export function pickBandFilm(
  films: Film[],
  band: UnlimitedBand,
  rng: (n: number) => number = randomInt,
  excludeId: number | null = null,
): Film | null {
  const candidates = bandFilms(films, band);
  const pool = candidates.length > 1 && excludeId !== null ? candidates.filter((f) => f.id !== excludeId) : candidates;
  if (pool.length === 0) return null;
  return pool[rng(pool.length)] ?? null;
}

// ---------------------------------------------------------------------------
// Engine entry points
// ---------------------------------------------------------------------------

/** POST /api/modes/unlimited/new: deal a reel. Returns only the opaque ref. */
export async function newUnlimitedReel(
  band: UnlimitedBand,
  after: string | null = null,
  rng: (n: number) => number = randomInt,
): Promise<{ ref: string; band: UnlimitedBand }> {
  const films = await getRepo().listFilms({ answerEligible: true });
  const previous = after ? decodeUnlimitedRef(after) : null;
  const film = pickBandFilm(films, band, rng, previous?.filmId ?? null);
  if (!film) throw new ApiFailure('not_found', 'No reels are loaded for that band yet. Try another.');
  return { ref: encodeUnlimitedRef(film.id, band), band };
}

const HINT_CACHE_MAX = 200;
const hintCache = new Map<number, Hint[]>();

async function hintsFor(film: Film): Promise<Hint[]> {
  const cached = hintCache.get(film.id);
  if (cached) return cached;
  let hints: Hint[] = [];
  try {
    hints = generateHints(film, await hintLibraryFor(getRepo(), film));
  } catch {
    hints = [];
  }
  if (hintCache.size >= HINT_CACHE_MAX) hintCache.delete(hintCache.keys().next().value!);
  hintCache.set(film.id, hints);
  return hints;
}

/** Test hook: the hint cache is per instance and keyed by film id. */
export function clearUnlimitedHintCacheForTesting(): void {
  hintCache.clear();
}

/**
 * resolveTarget for kind 'unlimited'. The ref is returned unchanged as the play key. Errors are
 * the same generic not_found for every failure so they never single out a film.
 */
export async function resolveUnlimitedTarget(ref: string): Promise<ResolvedTarget> {
  const payload = decodeUnlimitedRef(ref);
  if (!payload) throw new ApiFailure('not_found', REEL_NOT_FOUND);
  const film = await getRepo().getFilm(payload.filmId);
  if (!film || !film.isAnswerEligible || !film.isPlayable) throw new ApiFailure('not_found', REEL_NOT_FOUND);
  return {
    kind: 'unlimited',
    ref,
    answerFilmId: film.id,
    puzzleNumber: null,
    hints: await hintsFor(film),
  };
}
