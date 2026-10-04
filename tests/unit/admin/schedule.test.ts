// Admin service + routes: gate (403 for non-admins, dev bypass), schedule / swap / delete,
// hint edits, themes, film edits and studio aliases against an in-memory repo.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@/server/auth';

const auth = vi.hoisted(() => ({ user: null as SessionUser | null }));
vi.mock('@/server/auth', () => ({ getCurrentUser: async () => auth.user }));

import { setRepoForTesting } from '@/server/db';
import { decideAdminAccess } from '@/server/admin/access';
import { GET as scheduleGET, POST as schedulePOST } from '@/app/api/admin/schedule/route';
import { GET as filmsGET, POST as filmsPOST } from '@/app/api/admin/films/route';
import { GET as filmGET } from '@/app/api/admin/films/[id]/route';
import { GET as studiosGET, POST as studiosPOST } from '@/app/api/admin/studios/route';
import { SCHEDULING, HINT_CANDIDATES_PER_PUZZLE } from '@/config/game';
import { addDays, puzzleNumberForDate } from '@/lib/dates';
import type { MemoryRepo } from '@/server/db/memory';
import type { AdminDay, AdminScheduleResponse, AdminStudiosResponse } from '@/server/admin/types';
import { HERO, NOW, TODAY, buildRepo, validHints } from './helpers';

const ADMIN: SessionUser = { id: 'u-admin', email: 'boss@example.com', isAdmin: true };
const PLAYER: SessionUser = { id: 'u-player', email: 'p@example.com', isAdmin: false };
const BASE = 'http://localhost:3000';
let repo: MemoryRepo;

