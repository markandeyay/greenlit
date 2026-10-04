// Route-level tests: call the handlers directly with `new Request(...)`.
// Core assertion (Section 10, WS2 acceptance): before the round ends, no response body from any
// game route contains the answer's title or film id; the reveal appears only once finished.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setRepoForTesting } from '@/server/db';
import { resetRateLimitsForTesting } from '@/server/ratelimit';
import { RATE_LIMITS } from '@/config/game';
import { RULES } from '@/config/rules';
import { ANON_COOKIE } from '@/config/game';
import { POST as guessPOST } from '@/app/api/guess/route';
import { POST as giveupPOST } from '@/app/api/giveup/route';
import { POST as hintPOST } from '@/app/api/hint/route';
import { GET as hintOptionsGET } from '@/app/api/hint/options/route';
import { GET as playGET } from '@/app/api/play/route';
import { GET as todayGET } from '@/app/api/today/route';
import { GET as searchGET } from '@/app/api/search/route';
import { GET as statsGET } from '@/app/api/stats/daily/[number]/route';
import type { GuessResponse, PlayStateResponse } from '@/lib/types';
import { ANSWER_ID, ANSWER_TITLE, buildRepo, fillers, nearFilm, NOW, PITCH_SLUG, todayNumber } from './helpers';

const BASE = 'http://localhost:3000';
const T = todayNumber(NOW);
const today = String(T);
const ANSWER_ID_RE = new RegExp(`\\b${ANSWER_ID}\\b`);

interface Client {
  cookie: string | null;
  bodies: string[];
}

function newClient(): Client {
  return { cookie: null, bodies: [] };
}

