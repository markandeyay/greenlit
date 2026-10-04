// Sign-in completion (WS7, Section 10.8). SERVER ONLY.
// After the auth callback establishes a session: make sure the profile row exists, then attach
// every anonymous play from this device to the profile (repo.assignPlaysToProfile).
import 'server-only';
import { isRegionCode } from '@/config/regions';
import { isAnonId } from '@/lib/anon';
import type { RegionCode } from '@/lib/types';
import { getRepo } from '@/server/db';
import { ensureProfile } from '@/server/profile';

export interface SignInResult {
  profileCreated: boolean;
  mergedPlays: number;
}

export async function completeSignIn(
  userId: string,
  anonId: string | null,
  regionCookie: string | null = null,
): Promise<SignInResult> {
  const repo = getRepo();
  const before = await repo.getProfile(userId);
  const region: RegionCode | null = isRegionCode(regionCookie) ? regionCookie : null;
  const profile = before ?? (await ensureProfile(userId, region));
  // Carry a device region preference into a profile that has none yet.
  if (before && !before.region && region) {
    await repo.upsertProfile({ ...profile, region });
  }
  let mergedPlays = 0;
  if (anonId && isAnonId(anonId)) {
    mergedPlays = await repo.assignPlaysToProfile(anonId.toLowerCase(), userId);
  }
  return { profileCreated: !before, mergedPlays };
}

/** Only same-origin relative paths are allowed as post-sign-in destinations. */
export function safeNext(next: string | null | undefined, fallback = '/settings'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  if (next.startsWith('/auth/')) return fallback;
  return next;
}
