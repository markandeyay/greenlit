import { beforeEach, describe, expect, it } from 'vitest';
import { anonCookieHeader, isAnonId, parseCookieHeader, readAnonId } from '@/lib/anon';
import { checkRateLimit, clientIp, resetRateLimitsForTesting } from '@/server/ratelimit';
import { resolveRegion } from '@/server/region';

describe('anon cookie helpers', () => {
  it('parses cookies and validates the anon id', () => {
    expect(parseCookieHeader('a=1; gl_anon=abc; b=x%20y')).toEqual({ a: '1', gl_anon: 'abc', b: 'x y' });
    const id = crypto.randomUUID();
    expect(isAnonId(id)).toBe(true);
    expect(readAnonId(new Request('http://x', { headers: { cookie: `gl_anon=${id}` } }))).toBe(id);
    expect(readAnonId(new Request('http://x', { headers: { cookie: 'gl_anon=not-a-uuid' } }))).toBeNull();
  });
  it('builds an httpOnly Lax cookie, Secure only when asked', () => {
    const h = anonCookieHeader('11111111-1111-4111-8111-111111111111', false);
    expect(h).toContain('HttpOnly');
    expect(h).toContain('SameSite=Lax');
    expect(h).not.toContain('Secure');
    expect(anonCookieHeader('11111111-1111-4111-8111-111111111111', true)).toContain('Secure');
  });
});

describe('in-memory rate limiter', () => {
  beforeEach(() => resetRateLimitsForTesting());
  it('allows up to the limit within the window, then frees up after it', async () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) expect((await checkRateLimit('k', 3, 60, t0 + i)).ok).toBe(true);
    expect((await checkRateLimit('k', 3, 60, t0 + 10)).ok).toBe(false);
    expect((await checkRateLimit('other', 3, 60, t0 + 10)).ok).toBe(true);
    expect((await checkRateLimit('k', 3, 60, t0 + 60_001)).ok).toBe(true);
  });
  it('reads the client IP from proxy headers', () => {
    expect(clientIp(new Request('http://x', { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } }))).toBe('1.2.3.4');
    expect(clientIp(new Request('http://x', { headers: { 'x-real-ip': '9.9.9.9' } }))).toBe('9.9.9.9');
    expect(clientIp(new Request('http://x'))).toBeNull();
  });
});

describe('region resolution', () => {
  const req = (headers: Record<string, string>) => new Request('http://x', { headers });
  it('cookie, then profile, then Accept-Language, then default', () => {
    expect(resolveRegion(req({ cookie: 'gl_region=DE', 'accept-language': 'en-GB' }), 'CA')).toBe('DE');
    expect(resolveRegion(req({ cookie: 'gl_region=UK' }))).toBe('GB');
    expect(resolveRegion(req({ cookie: 'gl_region=ZZ', 'accept-language': 'en-GB' }), 'CA')).toBe('CA');
    expect(resolveRegion(req({ 'accept-language': 'en-IN,en;q=0.9' }))).toBe('IN');
    expect(resolveRegion(req({}))).toBe('US');
  });
});
