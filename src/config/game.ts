// Game policy constants that the spec states in prose (Sections 4.8 to 4.10, 7, 9, 10, 12).
// RULES in ./rules.ts stays exactly as Section 4.3; everything else lives here. Never hardcode these.

/** Daily reset timezone (Section 4.10). */
export const RESET_TIMEZONE = 'America/New_York';

/**
 * Launch day, as a YYYY-MM-DD date in RESET_TIMEZONE. Reel No. = days since launch + 1.
 * Placeholder until the launch date is decided; override with NEXT_PUBLIC_LAUNCH_DATE.
 */
export const LAUNCH_DATE: string = process.env.NEXT_PUBLIC_LAUNCH_DATE || '2026-10-01';

/** Takes recorded for a loss when averaging (Section 4.9). */
export const LOSS_SCORE = 11;

/** Number of hint candidates stored per puzzle (Section 4.8). */
export const HINT_CANDIDATES_PER_PUZZLE = 3;

/** Pitch (custom challenge) rules (Sections 5, 8, 9). */
export const PITCH = {
  slugLength: 8,
  slugAlphabet: '0123456789abcdefghijklmnopqrstuvwxyz', // base36
  noteMaxLength: 140,
  noteUnlockAfter: 5, // takes
} as const;

/** Rate limits (Sections 9, 10). */
export const RATE_LIMITS = {
  guessPerMinutePerAnon: 30,
  guessPerMinutePerIp: 120,
  pitchPerHourPerAnon: 20,
} as const;

/** Scheduling rules (Section 12, WS8). */
export const SCHEDULING = {
  aheadDays: 60,
  repeatCooldownDays: 365,
} as const;

/** Leaderboard and anti-cheat (Sections 4.9, 10, 12 WS7). */
export const LEADERBOARD = {
  weeklyWindowDays: 7,
  weeklyMinDailies: 3,
  oneTakeWinsFlagCount: 2,     // flag if MORE than this many 1-take daily wins...
  oneTakeWinsWindowDays: 7,    // ...within this many days
  minMedianFirstGuessMs: 3000, // flag if median time-to-first-guess is under this
} as const;

/** Global stats cache window (Sections 7.3, 9). */
export const DAILY_STATS_CACHE_SECONDS = 60;

/** Search (Section 9). */
export const SEARCH = {
  minQueryLength: 2,
  maxResults: 10,
} as const;

/** Anonymous device id cookie (Section 10). httpOnly. */
export const ANON_COOKIE = 'gl_anon';

/** localStorage keys (client-side persistence contracts in src/lib/types.ts). */
export const STORAGE_KEYS = {
  settings: 'gl_settings',   // ClientSettings
  localStats: 'gl_stats',    // LocalStatsFile
  leaderSeen: 'gl_leader',   // YYYY-MM-DD of the last day the Leader intro played
} as const;