const post = (handler: (r: Request) => Promise<Response>, path: string, body: unknown) =>
  handler(new Request(`${BASE}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
const get = (handler: (r: Request) => Promise<Response>, path: string) => handler(new Request(`${BASE}${path}`));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  repo = buildRepo();
  setRepoForTesting(repo);
  auth.user = ADMIN;
});
afterEach(() => {
  setRepoForTesting(undefined);
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('admin gate', () => {
  it('decides access: admin yes, dev bypass yes, otherwise no', () => {
    expect(decideAdminAccess(ADMIN, 'production')).toMatchObject({ allowed: true, devBypass: false });
    expect(decideAdminAccess(PLAYER, 'production').allowed).toBe(false);
    expect(decideAdminAccess(null, 'production').allowed).toBe(false);
    expect(decideAdminAccess(null, 'test').allowed).toBe(false);
    expect(decideAdminAccess(null, 'development', '1')).toMatchObject({ allowed: true, devBypass: true });
    expect(decideAdminAccess(null, 'development', undefined).allowed).toBe(false);
  });

  it('every admin API answers 403 with no data for non-admins', async () => {
    auth.user = PLAYER;
    const responses = await Promise.all([
      get(scheduleGET as never, '/api/admin/schedule'),
      post(schedulePOST, '/api/admin/schedule', { action: 'draft', filmId: HERO.id }),
      get(filmsGET, '/api/admin/films?q=silver'),
      post(filmsPOST, '/api/admin/films', { id: HERO.id, patch: { tagline: 'x' } }),
      filmGET(new Request(`${BASE}/api/admin/films/${HERO.id}`), { params: Promise.resolve({ id: String(HERO.id) }) }),
      get(studiosGET as never, '/api/admin/studios'),
      post(studiosPOST, '/api/admin/studios', { action: 'create', name: 'Evil' }),
    ]);
    for (const r of responses) {
      expect(r.status).toBe(403);
      const text = await r.text();
      expect(text).not.toContain(HERO.title);
      expect(text).toContain('forbidden');
    }
  });

  it('opens under NODE_ENV=development only with ADMIN_DEV_OPEN=1', async () => {
    auth.user = null;
    vi.stubEnv('NODE_ENV', 'development');
    expect((await get(scheduleGET as never, '/api/admin/schedule')).status).toBe(403);
    vi.stubEnv('ADMIN_DEV_OPEN', '1');
    expect((await get(scheduleGET as never, '/api/admin/schedule')).status).toBe(200);
  });
});

describe('schedule API', () => {
  const tomorrow = addDays(TODAY, 1);

  it('lists recent past through today + aheadDays', async () => {
    const r = await scheduleGET();
    const data = (await r.json()) as AdminScheduleResponse;
    expect(data.today).toBe(TODAY);
    expect(data.days.at(-1)!.date).toBe(addDays(TODAY, SCHEDULING.aheadDays));
    const today = data.days.find((d: AdminDay) => d.isToday)!;
    expect(today.editable).toBe(true); // nothing scheduled today yet in this repo
    expect(data.days.filter((d) => d.isPast).every((d) => !d.editable)).toBe(true);
  });

  it('schedules a film with drafted hints, then refuses the same film within the cooldown', async () => {
    const r = await post(schedulePOST, '/api/admin/schedule', { action: 'schedule', date: tomorrow, filmId: HERO.id, theme: 'Harbor Week' });
    expect(r.status).toBe(200);
    const stored = await repo.getPuzzleByDate(tomorrow);
    expect(stored).toMatchObject({ number: puzzleNumberForDate(tomorrow), filmId: HERO.id, theme: 'Harbor Week' });
    expect(stored!.hints).toHaveLength(HINT_CANDIDATES_PER_PUZZLE);

    const again = await post(schedulePOST, '/api/admin/schedule', { action: 'schedule', date: addDays(tomorrow, 30), filmId: HERO.id });
    expect(again.status).toBe(400);
    expect(await again.text()).toMatch(/already scheduled within/);
  });

  it('refuses a film used within the cooldown in the past', async () => {
    await repo.upsertPuzzle({ number: puzzleNumberForDate(addDays(TODAY, -200)), date: addDays(TODAY, -200), filmId: HERO.id, theme: null, hints: validHints() });
    const r = await post(schedulePOST, '/api/admin/schedule', { action: 'schedule', date: tomorrow, filmId: HERO.id });
    expect(r.status).toBe(400);
  });

  it('refuses films missing required fields', async () => {
    const r = await post(schedulePOST, '/api/admin/schedule', { action: 'schedule', date: tomorrow, filmId: 200, hints: validHints() });
    expect(r.status).toBe(400);
    expect(await r.text()).toMatch(/box office/);
    expect(await repo.getPuzzleByDate(tomorrow)).toBeNull();
  });

  it('swaps a film, edits hints by hand, and deletes a future reel', async () => {
    await post(schedulePOST, '/api/admin/schedule', { action: 'schedule', date: tomorrow, filmId: HERO.id });
    const swap = await post(schedulePOST, '/api/admin/schedule', { action: 'schedule', date: tomorrow, filmId: 101 });
    expect(swap.status).toBe(200);
    const n = puzzleNumberForDate(tomorrow);
    expect((await repo.getPuzzle(n))!.filmId).toBe(101);

    const hints = [
      { type: 'tagline', payload: { text: 'Hand written.' } },
      { type: 'decade_vibe', payload: { text: 'Released in the 1990s.' } },
      { type: 'first_letter', payload: { letter: 'M' } },
    ];
    expect((await post(schedulePOST, '/api/admin/schedule', { action: 'hints', number: n, hints })).status).toBe(200);
    expect((await repo.getPuzzle(n))!.hints).toEqual(hints);

    const bad = await post(schedulePOST, '/api/admin/schedule', { action: 'hints', number: n, hints: hints.slice(0, 2) });
    expect(bad.status).toBe(400);

    expect((await post(schedulePOST, '/api/admin/schedule', { action: 'delete', number: n })).status).toBe(200);
    expect(await repo.getPuzzle(n)).toBeNull();
  });

  it('never edits or deletes past or live puzzles', async () => {
    const past = addDays(TODAY, -3);
    await repo.upsertPuzzle({ number: puzzleNumberForDate(past), date: past, filmId: 101, theme: null, hints: validHints() });
    await repo.upsertPuzzle({ number: puzzleNumberForDate(TODAY), date: TODAY, filmId: 103, theme: null, hints: validHints() });
    for (const date of [past, TODAY]) {
      const n = puzzleNumberForDate(date);
      expect((await post(schedulePOST, '/api/admin/schedule', { action: 'delete', number: n })).status).toBe(400);
      expect((await post(schedulePOST, '/api/admin/schedule', { action: 'hints', number: n, hints: validHints() })).status).toBe(400);
      expect((await post(schedulePOST, '/api/admin/schedule', { action: 'schedule', date, filmId: HERO.id })).status).toBe(400);
    }
    expect((await repo.getPuzzleByDate(TODAY))!.filmId).toBe(103);
  });

  it('drafts hints for preview', async () => {
    const r = await post(schedulePOST, '/api/admin/schedule', { action: 'draft', filmId: HERO.id });
    const body = (await r.json()) as { hints: unknown[]; problems: string[] };
    expect(body.hints).toHaveLength(HINT_CANDIDATES_PER_PUZZLE);
    expect(body.problems).toEqual([]);
  });

  it('sets and clears a theme across a range, skipping empty dates', async () => {
    await post(schedulePOST, '/api/admin/schedule', { action: 'schedule', date: tomorrow, filmId: HERO.id });
    await post(schedulePOST, '/api/admin/schedule', { action: 'schedule', date: addDays(tomorrow, 2), filmId: 101 });
    const r = await post(schedulePOST, '/api/admin/schedule', { action: 'theme', fromDate: tomorrow, toDate: addDays(tomorrow, 2), theme: 'Twins Week' });
    const body = (await r.json()) as { updated: number[]; skipped: string[] };
    expect(body.updated).toHaveLength(2);
    expect(body.skipped).toEqual([addDays(tomorrow, 1)]);
    expect((await repo.getPuzzleByDate(tomorrow))!.theme).toBe('Twins Week');
    await post(schedulePOST, '/api/admin/schedule', { action: 'theme', fromDate: tomorrow, toDate: addDays(tomorrow, 2), theme: null });
    expect((await repo.getPuzzleByDate(tomorrow))!.theme).toBeNull();
    const pastTheme = await post(schedulePOST, '/api/admin/schedule', { action: 'theme', fromDate: addDays(TODAY, -2), toDate: tomorrow, theme: 'x' });
    expect(pastTheme.status).toBe(400);
  });
});

describe('films and studios API', () => {
  it('searches, shows details, and edits basic fields', async () => {
    const s = (await (await get(filmsGET, '/api/admin/films?q=the%20silver%20harbor&eligible=1')).json()) as { films: { id: number }[] };
    expect(s.films[0]!.id).toBe(HERO.id);
    const d = await filmGET(new Request(`${BASE}/api/admin/films/200`), { params: Promise.resolve({ id: '200' }) });
    expect(((await d.json()) as { missing: string[] }).missing).toContain('box office');

    const fixed = await post(filmsPOST, '/api/admin/films', { id: 200, patch: { boxOfficeUsd: 5_000_000 } });
    expect(((await fixed.json()) as { missing: string[] }).missing).toEqual([]);

    const cannot = await post(filmsPOST, '/api/admin/films', { id: 201, patch: { isAnswerEligible: true } });
    expect(cannot.status).toBe(400);
    expect(await cannot.text()).toMatch(/tagline/);
  });

  it('creates studios and edits aliases', async () => {
    const created = await post(studiosPOST, '/api/admin/studios', { action: 'create', name: 'Eastgate' });
    const body = (await created.json()) as AdminStudiosResponse & { studio: { id: number } };
    expect(body.studios.map((s) => s.name)).toContain('Eastgate');
    const dup = await post(studiosPOST, '/api/admin/studios', { action: 'create', name: 'eastgate' });
    expect(dup.status).toBe(400);

    const aliased = (await (await post(studiosPOST, '/api/admin/studios', { action: 'alias', rawCompanyId: 777, studioId: body.studio.id })).json()) as AdminStudiosResponse;
    expect(aliased.aliases).toContainEqual({ rawCompanyId: 777, studioId: body.studio.id });
    expect((await post(studiosPOST, '/api/admin/studios', { action: 'alias', rawCompanyId: 778, studioId: 99999 })).status).toBe(400);

    const removed = (await (await post(studiosPOST, '/api/admin/studios', { action: 'unalias', rawCompanyId: 777 })).json()) as AdminStudiosResponse;
    expect(removed.aliases.find((a) => a.rawCompanyId === 777)).toBeUndefined();
  });
});
