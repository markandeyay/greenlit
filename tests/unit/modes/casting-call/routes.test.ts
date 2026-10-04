// Casting Call routes (WS9): win flow, give up, validation, state token tamper rejection,
// one round per player with resume across instances, and the leak test (no response carries the
// optimal path before the round is finished).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFixtureRepo, setRepoForTesting } from '@/server/db';
import { resetRateLimitsForTesting } from '@/server/ratelimit';
import { CASTING_CALL } from '@/config/modes';
import { GET as stateGET } from '@/app/api/modes/casting-call/route';
import { POST as linkPOST } from '@/app/api/modes/casting-call/link/route';
import { POST as giveupPOST } from '@/app/api/modes/casting-call/giveup/route';
import { STATE_COOKIE, decodeStateToken, encodeStateToken, todaysCall } from '@/server/modes/casting-call/engine';
import { validateLink, type CastGraph, type ChainLink, type DailyPair } from '@/server/modes/casting-call/graph';
import type { CastingCallState } from '@/server/modes/casting-call/types';
import type { MemoryRepo } from '@/server/db/memory';

const NOW = new Date('2026-10-04T16:00:00Z');
const DATE = '2026-10-04';
const BASE = 'http://localhost:3000';

interface Client {
  jar: Map<string, string>;
  bodies: string[];
}
const newClient = (): Client => ({ jar: new Map(), bodies: [] });

