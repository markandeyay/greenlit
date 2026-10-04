// Pitch create + results, in keyless (memory) mode and with a Supabase-like repo.
// Section 10.5: slugs are random, never derived from the film; the answer is never in the
// create response or URL; results are creator only.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@/server/auth';

const auth = vi.hoisted(() => ({ user: null as SessionUser | null }));
vi.mock('@/server/auth', () => ({ getCurrentUser: async () => auth.user }));

import { setRepoForTesting } from '@/server/db';
import type { Repo } from '@/server/db/repo';
import { resetRateLimitsForTesting } from '@/server/ratelimit';
import { POST as pitchPOST } from '@/app/api/pitch/route';
import { GET as resultsGET } from '@/app/api/pitch/[slug]/results/route';
import { creatorCookieName, creatorKeyFor, generatePitchSlug, pitchUrl, verifyCreatorKey } from '@/server/pitch';
import { ANON_COOKIE, PITCH, RATE_LIMITS } from '@/config/game';
import { SITE_URL } from '@/config/brand';
import type { PitchResponse, PitchResultsResponse, Play } from '@/lib/types';
import { HERO, NOW, buildRepo, buildSupabaseLikeRepo } from '../admin/helpers';

const BASE = 'http://localhost:3000';
const ANON = '11111111-2222-4333-8444-555555555555';
let repo: Repo;

interface Client {
  cookies: Map<string, { value: string; path: string }>;
}
const newClient = (): Client => ({ cookies: new Map([[ANON_COOKIE, { value: ANON, path: '/' }]]) });

function cookieHeader(c: Client, path: string): string {
  return [...c.cookies.entries()]
    .filter(([, v]) => path.startsWith(v.path))
    .map(([k, v]) => `${k}=${v.value}`)
    .join('; ');
}
function absorb(c: Client, res: Response) {
  for (const sc of res.headers.getSetCookie()) {
    const [pair, ...attrs] = sc.split(';').map((s) => s.trim());
    const [name, ...rest] = pair!.split('=');
    const path = attrs.find((a) => a.startsWith('Path='))?.slice(5) ?? '/';
    c.cookies.set(name!, { value: rest.join('='), path });
  }
}

async function create(c: Client, body: unknown) {
  const res = await pitchPOST(
    new Request(`${BASE}/api/pitch`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: cookieHeader(c, '/api/pitch') }, body: JSON.stringify(body) }),
  );
  absorb(c, res);
  const text = await res.text();
  return { res, text, json: JSON.parse(text) as PitchResponse & { error?: { code: string; message: string } } };
}

async function results(c: Client | null, slug: string) {
  const path = `/api/pitch/${encodeURIComponent(slug)}/results`;
  const headers: Record<string, string> = c ? { cookie: cookieHeader(c, path) } : {};
  const res = await resultsGET(new Request(`${BASE}${path}`, { headers }), { params: Promise.resolve({ slug }) });
  const text = await res.text();
  return { res, text, json: JSON.parse(text) as PitchResultsResponse };
}

function play(slug: string, over: Partial<Play>): Play {
  return {
    id: crypto.randomUUID(),
    profileId: null,
    anonId: crypto.randomUUID(),
    kind: 'pitch',
    ref: slug,
    guesses: [101, 100],
    hintsUsed: [],
    status: 'won',
    takes: 2,
    startedAt: NOW.toISOString(),
    firstGuessAt: NOW.toISOString(),
    finishedAt: NOW.toISOString(),
    ...over,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  resetRateLimitsForTesting();
  auth.user = null;
});
afterEach(() => {
  setRepoForTesting(undefined);
  vi.useRealTimers();
});

describe('slug generation', () => {
  it(`draws ${PITCH.slugLength} chars from the base36 alphabet with crypto randomness`, () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const s = generatePitchSlug();
      expect(s).toMatch(new RegExp(`^[${PITCH.slugAlphabet}]{${PITCH.slugLength}}$`));
      seen.add(s);
    }
    expect(seen.size).toBe(500);
  });

  it('rejects biased bytes (rejection sampling)', () => {
    let call = 0;
    const fill = (buf: Uint8Array) => {
      call++;
      // First buffer: all 255 (rejected, 255 >= 252). Then all 0 -> '0'.
      buf.fill(call === 1 ? 255 : 0);
      return buf;
    };
    expect(generatePitchSlug(fill)).toBe('0'.repeat(PITCH.slugLength));
    expect(call).toBe(2);
  });

  it('builds the URL from SITE_URL with the encoded slug', () => {
    expect(pitchUrl('ab_c-9')).toBe(`${SITE_URL.replace(/\/$/, '')}/p/ab_c-9`);
  });

  it('creator keys verify only for their own slug', () => {
    expect(verifyCreatorKey('abc12345', creatorKeyFor('abc12345'))).toBe(true);
    expect(verifyCreatorKey('abc12346', creatorKeyFor('abc12345'))).toBe(false);
    expect(verifyCreatorKey('abc12345', null)).toBe(false);
    expect(creatorCookieName('x')).toMatch(/^gl_pitch_[0-9a-f]{16}$/);
  });
});

