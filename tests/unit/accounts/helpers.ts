import type { Play, Profile } from '@/lib/types';

let seq = 0;

/** A finished daily play. `reel` is the puzzle number; times are derived from it. */
export function dailyPlay(
  profileId: string | null,
  reel: number,
  opts: Partial<Play> & { takes?: number | null; won?: boolean; hints?: number; firstGuessMs?: number } = {},
): Play {
  const { won = true, hints = 0, firstGuessMs = 30_000, ...rest } = opts;
  const started = new Date(Date.UTC(2026, 9, 1, 15) + reel * 86_400_000);
  const takes = rest.takes === undefined ? (won ? 4 : 10) : rest.takes;
  seq++;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    profileId,
    anonId: `10000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    kind: 'daily',
    ref: String(reel),
    guesses: Array.from({ length: takes ?? 0 }, (_, i) => 1000 + i),
    hintsUsed: Array.from({ length: hints }, () => 'tagline' as const),
    status: won ? 'won' : 'lost',
    takes,
    startedAt: started.toISOString(),
    firstGuessAt: new Date(started.getTime() + firstGuessMs).toISOString(),
    finishedAt: new Date(started.getTime() + 600_000).toISOString(),
    ...rest,
  };
}

export function profile(id: string, handle: string | null, extra: Partial<Profile> = {}): Profile {
  return { id, handle, region: null, flagged: false, flagReason: null, createdAt: '2026-10-01T00:00:00Z', ...extra };
}

export const A = 'aaaaaaaa-0000-4000-8000-000000000001';
export const B = 'bbbbbbbb-0000-4000-8000-000000000002';
export const C = 'cccccccc-0000-4000-8000-000000000003';
export const D = 'dddddddd-0000-4000-8000-000000000004';
