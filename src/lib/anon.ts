// Anonymous device id cookie helpers (Section 10.8). The cookie is httpOnly, SameSite=Lax, and
// Secure in production. Route handlers read it from the Request and set it on the Response, so
// this module has no dependency on next/headers.
import { ANON_COOKIE } from '@/config/game';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One year, refreshed whenever the cookie is (re)issued. */
export const ANON_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isAnonId(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Parse a Cookie header into a name -> value map. */
export function parseCookieHeader(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (!name || name in out) continue;
    const rawValue = part.slice(eq + 1).trim();
    try {
      out[name] = decodeURIComponent(rawValue);
    } catch {
      out[name] = rawValue;
    }
  }
  return out;
}

export function readCookie(request: Request, name: string): string | null {
  return parseCookieHeader(request.headers.get('cookie'))[name] ?? null;
}

/** The anon id from the request cookie, or null when missing or malformed. */
export function readAnonId(request: Request): string | null {
  const v = readCookie(request, ANON_COOKIE);
  return isAnonId(v) ? v.toLowerCase() : null;
}

export function newAnonId(): string {
  return crypto.randomUUID();
}

/** Set-Cookie header value for the anon id. */
export function anonCookieHeader(anonId: string, secure: boolean = process.env.NODE_ENV === 'production'): string {
  const attrs = [
    `${ANON_COOKIE}=${anonId}`,
    'Path=/',
    `Max-Age=${ANON_COOKIE_MAX_AGE}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}
