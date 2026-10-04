// Route-level tests for Opening Weekend: call the handlers with `new Request(...)`.
// Core assertions: a pair's grosses never reach the client before that pair is answered; run tokens
// cannot be tampered with or replayed; the 60s window and the one-daily-run rule hold, including
// across "instances" (a fresh repo) through the signed cookies.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OPENING_WEEKEND } from '@/config/modes';
import { setRepoForTesting } from '@/server/db';
import type { MemoryRepo } from '@/server/db/memory';
import { resetRateLimitsForTesting } from '@/server/ratelimit';
import { GET as statusGET } from '@/app/api/modes/opening-weekend/route';
import { POST as startPOST } from '@/app/api/modes/opening-weekend/start/route';
import { POST as answerPOST } from '@/app/api/modes/opening-weekend/answer/route';
import { POST as finishPOST } from '@/app/api/modes/opening-weekend/finish/route';
import { buildPool, buildSequence, higherSide, type OwPair } from '@/server/modes/opening-weekend/sequence';
import { dailySeed, OW_RUN_COOKIE } from '@/server/modes/opening-weekend/token';
import { OW_GRACE_MS, OW_KIND } from '@/server/modes/opening-weekend/engine';
import { OW_RATE_LIMITS } from '@/server/modes/opening-weekend/route';
import type { HintType } from '@/lib/types';
import type { OwAnswerResponse, OwFinishResponse, OwPairView, OwStartResponse, OwStatusResponse } from '@/server/modes/opening-weekend/types';
import { allFilms, buildRepo, grossStrings, NOW, TODAY } from './helpers';

const BASE = 'http://localhost:3000';
const SEQ: OwPair[] = buildSequence(buildPool(allFilms), dailySeed(TODAY), 40);
const grossOf = new Map(allFilms.map((f) => [f.id, f.boxOfficeUsd]));

interface Client {
  jar: Map<string, string>;
}
const newClient = (): Client => ({ jar: new Map() });

async function call<T>(client: Client, handler: (req: Request) => Promise<Response>, path: string, body?: unknown, ip?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (client.jar.size) headers.cookie = [...client.jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  if (ip) headers['x-forwarded-for'] = ip;
  const res = await handler(
    new Request(`${BASE}${path}`, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) }),
  );
  for (const sc of res.headers.getSetCookie()) {
    const pair = sc.split(';')[0]!;
    const eq = pair.indexOf('=');
    client.jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
  const text = await res.text();
  return { res, text, json: JSON.parse(text) as T };
}

const start = (c: Client, mode: 'daily' | 'practice' = 'daily') => call<OwStartResponse>(c, startPOST, '/api/modes/opening-weekend/start', { mode });
const answer = (c: Client, token: string, pick: 'left' | 'right') =>
  call<OwAnswerResponse>(c, answerPOST, '/api/modes/opening-weekend/answer', { token, pick });
const finish = (c: Client, token: string) => call<OwFinishResponse>(c, finishPOST, '/api/modes/opening-weekend/finish', { token });
const status = (c: Client) => call<OwStatusResponse>(c, statusGET, '/api/modes/opening-weekend');

function started(r: OwStartResponse) {
  if (r.status === 'done') throw new Error('expected a started run');
  return r;
}

/** Assert a response text names no gross of the given (unresolved) films, and no gross field at all. */
function expectNoGrossFor(text: string, pair: OwPairView) {
  for (const id of [pair.left.id, pair.right.id]) expect(text).not.toContain(String(grossOf.get(id)));
}

let repo: MemoryRepo;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  repo = buildRepo();
  setRepoForTesting(repo);
  resetRateLimitsForTesting();
});
afterEach(() => {
  setRepoForTesting(undefined);
  vi.useRealTimers();
});

