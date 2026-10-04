// Casting Call cast graph (Section 5, WS9). Pure and deterministic: no I/O, no server secrets,
// so unit tests can import it directly. The engine (./engine.ts) wraps it with caching.
//
// The graph is bipartite: actors <-> films. A film's cast is its capped billed cast (lead plus at
// most RULES.maxSupportingCast supporting), the same cast the Classic engine compares. Directors
// are not cast. A chain from actor A to actor B is a list of links {filmId, personId}; its length
// in films is the score. Shortest paths come from BFS over actors with deterministic tie-breaks
// (films by id, cast in billing order), so every instance computes the same optimal path.
import { CASTING_CALL } from '@/config/modes';
import { RULES } from '@/config/rules';
import { hashString } from '@/lib/format';
import type { Film, Person } from '@/lib/types';

export interface GraphFilm {
  id: number;
  title: string;
  year: number;
  posterPath: string | null;
  popularity: number;
  /** Billing order: lead first, then supporting. Deduped. */
  cast: number[];
}

export interface GraphPerson {
  id: number;
  name: string;
  profilePath: string | null;
}

export interface CastGraph {
  films: Map<number, GraphFilm>;
  people: Map<number, GraphPerson>;
  /** Person id -> film ids they are cast in, ordered by year then id. */
  filmsByPerson: Map<number, number[]>;
}

export interface ChainLink {
  filmId: number;
  personId: number;
}

export interface DailyPair {
  date: string;
  startId: number;
  endId: number;
  /** A shortest chain from start to end. SERVER ONLY until the round is finished. */
  optimal: ChainLink[];
}

/** Lead plus capped supporting cast, deduped, nulls dropped. */
export function filmCast(film: Pick<Film, 'leadPersonId' | 'supportingIds'>): number[] {
  const ids = [film.leadPersonId, ...film.supportingIds.slice(0, RULES.maxSupportingCast)];
  const out: number[] = [];
  for (const id of ids) if (id != null && !out.includes(id)) out.push(id);
  return out;
}

/** Build the actor-film graph from playable films. People without a record are skipped. */
export function buildCastGraph(films: Film[], people: Person[]): CastGraph {
  const personById = new Map(people.map((p) => [p.id, p]));
  const graph: CastGraph = { films: new Map(), people: new Map(), filmsByPerson: new Map() };
  const sorted = films.filter((f) => f.isPlayable).sort((a, b) => a.releaseYear - b.releaseYear || a.id - b.id);
  for (const f of sorted) {
    const cast = filmCast(f).filter((id) => personById.has(id));
    if (cast.length === 0) continue;
    graph.films.set(f.id, {
      id: f.id,
      title: f.title,
      year: f.releaseYear,
      posterPath: f.posterPath,
      popularity: f.popularity ?? 0,
      cast,
    });
    for (const pid of cast) {
      const p = personById.get(pid)!;
      if (!graph.people.has(pid)) graph.people.set(pid, { id: p.id, name: p.name, profilePath: p.profilePath });
      const list = graph.filmsByPerson.get(pid) ?? [];
      list.push(f.id);
      graph.filmsByPerson.set(pid, list);
    }
  }
  return graph;
}

/** True when `personId` is in the capped cast of `filmId`. */
export function isInCast(graph: CastGraph, filmId: number, personId: number): boolean {
  return graph.films.get(filmId)?.cast.includes(personId) ?? false;
}

/** BFS from one actor. Returns distance in films to every reachable actor (start = 0). */
export function distancesFrom(graph: CastGraph, startId: number): Map<number, number> {
  const dist = new Map<number, number>([[startId, 0]]);
  if (!graph.people.has(startId)) return dist;
  let frontier = [startId];
  while (frontier.length) {
    const next: number[] = [];
    for (const a of frontier) {
      const d = dist.get(a)!;
      for (const fid of filmIdsAscending(graph, a)) {
        for (const b of graph.films.get(fid)!.cast) {
          if (dist.has(b)) continue;
          dist.set(b, d + 1);
          next.push(b);
        }
      }
    }
    frontier = next;
  }
  return dist;
}

function filmIdsAscending(graph: CastGraph, personId: number): number[] {
  return [...(graph.filmsByPerson.get(personId) ?? [])].sort((x, y) => x - y);
}

