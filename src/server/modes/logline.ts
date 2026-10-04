// Logline mode engine (Section 5, WS9; contract notes in Section 9.1 item 19). SERVER ONLY.
//
// Decisions:
// - Daily film: deterministic from the New York date. The pool is every film that has loglines
//   (src/server/modes/logline-data.ts) and is playable in the active library. It is shuffled in
//   cycles (mulberry32, like the classic default schedule in src/server/db/seed.ts) so a film
//   repeats only after the whole pool is used. If the pick equals today's classic daily answer,
//   the next film in the cycle is used instead. Independent of the classic schedule otherwise.
// - Takes: up to LOGLINE.maxTakes. Tier k (1-based) is earned after k - 1 missed takes; once
//   every tier is shown the remaining takes keep the last tier. Unearned tiers, the answer's
//   title and its id are never serialized until the round is over.
// - State: one round per player per day (kind 'logline', ref = date). The play is stored in the
//   repo, and also mirrored into an AES-GCM encrypted httpOnly cookie (LOGLINE_STATE_COOKIE)
//   bound to the anon id and the date, so it survives serverless hops in keyless deployments.
//   A token that fails to decrypt, or names another player or day, is ignored (never trusted).
//   When both sources exist the further-along one wins, so clearing one cannot reset a round.
//   The token is not mirrored into the shared gl_plays cookie, so it never evicts classic plays.
import 'server-only';
import { LOGLINE } from '@/config/modes';
import { LAUNCH_DATE, RATE_LIMITS } from '@/config/game';
import { daysBetween, dateInResetZone } from '@/lib/dates';
import { readCookie } from '@/lib/anon';
import type { Film, Play, PlayStatus } from '@/lib/types';
import { getRepo } from '@/server/db';
import { decrypt, encrypt } from '@/server/db/secret';
import { ApiFailure } from '@/server/http';
import { loadPlay, newPlay, type Identity } from '@/server/plays';
import { checkRateLimit } from '@/server/ratelimit';
import type { LoglineGuess, LoglineStateResponse } from '@/components/modes/logline/types';
import { LOGLINE_FILM_IDS, loglineFor } from './logline-data';

export const LOGLINE_KIND = 'logline' as const;
export const LOGLINE_STATE_COOKIE = 'gl_logline';
const STATE_COOKIE_MAX_AGE = 60 * 60 * 48;
const SEED = 0x10611e5;

// ---------------------------------------------------------------------------
// Pure helpers (exported for tests)
// ---------------------------------------------------------------------------

/** mulberry32, the same small PRNG as the classic default schedule. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The daily logline film for a date from a candidate pool. Deterministic: the same date and pool
 * always give the same film. `avoidId` (today's classic answer) is skipped when possible.
 */
export function pickDailyFilmId(
  date: string,
  candidates: readonly number[],
  avoidId: number | null = null,
  launch: string = LAUNCH_DATE,
): number | null {
  const pool = [...new Set(candidates)].sort((a, b) => a - b);
  const n = pool.length;
  if (n === 0) return null;
  const day = daysBetween(launch, date);
  const cycle = Math.floor(day / n);
  const index = ((day % n) + n) % n;
  const r = rng(SEED ^ (cycle >>> 0));
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const pick = pool[index]!;
  return pick === avoidId && n > 1 ? pool[(index + 1) % n]! : pick;
}

/** How many tiers the player may see after `takes` takes. Finished rounds see everything. */
export function tiersVisible(takes: number, status: PlayStatus, totalTiers: number = LOGLINE.tiers): number {
  if (status !== 'in_progress') return totalTiers;
  return Math.max(1, Math.min(totalTiers, takes + 1));
}

/** Status after a take: won on the answer, lost when out of takes, otherwise still rolling. */
export function statusAfter(guesses: readonly number[], answerId: number, maxTakes: number = LOGLINE.maxTakes): PlayStatus {
  if (guesses.includes(answerId)) return 'won';
  return guesses.length >= maxTakes ? 'lost' : 'in_progress';
}

// ---------------------------------------------------------------------------
// State token
// ---------------------------------------------------------------------------

interface StateToken {
  v: 1;
  /** anon id the token belongs to */
  a: string;
  /** New York date of the round */
  d: string;
  /** guessed film ids, in order */
  g: number[];
  s: PlayStatus;
}

export function encodeState(anonId: string, date: string, guesses: readonly number[], status: PlayStatus): string {
  const token: StateToken = { v: 1, a: anonId, d: date, g: [...guesses], s: status };
  return encrypt(JSON.stringify(token));
}

/** Decrypt and validate a state token. Null when tampered, malformed, or for another player / day. */
export function decodeState(token: string | null | undefined, anonId: string, date: string): { guesses: number[]; status: PlayStatus } | null {
  if (!token) return null;
  const raw = decrypt(token);
  if (!raw) return null;
  try {
    const t = JSON.parse(raw) as Partial<StateToken>;
    if (t.v !== 1 || t.a !== anonId || t.d !== date) return null;
    if (!Array.isArray(t.g) || t.g.length > LOGLINE.maxTakes || !t.g.every((x) => Number.isInteger(x) && x > 0)) return null;
    if (t.s !== 'in_progress' && t.s !== 'won' && t.s !== 'lost') return null;
    return { guesses: t.g, status: t.s };
  } catch {
    return null;
  }
}

