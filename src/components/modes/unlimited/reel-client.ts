// Client helpers for the Dailies Reel (Unlimited, WS9): the current reel kept on this device so a
// reload resumes it, and the call that deals a new reel. Client-safe: the ref is opaque, so
// storing it reveals nothing. Every storage access is wrapped (private mode never crashes).
import { UNLIMITED, type UnlimitedBand } from '@/config/modes';
import { GameApiError } from '@/lib/game/api';
import type { ApiError, PlayStateResponse } from '@/lib/types';

export const REEL_STORAGE_KEY = 'gl_unlimited';

export interface StoredReel {
  ref: string;
  band: UnlimitedBand;
}

export const BANDS = Object.keys(UNLIMITED.bands) as UnlimitedBand[];

export function isBand(v: unknown): v is UnlimitedBand {
  return typeof v === 'string' && (BANDS as string[]).includes(v);
}

export function readStoredReel(storage: Pick<Storage, 'getItem'> | undefined = safeStorage()): StoredReel | null {
  try {
    const raw = storage?.getItem(REEL_STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<StoredReel>;
    if (typeof v.ref !== 'string' || !/^[A-Za-z0-9_-]{1,512}$/.test(v.ref) || !isBand(v.band)) return null;
    return { ref: v.ref, band: v.band };
  } catch {
    return null;
  }
}

export function writeStoredReel(reel: StoredReel | null, storage: Pick<Storage, 'setItem' | 'removeItem'> | undefined = safeStorage()): void {
  try {
    if (reel) storage?.setItem(REEL_STORAGE_KEY, JSON.stringify(reel));
    else storage?.removeItem(REEL_STORAGE_KEY);
  } catch {
    /* storage unavailable: the reel simply does not survive a reload */
  }
}

function safeStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/** A fresh, empty play for a just-dealt reel (no request needed to paint the board). */
export function emptyPlay(ref: string): PlayStateResponse {
  return { kind: 'unlimited', ref, status: 'in_progress', take: 0, feedback: [], hints: [] };
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function toError(res: Response, body: unknown): GameApiError {
  const err = (body as ApiError | null)?.error;
  if (err && typeof err.code === 'string') return new GameApiError(err.code, err.message, res.status);
  return new GameApiError(res.status === 429 ? 'rate_limited' : 'internal', `Request failed (${res.status})`, res.status);
}

/** POST /api/modes/unlimited/new. Returns the opaque ref of a fresh reel. */
export async function dealReel(band: UnlimitedBand, after: string | null, fetcher: typeof fetch = fetch): Promise<string> {
  let res: Response;
  try {
    res = await fetcher('/api/modes/unlimited/new', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(after ? { band, after } : { band }),
    });
  } catch {
    throw new GameApiError('network', 'Network error', 0);
  }
  const body = await readJson(res);
  if (!res.ok) throw toError(res, body);
  const ref = (body as { ref?: unknown } | null)?.ref;
  if (typeof ref !== 'string' || !ref) throw new GameApiError('internal', 'Bad response', res.status);
  return ref;
}

/** GET /api/play for a stored reel, or null when the reel no longer resolves (404 / 400). */
export async function resumeReel(ref: string, fetcher: typeof fetch = fetch): Promise<PlayStateResponse | null> {
  let res: Response;
  try {
    res = await fetcher(`/api/play?kind=unlimited&ref=${encodeURIComponent(ref)}`, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new GameApiError('network', 'Network error', 0);
  }
  const body = await readJson(res);
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw toError(res, body);
  return body as PlayStateResponse;
}