function cookieHeader(c: Client): string {
  return [...c.jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

async function call(c: Client, handler: (r: Request) => Promise<Response>, path: string, body?: unknown) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (c.jar.size) headers.cookie = cookieHeader(c);
  const res = await handler(
    new Request(`${BASE}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
  for (const sc of res.headers.getSetCookie()) {
    const pair = sc.split(';')[0]!;
    const eq = pair.indexOf('=');
    c.jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
  const text = await res.text();
  c.bodies.push(text);
  return { res, text, json: JSON.parse(text) as CastingCallState & { error?: { code: string } } };
}

const getState = (c: Client) => call(c, stateGET, '/api/modes/casting-call');
const link = (c: Client, l: ChainLink, date = DATE) => call(c, linkPOST, '/api/modes/casting-call/link', { date, ...l });
const giveUp = (c: Client) => call(c, giveupPOST, '/api/modes/casting-call/giveup', { date: DATE });

let repo: MemoryRepo;
let graph: CastGraph;
let pair: DailyPair;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  repo = createFixtureRepo(undefined, NOW);
  setRepoForTesting(repo);
  resetRateLimitsForTesting();
  ({ graph, pair } = await todaysCall(NOW));
});
afterEach(() => {
  setRepoForTesting(undefined);
  vi.useRealTimers();
});

/** A wrong but legal first link: a film of the start actor and a castmate who is not the end. */
function detourLink(): ChainLink {
  for (const fid of graph.filmsByPerson.get(pair.startId)!) {
    for (const pid of graph.films.get(fid)!.cast) {
      if (pid !== pair.startId && pid !== pair.endId && (graph.filmsByPerson.get(pid)?.length ?? 0) > 1) return { filmId: fid, personId: pid };
    }
  }
  throw new Error('no detour available');
}

describe('GET state', () => {
  it('returns today’s pair and the start actor’s filmography, no result', async () => {
    const c = newClient();
    const { res, json } = await getState(c);
    expect(res.status).toBe(200);
    expect(json.date).toBe(DATE);
    expect(json.start.id).toBe(pair.startId);
    expect(json.end.id).toBe(pair.endId);
    expect(json.status).toBe('in_progress');
    expect(json.maxLinks).toBe(CASTING_CALL.maxLinks);
    expect(json.result).toBeUndefined();
    expect(json.options!.map((f) => f.id).sort()).toEqual([...graph.filmsByPerson.get(pair.startId)!].sort());
    for (const f of json.options!) expect(f.cast.some((p) => p.id === pair.startId)).toBe(false);
  });
});

describe('playing a round', () => {
  it('wins by following an optimal chain and reveals the optimum only at the end', async () => {
    const c = newClient();
    let last;
    for (const [i, l] of pair.optimal.entries()) {
      last = await link(c, l);
      expect(last.res.status).toBe(200);
      if (i < pair.optimal.length - 1) expect(last.json.result).toBeUndefined();
    }
    expect(last!.json.status).toBe('won');
    expect(last!.json.chain).toHaveLength(pair.optimal.length);
    expect(last!.json.options).toBeNull();
    expect(last!.json.result!.optimalFilms).toBe(pair.optimal.length);
    expect(last!.json.result!.optimalPath.map((l) => l.person.id).at(-1)).toBe(pair.endId);

    const play = await repo.getPlay([...c.jar.entries()].find(([k]) => k === 'gl_anon')![1], 'casting_call', DATE);
    expect(play!.status).toBe('won');
    expect(play!.takes).toBe(pair.optimal.length);
    expect(play!.guesses).toEqual(pair.optimal.flatMap((l) => [l.filmId, l.personId]));
  });

  it('rejects moves that are not in the cast graph', async () => {
    const c = newClient();
    const notWithStart = [...graph.films.values()].find((f) => !f.cast.includes(pair.startId))!;
    const r1 = await link(c, { filmId: notWithStart.id, personId: notWithStart.cast[0]! });
    expect(r1.res.status).toBe(400);
    const startFilm = graph.films.get(graph.filmsByPerson.get(pair.startId)![0]!)!;
    const outsider = [...graph.people.keys()].find((p) => !startFilm.cast.includes(p))!;
    const r2 = await link(c, { filmId: startFilm.id, personId: outsider });
    expect(r2.res.status).toBe(400);
    const r3 = await link(c, { filmId: startFilm.id, personId: pair.startId });
    expect(r3.res.status).toBe(409);
    const r4 = await call(c, linkPOST, '/api/modes/casting-call/link', { date: DATE, filmId: 'x', personId: 1 });
    expect(r4.res.status).toBe(400);
    const r5 = await link(c, pair.optimal[0]!, '2026-10-03');
    expect(r5.res.status).toBe(409);
    expect((await getState(c)).json.chain).toHaveLength(0);
  });

  it('loses at maxLinks without reaching the end actor', async () => {
    // DFS for a legal chain of maxLinks links that never touches the end actor.
    const walk = (chain: ChainLink[]): ChainLink[] | null => {
      if (chain.length === CASTING_CALL.maxLinks) return chain;
      const current = chain.length ? chain.at(-1)!.personId : pair.startId;
      for (const fid of graph.filmsByPerson.get(current)!) {
        for (const pid of graph.films.get(fid)!.cast) {
          if (pid === pair.endId) continue;
          const l = { filmId: fid, personId: pid };
          if (validateLink(graph, pair, chain, l)) continue;
          const found = walk([...chain, l]);
          if (found) return found;
        }
      }
      return null;
    };
    const chain = walk([]);
    expect(chain).not.toBeNull();
    const c = newClient();
    let state: CastingCallState | undefined;
    for (const [i, l] of chain!.entries()) {
      state = (await link(c, l)).json;
      expect(state.status).toBe(i === chain!.length - 1 ? 'lost' : 'in_progress');
    }
    expect(state!.result!.optimalFilms).toBe(pair.optimal.length);
    expect((await link(c, pair.optimal[0]!)).res.status).toBe(409);
  });

  it('give up reveals an optimal chain and ends the round', async () => {
    const c = newClient();
    await link(c, detourLink());
    const r = await giveUp(c);
    expect(r.json.status).toBe('lost');
    expect(r.json.result!.optimalPath.map((l) => [l.film.id, l.person.id])).toEqual(pair.optimal.map((l) => [l.filmId, l.personId]));
    expect((await link(c, pair.optimal[0]!)).res.status).toBe(409);
    expect((await getState(c)).json.status).toBe('lost');
  });
});

describe('state token', () => {
  it('round-trips and is bound to the anon id and date', () => {
    const round = { chain: [pair.optimal[0]!], status: 'in_progress' as const, startedAt: NOW.toISOString(), firstAt: null, finishedAt: null };
    const anon = '00000000-0000-4000-8000-000000000001';
    const t = encodeStateToken(anon, DATE, round);
    expect(decodeStateToken(t, anon, DATE)!.chain).toEqual(round.chain);
    expect(decodeStateToken(t, '00000000-0000-4000-8000-000000000002', DATE)).toBeNull();
    expect(decodeStateToken(t, anon, '2026-10-05')).toBeNull();
    expect(t).not.toContain(String(pair.optimal[0]!.filmId));
  });

  it('rejects a tampered token', async () => {
    const c = newClient();
    await link(c, detourLink());
    const token = decodeURIComponent(c.jar.get(STATE_COOKIE)!);
    const buf = Buffer.from(token, 'base64url');
    buf[buf.length - 1] ^= 0xff;
    expect(decodeStateToken(buf.toString('base64url'), c.jar.get('gl_anon')!, DATE)).toBeNull();
  });

  it('resumes on a fresh instance from the token alone; a tampered token gives nothing', async () => {
    const c = newClient();
    const first = detourLink();
    await link(c, first);
    // Fresh instance: new memory repo, and drop the keyless play cookie so only gl_cc remains.
    setRepoForTesting(createFixtureRepo(undefined, NOW));
    c.jar.delete('gl_plays');
    const resumed = await getState(c);
    expect(resumed.json.chain.map((l) => [l.film.id, l.person.id])).toEqual([[first.filmId, first.personId]]);

    setRepoForTesting(createFixtureRepo(undefined, NOW));
    c.jar.delete('gl_plays');
    const tok = c.jar.get(STATE_COOKIE)!;
    c.jar.set(STATE_COOKIE, (tok[0] === 'A' ? 'B' : 'A') + tok.slice(1));
    const tampered = await getState(c);
    expect(tampered.json.chain).toHaveLength(0);
  });

  it('allows one daily round per player: an old token cannot rewind a finished round', async () => {
    const c = newClient();
    await link(c, detourLink());
    const oldToken = c.jar.get(STATE_COOKIE)!;
    await giveUp(c);
    c.jar.set(STATE_COOKIE, oldToken);
    const s = await getState(c);
    expect(s.json.status).toBe('lost');
    expect((await link(c, pair.optimal[0]!)).res.status).toBe(409);
  });

  it('a token minted for another player is ignored', async () => {
    const a = newClient();
    await link(a, detourLink());
    await giveUp(a);
    const b = newClient();
    await getState(b);
    b.jar.set(STATE_COOKIE, a.jar.get(STATE_COOKIE)!);
    const s = await getState(b);
    expect(s.json.status).toBe('in_progress');
    expect(s.json.chain).toHaveLength(0);
  });
});

describe('leak test', () => {
  it('no response before the finish contains the optimal path', async () => {
    const c = newClient();
    const pre: string[] = [];
    pre.push((await getState(c)).text);
    const d = detourLink();
    pre.push((await link(c, d)).text);
    pre.push((await getState(c)).text);
    // A rejected move too.
    pre.push((await link(c, { filmId: d.filmId, personId: d.personId })).text);

    const optimalFilmIds = pair.optimal.map((l) => l.filmId);
    for (const t of pre) {
      expect(t.toLowerCase()).not.toContain('optimal');
      expect(t).not.toContain('"result"');
      const s = JSON.parse(t) as CastingCallState;
      if (!s.options) continue;
      // Everything exposed is the current actor's own filmography (the game) or the chain.
      const current = s.chain.length ? s.chain.at(-1)!.person.id : pair.startId;
      for (const f of s.options) {
        expect(graph.films.get(f.id)!.cast).toContain(current);
        for (const p of f.cast) expect(graph.films.get(f.id)!.cast).toContain(p.id);
      }
    }
    // From the start actor, the path's later films are never exposed (they do not feature the start).
    const first = JSON.parse(pre[0]!) as CastingCallState;
    const exposed = new Set(first.options!.map((f) => f.id));
    for (const fid of optimalFilmIds.slice(1)) expect(exposed.has(fid)).toBe(false);

    const done = await giveUp(c);
    expect(done.json.result!.optimalFilms).toBe(pair.optimal.length);
  });

  it('options are ordered by year, not by distance', async () => {
    const s = (await getState(newClient())).json;
    const years = s.options!.map((f) => f.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
  });
});
