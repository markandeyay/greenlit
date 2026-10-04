import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { APP_NAME } from '@/config/brand';
import { boardName, validateHandle } from '@/components/account/handle-rules';
import { isAuthConfigured, isSupabaseAuthCookie } from '@/lib/supabase/config';
import { getCurrentUser } from '@/server/auth';
import { isAdminEmail, parseAdminEmails } from '@/server/auth/admin';
import { completeSignIn, safeNext } from '@/server/auth/merge';
import { createFixtureRepo, setRepoForTesting } from '@/server/db';
import { ApiFailure } from '@/server/http';
import { getMe, updateProfile } from '@/server/profile';
import { GET as meRoute } from '@/app/api/me/route';
import { PATCH as profileRoute } from '@/app/api/profile/route';
import { A, B, dailyPlay, profile } from './helpers';

describe('handle validation', () => {
  it('accepts 3 to 20 letters, numbers and underscores', () => {
    expect(validateHandle('abc')).toEqual({ ok: true, handle: 'abc' });
    expect(validateHandle('  Night_Owl_42 ')).toEqual({ ok: true, handle: 'Night_Owl_42' });
    expect(validateHandle('a'.repeat(20)).ok).toBe(true);
  });

  it('rejects bad handles with friendly messages', () => {
    const msg = (v: unknown) => {
      const r = validateHandle(v);
      return r.ok ? null : r.message;
    };
    expect(msg('ab')).toMatch(/at least 3/);
    expect(msg('a'.repeat(21))).toMatch(/20 characters/);
    expect(msg('has space')).toMatch(/Letters, numbers and underscores/);
    expect(msg('emoji🎬')).toMatch(/Letters, numbers and underscores/);
    expect(msg('dash-name')).toMatch(/Letters, numbers and underscores/);
    expect(msg('')).toMatch(/Pick a handle/);
    expect(msg(42)).toMatch(/Pick a handle/);
    expect(msg('ADMIN')).toMatch(/reserved/);
    expect(msg(APP_NAME.toLowerCase())).toMatch(/reserved/);
  });

  it('bills handle-less players as an Extra', () => {
    expect(boardName({ id: A, handle: 'alice' })).toBe('alice');
    expect(boardName({ id: 'ab12cd34-0000-4000-8000-000000000000', handle: null })).toBe('Extra #AB12');
  });
});

describe('auth configuration', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('getCurrentUser returns null when Supabase is not configured', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(isAuthConfigured()).toBe(false);
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('getCurrentUser never throws, even outside a request scope', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    expect(isAuthConfigured()).toBe(true);
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('recognizes Supabase auth cookies', () => {
    expect(isSupabaseAuthCookie('sb-abcd-auth-token')).toBe(true);
    expect(isSupabaseAuthCookie('sb-abcd-auth-token.0')).toBe(true);
    expect(isSupabaseAuthCookie('gl_anon')).toBe(false);
  });

  it('admin check is case-insensitive over ADMIN_EMAILS', () => {
    expect(parseAdminEmails(' A@x.com, b@Y.com ,')).toEqual(['a@x.com', 'b@y.com']);
    expect(isAdminEmail('B@y.COM', 'a@x.com,b@y.com')).toBe(true);
    expect(isAdminEmail('c@z.com', 'a@x.com')).toBe(false);
    expect(isAdminEmail(null, 'a@x.com')).toBe(false);
    expect(isAdminEmail('a@x.com', '')).toBe(false);
  });

  it('only allows same-origin relative redirects after sign-in', () => {
    expect(safeNext('/stats')).toBe('/stats');
    expect(safeNext(null)).toBe('/settings');
    expect(safeNext('https://evil.example')).toBe('/settings');
    expect(safeNext('//evil.example')).toBe('/settings');
    expect(safeNext('/\\evil.example')).toBe('/settings');
    expect(safeNext('/auth/callback')).toBe('/settings');
  });
});

describe('sign-in merge and profile updates', () => {
  let repo: ReturnType<typeof createFixtureRepo>;
  const ANON = '20000000-0000-4000-8000-000000000001';
  beforeEach(() => {
    repo = createFixtureRepo();
    setRepoForTesting(repo);
  });
  afterEach(() => setRepoForTesting(undefined));

  it('creates the profile and attaches anon plays on sign-in', async () => {
    await repo.savePlay(dailyPlay(null, 3, { anonId: ANON }));
    await repo.savePlay(dailyPlay(null, 4, { anonId: ANON, kind: 'vault' }));
    const res = await completeSignIn(A, ANON, 'GB');
    expect(res).toEqual({ profileCreated: true, mergedPlays: 2 });
    expect(await repo.getProfile(A)).toMatchObject({ id: A, handle: null, region: 'GB', flagged: false });
    expect((await repo.listPlays({ profileId: A })).length).toBe(2);
    // Second sign-in: nothing left to merge, profile kept.
    expect(await completeSignIn(A, ANON, null)).toEqual({ profileCreated: false, mergedPlays: 0 });
    // Invalid anon ids are ignored.
    expect((await completeSignIn(A, 'not-a-uuid')).mergedPlays).toBe(0);
  });

  it('updates handle and region, enforcing uniqueness case-insensitively', async () => {
    await repo.upsertProfile(profile(B, 'Bob_1'));
    const ok = await updateProfile(A, { handle: 'alice_7', region: 'DE' });
    expect(ok).toEqual({ profile: { handle: 'alice_7', region: 'DE' }, boardName: 'alice_7' });
    await expect(updateProfile(A, { handle: 'bob_1' })).rejects.toMatchObject({ status: 409 });
    await expect(updateProfile(A, { handle: 'x' })).rejects.toBeInstanceOf(ApiFailure);
    await expect(updateProfile(A, { region: 'FR' })).rejects.toBeInstanceOf(ApiFailure);
    // Changing only the case of your own handle is fine.
    expect((await updateProfile(A, { handle: 'Alice_7' })).profile.handle).toBe('Alice_7');
    // Region can return to auto.
    expect((await updateProfile(A, { region: null })).profile.region).toBeNull();
  });

  it('getMe summarizes server plays for the profile', async () => {
    await repo.upsertProfile(profile(A, 'alice'));
    await repo.savePlay(dailyPlay(A, 3, { takes: 2 }));
    const me = await getMe({ id: A, email: 'a@x.com', isAdmin: false });
    expect(me.user).toEqual({ id: A, email: 'a@x.com', isAdmin: false });
    expect(me.boardName).toBe('alice');
    expect(me.stats?.daily.played).toBe(1);
    const anon = await getMe(null);
    expect(anon).toMatchObject({ user: null, stats: null });
  });

  it('routes degrade when signed out (keyless)', async () => {
    const me = await meRoute();
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ authConfigured: false, user: null });
    const res = await profileRoute(
      new Request('http://x/api/profile', { method: 'PATCH', body: JSON.stringify({ handle: 'alice' }) }),
    );
    expect(res.status).toBe(401);
  });
});

