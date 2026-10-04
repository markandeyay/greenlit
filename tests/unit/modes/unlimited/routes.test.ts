// Route-level leak test for the Dailies Reel (Section 10, 9.1 item 19): from dealing a reel to the
// last take, no response body contains the answer's title or film id. Only the finishing
// response carries the reveal.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setRepoForTesting } from '@/server/db';
import { resetRateLimitsForTesting } from '@/server/ratelimit';
import { clearUnlimitedHintCacheForTesting, decodeUnlimitedRef } from '@/server/modes/unlimited';
import { RATE_LIMITS } from '@/config/game';
import { RULES } from '@/config/rules';
import { POST as newPOST } from '@/app/api/modes/unlimited/new/route';
import { POST as guessPOST } from '@/app/api/guess/route';
import { POST as giveupPOST } from '@/app/api/giveup/route';
import { POST as hintPOST } from '@/app/api/hint/route';
import { GET as hintOptionsGET } from '@/app/api/hint/options/route';
import { GET as playGET } from '@/app/api/play/route';
import type { GuessResponse, HintOptionsResponse } from '@/lib/types';
import { fillers, nearFilm, NOW } from '../../engine/helpers';
import { ANSWER_ID, ANSWER_ID_RE, ANSWER_TITLE, soloRepo } from './helpers';

const BASE = 'http://localhost:3000';

interface Client {
  cookie: string | null;
  bodies: string[];
}

async function call(client: Client, handler: (req: Request) => Promise<Response>, path: string, body?: unknown) {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  if (client.cookie) h.cookie = client.cookie;
  const res = await handler(
    new Request(`${BASE}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: h,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
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

const q = (ref: string) => `kind=unlimited&ref=${encodeURIComponent(ref)}`;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  setRepoForTesting(soloRepo());
  resetRateLimitsForTesting();
  clearUnlimitedHintCacheForTesting();
});
afterEach(() => {
  setRepoForTesting(undefined);
  vi.useRealTimers();
});

describe('POST /api/modes/unlimited/new', () => {
  it('returns only an opaque ref (and the band), never the film', async () => {
    const c: Client = { cookie: null, bodies: [] };
    const { res, json } = await call(c, newPOST, '/api/modes/unlimited/new', { band: 'deep_cut' });
    expect(res.status).toBe(200);
    expect(Object.keys(json as object).sort()).toEqual(['band', 'ref']);
    expect((json as { band: string }).band).toBe('deep_cut');
    expect(decodeUnlimitedRef((json as { ref: string }).ref)?.filmId).toBe(ANSWER_ID);
    expectNoLeak(c.bodies);
  });

  it('defaults the band and rejects unknown bands', async () => {
    const c: Client = { cookie: null, bodies: [] };
    expect((await call(c, newPOST, '/api/modes/unlimited/new', {})).res.status).toBe(200);
    const bad = await call(c, newPOST, '/api/modes/unlimited/new', { band: 'blockbuster' });
    expect(bad.res.status).toBe(400);
    expect((bad.json as { error: { code: string } }).error.code).toBe('bad_request');
  });

  it('is rate limited per anon id', async () => {
    const c: Client = { cookie: null, bodies: [] };
    for (let i = 0; i < RATE_LIMITS.guessPerMinutePerAnon; i++) {
      expect((await call(c, newPOST, '/api/modes/unlimited/new', { band: 'popular' })).res.status).toBe(200);
    }
    const limited = await call(c, newPOST, '/api/modes/unlimited/new', { band: 'popular' });
    expect(limited.res.status).toBe(429);
  });
});

describe('leak test: a full Dailies Reel round', () => {
  it('no body names the answer until the round ends in a loss', async () => {
    const c: Client = { cookie: null, bodies: [] };
    const dealt = await call(c, newPOST, '/api/modes/unlimited/new', { band: 'popular' });
    const ref = (dealt.json as { ref: string }).ref;

    await call(c, playGET, `/api/play?${q(ref)}`);
    await call(c, hintOptionsGET, `/api/hint/options?${q(ref)}`);
    const guesses = [nearFilm, ...fillers].slice(0, RULES.maxGuesses);
    for (let i = 0; i < guesses.length - 1; i++) {
      const r = await call(c, guessPOST, '/api/guess', { kind: 'unlimited', ref, filmId: guesses[i]!.id });
      expect(r.res.status).toBe(200);
      if (i + 1 === RULES.hintUnlockAfter[0]) {
        const opts = (await call(c, hintOptionsGET, `/api/hint/options?${q(ref)}`)).json as HintOptionsResponse;
        expect(opts.slot1.length).toBeGreaterThan(0);
        const h = await call(c, hintPOST, '/api/hint', { kind: 'unlimited', ref, slot: 1, hintType: opts.slot1[0] });
        expect(h.res.status).toBe(200);
      }
    }
    // Error paths say nothing either.
    await call(c, guessPOST, '/api/guess', { kind: 'unlimited', ref, filmId: guesses[0]!.id }); // duplicate
    await call(c, playGET, `/api/play?${q(ref.slice(0, -4) + 'AAAA')}`); // tampered
    await call(c, guessPOST, '/api/guess', { kind: 'unlimited', ref: 'not-a-reel', filmId: nearFilm.id });
    await call(c, playGET, `/api/play?${q(ref)}`);
    expectNoLeak(c.bodies);

    const last = await call(c, guessPOST, '/api/guess', { kind: 'unlimited', ref, filmId: guesses[guesses.length - 1]!.id });
    const res = last.json as GuessResponse;
    expect(res.status).toBe('lost');
    expect(res.reveal).toMatchObject({ filmId: ANSWER_ID, title: ANSWER_TITLE });
  });

  it('give up reveals; the reveal never appears in an earlier body', async () => {
    const c: Client = { cookie: null, bodies: [] };
    const ref = ((await call(c, newPOST, '/api/modes/unlimited/new', { band: 'cinephile' })).json as { ref: string }).ref;
    await call(c, guessPOST, '/api/guess', { kind: 'unlimited', ref, filmId: nearFilm.id });
    await call(c, playGET, `/api/play?${q(ref)}`);
    expectNoLeak(c.bodies);
    const gave = await call(c, giveupPOST, '/api/giveup', { kind: 'unlimited', ref });
    expect(gave.res.status).toBe(200);
    expect(gave.text).toContain(ANSWER_TITLE);
  });
});
