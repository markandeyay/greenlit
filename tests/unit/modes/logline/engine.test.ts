// Logline engine + routes (WS9): deterministic daily pick, tier progression, take limit, state
// token tamper rejection, one round per player, and the route-level leak test (Section 10).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFixtureRepo, setRepoForTesting } from '@/server/db';
import type { LibrarySnapshot } from '@/server/db/repo';
import fixture from '@/server/db/fixtures/library.json';
import { resetRateLimitsForTesting } from '@/server/ratelimit';
import { LOGLINE } from '@/config/modes';
import { RATE_LIMITS } from '@/config/game';
import { addDays, dateInResetZone } from '@/lib/dates';
import {
  LOGLINE_STATE_COOKIE,
  dailyTarget,
  decodeState,
  encodeState,
  pickDailyFilmId,
  statusAfter,
  tiersVisible,
} from '@/server/modes/logline';
import { LOGLINES, LOGLINE_FILM_IDS } from '@/server/modes/logline-data';
import { GET as stateGET } from '@/app/api/modes/logline/route';
import { POST as guessPOST } from '@/app/api/modes/logline/guess/route';
import { buildLoglineShare, shortShareDate } from '@/components/modes/logline/share';
import type { LoglineStateResponse } from '@/components/modes/logline/types';
import type { ApiError } from '@/lib/types';

const NOW = new Date('2026-10-04T16:00:00Z');
const BASE = 'http://localhost:3000';
const lib = fixture as LibrarySnapshot;
const ANON = '11111111-2222-4333-8444-555555555555';

interface Client {
  cookie: string | null;
  bodies: string[];
}
const newClient = (): Client => ({ cookie: null, bodies: [] });

