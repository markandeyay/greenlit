// Release Order engine (WS9, Section 5). SERVER ONLY.
//
// Round state:
// - The set comes from the saved play (its first attempt is the set), else the state token, else
//   the deterministic daily pick. Card keys index the served order (logic.servedOrder).
// - Attempts come from the saved play and the encrypted state token (cookie gl_ro); the longer
//   history wins, and a finished play is final. Every attempt is saved as a play
//   (kind 'release_order', ref = New York date, guesses = flattened film ids), so one anon id gets
//   one round per day, and clearing only the token cookie does not reset it.
// - Release dates and years leave the server only in `reveal`, once the round is won or lost.
import 'server-only';
import { RELEASE_ORDER } from '@/config/modes';
import { dateInResetZone, nextResetAt } from '@/lib/dates';
import type { Film, Play, PlayStatus } from '@/lib/types';
import { getRepo, type Repo } from '@/server/db';
import { ApiFailure } from '@/server/http';
import { loadPlay, newPlay, savePlay, type Identity } from '@/server/plays';
import { isPermutation, isWin, pickDailySet, scoreAttempt, servedOrder, shortDateLabel, trueOrder } from './logic';
import { decodeRoundToken, type RoundToken } from './token';
import type { ReleaseOrderState } from './types';

export const RELEASE_ORDER_KIND = 'release_order' as const;
const N = RELEASE_ORDER.filmsPerSet;

const setCache = new WeakMap<Repo, Map<string, number[]>>();

/** The day's set ids (pick order), memoized per repo and date. */
export async function dailySetIds(date: string, repo: Repo = getRepo()): Promise<number[]> {
  let byDate = setCache.get(repo);
  if (!byDate) {
    byDate = new Map();
    setCache.set(repo, byDate);
  }
  const hit = byDate.get(date);
  if (hit) return hit;
  const set = pickDailySet(await repo.listFilms({ playable: true }), date);
  if (!set) throw new ApiFailure('internal', 'Today’s set is unavailable right now.');
  const ids = set.map((f) => f.id);
  byDate.set(date, ids);
  return ids;
}

interface Round {
  date: string;
  /** Set films in served order (index = card key). */
  films: Film[];
  attempts: number[][];
  play: Play | null;
}

const sameIds = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

function attemptsFromPlay(play: Play, ids: number[]): number[][] {
  const out: number[][] = [];
  for (let i = 0; i + N <= play.guesses.length; i += N) {
    const keys = play.guesses.slice(i, i + N).map((id) => ids.indexOf(id));
    if (isPermutation(keys, N)) out.push(keys);
  }
  return out;
}

async function loadRound(identity: Identity, rawToken: string | null, now: Date): Promise<Round> {
  const repo = getRepo();
  const date = dateInResetZone(now);
  const play = await loadPlay(identity, RELEASE_ORDER_KIND, date);
  let token = decodeRoundToken(rawToken);
  if (token && (token.d !== date || token.a !== identity.anonId || token.s.length !== N || !token.t.every((t) => isPermutation(t, N)))) {
    token = null;
  }

  let ids: number[];
  if (play && play.guesses.length >= N) ids = servedOrder(play.guesses.slice(0, N), date);
  else if (token) ids = token.s;
  else ids = servedOrder(await dailySetIds(date, repo), date);

  const byId = new Map((await repo.getFilms(ids)).map((f) => [f.id, f]));
  const films = ids.map((id) => byId.get(id));
  if (films.some((f) => !f)) throw new ApiFailure('internal', 'Today’s set is unavailable right now.');

  const fromPlay = play ? attemptsFromPlay(play, ids) : [];
  const fromToken = token && sameIds(token.s, ids) ? token.t : [];
  const finishedPlay = play && play.status !== 'in_progress';
  const attempts = finishedPlay || fromPlay.length >= fromToken.length ? fromPlay : fromToken;
  return { date, films: films as Film[], attempts: attempts.slice(0, RELEASE_ORDER.maxAttempts), play };
}

function truthKeys(films: Film[]): number[] {
  return trueOrder(films).map((id) => films.findIndex((f) => f.id === id));
}

function statusOf(attempts: number[][], truth: number[]): PlayStatus {
  if (attempts.some((a) => isWin(scoreAttempt(a, truth)))) return 'won';
  return attempts.length >= RELEASE_ORDER.maxAttempts ? 'lost' : 'in_progress';
}

function toState(round: Round, now: Date): ReleaseOrderState {
  const truth = truthKeys(round.films);
  const status = statusOf(round.attempts, truth);
  const state: ReleaseOrderState = {
    date: round.date,
    dateLabel: shortDateLabel(round.date),
    cards: round.films.map((f, key) => ({ key, title: f.title, posterPath: f.posterPath })),
    attempts: round.attempts.map((order) => ({ order: [...order], feedback: scoreAttempt(order, truth) })),
    maxAttempts: RELEASE_ORDER.maxAttempts,
    status,
    nextResetAt: nextResetAt(now).toISOString(),
  };
  if (status !== 'in_progress') {
    state.reveal = truth.map((key) => {
      const f = round.films[key]!;
      return { key, title: f.title, posterPath: f.posterPath, releaseDate: f.releaseDate, releaseYear: f.releaseYear };
    });
  }
  return state;
}

function tokenFor(round: Round, identity: Identity): RoundToken {
  return { v: 1, d: round.date, a: identity.anonId, s: round.films.map((f) => f.id), t: round.attempts };
}

export interface RoundResult {
  state: ReleaseOrderState;
  /** Token to store in the round cookie (absent when nothing needs to be written). */
  token?: RoundToken;
}

/** Current round for this player (starts nothing; a play is saved on the first attempt). */
export async function getReleaseOrderRound(identity: Identity, rawToken: string | null, now: Date = new Date()): Promise<RoundResult> {
  const round = await loadRound(identity, rawToken, now);
  return { state: toState(round, now), token: round.attempts.length ? tokenFor(round, identity) : undefined };
}

/** Validate and score one attempt. */
export async function submitReleaseOrderAttempt(
  identity: Identity,
  rawToken: string | null,
  body: { date: string; order: unknown[] },
  now: Date = new Date(),
): Promise<RoundResult> {
  const round = await loadRound(identity, rawToken, now);
  if (body.date !== round.date) throw new ApiFailure('game_over', 'That set has closed. Reload for today’s set.');
  const truth = truthKeys(round.films);
  if (statusOf(round.attempts, truth) !== 'in_progress') throw new ApiFailure('game_over', 'This round is already over.');
  if (!isPermutation(body.order, N)) throw new ApiFailure('bad_request', `Send all ${N} films in an order.`);

  round.attempts = [...round.attempts, [...body.order]];
  const status = statusOf(round.attempts, truth);

  const play = round.play ?? newPlay(identity, RELEASE_ORDER_KIND, round.date, now);
  play.guesses = round.attempts.flat().map((k) => round.films[k]!.id);
  play.firstGuessAt ??= now.toISOString();
  play.status = status;
  if (status !== 'in_progress') {
    play.takes = round.attempts.length;
    play.finishedAt = now.toISOString();
  }
  await savePlay(play, identity);
  round.play = play;

  return { state: toState(round, now), token: tokenFor(round, identity) };
}