describe('no leaks', () => {
  it('start responses carry cards only: no grosses anywhere', async () => {
    const c = newClient();
    for (const mode of ['daily', 'practice'] as const) {
      const { text, json } = await start(c, mode);
      expect(text).not.toMatch(/gross|boxOffice/i);
      for (const g of grossStrings) expect(text).not.toContain(g);
      const pair = started(json).pair;
      expect(Object.keys(pair.left).sort()).toEqual(['id', 'posterPath', 'title', 'year']);
    }
  });

  it('a correct answer reveals only the resolved pair; the next challenger stays secret', async () => {
    const c = newClient();
    let { token, pair } = started((await start(c)).json);
    for (let i = 0; i < 8; i++) {
      expect(pair.left.id).toBe(SEQ[i]!.left.id);
      expect(pair.right.id).toBe(SEQ[i]!.right.id);
      const { json, text } = await answer(c, token, higherSide(SEQ[i]!));
      if (json.result !== 'correct') throw new Error(`expected correct, got ${json.result}`);
      expect(json.resolved.left.gross).toBe(grossOf.get(pair.left.id));
      expect(json.resolved.right.gross).toBe(grossOf.get(pair.right.id));
      const next = json.next.pair;
      const resolvedIds = new Set([pair.left.id, pair.right.id]);
      const newcomers = [next.left, next.right].filter((f) => !resolvedIds.has(f.id));
      expect(newcomers.length).toBeGreaterThan(0);
      for (const f of newcomers) expect(text).not.toContain(String(grossOf.get(f.id)));
      expect(JSON.stringify(json.next)).not.toMatch(/gross/i);
      token = json.next.token;
      pair = next;
    }
  });

  it('a timed-out answer does not resolve the pair', async () => {
    const c = newClient();
    const { token, pair } = started((await start(c)).json);
    vi.setSystemTime(NOW.getTime() + OPENING_WEEKEND.dailyRunSeconds * 1000 + OW_GRACE_MS + 1);
    const { json, text } = await answer(c, token, 'left');
    expect(json).toEqual({ result: 'time', score: 0 });
    expectNoGrossFor(text, pair);
  });

  it('status and finish never mention grosses', async () => {
    const c = newClient();
    const { token, pair } = started((await start(c)).json);
    const s = await status(c);
    expect(s.text).not.toMatch(/gross/i);
    const f = await finish(c, token);
    expectNoGrossFor(f.text + s.text, pair);
  });
});

