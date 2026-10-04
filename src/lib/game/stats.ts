// Post-game stats line (Section 7.3). Pure helpers over DailyStatsResponse.
import { RULES } from '@/config/rules';
import type { DailyStatsResponse, PlayStatus } from '@/lib/types';

/** Distribution bucket: 0..maxGuesses-1 = won in 1..maxGuesses takes, maxGuesses = turnaround. */
export function bucketFor(status: Exclude<PlayStatus, 'in_progress'>, takes: number): number {
  if (status === 'lost') return RULES.maxGuesses;
  return Math.min(Math.max(takes, 1), RULES.maxGuesses) - 1;
}

export interface StatsView {
  distribution: number[];
  plays: number;
  wins: number;
}

/**
 * Normalize server stats and make sure the player's own result is counted (aggregates are cached,
 * so a fresh finish may not be in them yet).
 */
export function withSelf(stats: DailyStatsResponse | null, bucket: number): StatsView {
  const size = RULES.maxGuesses + 1;
  const distribution = Array.from({ length: size }, (_, i) => Math.max(0, stats?.distribution?.[i] ?? 0));
  let plays = Math.max(stats?.plays ?? 0, distribution.reduce((a, b) => a + b, 0));
  let wins = Math.max(stats?.wins ?? 0, distribution.slice(0, RULES.maxGuesses).reduce((a, b) => a + b, 0));
  if (distribution[bucket] === 0) {
    distribution[bucket] = 1;
    plays += 1;
    if (bucket < RULES.maxGuesses) wins += 1;
  }
  return { distribution, plays, wins };
}

/**
 * "You beat N% of players today": share of OTHER players with a strictly worse result.
 * null when nobody else has finished yet, or the player did not win.
 */
export function beatPercent(view: StatsView, bucket: number): number | null {
  if (bucket >= RULES.maxGuesses) return null;
  const others = view.plays - 1;
  if (others <= 0) return null;
  const worse = view.distribution.slice(bucket + 1).reduce((a, b) => a + b, 0);
  return Math.max(0, Math.min(100, Math.round((worse / others) * 100)));
}
