// Opening Weekend engine (Section 5, WS9): higher or lower on worldwide gross. SERVER ONLY.
//
// Decisions:
// - The server issues each pair as cards with no gross. A choice resolves exactly one pair and
//   only then are both of its grosses returned.
// - State lives in an encrypted run token (token.ts). Daily runs are also recorded as a play
//   (kind 'opening_weekend', ref = New York date) created at start, so one daily run per player
//   holds even if the tab is closed. The play's guesses are the films picked correctly, in order,
//   so guesses.length is the step the next valid token must carry; takes is the running score.
// - Status: 'lost' = ended on a wrong pick, 'won' = the clock ran out with no miss. A run left
//   in progress past its window counts as finished on time with its saved score.
// - The 60s window is enforced from the token's start instant plus a small network grace.
// - Practice runs are never persisted: random seed, no clock, no board.
import 'server-only';
import { OPENING_WEEKEND } from '@/config/modes';
import { dateInResetZone } from '@/lib/dates';
import type { Play } from '@/lib/types';
import { getRepo } from '@/server/db';
import { ApiFailure } from '@/server/http';
import { loadPlay, newPlay, savePlay, type Identity } from '@/server/plays';
import { buildPool, buildSequence, higherSide, toCard, type OwFilm, type OwPair } from './sequence';
import { dailySeed, decodeRunToken, encodeRunToken, type OwDailyRecord, type OwRunState } from './token';
import type {
  OwAnswerResponse,
  OwBoardRow,
  OwFinishResponse,
  OwMode,
  OwOutcome,
  OwPairView,
  OwResolved,
  OwSide,
  OwStartResponse,
  OwStatusResponse,
} from './types';

export const OW_KIND = 'opening_weekend' as const;
/** Network grace on top of the daily window, in ms. */
export const OW_GRACE_MS = 2500;
export const OW_WINDOW_MS = OPENING_WEEKEND.dailyRunSeconds * 1000;
const BOARD_SIZE = 10;

/** Per-request context: identity plus the daily cookie record read from the request. */
export interface OwContext {
  identity: Identity;
  cookieRecord: OwDailyRecord | null;
  /** Set by the engine when the daily cookie must be rewritten. */
  nextCookie?: OwDailyRecord;
}

// ---- Pool and pairs -------------------------------------------------------------------------

async function loadPool(): Promise<OwFilm[]> {
  const pool = buildPool(await getRepo().listFilms({ playable: true }));
  if (pool.length < 2) throw new ApiFailure('not_found', 'Opening Weekend is not showing right now.');
  return pool;
}

function pairAt(pool: OwFilm[], seed: string, step: number): OwPair {
  const seq = buildSequence(pool, seed, step + 1);
  const pair = seq[step];
  if (!pair) throw new ApiFailure('not_found', 'Opening Weekend is not showing right now.');
  return pair;
}

function view(pair: OwPair): OwPairView {
  return { step: pair.step, left: toCard(pair.left), right: toCard(pair.right) };
}

function resolved(pair: OwPair, picked: OwSide): OwResolved {
  return {
    left: { id: pair.left.id, gross: pair.left.gross },
    right: { id: pair.right.id, gross: pair.right.gross },
    higher: higherSide(pair),
    picked,
  };
}

// ---- Daily record ---------------------------------------------------------------------------

function deadline(t0: number): number {
  return t0 + OW_WINDOW_MS;
}

function remaining(t0: number, now: number): number {
  return Math.max(0, deadline(t0) - now);
}

function recordFromPlay(play: Play): OwDailyRecord {
  return {
    date: play.ref,
    anon: play.anonId,
    run: play.id,
    step: Math.max(play.guesses.length, play.takes ?? 0),
    t0: Date.parse(play.startedAt),
    done: play.status !== 'in_progress',
    outcome: play.status === 'lost' ? 'wrong' : play.status === 'won' ? 'time' : null,
  };
}

/**
 * Today's daily run for this player from the play row and the signed cookie, whichever is
 * further along (so neither a lagging instance nor a stale cookie can rewind a run).
 */