export function stateCookieHeader(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${LOGLINE_STATE_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${STATE_COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax${secure}`;
}

export function readStateToken(request: Request): string | null {
  return readCookie(request, LOGLINE_STATE_COOKIE);
}

// ---------------------------------------------------------------------------
// Daily target
// ---------------------------------------------------------------------------

interface DailyTarget {
  date: string;
  film: Film;
  tiers: readonly string[];
}

/** Today's logline film. Throws ApiFailure('internal') if no film is available. */
export async function dailyTarget(now: Date = new Date()): Promise<DailyTarget> {
  const repo = getRepo();
  const date = dateInResetZone(now);
  const films = (await repo.getFilms([...LOGLINE_FILM_IDS])).filter((f) => f.isPlayable && loglineFor(f.id));
  let classicId: number | null = null;
  try {
    classicId = (await repo.getPuzzleByDate(date))?.filmId ?? null;
  } catch {
    classicId = null;
  }
  const id = pickDailyFilmId(date, films.map((f) => f.id), classicId);
  const film = films.find((f) => f.id === id);
  const tiers = film ? loglineFor(film.id) : null;
  if (!film || !tiers) throw new ApiFailure('internal', 'Today\'s logline is unavailable right now.');
  return { date, film, tiers };
}

// ---------------------------------------------------------------------------
// Rounds
// ---------------------------------------------------------------------------

interface Round {
  play: Play;
  target: DailyTarget;
}

async function loadRound(identity: Identity, token: string | null, now: Date): Promise<Round> {
  const target = await dailyTarget(now);
  const stored = await loadPlay(identity, LOGLINE_KIND, target.date);
  const fromToken = decodeState(token, identity.anonId, target.date);
  let play = stored ?? newPlay(identity, LOGLINE_KIND, target.date, now);
  if (fromToken) {
    const storedDone = play.status !== 'in_progress';
    const tokenAhead = fromToken.status !== 'in_progress' || fromToken.guesses.length > play.guesses.length;
    if (!storedDone && tokenAhead) {
      // Re-derive the status from the guesses instead of trusting the token's claim.
      play = { ...play, guesses: [...fromToken.guesses] };
      play.status = statusAfter(play.guesses, target.film.id);
      if (play.status !== 'in_progress') {
        play.takes = play.guesses.length;
        play.finishedAt = play.finishedAt ?? now.toISOString();
      }
    }
  }
  return { play, target };
}

async function toResponse(round: Round): Promise<LoglineStateResponse> {
  const { play, target } = round;
  const films = play.guesses.length ? await getRepo().getFilms(play.guesses) : [];
  const byId = new Map(films.map((f) => [f.id, f]));
  const guesses: LoglineGuess[] = play.guesses.flatMap((id) => {
    const f = byId.get(id);
    return f ? [{ filmId: f.id, title: f.title, year: f.releaseYear, correct: f.id === target.film.id }] : [];
  });
  const shown = tiersVisible(play.guesses.length, play.status, target.tiers.length);
  const res: LoglineStateResponse = {
    date: target.date,
    maxTakes: LOGLINE.maxTakes,
    totalTiers: target.tiers.length,
    status: play.status,
    take: play.guesses.length,
    tiers: target.tiers.slice(0, shown),
    guesses,
  };
  if (play.status !== 'in_progress') {
    res.reveal = {
      title: target.film.title,
      year: target.film.releaseYear,
      posterPath: target.film.posterPath,
      tiers: [...target.tiers],
    };
  }
  return res;
}

export interface LoglineResult {
  state: LoglineStateResponse;
  /** Fresh encrypted state token to set as LOGLINE_STATE_COOKIE. */
  token: string;
}

function tokenFor(identity: Identity, play: Play): string {
  return encodeState(identity.anonId, play.ref, play.guesses, play.status);
}

/** Current round for a player. Read only: never creates a stored play. */
export async function getLoglineState(identity: Identity, token: string | null, now: Date = new Date()): Promise<LoglineResult> {
  const round = await loadRound(identity, token, now);
  return { state: await toResponse(round), token: tokenFor(identity, round.play) };
}

/** Submit a take. Validation order: round over -> film exists and is playable -> not repeated. */
export async function submitLoglineGuess(
  identity: Identity,
  token: string | null,
  filmId: number,
  now: Date = new Date(),
): Promise<LoglineResult> {
  const limit = await checkRateLimit(`logline:anon:${identity.anonId}`, RATE_LIMITS.guessPerMinutePerAnon, 60);
  if (!limit.ok) throw new ApiFailure('rate_limited', 'Too many takes. Take a breath and try again in a minute.');

  const repo = getRepo();
  const round = await loadRound(identity, token, now);
  const { play, target } = round;
  if (play.status !== 'in_progress' || play.guesses.length >= LOGLINE.maxTakes) {
    throw new ApiFailure('game_over', 'Today\'s logline is already wrapped.');
  }
  const guessed = await repo.getFilm(filmId);
  if (!guessed || !guessed.isPlayable) throw new ApiFailure('not_found', 'That film is not in the library.');
  if (play.guesses.includes(filmId)) throw new ApiFailure('already_guessed', 'You already tried that film.');

  play.guesses.push(filmId);
  if (!play.firstGuessAt) play.firstGuessAt = now.toISOString();
  play.status = statusAfter(play.guesses, target.film.id);
  if (play.status !== 'in_progress') {
    play.takes = play.guesses.length;
    play.finishedAt = now.toISOString();
  }
  if (identity.profileId && !play.profileId) play.profileId = identity.profileId;
  await repo.savePlay(play);
  return { state: await toResponse(round), token: tokenFor(identity, play) };
}
