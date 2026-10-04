// Response shapes for WS7's own routes (/api/me, /api/profile). Client-safe types only.
import type { StatsSummary } from '@/lib/local-stats';
import type { LocalPlayRecord, RegionCode } from '@/lib/types';

export interface MeStats {
  daily: StatsSummary;
  vault: StatsSummary;
  pitch: StatsSummary;
  /** Finished plays recorded on the server for this profile (results only, never films). */
  records: LocalPlayRecord[];
}

export interface MeResponse {
  /** False in keyless mode: accounts are not available yet. */
  authConfigured: boolean;
  user: { id: string; email: string | null; isAdmin: boolean } | null;
  profile: { handle: string | null; region: RegionCode | null } | null;
  /** How this player appears on leaderboards (handle or "Extra #ABCD"). */
  boardName: string | null;
  stats: MeStats | null;
}

export interface ProfileUpdateRequest {
  handle?: string;
  region?: RegionCode | null;
}

export interface ProfileUpdateResponse {
  profile: { handle: string | null; region: RegionCode | null };
  boardName: string;
}