/** A shortest chain from start to end (deterministic), [] when start === end, null if unconnected. */
export function shortestPath(graph: CastGraph, startId: number, endId: number): ChainLink[] | null {
  if (!graph.people.has(startId) || !graph.people.has(endId)) return null;
  if (startId === endId) return [];
  const parent = new Map<number, { prev: number; filmId: number }>();
  const seen = new Set([startId]);
  let frontier = [startId];
  while (frontier.length) {
    const next: number[] = [];
    for (const a of frontier) {
      for (const fid of filmIdsAscending(graph, a)) {
        for (const b of graph.films.get(fid)!.cast) {
          if (seen.has(b)) continue;
          seen.add(b);
          parent.set(b, { prev: a, filmId: fid });
          if (b === endId) return unwind(parent, startId, endId);
          next.push(b);
        }
      }
    }
    frontier = next;
  }
  return null;
}

function unwind(parent: Map<number, { prev: number; filmId: number }>, startId: number, endId: number): ChainLink[] {
  const out: ChainLink[] = [];
  let cur = endId;
  while (cur !== startId) {
    const p = parent.get(cur)!;
    out.unshift({ filmId: p.filmId, personId: cur });
    cur = p.prev;
  }
  return out;
}

/** How many candidate actors the daily pair is drawn from. */
export const CANDIDATE_POOL = 40;

/**
 * Well-known actors: the most credited people in the library (2+ films), ties broken by the
 * summed popularity of their films, then id. Recognition is the point of the daily pair.
 */
export function wellKnownActors(graph: CastGraph, pool: number = CANDIDATE_POOL): number[] {
  const rows: { id: number; credits: number; pop: number }[] = [];
  for (const [id, films] of graph.filmsByPerson) {
    if (films.length < 2) continue;
    const pop = films.reduce((s, fid) => s + (graph.films.get(fid)?.popularity ?? 0), 0);
    rows.push({ id, credits: films.length, pop });
  }
  rows.sort((a, b) => b.credits - a.credits || b.pop - a.pop || a.id - b.id);
  return rows.slice(0, pool).map((r) => r.id);
}

/** Every unordered candidate pair whose shortest path is within CASTING_CALL.targetPathFilms. */
export function eligiblePairs(graph: CastGraph, pool: number = CANDIDATE_POOL): [number, number][] {
  const [min, max] = CASTING_CALL.targetPathFilms;
  const ids = [...wellKnownActors(graph, pool)].sort((a, b) => a - b);
  const pairs: [number, number][] = [];
  for (let i = 0; i < ids.length; i++) {
    const dist = distancesFrom(graph, ids[i]!);
    for (let j = i + 1; j < ids.length; j++) {
      const d = dist.get(ids[j]!);
      if (d !== undefined && d >= min && d <= max) pairs.push([ids[i]!, ids[j]!]);
    }
  }
  return pairs;
}

/**
 * The daily pair for a New York date. Deterministic from the date and the library: a hash of the
 * date picks one eligible pair and its orientation. Returns null if the library has no eligible pair.
 */
export function pickDailyPair(graph: CastGraph, date: string, pairs: [number, number][] = eligiblePairs(graph)): DailyPair | null {
  if (pairs.length === 0) return null;
  const h = hashString(`casting_call:${date}`);
  const [a, b] = pairs[h % pairs.length]!;
  const flip = (hashString(`casting_call:flip:${date}`) & 1) === 1;
  const startId = flip ? b : a;
  const endId = flip ? a : b;
  const optimal = shortestPath(graph, startId, endId);
  if (!optimal) return null;
  return { date, startId, endId, optimal };
}

export type ChainError = 'game_over' | 'film_not_with_actor' | 'film_used' | 'actor_not_in_film' | 'actor_used';

/**
 * Validate one link against the graph and the chain so far. `chain` is the links already made;
 * the current actor is the last link's person, or the start actor.
 */
export function validateLink(
  graph: CastGraph,
  pair: Pick<DailyPair, 'startId' | 'endId'>,
  chain: ChainLink[],
  link: ChainLink,
): ChainError | null {
  if (chain.length >= CASTING_CALL.maxLinks) return 'game_over';
  if (chain.some((l) => l.personId === pair.endId)) return 'game_over';
  const current = chain.length ? chain[chain.length - 1]!.personId : pair.startId;
  if (!isInCast(graph, link.filmId, current)) return 'film_not_with_actor';
  if (chain.some((l) => l.filmId === link.filmId)) return 'film_used';
  if (!isInCast(graph, link.filmId, link.personId)) return 'actor_not_in_film';
  if (link.personId === pair.startId || chain.some((l) => l.personId === link.personId)) return 'actor_used';
  return null;
}

/** Validate a whole stored chain (e.g. one restored from a token). */
export function validateChain(graph: CastGraph, pair: Pick<DailyPair, 'startId' | 'endId'>, chain: ChainLink[]): boolean {
  for (let i = 0; i < chain.length; i++) {
    if (validateLink(graph, pair, chain.slice(0, i), chain[i]!)) return false;
  }
  return true;
}
