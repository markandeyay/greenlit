// Opening Weekend run state (WS9). SERVER ONLY.
//
// The run travels between serverless instances in an AES-GCM token (src/server/db/secret.ts), so
// the client can neither read its seed nor forge a better position. The token is bound to the
// player's anon id and names the step it is valid for; the daily run additionally keeps a
// server-side record (the play row, plus a signed cookie in keyless mode) whose step must match,
// so a replayed token for an earlier step is rejected.
import 'server-only';
import { decrypt, encrypt, sign, verify } from '@/server/db/secret';
import { readCookie } from '@/lib/anon';
import type { OwMode } from './types';

export interface OwRunState {
  v: 1;
  mode: OwMode;
  /** Pair sequence seed. Daily seeds are derived from the date with the server secret. */
  seed: string;
  /** Daily only: the New York date the run belongs to. */
  date: string | null;
  anon: string;
  /** Run id; equals the daily play's id. */
  run: string;
  /** Pairs answered correctly so far = index of the pair this token may answer. */
  step: number;
  /** Epoch ms the run started (daily clock). */
  t0: number;
}

export function encodeRunToken(state: OwRunState): string {
  return encrypt(JSON.stringify(state));
}

export function decodeRunToken(token: string): OwRunState | null {
  if (typeof token !== 'string' || token.length > 2048) return null;
  const raw = decrypt(token);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Partial<OwRunState>;
    if (
      s.v !== 1 ||
      (s.mode !== 'daily' && s.mode !== 'practice') ||
      typeof s.seed !== 'string' ||
      typeof s.anon !== 'string' ||
      typeof s.run !== 'string' ||
      !Number.isInteger(s.step) ||
      (s.step as number) < 0 ||
      typeof s.t0 !== 'number' ||
      (s.mode === 'daily' && typeof s.date !== 'string')
    ) {
      return null;
    }
    return s as OwRunState;
  } catch {
    return null;
  }
}

/** Secret-keyed daily seed: same for everyone on a date, not computable without the server secret. */
export function dailySeed(date: string): string {
  const signed = sign(`opening-weekend:${date}`);
  return signed.slice(signed.indexOf('.') + 1);
}

// ---- Daily run cookie (keyless fallback) ------------------------------------------------------

export const OW_RUN_COOKIE = 'gl_ow_run';

/** What the server remembers about today's daily run, independent of the token. */
export interface OwDailyRecord {
  date: string;
  anon: string;
  run: string;
  step: number;
  t0: number;
  done: boolean;
  /** Set when done: how the run ended. */
  outcome: 'wrong' | 'time' | null;
}

export function readRunCookie(request: Request): OwDailyRecord | null {
  const raw = readCookie(request, OW_RUN_COOKIE);
  if (!raw) return null;
  const payload = verify(raw);
  if (!payload) return null;
  try {
    const r = JSON.parse(payload) as Partial<OwDailyRecord>;
    if (
      typeof r.date !== 'string' ||
      typeof r.anon !== 'string' ||
      typeof r.run !== 'string' ||
      !Number.isInteger(r.step) ||
      typeof r.t0 !== 'number' ||
      typeof r.done !== 'boolean'
    ) {
      return null;
    }
    return { outcome: null, ...r } as OwDailyRecord;
  } catch {
    return null;
  }
}

export function runCookieHeader(record: OwDailyRecord): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const value = encodeURIComponent(sign(JSON.stringify(record)));
  // Two days: long enough to cover the whole New York day from any timezone.
  return `${OW_RUN_COOKIE}=${value}; Path=/; Max-Age=${60 * 60 * 48}; HttpOnly; SameSite=Lax${secure}`;
}
