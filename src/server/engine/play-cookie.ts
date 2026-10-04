// Keyless-mode play persistence (WS0). When the active repo is the in-memory one (no Supabase),
// serverless instances do not share memory, so each player's recent plays are mirrored into a
// signed httpOnly cookie. A play's guesses are the player's own information, so this reveals
// nothing; the signature stops tampering (e.g. erasing guesses to get more takes).
import 'server-only';
import type { Play } from '@/lib/types';
import { sign, verify } from '@/server/db/secret';

export const PLAY_COOKIE = 'gl_plays';
const MAX_PLAYS = 5;
const MAX_AGE = 60 * 60 * 24 * 60; // 60 days

export function readPlayCookie(request: Request): Play[] {
  const header = request.headers.get('cookie') ?? '';
  const raw = header
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${PLAY_COOKIE}=`))
    ?.slice(PLAY_COOKIE.length + 1);
  if (!raw) return [];
  const payload = verify(decodeURIComponent(raw));
  if (!payload) return [];
  try {
    const plays = JSON.parse(payload) as Play[];
    return Array.isArray(plays) ? plays : [];
  } catch {
    return [];
  }
}

/** Newest first, one entry per kind+ref, capped. */
export function upsertCookiePlay(plays: Play[], play: Play): Play[] {
  return [play, ...plays.filter((p) => !(p.kind === play.kind && p.ref === play.ref))].slice(0, MAX_PLAYS);
}

export function playCookieHeader(plays: Play[]): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const value = encodeURIComponent(sign(JSON.stringify(plays)));
  return `${PLAY_COOKIE}=${value}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax${secure}`;
}