describe('daily run', () => {
  it('a wrong pick ends the run, shows both grosses, and saves a play', async () => {
    const c = newClient();
    let { token } = started((await start(c)).json);
    for (let i = 0; i < 3; i++) {
      const r = (await answer(c, token, higherSide(SEQ[i]!))).json;
      if (r.result !== 'correct') throw new Error('expected correct');
      token = r.next.token;
    }
    const wrongSide = higherSide(SEQ[3]!) === 'left' ? 'right' : 'left';
    const { json } = await answer(c, token, wrongSide);
    if (json.result !== 'wrong') throw new Error('expected wrong');
    expect(json.score).toBe(3);
    expect(json.resolved.picked).toBe(wrongSide);
    expect(json.resolved.higher).toBe(higherSide(SEQ[3]!));
    const plays = await repo.listPlays({ kind: OW_KIND, ref: TODAY });
    expect(plays).toHaveLength(1);
    expect(plays[0]).toMatchObject({ status: 'lost', takes: 3 });
    expect(plays[0]!.guesses).toHaveLength(3);
  });

  it('enforces the 60 second window from the start instant (with a small grace)', async () => {
    const c = newClient();
    const { token, remainingMs } = started((await start(c)).json);
    expect(remainingMs).toBe(OPENING_WEEKEND.dailyRunSeconds * 1000);
    // Inside the grace: still accepted.
    vi.setSystemTime(NOW.getTime() + OPENING_WEEKEND.dailyRunSeconds * 1000 + OW_GRACE_MS - 100);
    const ok = (await answer(c, token, higherSide(SEQ[0]!))).json;
    if (ok.result !== 'correct') throw new Error('expected correct inside the grace');
    expect(ok.remainingMs).toBe(0);
    // Past it: the run ends on time with the score so far.
    vi.setSystemTime(NOW.getTime() + OPENING_WEEKEND.dailyRunSeconds * 1000 + OW_GRACE_MS + 1);
    const late = (await answer(c, ok.next.token, higherSide(SEQ[1]!))).json;
    expect(late).toEqual({ result: 'time', score: 1 });
    const [play] = await repo.listPlays({ kind: OW_KIND, ref: TODAY });
    expect(play).toMatchObject({ status: 'won', takes: 1 });
  });

  it('allows one daily run per player: resume while live, done afterwards', async () => {
    const c = newClient();
    const first = started((await start(c)).json);
    const r = (await answer(c, first.token, higherSide(SEQ[0]!))).json;
    if (r.result !== 'correct') throw new Error('expected correct');
    vi.setSystemTime(NOW.getTime() + 10_000);
    const again = started((await start(c)).json);
    expect(again.status).toBe('resumed');
    expect(again.pair.step).toBe(1);
    expect(again.remainingMs).toBe(50_000);
    await finish(c, again.token);
    const third = (await start(c)).json;
    expect(third).toMatchObject({ status: 'done', score: 1, outcome: 'time' });
    // An abandoned run past its window also counts as done.
    const d = newClient();
    started((await start(d)).json);
    vi.setSystemTime(NOW.getTime() + 120_000);
    expect((await start(d)).json).toMatchObject({ status: 'done', score: 0 });
  });

  it('keyless: a fresh instance still sees the finished run via the signed run cookie', async () => {
    const c = newClient();
    const { token } = started((await start(c)).json);
    await answer(c, token, higherSide(SEQ[0]!) === 'left' ? 'right' : 'left');
    // New instance: empty memory, and only the anon + run cookies survive (no gl_plays mirror).
    setRepoForTesting(buildRepo());
    c.jar.delete('gl_plays');
    expect(c.jar.has(OW_RUN_COOKIE)).toBe(true);
    expect((await start(c)).json).toMatchObject({ status: 'done', score: 0, outcome: 'wrong' });
  });

  it('a forged run cookie is ignored', async () => {
    const c = newClient();
    started((await start(c)).json);
    c.jar.set(OW_RUN_COOKIE, 'eyJmYWtlIjp0cnVlfQ.AAAAAAAAAAAAAAAAAAAAAAAA');
    setRepoForTesting(buildRepo());
    c.jar.delete('gl_plays');
    // With no trustworthy record the server starts fresh rather than trusting the forgery.
    expect(started((await start(c)).json).status).toBe('started');
  });
});

describe('token integrity', () => {
  it('rejects a tampered token', async () => {
    const c = newClient();
    const { token } = started((await start(c)).json);
    const flipped = token.slice(0, 20) + (token[20] === 'A' ? 'B' : 'A') + token.slice(21);
    const res = await answer(c, flipped, 'left');
    expect(res.res.status).toBe(400);
    expect((await answer(c, 'not-a-token', 'left')).res.status).toBe(400);
  });

  it("rejects another player's token", async () => {
    const a = newClient();
    const b = newClient();
    const { token } = started((await start(a)).json);
    await status(b); // mint b's anon id
    const res = await answer(b, token, 'left');
    expect(res.res.status).toBe(403);
  });

  it('rejects a replayed token for an earlier step', async () => {
    const c = newClient();
    const { token: t0 } = started((await start(c)).json);
    const r1 = (await answer(c, t0, higherSide(SEQ[0]!))).json;
    if (r1.result !== 'correct') throw new Error('expected correct');
    const replay = await answer(c, t0, higherSide(SEQ[0]!));
    expect(replay.res.status).toBe(409);
    expect(replay.text).not.toMatch(/gross/i);
    // The current token still works.
    expect((await answer(c, r1.next.token, higherSide(SEQ[1]!))).json.result).toBe('correct');
  });

  it('rejects replay after the run is over (cannot retry a wrong pick)', async () => {
    const c = newClient();
    const { token } = started((await start(c)).json);
    const wrong = higherSide(SEQ[0]!) === 'left' ? 'right' : 'left';
    expect((await answer(c, token, wrong)).json.result).toBe('wrong');
    const retry = await answer(c, token, higherSide(SEQ[0]!));
    expect(retry.res.status).toBe(409);
  });

  it('rejects replay on a fresh instance too (signed run cookie holds the step)', async () => {
    const c = newClient();
    const { token: t0 } = started((await start(c)).json);
    const r1 = (await answer(c, t0, higherSide(SEQ[0]!))).json;
    if (r1.result !== 'correct') throw new Error('expected correct');
    setRepoForTesting(buildRepo());
    c.jar.delete('gl_plays');
    expect((await answer(c, t0, higherSide(SEQ[0]!))).res.status).toBe(409);
    expect((await answer(c, r1.next.token, higherSide(SEQ[1]!))).json.result).toBe('correct');
  });
});