async function loadDaily(ctx: OwContext, date: string): Promise<{ play: Play | null; record: OwDailyRecord | null }> {
  const { identity } = ctx;
  let play = await loadPlay(identity, OW_KIND, date);
  const c = ctx.cookieRecord;
  const cookie = c && c.date === date && c.anon === identity.anonId ? c : null;
  if (!play && cookie) {
    // Keyless mode on a fresh instance: rebuild the play row from the signed cookie.
    play = newPlay(identity, OW_KIND, date, new Date(cookie.t0));
    play.id = cookie.run;
    play.takes = cookie.step;
    if (cookie.done) {
      play.status = cookie.outcome === 'wrong' ? 'lost' : 'won';
      play.finishedAt = new Date(Math.min(Date.now(), deadline(cookie.t0))).toISOString();
    }
    await savePlay(play, identity);
  }
  if (!play) return { play: null, record: null };
  const fromPlay = recordFromPlay(play);
  if (cookie && cookie.run === fromPlay.run) {
    if (cookie.step > fromPlay.step) fromPlay.step = cookie.step;
    if (cookie.done && !fromPlay.done) {
      fromPlay.done = true;
      fromPlay.outcome = cookie.outcome ?? 'time';
    }
  }
  return { play, record: fromPlay };
}

async function persist(ctx: OwContext, play: Play, record: OwDailyRecord): Promise<void> {
  await savePlay(play, ctx.identity);
  ctx.nextCookie = record;
}

async function finishDaily(ctx: OwContext, play: Play, record: OwDailyRecord, outcome: OwOutcome, now: number): Promise<number> {
  const score = record.step;
  play.status = outcome === 'wrong' ? 'lost' : 'won';
  play.takes = score;
  play.finishedAt = new Date(Math.min(now, deadline(record.t0) + OW_GRACE_MS)).toISOString();
  record.done = true;
  record.outcome = outcome;
  await persist(ctx, play, record);
  return score;
}

// ---- Public operations ----------------------------------------------------------------------

export function todayDate(now: Date): string {
  return dateInResetZone(now);
}

export async function startRun(ctx: OwContext, mode: OwMode, now: Date): Promise<OwStartResponse> {
  const pool = await loadPool();
  const nowMs = now.getTime();
  if (mode === 'practice') {
    const state: OwRunState = {
      v: 1,
      mode: 'practice',
      seed: crypto.randomUUID(),
      date: null,
      anon: ctx.identity.anonId,
      run: crypto.randomUUID(),
      step: 0,
      t0: nowMs,
    };
    return { status: 'started', mode, token: encodeRunToken(state), pair: view(pairAt(pool, state.seed, 0)), remainingMs: null, date: null };
  }

  const date = todayDate(now);
  const seed = dailySeed(date);
  const { play, record } = await loadDaily(ctx, date);
  if (play && record) {
    if (!record.done && nowMs > deadline(record.t0) + OW_GRACE_MS) {
      await finishDaily(ctx, play, record, 'time', nowMs);
    }
    if (record.done) {
      return { status: 'done', mode: 'daily', date, score: record.step, outcome: record.outcome ?? 'time' };
    }
    // Resume the run in progress (same clock, same step).
    const state: OwRunState = { v: 1, mode: 'daily', seed, date, anon: ctx.identity.anonId, run: record.run, step: record.step, t0: record.t0 };
    ctx.nextCookie = record;
    return {
      status: 'resumed',
      mode,
      token: encodeRunToken(state),
      pair: view(pairAt(pool, seed, record.step)),
      remainingMs: remaining(record.t0, nowMs),
      date,
    };
  }

  const fresh = newPlay(ctx.identity, OW_KIND, date, now);
  fresh.takes = 0;
  const rec = recordFromPlay(fresh);
  const pair = pairAt(pool, seed, 0);
  await persist(ctx, fresh, rec);
  const state: OwRunState = { v: 1, mode: 'daily', seed, date, anon: ctx.identity.anonId, run: fresh.id, step: 0, t0: nowMs };
  return { status: 'started', mode, token: encodeRunToken(state), pair: view(pair), remainingMs: OW_WINDOW_MS, date };
}

function readState(ctx: OwContext, token: string): OwRunState {
  const state = decodeRunToken(token);
  if (!state) throw new ApiFailure('bad_request', 'That run ticket is not valid.');
  // Daily runs are bound to the player. Practice runs record nothing, so a token that outlives a
  // cookie change (first visit, cleared cookies) keeps working.
  if (state.mode === 'daily' && state.anon !== ctx.identity.anonId) {
    throw new ApiFailure('forbidden', 'That run belongs to another player.');
  }
  return state;
}

/** Load the daily run a token refers to and check the token is the current one. */
async function checkDaily(ctx: OwContext, state: OwRunState): Promise<{ play: Play; record: OwDailyRecord }> {
  const { play, record } = await loadDaily(ctx, state.date!);
  if (!play || !record || record.run !== state.run) throw new ApiFailure('forbidden', 'That run is not yours to continue.');
  if (record.done) throw new ApiFailure('game_over', 'This run is already over.');
  if (record.step !== state.step) throw new ApiFailure('game_over', 'That pair was already answered.');
  return { play, record };
}

