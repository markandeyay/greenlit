// Leaderboard policy derived from LEADERBOARD (src/config/game.ts). Client-safe, shared by the
// server computation (src/server/leaderboard.ts) and the page microcopy.
import { LEADERBOARD, LOSS_SCORE } from '@/config/game';
import type { LeaderboardPeriod } from '@/lib/types';

/** All-time board minimum: the weekly minimum, reused so there is one knob. */
export const ALL_TIME_MIN_DAILIES = LEADERBOARD.weeklyMinDailies;
/** Median first-guess time needs this many samples before it can flag anyone. */
export const MIN_FIRST_GUESS_SAMPLES = LEADERBOARD.weeklyMinDailies;
/** Display cap for a board (not a game rule). */
export const MAX_ROWS = 100;

export const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  week: 'Weekly',
  all: 'All time',
  streak: 'Streaks',
};

/** Explanatory microcopy for each board. */
export function periodBlurb(period: LeaderboardPeriod): string {
  if (period === 'week') {
    return `Average takes over the last ${LEADERBOARD.weeklyWindowDays} daily reels. Wrap at least ${LEADERBOARD.weeklyMinDailies} of them to make the credits; days you skip do not count against you. A turnaround counts as ${LOSS_SCORE}. Lowest average wins.`;
  }
  if (period === 'all') {
    return `Average takes over every daily reel you have wrapped, with a minimum of ${ALL_TIME_MIN_DAILIES}. A turnaround counts as ${LOSS_SCORE}. Lowest average wins.`;
  }
  return 'Current run of daily reels greenlit in a row. A turnaround or a missed day resets it to zero.';
}

export function valueHeading(period: LeaderboardPeriod): string {
  return period === 'streak' ? 'Streak' : 'Avg takes';
}

export function formatValue(period: LeaderboardPeriod, value: number): string {
  return period === 'streak' ? String(value) : value.toFixed(2);
}
