// The creator's own recent pitches, remembered on their device so "See how friends did" survives
// a reload. The creator chose these films, so keeping the title locally reveals nothing new.
// Proof of authorship is the httpOnly creator cookie (or the account), not this list.
import type { SearchResult } from '@/lib/types';

/** localStorage key (WS8-local; not one of the shared STORAGE_KEYS). */
export const RECENT_PITCHES_KEY = 'gl_pitches';
export const RECENT_PITCHES_MAX = 12;

export interface RecentPitch {
  slug: string;
  url: string;
  film: SearchResult;
  note: string | null;
  createdAt: string;
}

function isRecent(x: unknown): x is RecentPitch {
  const r = x as RecentPitch;
  return !!r && typeof r.slug === 'string' && typeof r.url === 'string' && !!r.film && typeof r.film.title === 'string';
}

export function readRecentPitches(storage: Pick<Storage, 'getItem'> | null = safeStorage()): RecentPitch[] {
  if (!storage) return [];
  try {
    const raw = JSON.parse(storage.getItem(RECENT_PITCHES_KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.filter(isRecent).slice(0, RECENT_PITCHES_MAX) : [];
  } catch {
    return [];
  }
}

export function saveRecentPitch(p: RecentPitch, storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeStorage()): RecentPitch[] {
  const next = [p, ...readRecentPitches(storage).filter((x) => x.slug !== p.slug)].slice(0, RECENT_PITCHES_MAX);
  try {
    storage?.setItem(RECENT_PITCHES_KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked: the in-memory list still works for this visit */
  }
  return next;
}

function safeStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}
