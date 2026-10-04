// Casting Call engine (Section 5, WS9, 9.1 item 19). SERVER ONLY.
//
// Decisions:
// - The daily pair comes from today's New York date (src/lib/dates.ts) and the library graph,
//   identical on every instance. The graph and the day's pair are cached per repo instance.
// - No leaks: the optimal path (and any distance) is computed here but is only serialized into
//   a response once the round is won or lost. While playing, a response carries the pair, the
//   player's own chain, and the CURRENT actor's filmography with each film's cast. Options are
//   ordered by year and billing, never by distance.
// - State survives serverless hops twice over: an AES-GCM state token in the httpOnly `gl_cc`
//   cookie (bound to the anon id and date, so it cannot be replayed by another player or day),
//   and the play record (kind 'casting_call', ref = date) which the keyless repo also mirrors
//   into the signed play cookie. On load the most advanced valid source wins (finished beats in
//   progress, then the longer chain), so replaying an old token cannot rewind a round.
// - Play record mapping: `guesses` holds the chain interleaved [filmId, personId, ...] so the
//   chain can be rebuilt from the repo alone; `takes` = films used, set when finished.
// - Links are final (no undo). The round is lost at CASTING_CALL.maxLinks films without reaching
//   the end actor, or on give up.
import 'server-only';
import { CASTING_CALL } from '@/config/modes';
import { RATE_LIMITS } from '@/config/game';
import { dateInResetZone } from '@/lib/dates';
import type { Play, PlayStatus } from '@/lib/types';
import { getRepo, type Repo } from '@/server/db';
import { decrypt, encrypt } from '@/server/db/secret';
import { ApiFailure } from '@/server/http';
import { loadPlay, newPlay, savePlay, type Identity } from '@/server/plays';
import { checkRateLimit } from '@/server/ratelimit';
import { readCookie } from '@/lib/anon';
import {
  buildCastGraph,
  eligiblePairs,
  pickDailyPair,
  validateChain,
  validateLink,
  type CastGraph,
  type ChainLink,
  type DailyPair,
} from './graph';
import type { CastingCallState, CastingFilm, CastingLink, CastingOptionFilm, CastingPerson } from './types';

export const KIND = 'casting_call' as const;
export const STATE_COOKIE = 'gl_cc';
const STATE_MAX_AGE = 60 * 60 * 48;
const GRAPH_TTL_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------------------------------------
// Graph cache
// ---------------------------------------------------------------------------------------------

interface GraphEntry {
  builtAt: number;
  graph: CastGraph;
  pairs: [number, number][];
  daily: Map<string, DailyPair | null>;
}

const cache = new WeakMap<Repo, GraphEntry>();

async function graphEntry(repo: Repo, now: number): Promise<GraphEntry> {
  const hit = cache.get(repo);
  if (hit && now - hit.builtAt < GRAPH_TTL_MS) return hit;
  const films = await repo.listFilms({ playable: true });
  const ids = new Set<number>();
  for (const f of films) {
    if (f.leadPersonId != null) ids.add(f.leadPersonId);
    for (const s of f.supportingIds) ids.add(s);
  }
  const people = await repo.getPeople([...ids]);
  const graph = buildCastGraph(films, people);
  const entry: GraphEntry = { builtAt: now, graph, pairs: eligiblePairs(graph), daily: new Map() };
  cache.set(repo, entry);
  return entry;
}

/** Today's graph and pair. Throws not_found when the library cannot produce a pair. */
export async function todaysCall(now: Date = new Date()): Promise<{ graph: CastGraph; pair: DailyPair }> {
  const entry = await graphEntry(getRepo(), now.getTime());
  const date = dateInResetZone(now);
  if (!entry.daily.has(date)) entry.daily.set(date, pickDailyPair(entry.graph, date, entry.pairs));
  const pair = entry.daily.get(date);
  if (!pair) throw new ApiFailure('not_found', 'There is no casting call today.');
  return { graph: entry.graph, pair };
}

// ---------------------------------------------------------------------------------------------
// Round state and the encrypted state token
// ---------------------------------------------------------------------------------------------

export interface Round {
  chain: ChainLink[];
  status: PlayStatus;
  startedAt: string;
  firstAt: string | null;
  finishedAt: string | null;
}

interface TokenPayload {
  v: 1;
  a: string; // anon id
  d: string; // date
  c: [number, number][];
  s: PlayStatus;
  t0: string;
  t1: string | null;
  tf: string | null;
}

export function encodeStateToken(anonId: string, date: string, round: Round): string {
  const payload: TokenPayload = {
    v: 1,
    a: anonId,
    d: date,
    c: round.chain.map((l) => [l.filmId, l.personId]),
    s: round.status,
    t0: round.startedAt,
    t1: round.firstAt,
    tf: round.finishedAt,
  };
  return encrypt(JSON.stringify(payload));
}

