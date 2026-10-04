// Public daily aggregates (Sections 7.3, 9). Only released puzzles (1 <= n <= today).
import 'server-only';
import { getRepo } from '@/server/db';
import { ApiFailure } from '@/server/http';
import { isReleasedPuzzleNumber } from '@/server/puzzles';
import type { DailyStatsResponse } from '@/lib/types';

export const DISTRIBUTION_LENGTH = 11;

export async function getDailyStatsPublic(n: number, now: Date = new Date()): Promise<DailyStatsResponse> {
  if (!isReleasedPuzzleNumber(n, now)) throw new ApiFailure('not_found', 'Puzzle not found.');
  const stats = await getRepo().getDailyStats(n);
  const distribution = Array.from({ length: DISTRIBUTION_LENGTH }, (_, i) => stats?.distribution[i] ?? 0);
  return { puzzleNumber: n, distribution, plays: stats?.plays ?? 0, wins: stats?.wins ?? 0 };
}
