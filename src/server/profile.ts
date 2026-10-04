// Profiles and synced stats (WS7). SERVER ONLY.
import 'server-only';
import { boardName, validateHandle } from '@/components/account/handle-rules';
import type { MeResponse, MeStats, ProfileUpdateResponse } from '@/components/account/types';
import { isRegionCode } from '@/config/regions';
import { summarize } from '@/lib/local-stats';
import { isAuthConfigured } from '@/lib/supabase/config';
import type { LocalPlayRecord, LocalStatsFile, Play, Profile, RegionCode } from '@/lib/types';
import type { SessionUser } from '@/server/auth';
import { getRepo } from '@/server/db';
import { ApiFailure } from '@/server/http';

export function emptyProfile(id: string, region: RegionCode | null = null): Profile {
  return { id, handle: null, region, flagged: false, flagReason: null, createdAt: new Date().toISOString() };
}

/** Load the profile row, creating it when missing (the DB trigger usually does this first). */
export async function ensureProfile(id: string, region: RegionCode | null = null): Promise<Profile> {
  const repo = getRepo();
  const existing = await repo.getProfile(id);
  if (existing) return existing;
  const created = emptyProfile(id, region);
  await repo.upsertProfile(created);
  return created;
}

const CLASSIC_KINDS = new Set<Play['kind']>(['daily', 'vault', 'pitch', 'unlimited']);

/** Finished plays as LocalPlayRecords, so the same summarize() powers local and synced stats. */
export function playsToRecords(plays: Play[]): LocalPlayRecord[] {
  const out: LocalPlayRecord[] = [];
  for (const p of plays) {
    if (p.status !== 'won' && p.status !== 'lost') continue;
    // Mode plays (Opening Weekend scores, Casting Call chains...) have different take semantics.
    if (!CLASSIC_KINDS.has(p.kind)) continue;
    out.push({
      kind: p.kind,
      ref: p.ref,
      status: p.status,
      takes: p.takes ?? p.guesses.length,
      hintsUsed: p.hintsUsed.length,
      finishedAt: p.finishedAt ?? p.startedAt,
    });
  }
  return out;
}

export function statsFromPlays(plays: Play[]): MeStats {
  const records = playsToRecords(plays);
  const file: LocalStatsFile = { v: 1, records: {} };
  for (const r of records) {
    const key = `${r.kind}:${r.ref}`;
    const prev = file.records[key];
    if (!prev || r.finishedAt < prev.finishedAt) file.records[key] = r;
  }
  return {
    daily: summarize(file, 'daily'),
    vault: summarize(file, 'vault'),
    pitch: summarize(file, 'pitch'),
    records: Object.values(file.records),
  };
}

/** Body of GET /api/me. */
export async function getMe(user: SessionUser | null): Promise<MeResponse> {
  const base: MeResponse = { authConfigured: isAuthConfigured(), user: null, profile: null, boardName: null, stats: null };
  if (!user) return base;
  const repo = getRepo();
  const profile = (await repo.getProfile(user.id)) ?? emptyProfile(user.id);
  const plays = await repo.listPlays({ profileId: user.id });
  return {
    ...base,
    user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
    profile: { handle: profile.handle, region: profile.region },
    boardName: boardName(profile),
    stats: statsFromPlays(plays),
  };
}

/** PATCH /api/profile: update handle and / or region. Throws ApiFailure with friendly messages. */
export async function updateProfile(
  userId: string,
  patch: { handle?: unknown; region?: unknown },
): Promise<ProfileUpdateResponse> {
  const repo = getRepo();
  const profile = await ensureProfile(userId);
  const next: Profile = { ...profile };

  if (patch.handle !== undefined) {
    const check = validateHandle(patch.handle);
    if (!check.ok) throw new ApiFailure('bad_request', check.message);
    if (check.handle !== profile.handle) {
      let taken: Profile | null = null;
      try {
        taken = await repo.getProfileByHandle(check.handle);
      } catch {
        taken = null;
      }
      if (taken && taken.id !== userId && taken.handle?.toLowerCase() === check.handle.toLowerCase()) {
        throw new ApiFailure('bad_request', 'That handle is already on the call sheet. Try another.', 409);
      }
    }
    next.handle = check.handle;
  }

  if (patch.region !== undefined) {
    if (patch.region !== null && !isRegionCode(patch.region)) throw new ApiFailure('bad_request', 'Unknown region.');
    next.region = patch.region;
  }

  try {
    await repo.upsertProfile(next);
  } catch (err) {
    // A unique violation that slipped past the check above (race between two sign-ups).
    const msg = err instanceof Error ? err.message : String(err);
    if (/duplicate|unique/i.test(msg)) {
      throw new ApiFailure('bad_request', 'That handle is already on the call sheet. Try another.', 409);
    }
    throw err;
  }
  return { profile: { handle: next.handle, region: next.region }, boardName: boardName(next) };
}
