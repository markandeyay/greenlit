// Leaderboards (Sections 4.9, 9, 10.6, 12 WS7). SERVER ONLY.
//
// Rules (all thresholds from LEADERBOARD / LOSS_SCORE / RULES):
// - Only server-recorded plays with a profileId count, and only kind 'daily' (Section 10.6).
// - A play counts once it is finished (won or lost). If a profile somehow has two finished plays
//   for the same reel (anon merge from two devices), the earliest finish counts.
// - Score per play = takes on a win, LOSS_SCORE on a loss (Section 4.9).
// - week: reels whose New York date falls in the last LEADERBOARD.weeklyWindowDays days up to
//   today. A player needs at least LEADERBOARD.weeklyMinDailies finished dailies in that window.
//   Unplayed days do not count. Value = average score. Ties: more wins, then earlier finish
//   (the time the player's latest counted take finished), then handle.
// - all: average over every finished daily. Minimum: the same LEADERBOARD.weeklyMinDailies, so a
//   single lucky reel cannot top the board.
// - streak: current run of consecutive daily wins ending at today's or yesterday's reel. A loss or
//   a missed reel ends it. Ties: more wins overall, then earlier finish.
// - noNotes: plays that used any Script Note are dropped before any of the above (for streaks a
//   hinted day therefore breaks the run).
// - Anti-cheat (Section 10.6): a player is flagged when they have MORE than
//   LEADERBOARD.oneTakeWinsFlagCount one-take daily wins within any LEADERBOARD.oneTakeWinsWindowDays
//   consecutive reels, or when the median time to first guess (firstGuessAt - startedAt) over their
//   dailies is under LEADERBOARD.minMedianFirstGuessMs (needs MIN_FIRST_GUESS_SAMPLES samples).
//   Flagged players (computed or profile.flagged) are hidden from every board, never banned.
//   Newly computed flags are persisted with upsertProfile(flagged: true, flagReason).
// - Rows show the handle; players without one are billed as "Extra #ABCD" (boardName()).
// Rows carry handles and numbers only, never films.
import 'server-only';
import { LEADERBOARD, LOSS_SCORE } from '@/config/game';
import { RULES } from '@/config/rules';
import { boardName } from '@/components/account/handle-rules';
import { ALL_TIME_MIN_DAILIES, MAX_ROWS, MIN_FIRST_GUESS_SAMPLES } from '@/components/leaderboard/rules';
import { todayPuzzleNumber } from '@/lib/dates';
import type { LeaderboardPeriod, LeaderboardResponse, LeaderboardRow, Play, Profile } from '@/lib/types';
import { getRepo } from '@/server/db';

export { ALL_TIME_MIN_DAILIES, MIN_FIRST_GUESS_SAMPLES, MAX_ROWS };

export const LEADERBOARD_PERIODS: readonly LeaderboardPeriod[] = ['week', 'all', 'streak'];

export function isLeaderboardPeriod(v: unknown): v is LeaderboardPeriod {
  return typeof v === 'string' && (LEADERBOARD_PERIODS as readonly string[]).includes(v);
}

const reelOf = (p: Play): number => (/^\d+$/.test(p.ref) ? Number(p.ref) : NaN);
const isFinished = (p: Play) => p.status === 'won' || p.status === 'lost';
const timeOf = (iso: string | null | undefined) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
};

/** Score for one finished play: takes on a win, LOSS_SCORE on a loss. */
export function playScore(p: Play): number {
  if (p.status !== 'won') return LOSS_SCORE;
  const takes = p.takes ?? p.guesses.length;
  return Math.min(Math.max(takes, 1), RULES.maxGuesses);
}