describe.each([
  ['keyless (memory repo)', () => buildRepo() as Repo, false],
  ['Supabase-like repo', () => buildSupabaseLikeRepo() as Repo, true],
])('pitch flow, %s', (_name, makeRepo, base36) => {
  beforeEach(() => {
    repo = makeRepo();
    setRepoForTesting(repo);
  });

  it('creates an opaque pitch and never returns the answer', async () => {
    const c = newClient();
    const { res, text, json } = await create(c, { filmId: HERO.id, note: '  Think foggy docks  ' });
    expect(res.status).toBe(201);
    expect(Object.keys(json).sort()).toEqual(['slug', 'url']);
    expect(json.url).toBe(pitchUrl(json.slug));
    if (base36) expect(json.slug).toMatch(/^[0-9a-z]{8}$/);
    else expect(json.slug).toMatch(/^[A-Za-z0-9_-]{30,}$/);
    expect(text).not.toContain(HERO.title);
    expect(text).not.toMatch(new RegExp(`\\b${HERO.id}\\b`));
    const stored = await repo.getPitch(json.slug);
    expect(stored).toMatchObject({ filmId: HERO.id, note: 'Think foggy docks', creatorId: null });
    // httpOnly creator cookie scoped to this pitch's API path.
    const sc = res.headers.getSetCookie().find((s) => s.startsWith(creatorCookieName(json.slug)))!;
    expect(sc).toContain('HttpOnly');
    expect(sc).toContain(`Path=/api/pitch/${encodeURIComponent(json.slug)}`);
    expect(sc.split(';')[0]).toBe(`${creatorCookieName(json.slug)}=${creatorKeyFor(json.slug)}`);
  });

  it('random slugs: two pitches of the same film differ', async () => {
    const a = await create(newClient(), { filmId: HERO.id });
    const b = await create(newClient(), { filmId: HERO.id });
    expect(a.json.slug).not.toBe(b.json.slug);
  });

  it('validates film and note', async () => {
    const c = newClient();
    expect((await create(c, { filmId: 424242 })).res.status).toBe(404);
    expect((await create(c, { filmId: 207 })).res.status).toBe(404); // not playable
    expect((await create(c, { filmId: 'x' })).res.status).toBe(400);
    expect((await create(c, { filmId: HERO.id, note: 'y'.repeat(PITCH.noteMaxLength + 1) })).res.status).toBe(400);
    const prof = await create(c, { filmId: HERO.id, note: 'this is shit' });
    expect(prof.res.status).toBe(400);
    expect(prof.json.error?.message).toMatch(/friendly/);
    const spoiler = await create(c, { filmId: HERO.id, note: 'It is The Silver Harbor lol' });
    expect(spoiler.res.status).toBe(400);
    expect(spoiler.json.error?.message).toMatch(/title/);
  });

  it(`rate limits at ${RATE_LIMITS.pitchPerHourPerAnon} per hour per anon id`, async () => {
    const c = newClient();
    for (let i = 0; i < RATE_LIMITS.pitchPerHourPerAnon; i++) expect((await create(c, { filmId: HERO.id })).res.status).toBe(201);
    const blocked = await create(c, { filmId: HERO.id });
    expect(blocked.res.status).toBe(429);
    expect((await create(newClient(), { filmId: HERO.id })).res.status).toBe(429); // same anon id
    const other: Client = { cookies: new Map([[ANON_COOKIE, { value: '99999999-2222-4333-8444-555555555555', path: '/' }]]) };
    expect((await create(other, { filmId: HERO.id })).res.status).toBe(201);
  });

  it('results: creator (cookie) sees friends; others get 403 with no film data', async () => {
    const creator = newClient();
    const { json } = await create(creator, { filmId: HERO.id });
    const slug = json.slug;
    await repo.upsertProfile({ id: 'p-1', handle: 'reelfan', region: null, flagged: false, flagReason: null, createdAt: NOW.toISOString() });
    await repo.savePlay(play(slug, { profileId: 'p-1', takes: 3, hintsUsed: ['creator_note'] }));
    await repo.savePlay(play(slug, { status: 'lost', takes: 10, finishedAt: new Date(NOW.getTime() + 1000).toISOString() }));
    await repo.savePlay(play(slug, { status: 'in_progress', takes: null, guesses: [101], finishedAt: null }));
    await repo.savePlay(play(slug, { status: 'in_progress', takes: null, guesses: [], finishedAt: null })); // opened only

    const ok = await results(creator, slug);
    expect(ok.res.status).toBe(200);
    expect(ok.json.film).toMatchObject({ filmId: HERO.id, title: HERO.title });
    expect(ok.json.results).toEqual([
      { handle: 'reelfan', status: 'won', takes: 3, hintsUsed: 1, finishedAt: NOW.toISOString() },
      { handle: null, status: 'lost', takes: 10, hintsUsed: 0, finishedAt: new Date(NOW.getTime() + 1000).toISOString() },
      { handle: null, status: 'in_progress', takes: 1, hintsUsed: 0, finishedAt: null },
    ]);

    for (const who of [null, newClient()]) {
      const denied = await results(who, slug);
      expect(denied.res.status).toBe(403);
      expect(denied.text).not.toContain(HERO.title);
    }
    // A creator cookie for a different pitch does not unlock this one.
    const forged = newClient();
    forged.cookies.set(creatorCookieName(slug), { value: creatorKeyFor('another1'), path: '/' });
    expect((await results(forged, slug)).res.status).toBe(403);
    expect((await results(creator, 'nope0000')).res.status).toBe(404);
  });

  it('results: a signed-in creator is recognized on any device; their own play is excluded', async () => {
    auth.user = { id: 'creator-1', email: 'c@example.com', isAdmin: false };
    const { json } = await create(newClient(), { filmId: HERO.id });
    expect((await repo.getPitch(json.slug))!.creatorId).toBe('creator-1');
    await repo.savePlay(play(json.slug, { profileId: 'creator-1' }));
    const r = await results(null, json.slug); // no cookie at all
    expect(r.res.status).toBe(200);
    expect(r.json.results).toEqual([]);
    auth.user = { id: 'someone-else', email: null, isAdmin: false };
    expect((await results(null, json.slug)).res.status).toBe(403);
  });
});