async function call(client: Client, handler: (req: Request) => Promise<Response>, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const h: Record<string, string> = { 'content-type': 'application/json', ...headers };
  if (client.cookie) h.cookie = client.cookie;
  const req = new Request(`${BASE}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const res = await handler(req);
  // Merge every Set-Cookie into the jar (the anon cookie and, in keyless mode, the play cookie).
  const jar = new Map((client.cookie ?? '').split('; ').filter(Boolean).map((c) => [c.split('=')[0]!, c] as const));
  for (const sc of res.headers.getSetCookie()) {
    const pair = sc.split(';')[0]!;
    jar.set(pair.split('=')[0]!, pair);
  }
  client.cookie = jar.size ? [...jar.values()].join('; ') : null;
  const text = await res.text();
  client.bodies.push(text);
  return { res, text, json: JSON.parse(text) as unknown };
}

function expectNoLeak(texts: string[]) {
  for (const t of texts) {
    expect(t).not.toContain(ANSWER_TITLE);
    expect(t).not.toMatch(ANSWER_ID_RE);
  }
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  setRepoForTesting(await buildRepo(NOW));
  resetRateLimitsForTesting();
});
afterEach(() => {
  setRepoForTesting(undefined);
  vi.useRealTimers();
});

describe('anon cookie', () => {
  it('is issued httpOnly, SameSite=Lax on first contact and reused afterwards', async () => {
    const c = newClient();
    const first = await call(c, guessPOST, '/api/guess', { kind: 'daily', ref: today, filmId: nearFilm.id });
    const sc = first.res.headers.get('set-cookie')!;
    expect(sc).toMatch(new RegExp(`^${ANON_COOKIE}=[0-9a-f-]{36};`));
    expect(sc).toContain('HttpOnly');
    expect(sc).toContain('SameSite=Lax');
    const second = await call(c, guessPOST, '/api/guess', { kind: 'daily', ref: today, filmId: fillers[0]!.id });
    // The anon cookie is not re-issued (keyless mode may still refresh the signed play cookie).
    expect(second.res.headers.getSetCookie().some((s) => s.startsWith(`${ANON_COOKIE}=`))).toBe(false);
    expect((second.json as GuessResponse).take).toBe(2);
    expect(first.res.headers.get('cache-control')).toContain('no-store');
  });
});

describe('leak test: full daily round', () => {
  it('no response contains the answer before the final take; the reveal arrives only on finish', async () => {
    const c = newClient();
    await call(c, todayGET, '/api/today');
    await call(c, playGET, `/api/play?kind=daily&ref=${today}`);
    await call(c, hintOptionsGET, `/api/hint/options?kind=daily&ref=${today}`);
    await call(c, searchGET, '/api/search?q=near');
    c.bodies.push(await (await statsGET(new Request(BASE + '/api/stats/daily/' + today), { params: Promise.resolve({ number: today }) })).text());

    // Error paths too.
    await call(c, guessPOST, '/api/guess', { kind: 'daily', ref: today, filmId: 2003 }); // unplayable
    await call(c, guessPOST, '/api/guess', { kind: 'daily', ref: String(T - 1), filmId: nearFilm.id }); // not today
    await call(c, guessPOST, '/api/guess', { kind: 'daily', ref: today }); // bad body
    await call(c, hintPOST, '/api/hint', { kind: 'daily', ref: today, slot: 1, hintType: 'tagline' }); // locked

    const first = await call(c, guessPOST, '/api/guess', { kind: 'daily', ref: today, filmId: nearFilm.id });
    expect((first.json as GuessResponse).reveal).toBeUndefined();
    await call(c, guessPOST, '/api/guess', { kind: 'daily', ref: today, filmId: nearFilm.id }); // duplicate

    for (let i = 0; i < RULES.maxGuesses - 2; i++) {
      const r = await call(c, guessPOST, '/api/guess', { kind: 'daily', ref: today, filmId: fillers[i]!.id });
      expect((r.json as GuessResponse).status).toBe('in_progress');
      expect((r.json as GuessResponse).reveal).toBeUndefined();
      await call(c, playGET, `/api/play?kind=daily&ref=${today}`);
      await call(c, hintOptionsGET, `/api/hint/options?kind=daily&ref=${today}`);
    }
    // A non-tagline hint (the tagline hint is the answer's tagline, which is intended content).
    const hint = await call(c, hintPOST, '/api/hint', { kind: 'daily', ref: today, slot: 1, hintType: 'plot_keywords' });
    expect(hint.res.status).toBe(200);

    expectNoLeak(c.bodies);

    // Final take wins: reveal appears now and in play state afterwards.
    const win = await call(c, guessPOST, '/api/guess', { kind: 'daily', ref: today, filmId: ANSWER_ID });
    const w = win.json as GuessResponse;
    expect(w.status).toBe('won');
    expect(w.reveal?.title).toBe(ANSWER_TITLE);
    const state = (await call(c, playGET, `/api/play?kind=daily&ref=${today}`)).json as PlayStateResponse;
    expect(state.reveal?.filmId).toBe(ANSWER_ID);
    expect(state.take).toBe(RULES.maxGuesses);
  });

  it('error statuses map to ApiError codes', async () => {
    const c = newClient();
    const bad = await call(c, guessPOST, '/api/guess', { kind: 'nope', ref: today, filmId: 1 });
    expect(bad.res.status).toBe(400);
    expect(bad.json).toEqual({ error: { code: 'bad_request', message: expect.any(String) } });
    const notToday = await call(c, guessPOST, '/api/guess', { kind: 'daily', ref: String(T + 1), filmId: nearFilm.id });
    expect(notToday.res.status).toBe(404);
    await call(c, guessPOST, '/api/guess', { kind: 'daily', ref: today, filmId: nearFilm.id });
    const dup = await call(c, guessPOST, '/api/guess', { kind: 'daily', ref: today, filmId: nearFilm.id });
    expect(dup.res.status).toBe(409);
    expect((dup.json as { error: { code: string } }).error.code).toBe('already_guessed');
    const locked = await call(c, hintPOST, '/api/hint', { kind: 'daily', ref: today, slot: 1, hintType: 'tagline' });
    expect(locked.res.status).toBe(403);
    expect((locked.json as { error: { code: string } }).error.code).toBe('hint_locked');
    for (const t of c.bodies) expect(t).not.toContain(String.fromCharCode(0x2014));
    expectNoLeak(c.bodies);
  });
});

describe('give up and pitch rounds', () => {
  it('give up returns the reveal; nothing leaked before it', async () => {
    const c = newClient();
    await call(c, guessPOST, '/api/guess', { kind: 'pitch', ref: PITCH_SLUG, filmId: nearFilm.id });
    await call(c, playGET, `/api/play?kind=pitch&ref=${PITCH_SLUG}`);
    expectNoLeak(c.bodies);
    const r = await call(c, giveupPOST, '/api/giveup', { kind: 'pitch', ref: PITCH_SLUG });
    expect(r.json).toMatchObject({ status: 'lost', reveal: { filmId: ANSWER_ID, title: ANSWER_TITLE } });
    const after = await call(c, guessPOST, '/api/guess', { kind: 'pitch', ref: PITCH_SLUG, filmId: fillers[0]!.id });
    expect(after.res.status).toBe(409);
  });
});

describe('rate limiting', () => {
  it(`returns 429 after RATE_LIMITS.guessPerMinutePerAnon (${RATE_LIMITS.guessPerMinutePerAnon}) guesses per minute`, async () => {
    const c = newClient();
    for (let i = 0; i < RATE_LIMITS.guessPerMinutePerAnon; i++) {
      const r = await call(c, guessPOST, '/api/guess', { kind: 'daily', ref: today, filmId: -1 });
      expect(r.res.status).toBe(400);
    }
    const limited = await call(c, guessPOST, '/api/guess', { kind: 'daily', ref: today, filmId: nearFilm.id });
    expect(limited.res.status).toBe(429);
    expect((limited.json as { error: { code: string } }).error.code).toBe('rate_limited');
  });
  it('limits per IP across anon ids', async () => {
    const headers = { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' };
    for (let i = 0; i < RATE_LIMITS.guessPerMinutePerIp; i++) {
      await call(newClient(), guessPOST, '/api/guess', { kind: 'daily', ref: today, filmId: -1 }, headers);
    }
    const limited = await call(newClient(), guessPOST, '/api/guess', { kind: 'daily', ref: today, filmId: nearFilm.id }, headers);
    expect(limited.res.status).toBe(429);
  });
});

describe('public routes', () => {
  it('today returns number, date, theme, nextResetAt only', async () => {
    const r = await call(newClient(), todayGET, '/api/today');
    expect(Object.keys(r.json as object).sort()).toEqual(['date', 'nextResetAt', 'number', 'theme']);
    expect((r.json as { number: number }).number).toBe(T);
  });
  it('search requires the minimum query length and caps results', async () => {
    const short = await call(newClient(), searchGET, '/api/search?q=n');
    expect(short.json).toEqual({ results: [] });
    const r = await call(newClient(), searchGET, '/api/search?q=filler');
    const results = (r.json as { results: unknown[] }).results;
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(10);
    expect(r.res.headers.get('cache-control')).toContain('s-maxage');
  });
  it('stats only for released puzzles, with an s-maxage cache header', async () => {
    const ctx = (n: string) => ({ params: Promise.resolve({ number: n }) });
    const ok = await statsGET(new Request(`${BASE}/api/stats/daily/${T}`), ctx(today));
    expect(ok.status).toBe(200);
    expect(ok.headers.get('cache-control')).toContain('s-maxage=60');
    expect((await ok.json()).distribution).toHaveLength(11);
    const future = await statsGET(new Request(`${BASE}/api/stats/daily/${T + 1}`), ctx(String(T + 1)));
    expect(future.status).toBe(404);
  });
});

describe('region', () => {
  it('uses the region cookie, then Accept-Language, and falls back to US with a tag', async () => {
    const c = newClient();
    await call(c, guessPOST, '/api/guess', { kind: 'daily', ref: today, filmId: nearFilm.id });
    const anon = c.cookie!;
    const gb = (await call({ cookie: `${anon}; gl_region=GB`, bodies: [] }, playGET, `/api/play?kind=daily&ref=${today}`)).json as PlayStateResponse;
    expect(gb.feedback[0]!.rating.region).toBe('GB');
    const au = (await call({ cookie: anon, bodies: [] }, playGET, `/api/play?kind=daily&ref=${today}`, undefined, { 'accept-language': 'en-AU,en;q=0.8' })).json as PlayStateResponse;
    expect(au.feedback[0]!.rating).toEqual({ value: 'R', verdict: 'match', region: 'US' });
  });
});