const STATUSES: PlayStatus[] = ['in_progress', 'won', 'lost'];

/** Decrypt and check a state token. Tampered, foreign (other anon id) or stale tokens are null. */
export function decodeStateToken(token: string | null, anonId: string, date: string): Round | null {
  if (!token) return null;
  const raw = decrypt(token);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as TokenPayload;
    if (p.v !== 1 || p.a !== anonId || p.d !== date || !STATUSES.includes(p.s) || !Array.isArray(p.c)) return null;
    const chain = p.c.map(([filmId, personId]) => ({ filmId: Number(filmId), personId: Number(personId) }));
    if (chain.some((l) => !Number.isInteger(l.filmId) || !Number.isInteger(l.personId))) return null;
    return { chain, status: p.s, startedAt: String(p.t0), firstAt: p.t1 ?? null, finishedAt: p.tf ?? null };
  } catch {
    return null;
  }
}

export function stateCookieHeader(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${STATE_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${STATE_MAX_AGE}; HttpOnly; SameSite=Lax${secure}`;
}

function roundFromPlay(play: Play): Round {
  const chain: ChainLink[] = [];
  for (let i = 0; i + 1 < play.guesses.length; i += 2) chain.push({ filmId: play.guesses[i]!, personId: play.guesses[i + 1]! });
  return { chain, status: play.status, startedAt: play.startedAt, firstAt: play.firstGuessAt, finishedAt: play.finishedAt };
}

function progress(r: Round): number {
  return (r.status === 'in_progress' ? 0 : 1000) + r.chain.length;
}

/** Status implied by a chain (guards against a stored status that disagrees with the chain). */
function consistent(pair: DailyPair, r: Round): boolean {
  const reached = r.chain.some((l) => l.personId === pair.endId);
  if (reached) return r.status === 'won';
  if (r.status === 'won') return false;
  if (r.chain.length >= CASTING_CALL.maxLinks) return r.status === 'lost';
  return true;
}

interface Loaded {
  graph: CastGraph;
  pair: DailyPair;
  round: Round | null;
  play: Play | null;
}

async function loadRound(request: Request, identity: Identity, now: Date): Promise<Loaded> {
  const { graph, pair } = await todaysCall(now);
  const play = await loadPlay(identity, KIND, pair.date);
  const sources: Round[] = [];
  if (play) sources.push(roundFromPlay(play));
  const fromToken = decodeStateToken(readCookie(request, STATE_COOKIE), identity.anonId, pair.date);
  if (fromToken) sources.push(fromToken);
  const valid = sources.filter((r) => consistent(pair, r) && validateChain(graph, pair, r.chain));
  valid.sort((a, b) => progress(b) - progress(a));
  return { graph, pair, round: valid[0] ?? null, play };
}

async function persist(identity: Identity, pair: DailyPair, round: Round, existing: Play | null, now: Date): Promise<string> {
  const play = existing ?? newPlay(identity, KIND, pair.date, now);
  play.guesses = round.chain.flatMap((l) => [l.filmId, l.personId]);
  play.hintsUsed = [];
  play.status = round.status;
  play.startedAt = round.startedAt;
  play.firstGuessAt = round.firstAt;
  play.finishedAt = round.finishedAt;
  play.takes = round.status === 'in_progress' ? null : round.chain.length;
  await savePlay(play, identity);
  return encodeStateToken(identity.anonId, pair.date, round);
}

// ---------------------------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------------------------

function personView(graph: CastGraph, id: number): CastingPerson {
  const p = graph.people.get(id);
  return { id, name: p?.name ?? 'Unknown', profilePath: p?.profilePath ?? null };
}

function filmView(graph: CastGraph, id: number): CastingFilm {
  const f = graph.films.get(id);
  return { id, title: f?.title ?? 'Unknown', year: f?.year ?? 0, posterPath: f?.posterPath ?? null };
}

function linkView(graph: CastGraph, l: ChainLink): CastingLink {
  return { film: filmView(graph, l.filmId), person: personView(graph, l.personId) };
}

/** The current actor's unused films, by year, each with its cast in billing order. */
function optionsView(graph: CastGraph, pair: DailyPair, chain: ChainLink[]): CastingOptionFilm[] {
  const current = chain.length ? chain[chain.length - 1]!.personId : pair.startId;
  const usedFilms = new Set(chain.map((l) => l.filmId));
  const usedPeople = new Set([pair.startId, ...chain.map((l) => l.personId)]);
  const out: CastingOptionFilm[] = [];
  for (const fid of graph.filmsByPerson.get(current) ?? []) {
    if (usedFilms.has(fid)) continue;
    const f = graph.films.get(fid)!;
    out.push({
      ...filmView(graph, fid),
      cast: f.cast
        .filter((pid) => pid !== current)
        .map((pid) => ({
          ...personView(graph, pid),
          billing: f.cast[0] === pid ? ('lead' as const) : ('supp' as const),
          used: usedPeople.has(pid),
          onward: (graph.filmsByPerson.get(pid) ?? []).filter((x) => x !== fid && !usedFilms.has(x)).length,
        })),
    });
  }
  return out;
}

export function buildView(graph: CastGraph, pair: DailyPair, round: Round | null): CastingCallState {
  const chain = round?.chain ?? [];
  const status = round?.status ?? 'in_progress';
  const state: CastingCallState = {
    date: pair.date,
    start: personView(graph, pair.startId),
    end: personView(graph, pair.endId),
    status,
    chain: chain.map((l) => linkView(graph, l)),
    maxLinks: CASTING_CALL.maxLinks,
    options: status === 'in_progress' ? optionsView(graph, pair, chain) : null,
  };
  if (status !== 'in_progress') {
    state.result = { optimalFilms: pair.optimal.length, optimalPath: pair.optimal.map((l) => linkView(graph, l)) };
  }
  return state;
}

// ---------------------------------------------------------------------------------------------
// Operations (used by the route handlers and the page shell)
// ---------------------------------------------------------------------------------------------

export interface EngineResult {
  state: CastingCallState;
  /** New state token to set in the cookie, or null when nothing changed worth persisting. */
  token: string | null;
}

function assertToday(pair: DailyPair, date: string): void {
  if (date !== pair.date) throw new ApiFailure('game_over', 'That casting call has wrapped. Reload for today’s pair.');
}

export async function getCastingState(request: Request, identity: Identity, now: Date = new Date()): Promise<EngineResult> {
  const { graph, pair, round } = await loadRound(request, identity, now);
  return { state: buildView(graph, pair, round), token: round ? encodeStateToken(identity.anonId, pair.date, round) : null };
}

const LINK_ERRORS: Record<string, [ApiFailure['code'], string]> = {
  game_over: ['game_over', 'This casting call is already over.'],
  film_not_with_actor: ['bad_request', 'That film is not in the current actor’s filmography.'],
  film_used: ['already_guessed', 'That film is already on the call sheet.'],
  actor_not_in_film: ['bad_request', 'That actor is not in that film’s cast.'],
  actor_used: ['already_guessed', 'That actor is already on the call sheet.'],
};

export async function addLink(
  request: Request,
  identity: Identity,
  body: { date: string; filmId: number; personId: number },
  now: Date = new Date(),
): Promise<EngineResult> {
  const rl = await checkRateLimit(`cc:${identity.anonId}`, RATE_LIMITS.guessPerMinutePerAnon, 60, now.getTime());
  if (!rl.ok) throw new ApiFailure('rate_limited', 'Too many moves. Take a breath and try again.');
  const { graph, pair, round, play } = await loadRound(request, identity, now);
  assertToday(pair, body.date);
  const r: Round = round ?? { chain: [], status: 'in_progress', startedAt: now.toISOString(), firstAt: null, finishedAt: null };
  if (r.status !== 'in_progress') throw new ApiFailure(...LINK_ERRORS.game_over!);
  const link = { filmId: body.filmId, personId: body.personId };
  const err = validateLink(graph, pair, r.chain, link);
  if (err) throw new ApiFailure(...LINK_ERRORS[err]!);
  r.chain = [...r.chain, link];
  r.firstAt ??= now.toISOString();
  if (link.personId === pair.endId) r.status = 'won';
  else if (r.chain.length >= CASTING_CALL.maxLinks) r.status = 'lost';
  if (r.status !== 'in_progress') r.finishedAt = now.toISOString();
  const token = await persist(identity, pair, r, play, now);
  return { state: buildView(graph, pair, r), token };
}

export async function giveUpCasting(
  request: Request,
  identity: Identity,
  body: { date: string },
  now: Date = new Date(),
): Promise<EngineResult> {
  const { graph, pair, round, play } = await loadRound(request, identity, now);
  assertToday(pair, body.date);
  const r: Round = round ?? { chain: [], status: 'in_progress', startedAt: now.toISOString(), firstAt: null, finishedAt: null };
  if (r.status === 'won') throw new ApiFailure(...LINK_ERRORS.game_over!);
  if (r.status === 'in_progress') {
    r.status = 'lost';
    r.finishedAt = now.toISOString();
  }
  const token = await persist(identity, pair, r, play, now);
  return { state: buildView(graph, pair, r), token };
}

/** Tests only: drop cached graphs. */
export function resetCastingCacheForTesting(repo?: Repo): void {
  if (repo) cache.delete(repo);
}