export async function answer(ctx: OwContext, token: string, pick: OwSide, now: Date): Promise<OwAnswerResponse> {
  const state = readState(ctx, token);
  const nowMs = now.getTime();
  const pool = await loadPool();

  if (state.mode === 'practice') {
    const pair = pairAt(pool, state.seed, state.step);
    const res = resolved(pair, pick);
    if (res.higher !== pick) return { result: 'wrong', resolved: res, score: state.step };
    const next: OwRunState = { ...state, step: state.step + 1 };
    return {
      result: 'correct',
      resolved: res,
      score: next.step,
      next: { token: encodeRunToken(next), pair: view(pairAt(pool, state.seed, next.step)) },
      remainingMs: null,
    };
  }

  const { play, record } = await checkDaily(ctx, state);
  if (nowMs > deadline(record.t0) + OW_GRACE_MS) {
    // Too late: the pair stays unresolved and its grosses stay secret.
    const score = await finishDaily(ctx, play, record, 'time', nowMs);
    return { result: 'time', score };
  }
  const pair = pairAt(pool, state.seed, state.step);
  const res = resolved(pair, pick);
  if (res.higher !== pick) {
    const score = await finishDaily(ctx, play, record, 'wrong', nowMs);
    return { result: 'wrong', resolved: res, score };
  }
  const chosen = pick === 'left' ? pair.left : pair.right;
  play.guesses = [...play.guesses, chosen.id];
  if (!play.firstGuessAt) play.firstGuessAt = now.toISOString();
  record.step += 1;
  play.takes = record.step;
  await persist(ctx, play, record);
  const next: OwRunState = { ...state, step: record.step };
  return {
    result: 'correct',
    resolved: res,
    score: record.step,
    next: { token: encodeRunToken(next), pair: view(pairAt(pool, state.seed, next.step)) },
    remainingMs: remaining(record.t0, nowMs),
  };
}

/** End a daily run at its current score (the client's clock ran out, or the player stopped). */
export async function finishRun(ctx: OwContext, token: string, now: Date): Promise<OwFinishResponse> {
  const state = readState(ctx, token);
  if (state.mode === 'practice') return { score: state.step, outcome: 'time' };
  const { play, record } = await loadDaily(ctx, state.date!);
  if (!play || !record || record.run !== state.run) throw new ApiFailure('forbidden', 'That run is not yours to finish.');
  if (record.done) return { score: record.step, outcome: record.outcome ?? 'time' };
  const score = await finishDaily(ctx, play, record, 'time', now.getTime());
  return { score, outcome: 'time' };
}

function runIsFinished(p: Play, nowMs: number): boolean {
  return p.status !== 'in_progress' || nowMs > deadline(Date.parse(p.startedAt)) + OW_GRACE_MS;
}

export async function status(ctx: OwContext, now: Date): Promise<OwStatusResponse> {
  const repo = getRepo();
  const date = todayDate(now);
  const nowMs = now.getTime();
  const { record } = await loadDaily(ctx, date);
  let today: OwStatusResponse['today'] = null;
  if (record) {
    const finished = record.done || nowMs > deadline(record.t0) + OW_GRACE_MS;
    today = { score: record.step, finished, outcome: finished ? (record.outcome ?? 'time') : null };
  }

  const plays = (await repo.listPlays({ kind: OW_KIND, ref: date })).filter((p) => runIsFinished(p, nowMs));
  const profileIds = [...new Set(plays.map((p) => p.profileId).filter((id): id is string => !!id))];
  const profiles = profileIds.length ? await repo.listProfiles(profileIds) : [];
  const handles = new Map(profiles.filter((p) => p.handle && !p.flagged).map((p) => [p.id, p.handle!]));
  const score = (p: Play) => p.takes ?? p.guesses.length;
  const named = plays
    .filter((p) => p.profileId && handles.has(p.profileId))
    .sort((a, b) => score(b) - score(a) || (a.finishedAt ?? a.startedAt).localeCompare(b.finishedAt ?? b.startedAt));
  const rows: OwBoardRow[] = [];
  for (const p of named) {
    if (rows.length >= BOARD_SIZE) break;
    const prev = rows[rows.length - 1];
    const s = score(p);
    rows.push({ rank: prev && prev.score === s ? prev.rank : rows.length + 1, handle: handles.get(p.profileId!)!, score: s });
  }
  return {
    date,
    seconds: OPENING_WEEKEND.dailyRunSeconds,
    today,
    board: { rows, anonymousCount: plays.length - named.length, totalRuns: plays.length },
  };
}
