// Keyless deployments (no Supabase): serverless instances do not share memory. A play must
// survive a hop to a fresh instance via the signed play cookie, and a pitch via its encrypted slug.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setRepoForTesting } from '@/server/db';
import { resetRateLimitsForTesting } from '@/server/ratelimit';
import { POST as guessPOST } from '@/app/api/guess/route';
import { GET as playGET } from '@/app/api/play/route';
import { PLAY_COOKIE, playCookieHeader, readPlayCookie } from '@/server/engine/play-cookie';
import type { GuessResponse, PlayStateResponse } from '@/lib/types';
import { ANSWER_ID, ANSWER_TITLE, buildRepo, fillers, nearFilm, NOW, todayNumber } from './helpers';

const BASE = 'http://localhost:3000';
const today = String(todayNumber(NOW));

function cookiesFrom(res: Response, prior = ''): string {
  const jar = new Map(prior.split('; ').filter(Boolean).map((c) => [c.split('=')[0]!, c] as const));
  for (const sc of res.headers.getSetCookie()) {
    const pair = sc.split(';')[0]!;
    jar.set(pair.split('=')[0]!, pair);
  }
  return [...jar.values()].join('; ');
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  resetRateLimitsForTesting();
});
afterEach(() => {
  vi.useRealTimers();
  setRepoForTesting(undefined);
});

describe('keyless mode', () => {
  it('a play resumes on a fresh instance from the signed cookie', async () => {
    setRepoForTesting(await buildRepo(NOW));
    const g1 = await guessPOST(new Request(`${BASE}/api/guess`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'daily', ref: today, filmId: nearFilm.id }) }));
    let cookie = cookiesFrom(g1);
    expect(cookie).toContain(`${PLAY_COOKIE}=`);
    expect(cookie).not.toContain(ANSWER_TITLE);

    setRepoForTesting(await buildRepo(NOW)); // "another instance": empty memory
    const play = await playGET(new Request(`${BASE}/api/play?kind=daily&ref=${today}`, { headers: { cookie } }));
    expect(((await play.json()) as PlayStateResponse).take).toBe(1);

    setRepoForTesting(await buildRepo(NOW));
    const g2 = await guessPOST(new Request(`${BASE}/api/guess`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ kind: 'daily', ref: today, filmId: fillers[0]!.id }) }));
    expect(((await g2.json()) as GuessResponse).take).toBe(2);
    cookie = cookiesFrom(g2, cookie);
    expect(cookie).toContain(PLAY_COOKIE);
  });

  it('rejects a tampered play cookie', () => {
    const header = playCookieHeader([]).split(';')[0]!;
    const tampered = header.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'));
    expect(readPlayCookie(new Request(BASE, { headers: { cookie: tampered } }))).toEqual([]);
  });

  it('a pitch created on one instance resolves on another by its opaque slug', async () => {
    const a = await buildRepo(NOW);
    const stored = await a.createPitch({ slug: 'abcd1234', filmId: ANSWER_ID, note: 'hi', creatorId: null, createdAt: NOW.toISOString() });
    expect(stored.slug).not.toContain(String(ANSWER_ID));
    expect(stored.slug).toMatch(/^[A-Za-z0-9_-]{30,}$/);
    const b = await buildRepo(NOW);
    expect((await b.getPitch(stored.slug))?.filmId).toBe(ANSWER_ID);
    expect(await b.getPitch(stored.slug.slice(0, -2) + 'xx')).toBeNull();
  });
});

describe('play cookie retention', () => {
  it('keeps the daily when many practice reels are played', async () => {
    const { upsertCookiePlay } = await import('@/server/engine/play-cookie');
    const base = { profileId: null, anonId: 'a', guesses: [], hintsUsed: [], status: 'in_progress' as const, takes: null, startedAt: '', firstGuessAt: null, finishedAt: null };
    let plays = upsertCookiePlay([], { ...base, id: 'd', kind: 'daily', ref: '4' });
    for (let i = 0; i < 8; i++) plays = upsertCookiePlay(plays, { ...base, id: `u${i}`, kind: 'unlimited', ref: `r${i}` });
    expect(plays.some((p) => p.kind === 'daily')).toBe(true);
    expect(plays.filter((p) => p.kind === 'unlimited')).toHaveLength(1);
    expect(plays[0]!.ref).toBe('r7');
  });
});
