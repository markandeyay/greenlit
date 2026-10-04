// Release Order round state token (WS9, Section 9.1 items 17 and 19). SERVER ONLY.
// AES-256-GCM via src/server/db/secret.ts: opaque to the client and authenticated, so any edit is
// rejected. It lives in an httpOnly cookie, so a round resumes on any serverless instance.
import 'server-only';
import { decrypt, encrypt } from '@/server/db/secret';

export const RELEASE_ORDER_COOKIE = 'gl_ro';
const MAX_AGE = 60 * 60 * 48; // a round only matters for its own New York day

export interface RoundToken {
  v: 1;
  /** New York date of the set. */
  d: string;
  /** Anon id the round belongs to. */
  a: string;
  /** Set film ids in served order (card key = index). */
  s: number[];
  /** Attempts as card keys. */
  t: number[][];
}

export function encodeRoundToken(token: RoundToken): string {
  return encrypt(JSON.stringify(token));
}

const isIntArray = (x: unknown): x is number[] => Array.isArray(x) && x.every((n) => Number.isInteger(n));

/** Decrypt and shape-check a token. Null when missing, tampered, or malformed. */
export function decodeRoundToken(raw: string | null | undefined): RoundToken | null {
  if (!raw) return null;
  const plain = decrypt(raw);
  if (!plain) return null;
  try {
    const t = JSON.parse(plain) as Partial<RoundToken>;
    if (t.v !== 1 || typeof t.d !== 'string' || typeof t.a !== 'string' || !isIntArray(t.s)) return null;
    if (!Array.isArray(t.t) || !t.t.every(isIntArray)) return null;
    return t as RoundToken;
  } catch {
    return null;
  }
}

export function roundCookieHeader(token: RoundToken): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${RELEASE_ORDER_COOKIE}=${encodeRoundToken(token)}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax${secure}`;
}