async function call(client: Client, handler: (req: Request) => Promise<Response>, path: string, body?: unknown) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (client.cookie) headers.cookie = client.cookie;
  const res = await handler(
    new Request(`${BASE}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers,
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
  return { res, text, json: JSON.parse(text) as LoglineStateResponse & ApiError };
}

const getState = (c: Client) => call(c, stateGET, '/api/modes/logline');
const guess = (c: Client, filmId: number) => call(c, guessPOST, '/api/modes/logline/guess', { filmId });

function cookieValue(c: Client, name: string): string | null {
  const pair = (c.cookie ?? '').split('; ').find((p) => p.startsWith(`${name}=`));
  return pair ? pair.slice(name.length + 1) : null;
}
function setCookie(c: Client, name: string, value: string | null) {
  const rest = (c.cookie ?? '').split('; ').filter((p) => p && !p.startsWith(`${name}=`));
  if (value !== null) rest.push(`${name}=${value}`);
  c.cookie = rest.join('; ') || null;
}

let answer: { id: number; title: string; tiers: readonly string[] };
let wrong: number[];

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  setRepoForTesting(createFixtureRepo(lib, NOW));
  resetRateLimitsForTesting();
  const t = await dailyTarget(NOW);
  answer = { id: t.film.id, title: t.film.title, tiers: t.tiers };
  const a = answer.title.toLowerCase();
  wrong = lib.films
    .filter((f) => f.isPlayable && f.id !== answer.id)
    .filter((f) => !f.title.toLowerCase().includes(a) && !a.includes(f.title.toLowerCase()))
    .filter((f) => !new RegExp(`\\b${answer.id}\\b`).test(`${f.id} ${f.releaseYear}`))
    .map((f) => f.id)
    .slice(0, 10);
});
afterEach(() => {
  setRepoForTesting(undefined);
  vi.useRealTimers();
});

function expectNoLeak(texts: string[], shownTiers: number) {
  const idRe = new RegExp(`\\b${answer.id}\\b`);
  for (const t of texts) {
    expect(t).not.toContain(answer.title);
    expect(t).not.toMatch(idRe);
    for (const unearned of answer.tiers.slice(shownTiers)) expect(t).not.toContain(unearned);
  }
}

describe('daily pick', () => {
  const pool = [...LOGLINE_FILM_IDS];

  it('is deterministic for a date', () => {
    expect(pickDailyFilmId('2026-10-04', pool)).toBe(pickDailyFilmId('2026-10-04', [...pool].reverse()));
    expect(pool).toContain(pickDailyFilmId('2026-10-04', pool));
  });

  it('uses every film once per cycle before repeating', () => {
    const start = '2026-10-01';
    const picks = Array.from({ length: pool.length }, (_, i) => pickDailyFilmId(addDays(start, i), pool, null, start));
    expect(new Set(picks).size).toBe(pool.length);
  });

  it('avoids the classic daily answer when it can', () => {
    const p = pickDailyFilmId('2026-10-09', pool)!;
    const q = pickDailyFilmId('2026-10-09', pool, p);
    expect(q).not.toBe(p);
    expect(pickDailyFilmId('2026-10-09', [p], p)).toBe(p);
    expect(pickDailyFilmId('2026-10-09', [])).toBeNull();
  });

  it('picks a film with loglines that is not today\'s classic answer', async () => {
    const repo = createFixtureRepo(lib, NOW);
    setRepoForTesting(repo);
    const t = await dailyTarget(NOW);
    expect(LOGLINES[t.film.id]).toBeDefined();
    const classic = await repo.getPuzzleByDate(dateInResetZone(NOW));
    expect(t.film.id).not.toBe(classic?.filmId);
    expect(t.date).toBe('2026-10-04');
  });
});

describe('rules', () => {
  it('earns one tier per missed take and keeps the last tier after that', () => {
    expect([0, 1, 2, 3, 4, 5].map((k) => tiersVisible(k, 'in_progress'))).toEqual([1, 2, 3, 4, 4, 4]);
    expect(tiersVisible(1, 'won')).toBe(LOGLINE.tiers);
    expect(tiersVisible(6, 'lost')).toBe(LOGLINE.tiers);
  });

  it('wins on the answer and loses after the take limit', () => {
    expect(statusAfter([1, 2], 2)).toBe('won');
    expect(statusAfter([1, 2], 9)).toBe('in_progress');
    expect(statusAfter([1, 2, 3, 4, 5, 6].slice(0, LOGLINE.maxTakes), 9)).toBe('lost');
  });

  it('share text matches the spec', () => {
    expect(shortShareDate('2026-10-04')).toBe('Oct 4');
    const text = buildLoglineShare({
      date: '2026-10-04',
      status: 'won',
      take: 3,
      maxTakes: 6,
      guesses: [
        { filmId: 1, title: 'a', year: 1, correct: false },
        { filmId: 2, title: 'b', year: 2, correct: false },
        { filmId: 3, title: 'c', year: 3, correct: true },
      ],
    });
    const [head, row, url] = text.split('\n');
    expect(head).toMatch(/ · Logline · Oct 4 · 3\/6$/);
    expect(row).toBe('⬛⬛🟩');
    expect(url).toMatch(/\/modes\/logline$/);
    expect(buildLoglineShare({ date: '2026-10-04', status: 'lost', take: 6, maxTakes: 6, guesses: [] })).toContain('X/6');
  });
});

describe('state token', () => {
  it('round trips and is opaque', () => {
    const t = encodeState(ANON, '2026-10-04', [11, 12], 'in_progress');
    expect(t).not.toContain(ANON);
    expect(t).not.toContain('in_progress');
    expect(decodeState(t, ANON, '2026-10-04')).toEqual({ guesses: [11, 12], status: 'in_progress' });
  });

  it('rejects tampering, other players and other days', () => {
    const t = encodeState(ANON, '2026-10-04', [11], 'in_progress');
    const flipped = t.slice(0, -2) + (t.endsWith('A') ? 'BB' : 'AA');
    expect(decodeState(flipped, ANON, '2026-10-04')).toBeNull();
    expect(decodeState('garbage', ANON, '2026-10-04')).toBeNull();
    expect(decodeState(t, '99999999-2222-4333-8444-555555555555', '2026-10-04')).toBeNull();
    expect(decodeState(t, ANON, '2026-10-05')).toBeNull();
    expect(decodeState(encodeState(ANON, '2026-10-04', [1, 2, 3, 4, 5, 6, 7], 'in_progress'), ANON, '2026-10-04')).toBeNull();
  });
});

describe('routes', () => {
  it('a fresh round shows only the first tier and nothing about the answer', async () => {
    const c = newClient();
    const { res, json } = await getState(c);
    expect(res.status).toBe(200);
    expect(json.take).toBe(0);
    expect(json.status).toBe('in_progress');
    expect(json.tiers).toEqual([answer.tiers[0]]);
    expect(json.totalTiers).toBe(LOGLINE.tiers);
    expect(json.maxTakes).toBe(LOGLINE.maxTakes);
    expect(json.reveal).toBeUndefined();
    expect(res.headers.getSetCookie().some((s) => s.startsWith(`${LOGLINE_STATE_COOKIE}=`) && /HttpOnly/i.test(s))).toBe(true);
    expectNoLeak(c.bodies, 1);
  });

  it('reveals one tier per miss, never leaks early, and ends after the take limit', async () => {
    const c = newClient();
    for (let k = 1; k <= LOGLINE.maxTakes; k++) {
      const { json } = await guess(c, wrong[k - 1]!);
      if (k < LOGLINE.maxTakes) {
        expect(json.status).toBe('in_progress');
        expect(json.take).toBe(k);
        expect(json.tiers).toEqual(answer.tiers.slice(0, Math.min(LOGLINE.tiers, k + 1)));
        expect(json.reveal).toBeUndefined();
        expectNoLeak(c.bodies, json.tiers.length);
        // Resume: a reload sees the same state.
        const again = await getState(c);
        expect(again.json.tiers).toEqual(json.tiers);
        expect(again.json.guesses.map((g) => g.filmId)).toEqual(wrong.slice(0, k));
      } else {
        expect(json.status).toBe('lost');
        expect(json.reveal?.title).toBe(answer.title);
        expect(json.reveal?.tiers).toEqual([...answer.tiers]);
        expect(json.guesses.every((g) => !g.correct)).toBe(true);
      }
    }
    const over = await guess(c, wrong[7]!);
    expect(over.res.status).toBe(409);
    expect(over.json.error.code).toBe('game_over');
  });

  it('wins on the answer and records a finished play', async () => {
    const c = newClient();
    await guess(c, wrong[0]!);
    const { json } = await guess(c, answer.id);
    expect(json.status).toBe('won');
    expect(json.take).toBe(2);
    expect(json.guesses.map((g) => g.correct)).toEqual([false, true]);
    expect(json.reveal?.title).toBe(answer.title);
    const { getRepo } = await import('@/server/db');
    const plays = await getRepo().listPlays({ kind: 'logline', ref: '2026-10-04' });
    expect(plays).toHaveLength(1);
    expect(plays[0]).toMatchObject({ status: 'won', takes: 2, guesses: [wrong[0], answer.id] });
  });

  it('rejects repeats, unknown films and bad bodies', async () => {
    const c = newClient();
    await guess(c, wrong[0]!);
    expect((await guess(c, wrong[0]!)).json.error.code).toBe('already_guessed');
    expect((await guess(c, 2_000_000_000)).json.error.code).toBe('not_found');
    const bad = await call(c, guessPOST, '/api/modes/logline/guess', { filmId: 'x' });
    expect(bad.res.status).toBe(400);
    expect((await getState(c)).json.take).toBe(1);
  });

  it('one round per player: clearing the token cookie does not reset progress', async () => {
    const c = newClient();
    for (const id of wrong.slice(0, LOGLINE.maxTakes)) await guess(c, id);
    setCookie(c, LOGLINE_STATE_COOKIE, null);
    const s = await getState(c);
    expect(s.json.status).toBe('lost');
    expect((await guess(c, answer.id)).json.error.code).toBe('game_over');
  });

  it('the token carries the round to an instance that never saw it', async () => {
    const c = newClient();
    await guess(c, wrong[0]!);
    await guess(c, wrong[1]!);
    setRepoForTesting(createFixtureRepo(lib, NOW)); // a cold serverless instance
    const s = await getState(c);
    expect(s.json.take).toBe(2);
    expect(s.json.tiers).toHaveLength(3);
    const next = await guess(c, wrong[2]!);
    expect(next.json.take).toBe(3);
  });

  it('a tampered or foreign token is ignored, never trusted', async () => {
    const c = newClient();
    await guess(c, wrong[0]!);
    const token = decodeURIComponent(cookieValue(c, LOGLINE_STATE_COOKIE)!);
    // Tampered token on a cold instance: the round starts from scratch (no extra tiers granted).
    setRepoForTesting(createFixtureRepo(lib, NOW));
    setCookie(c, LOGLINE_STATE_COOKIE, encodeURIComponent(token.slice(0, -3) + 'xyz'));
    const s = await getState(c);
    expect(s.json.take).toBe(0);
    expect(s.json.tiers).toHaveLength(1);
    // A token minted for another player cannot be replayed.
    const other = newClient();
    setCookie(other, LOGLINE_STATE_COOKIE, encodeURIComponent(encodeState(ANON, '2026-10-04', [answer.id], 'won')));
    const o = await getState(other);
    expect(o.json.status).toBe('in_progress');
    expect(o.json.reveal).toBeUndefined();
    expectNoLeak(other.bodies, 1);
  });

  it('rate limits takes per player', async () => {
    const c = newClient();
    await getState(c);
    let last: Awaited<ReturnType<typeof guess>> | null = null;
    for (let i = 0; i <= RATE_LIMITS.guessPerMinutePerAnon; i++) last = await guess(c, 2_000_000_000);
    expect(last!.res.status).toBe(429);
  });
});