/** Finished daily plays with a profile, one per profile and reel (earliest finish wins). */
export function eligibleDailies(plays: Play[], todayNumber: number): Play[] {
  const best = new Map<string, Play>();
  for (const p of plays) {
    if (p.kind !== 'daily' || !p.profileId || !isFinished(p)) continue;
    const n = reelOf(p);
    if (!Number.isFinite(n) || n < 1 || n > todayNumber) continue;
    const key = `${p.profileId}:${n}`;
    const prev = best.get(key);
    if (!prev || timeOf(p.finishedAt) < timeOf(prev.finishedAt)) best.set(key, p);
  }
  return [...best.values()];
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * Anti-cheat check for one player's daily plays. Returns a flag reason or null.
 * `plays` should be that player's daily plays (any status); one-take wins use finished ones.
 */
export function detectFlag(plays: Play[]): string | null {
  const oneTakeReels = plays
    .filter((p) => p.kind === 'daily' && p.status === 'won' && (p.takes ?? p.guesses.length) === 1)
    .map(reelOf)
    .filter(Number.isFinite);
  const reels = [...new Set(oneTakeReels)].sort((a, b) => a - b);
  for (let i = 0, j = 0; j < reels.length; j++) {
    while (reels[j]! - reels[i]! >= LEADERBOARD.oneTakeWinsWindowDays) i++;
    const count = j - i + 1;
    if (count > LEADERBOARD.oneTakeWinsFlagCount) {
      return `${count} one-take daily wins within ${LEADERBOARD.oneTakeWinsWindowDays} days`;
    }
  }

  const samples: number[] = [];
  for (const p of plays) {
    if (p.kind !== 'daily' || !p.firstGuessAt) continue;
    const ms = Date.parse(p.firstGuessAt) - Date.parse(p.startedAt);
    if (Number.isFinite(ms) && ms >= 0) samples.push(ms);
  }
  if (samples.length >= MIN_FIRST_GUESS_SAMPLES) {
    const m = median(samples);
    if (m < LEADERBOARD.minMedianFirstGuessMs) {
      return `median time to first guess ${(m / 1000).toFixed(1)}s (under ${LEADERBOARD.minMedianFirstGuessMs / 1000}s)`;
    }
  }
  return null;
}

/** Current consecutive daily win streak ending at today's or yesterday's reel. */
export function currentStreak(plays: Play[], todayNumber: number): number {
  const byReel = new Map<number, Play>();
  for (const p of plays) {
    const n = reelOf(p);
    if (Number.isFinite(n) && isFinished(p)) byReel.set(n, p);
  }
  let start = todayNumber;
  if (!byReel.has(start)) start = todayNumber - 1; // today not played yet: the run is still alive
  let streak = 0;
  for (let n = start; byReel.get(n)?.status === 'won'; n--) streak++;
  return streak;
}

export interface BuildInput {
  period: LeaderboardPeriod;
  noNotes: boolean;
  /** All plays to consider (any kind / status; filtered here). */
  plays: Play[];
  profiles: Profile[];
  todayNumber: number;
}

export interface BuildResult {
  rows: LeaderboardRow[];
  /** Flags computed in this pass, keyed by profile id (includes players already flagged). */
  flags: Map<string, string>;
}

interface Tally {
  profileId: string;
  name: string;
  played: number;
  wins: number;
  total: number;
  lastFinish: number;
  value: number;
}

function tally(profileId: string, name: string, plays: Play[]): Tally {
  let wins = 0;
  let total = 0;
  let lastFinish = 0;
  for (const p of plays) {
    if (p.status === 'won') wins++;
    total += playScore(p);
    const t = timeOf(p.finishedAt);
    if (Number.isFinite(t)) lastFinish = Math.max(lastFinish, t);
  }
  const played = plays.length;
  return { profileId, name, played, wins, total, lastFinish, value: played ? Math.round((total / played) * 100) / 100 : 0 };
}

/** Pure leaderboard computation. */
export function buildLeaderboard({ period, noNotes, plays, profiles, todayNumber }: BuildInput): BuildResult {
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  // Flags look at every daily play of the player, regardless of filters.
  const allByProfile = new Map<string, Play[]>();
  for (const p of plays) {
    if (p.kind !== 'daily' || !p.profileId) continue;
    (allByProfile.get(p.profileId) ?? allByProfile.set(p.profileId, []).get(p.profileId)!).push(p);
  }
  const flags = new Map<string, string>();
  for (const [id, list] of allByProfile) {
    const reason = detectFlag(list);
    if (reason) flags.set(id, reason);
  }
  const hidden = (id: string) => flags.has(id) || profileById.get(id)?.flagged === true;

  let counted = eligibleDailies(plays, todayNumber);
  if (noNotes) counted = counted.filter((p) => p.hintsUsed.length === 0);

  const byProfile = new Map<string, Play[]>();
  for (const p of counted) {
    if (hidden(p.profileId!)) continue;
    (byProfile.get(p.profileId!) ?? byProfile.set(p.profileId!, []).get(p.profileId!)!).push(p);
  }

  const nameOf = (id: string) => boardName(profileById.get(id) ?? { id, handle: null });
  const tallies: Tally[] = [];

  if (period === 'week') {
    const from = todayNumber - LEADERBOARD.weeklyWindowDays + 1;
    for (const [id, list] of byProfile) {
      const inWindow = list.filter((p) => reelOf(p) >= from);
      if (inWindow.length < LEADERBOARD.weeklyMinDailies) continue;
      tallies.push(tally(id, nameOf(id), inWindow));
    }
  } else if (period === 'all') {
    for (const [id, list] of byProfile) {
      if (list.length < ALL_TIME_MIN_DAILIES) continue;
      tallies.push(tally(id, nameOf(id), list));
    }
  } else {
    for (const [id, list] of byProfile) {
      const streak = currentStreak(list, todayNumber);
      if (streak < 1) continue;
      tallies.push({ ...tally(id, nameOf(id), list), value: streak });
    }
  }

  const byName = (a: Tally, b: Tally) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  tallies.sort((a, b) =>
    period === 'streak'
      ? b.value - a.value || b.wins - a.wins || a.lastFinish - b.lastFinish || byName(a, b)
      : a.value - b.value || b.wins - a.wins || a.lastFinish - b.lastFinish || byName(a, b),
  );

  const rows: LeaderboardRow[] = tallies.slice(0, MAX_ROWS).map((t, i) => ({
    rank: i + 1,
    handle: t.name,
    value: t.value,
    played: t.played,
    wins: t.wins,
  }));
  return { rows, flags };
}

/** Persist newly computed flags (best effort; never throws). */
async function persistFlags(flags: Map<string, string>, profiles: Profile[]): Promise<void> {
  if (flags.size === 0) return;
  const repo = getRepo();
  const byId = new Map(profiles.map((p) => [p.id, p]));
  await Promise.all(
    [...flags].map(async ([id, reason]) => {
      const existing = byId.get(id);
      if (existing?.flagged) return;
      try {
        await repo.upsertProfile({
          id,
          handle: existing?.handle ?? null,
          region: existing?.region ?? null,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          flagged: true,
          flagReason: reason,
        });
      } catch (err) {
        console.error('[leaderboard] could not persist flag', err);
      }
    }),
  );
}

/** GET /api/leaderboard backing function. */
export async function getLeaderboard(
  period: LeaderboardPeriod,
  noNotes: boolean,
  now: Date = new Date(),
): Promise<LeaderboardResponse> {
  const repo = getRepo();
  const plays = (await repo.listPlays({ kind: 'daily' })).filter((p) => p.profileId);
  const ids = [...new Set(plays.map((p) => p.profileId!))];
  const profiles = ids.length ? await repo.listProfiles(ids) : [];
  const { rows, flags } = buildLeaderboard({ period, noNotes, plays, profiles, todayNumber: todayPuzzleNumber(now) });
  await persistFlags(flags, profiles);
  return { period, noNotes, rows };
}