describe('practice', () => {
  it('plays without a clock and saves nothing', async () => {
    const c = newClient();
    const s = started((await start(c, 'practice')).json);
    expect(s.remainingMs).toBeNull();
    vi.setSystemTime(NOW.getTime() + 10 * 60_000);
    const r = (await answer(c, s.token, 'left')).json;
    expect(['correct', 'wrong']).toContain(r.result);
    expect(await repo.listPlays({ kind: OW_KIND })).toHaveLength(0);
  });
});

describe('board', () => {
  it('lists named finished runs by score and counts the rest as anonymous', async () => {
    const base = { kind: OW_KIND, ref: TODAY, firstGuessAt: null, hintsUsed: [] as HintType[] } as const;
    const startedAt = new Date(NOW.getTime() - 5 * 60_000).toISOString();
    const finishedAt = new Date(NOW.getTime() - 4 * 60_000).toISOString();
    await repo.upsertProfile({ id: 'p1', handle: 'reelqueen', region: null, flagged: false, flagReason: null, createdAt: startedAt });
    await repo.upsertProfile({ id: 'p2', handle: 'cheater', region: null, flagged: true, flagReason: 'x', createdAt: startedAt });
    await repo.upsertProfile({ id: 'p3', handle: 'boxofficebob', region: null, flagged: false, flagReason: null, createdAt: startedAt });
    const play = (id: string, profileId: string | null, takes: number, status: 'won' | 'lost' | 'in_progress' = 'lost') =>
      repo.savePlay({ ...base, id, anonId: crypto.randomUUID(), profileId, takes, status, guesses: [], startedAt, finishedAt: status === 'in_progress' ? null : finishedAt });
    await play('a', 'p1', 7);
    await play('b', 'p2', 30);
    await play('c', 'p3', 12, 'won');
    await play('d', null, 40);
    // Live run (started just now) is not on the board yet.
    await repo.savePlay({ ...base, id: 'e', anonId: crypto.randomUUID(), profileId: null, takes: 2, status: 'in_progress', guesses: [], startedAt: NOW.toISOString(), finishedAt: null });
    const { json } = await status(newClient());
    expect(json.board.rows).toEqual([
      { rank: 1, handle: 'boxofficebob', score: 12 },
      { rank: 2, handle: 'reelqueen', score: 7 },
    ]);
    expect(json.board.anonymousCount).toBe(2);
    expect(json.board.totalRuns).toBe(4);
    expect(json.today).toBeNull();
  });

  it("reports this player's run", async () => {
    const c = newClient();
    const { token } = started((await start(c)).json);
    expect((await status(c)).json.today).toEqual({ score: 0, finished: false, outcome: null });
    await answer(c, token, higherSide(SEQ[0]!) === 'left' ? 'right' : 'left');
    expect((await status(c)).json.today).toEqual({ score: 0, finished: true, outcome: 'wrong' });
  });
});

describe('rate limit', () => {
  it('limits answers per anon id', async () => {
    const c = newClient();
    await status(c);
    let last = 0;
    for (let i = 0; i <= OW_RATE_LIMITS.perAnon; i++) last = (await finish(c, 'junk')).res.status;
    expect(last).toBe(429);
  });
});
