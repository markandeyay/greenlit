// Route-level tests for /api/modes/release-order: call the handlers with `new Request(...)`.
// Core assertion (Section 10): before the round ends no response body carries a release date,
// release year, film id or sortable field of any film in the set.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANON_COOKIE } from '@/config/game';
import { RELEASE_ORDER } from '@/config/modes';
import { setRepoForTesting } from '@/server/db';
import type { MemoryRepo } from '@/server/db/memory';
import { resetRateLimitsForTesting } from '@/server/ratelimit';
import { GET, POST } from '@/app/api/modes/release-order/route';
import { dailySetIds } from '@/server/modes/release-order/engine';
import { servedOrder, trueOrder } from '@/server/modes/release-order/logic';
import { decodeRoundToken, encodeRoundToken, RELEASE_ORDER_COOKIE } from '@/server/modes/release-order/token';
import type { ReleaseOrderState } from '@/server/modes/release-order/types';
import type { Film } from '@/lib/types';
import { buildRepo, FILMS, NOW, TODAY } from './helpers';

const URL_ = 'http://localhost:3000/api/modes/release-order';

interface Client {
  jar: Map<string, string>;
  bodies: string[];
}
const newClient = (): Client => ({ jar: new Map(), bodies: [] });
const cookieHeader = (c: Client) => [...c.jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

async function call(c: Client, method: 'GET' | 'POST', body?: unknown) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (c.jar.size) headers.cookie = cookieHeader(c);
  const req = new Request(URL_, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const res = await (method === 'GET' ? GET(req) : POST(req));
  const setCookies = res.headers.getSetCookie();
  for (const sc of setCookies) {
    const pair = sc.split(';')[0]!;
    const eq = pair.indexOf('=');
    c.jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
  const text = await res.text();
  c.bodies.push(text);
  return { res, text, json: JSON.parse(text) as ReleaseOrderState & { error?: { code: string } }, setCookies };
}

let repo: MemoryRepo;
let set: Film[]; // served order
let truthKeys: number[]; // card keys, earliest first

async function loadSet() {
  const ids = servedOrder(await dailySetIds(TODAY, repo), TODAY);
  set = ids.map((id) => FILMS.find((f) => f.id === id)!);
  truthKeys = trueOrder(set).map((id) => ids.indexOf(id));
}

/** A wrong order: the truth rotated by one (every slot misses or is one off). */
const wrongOrder = () => [...truthKeys.slice(1), truthKeys[0]!];

function expectNoLeak(texts: string[]) {
  for (const t of texts) {
    expect(t).not.toMatch(/releaseDate|releaseYear|"year"/);
    for (const f of set) {
      expect(t).not.toContain(String(f.releaseYear));
      if (f.releaseDate) expect(t).not.toContain(f.releaseDate);
      expect(t).not.toMatch(new RegExp(`\\b${f.id}\\b`));
    }
  }
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  repo = buildRepo();
  setRepoForTesting(repo);
  resetRateLimitsForTesting();
  await loadSet();
});
afterEach(() => {
  setRepoForTesting(undefined);
  vi.useRealTimers();
});

describe('GET', () => {
  it('serves the daily set without any sortable field, and sets no round cookie yet', async () => {
    const c = newClient();
    const { res, json, setCookies } = await call(c, 'GET');
    expect(res.status).toBe(200);
    expect(json.date).toBe(TODAY);
    expect(json.dateLabel).toBe('Oct 4');
    expect(json.status).toBe('in_progress');
    expect(json.attempts).toEqual([]);
    expect(json.maxAttempts).toBe(RELEASE_ORDER.maxAttempts);
    expect(json.reveal).toBeUndefined();
    expect(json.cards.map((x) => x.title)).toEqual(set.map((f) => f.title));
    expect(json.cards.map((x) => x.key)).toEqual([0, 1, 2, 3, 4]);
    for (const card of json.cards) expect(Object.keys(card).sort()).toEqual(['key', 'posterPath', 'title']);
    expect(setCookies.some((s) => s.startsWith(`${ANON_COOKIE}=`))).toBe(true);
    expect(setCookies.some((s) => s.startsWith(`${RELEASE_ORDER_COOKIE}=`))).toBe(false);
    expectNoLeak(c.bodies);
  });

  it('serves the same set to every player', async () => {
    const a = await call(newClient(), 'GET');
    const b = await call(newClient(), 'GET');
    expect(a.json.cards).toEqual(b.json.cards);
  });
});

describe('attempts', () => {
  it('scores each attempt, stops at maxAttempts, and reveals only at the end', async () => {
    const c = newClient();
    await call(c, 'GET');
    for (let i = 1; i <= RELEASE_ORDER.maxAttempts; i++) {
      const { res, json, setCookies } = await call(c, 'POST', { date: TODAY, order: wrongOrder() });
      expect(res.status).toBe(200);
      expect(json.attempts).toHaveLength(i);
      expect(json.attempts[i - 1]!.feedback).toHaveLength(5);
      expect(json.attempts[i - 1]!.feedback.every((v) => v !== 'match')).toBe(true);
      const cookie = setCookies.find((s) => s.startsWith(`${RELEASE_ORDER_COOKIE}=`))!;
      expect(cookie).toContain('HttpOnly');
      if (i < RELEASE_ORDER.maxAttempts) {
        expect(json.status).toBe('in_progress');
        expect(json.reveal).toBeUndefined();
        expectNoLeak(c.bodies);
      } else {
        expect(json.status).toBe('lost');
        expect(json.reveal!.map((r) => r.key)).toEqual(truthKeys);
        expect(json.reveal!.map((r) => r.releaseYear)).toEqual([...set.map((f) => f.releaseYear)].sort((a, b) => a - b));
      }
    }
    const over = await call(c, 'POST', { date: TODAY, order: truthKeys });
    expect(over.res.status).toBe(409);
    expect(over.json.error!.code).toBe('game_over');
  });

  it('wins when the order is right and saves the play', async () => {
    const c = newClient();
    const first = await call(c, 'POST', { date: TODAY, order: wrongOrder() });
    expect(first.json.status).toBe('in_progress');
    expectNoLeak(c.bodies);
    const win = await call(c, 'POST', { date: TODAY, order: truthKeys });
    expect(win.json.status).toBe('won');
    expect(win.json.attempts[1]!.feedback).toEqual(['match', 'match', 'match', 'match', 'match']);
    expect(win.json.reveal).toHaveLength(5);
    const anon = c.jar.get(ANON_COOKIE)!;
    const play = await repo.getPlay(anon, 'release_order', TODAY);
    expect(play).toMatchObject({ kind: 'release_order', ref: TODAY, status: 'won', takes: 2 });
    expect(play!.guesses).toHaveLength(10);
  });

  it('rejects malformed orders and a stale date', async () => {
    const c = newClient();
    for (const order of [[0, 1, 2, 3], [0, 1, 2, 3, 3], [0, 1, 2, 3, 9], [-1, 0, 1, 2, 3]]) {
      const r = await call(c, 'POST', { date: TODAY, order });
      expect(r.res.status).toBe(400);
    }
    const stale = await call(c, 'POST', { date: '2026-10-03', order: truthKeys });
    expect(stale.res.status).toBe(409);
    const garbage = await call(c, 'POST', { date: 'today', order: truthKeys });
    expect(garbage.res.status).toBe(400);
    const state = await call(c, 'GET');
    expect(state.json.attempts).toEqual([]);
  });
});

describe('state token', () => {
  it('resumes a round on another instance from the token alone', async () => {
    const c = newClient();
    await call(c, 'POST', { date: TODAY, order: wrongOrder() });
    // New instance: empty repo memory, and drop the shared play mirror cookie.
    setRepoForTesting(buildRepo());
    c.jar.delete('gl_plays');
    const resumed = await call(c, 'GET');
    expect(resumed.json.attempts).toHaveLength(1);
    expect(resumed.json.status).toBe('in_progress');
  });

  it('rejects a tampered token', async () => {
    const c = newClient();
    await call(c, 'POST', { date: TODAY, order: wrongOrder() });
    const raw = c.jar.get(RELEASE_ORDER_COOKIE)!;
    const flipped = raw.slice(0, 20) + (raw[20] === 'A' ? 'B' : 'A') + raw.slice(21);
    expect(decodeRoundToken(flipped)).toBeNull();
    expect(decodeRoundToken('not-a-token')).toBeNull();
    setRepoForTesting(buildRepo());
    c.jar.delete('gl_plays');
    c.jar.set(RELEASE_ORDER_COOKIE, flipped);
    const fresh = await call(c, 'GET');
    expect(fresh.json.attempts).toEqual([]);
  });

  it('ignores a valid token issued to another player or for another day', async () => {
    const a = newClient();
    await call(a, 'POST', { date: TODAY, order: wrongOrder() });
    const b = newClient();
    await call(b, 'GET');
    b.jar.set(RELEASE_ORDER_COOKIE, a.jar.get(RELEASE_ORDER_COOKIE)!);
    expect((await call(b, 'GET')).json.attempts).toEqual([]);

    const anon = a.jar.get(ANON_COOKIE)!;
    const ids = set.map((f) => f.id);
    const old = encodeRoundToken({ v: 1, d: '2026-10-03', a: anon, s: ids, t: [[0, 1, 2, 3, 4]] });
    setRepoForTesting(buildRepo());
    a.jar.delete('gl_plays');
    a.jar.set(RELEASE_ORDER_COOKIE, old);
    expect((await call(a, 'GET')).json.attempts).toEqual([]);
  });

  it('cannot roll back attempts by replaying an older token', async () => {
    const c = newClient();
    await call(c, 'POST', { date: TODAY, order: wrongOrder() });
    const older = c.jar.get(RELEASE_ORDER_COOKIE)!;
    await call(c, 'POST', { date: TODAY, order: wrongOrder() });
    c.jar.set(RELEASE_ORDER_COOKIE, older);
    expect((await call(c, 'GET')).json.attempts).toHaveLength(2);
  });
});

describe('one round per player per day', () => {
  it('stays finished after the round cookie is cleared, on this or another instance', async () => {
    const c = newClient();
    for (let i = 0; i < RELEASE_ORDER.maxAttempts; i++) await call(c, 'POST', { date: TODAY, order: wrongOrder() });
    c.jar.delete(RELEASE_ORDER_COOKIE);
    const same = await call(c, 'GET');
    expect(same.json.status).toBe('lost');
    expect((await call(c, 'POST', { date: TODAY, order: truthKeys })).res.status).toBe(409);

    // Another instance: the signed play mirror cookie restores the finished play.
    setRepoForTesting(buildRepo());
    const other = await call(c, 'GET');
    expect(other.json.status).toBe('lost');
    expect((await call(c, 'POST', { date: TODAY, order: truthKeys })).res.status).toBe(409);
  });

  it('keeps an in progress round after the round cookie is cleared', async () => {
    const c = newClient();
    await call(c, 'POST', { date: TODAY, order: wrongOrder() });
    await call(c, 'POST', { date: TODAY, order: wrongOrder() });
    c.jar.delete(RELEASE_ORDER_COOKIE);
    const r = await call(c, 'GET');
    expect(r.json.attempts).toHaveLength(2);
  });
});
