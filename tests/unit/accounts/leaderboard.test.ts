import { afterEach, describe, expect, it } from 'vitest';
import { LEADERBOARD, LOSS_SCORE } from '@/config/game';
import { RULES } from '@/config/rules';
import { dateForPuzzleNumber } from '@/lib/dates';
import {
  buildLeaderboard,
  currentStreak,
  detectFlag,
  eligibleDailies,
  getLeaderboard,
  playScore,
} from '@/server/leaderboard';
import { createFixtureRepo, setRepoForTesting } from '@/server/db';
import { GET } from '@/app/api/leaderboard/route';
import { A, B, C, D, dailyPlay, profile } from './helpers';

const TODAY = 40;
const profiles = [profile(A, 'alice'), profile(B, 'bob'), profile(C, 'cara'), profile(D, null)];
const build = (plays: ReturnType<typeof dailyPlay>[], period: 'week' | 'all' | 'streak' = 'week', noNotes = false) =>
  buildLeaderboard({ period, noNotes, plays, profiles, todayNumber: TODAY });

describe('scoring', () => {
  it('counts a loss as LOSS_SCORE (11) and a win as its takes', () => {
    expect(LOSS_SCORE).toBe(11);
    expect(playScore(dailyPlay(A, 1, { won: false }))).toBe(LOSS_SCORE);
    expect(playScore(dailyPlay(A, 1, { takes: 3 }))).toBe(3);
    expect(playScore(dailyPlay(A, 1, { takes: RULES.maxGuesses }))).toBe(RULES.maxGuesses);
  });

  it('only counts finished daily plays with a profile, one per reel (earliest finish)', () => {
    const first = dailyPlay(A, 38, { takes: 2, finishedAt: '2026-11-07T10:00:00Z' });
    const dupe = dailyPlay(A, 38, { takes: 9, finishedAt: '2026-11-07T12:00:00Z' });
    const plays = [
      first,
      dupe,
      dailyPlay(null, 38),
      dailyPlay(A, 37, { status: 'in_progress', takes: null, finishedAt: null }),
      dailyPlay(A, 36, { kind: 'vault' }),
      dailyPlay(A, TODAY + 1),
    ];
    const out = eligibleDailies(plays, TODAY);
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe(first.id);
  });
});

describe('weekly board (3 of 7, loss = 11)', () => {
  it('requires weeklyMinDailies finished dailies inside the weeklyWindowDays window', () => {
    expect(LEADERBOARD.weeklyMinDailies).toBe(3);
    expect(LEADERBOARD.weeklyWindowDays).toBe(7);
    const windowStart = TODAY - LEADERBOARD.weeklyWindowDays + 1; // 34
    const plays = [
      // alice: 3 in window -> qualifies
      dailyPlay(A, TODAY, { takes: 2 }),
      dailyPlay(A, TODAY - 2, { takes: 4 }),
      dailyPlay(A, windowStart, { takes: 3 }),
      // bob: only 2 in window (third is one day too old) -> excluded
      dailyPlay(B, TODAY, { takes: 1 + 1 }),
      dailyPlay(B, TODAY - 1, { takes: 2 }),
      dailyPlay(B, windowStart - 1, { takes: 2 }),
    ];
    const { rows } = build(plays);
    expect(rows.map((r) => r.handle)).toEqual(['alice']);
    expect(rows[0]).toMatchObject({ rank: 1, value: 3, played: 3, wins: 3 });
  });

  it('averages with a loss counted as 11 and ignores unplayed days', () => {
    const plays = [
      dailyPlay(A, TODAY, { takes: 2 }),
      dailyPlay(A, TODAY - 3, { won: false }),
      dailyPlay(A, TODAY - 6, { takes: 5 }),
    ];
    const { rows } = build(plays);
    expect(rows[0]!.value).toBeCloseTo((2 + LOSS_SCORE + 5) / 3, 2);
    expect(rows[0]!.played).toBe(3);
    expect(rows[0]!.wins).toBe(2);
  });

  it('ranks by lowest average, then more wins, then earlier finish', () => {
    const plays = [
      // alice: avg 4
      ...[TODAY, TODAY - 1, TODAY - 2].map((n) => dailyPlay(A, n, { takes: 4 })),
      // bob: (1 + 11 + 1) / 3 = 4.33
      dailyPlay(B, TODAY, { takes: 1 }),
      dailyPlay(B, TODAY - 1, { won: false }),
      dailyPlay(B, TODAY - 2, { takes: 1 }),
      // cara: avg 3
      ...[TODAY, TODAY - 1, TODAY - 2].map((n) => dailyPlay(C, n, { takes: 3 })),
    ];
    const { rows } = build(plays);
    expect(rows.map((r) => r.handle)).toEqual(['cara', 'alice', 'bob']);

    // Same average, more wins first.
    const tie = [
      ...[TODAY, TODAY - 1, TODAY - 2].map((n) => dailyPlay(A, n, { takes: 5 })), // 15 / 3, 3 wins
      dailyPlay(B, TODAY, { takes: 2 }),
      dailyPlay(B, TODAY - 1, { takes: 2 }),
      dailyPlay(B, TODAY - 2, { won: false }), // (2 + 2 + 11) / 3 = 5, 2 wins
    ];
    expect(build(tie).rows.map((r) => r.handle)).toEqual(['alice', 'bob']);

    // Same average and wins: earlier finish first.
    const early = [TODAY, TODAY - 1, TODAY - 2].map((n) => dailyPlay(A, n, { takes: 4, finishedAt: `2026-11-0${n - 37}T09:00:00Z` }));
    const late = [TODAY, TODAY - 1, TODAY - 2].map((n) => dailyPlay(B, n, { takes: 4, finishedAt: `2026-11-0${n - 37}T23:00:00Z` }));
    expect(build([...late, ...early]).rows.map((r) => r.handle)).toEqual(['alice', 'bob']);
  });

  it('bills players without a handle as an Extra', () => {
    const plays = [TODAY, TODAY - 1, TODAY - 2].map((n) => dailyPlay(D, n, { takes: 4 }));
    expect(build(plays).rows[0]!.handle).toBe('Extra #DDDD');
  });

  it('never exposes films, only handle and numbers', () => {
    const plays = [TODAY, TODAY - 1, TODAY - 2].map((n) => dailyPlay(A, n, { takes: 4 }));
    const row = build(plays).rows[0]!;
    expect(Object.keys(row).sort()).toEqual(['handle', 'played', 'rank', 'value', 'wins']);
  });
});

describe('no notes filter', () => {
  it('drops plays that used Script Notes before applying the minimum', () => {
    const plays = [
      dailyPlay(A, TODAY, { takes: 2 }),
      dailyPlay(A, TODAY - 1, { takes: 2 }),
      dailyPlay(A, TODAY - 2, { takes: 2, hints: 1 }),
      dailyPlay(B, TODAY, { takes: 6 }),
      dailyPlay(B, TODAY - 1, { takes: 6 }),
      dailyPlay(B, TODAY - 2, { takes: 6 }),
    ];
    expect(build(plays, 'week', false).rows.map((r) => r.handle)).toEqual(['alice', 'bob']);
    expect(build(plays, 'week', true).rows.map((r) => r.handle)).toEqual(['bob']);
  });
});

describe('all time board', () => {
  it('averages every finished daily with a minimum of 3', () => {
    const plays = [
      dailyPlay(A, 2, { takes: 2 }),
      dailyPlay(A, 10, { takes: 4 }),
      dailyPlay(A, 20, { won: false }),
      dailyPlay(B, 5, { takes: 1 }),
      dailyPlay(B, 6, { takes: 1 }),
    ];
    const { rows } = build(plays, 'all');
    expect(rows.map((r) => r.handle)).toEqual(['alice']);
    expect(rows[0]!.value).toBeCloseTo((2 + 4 + LOSS_SCORE) / 3, 2);
  });
});

describe('streaks', () => {
  it('counts consecutive daily wins ending today or yesterday', () => {
    const won = (n: number) => dailyPlay(A, n);
    expect(currentStreak([won(TODAY), won(TODAY - 1), won(TODAY - 2)], TODAY)).toBe(3);
    // Today not played yet: still alive.
    expect(currentStreak([won(TODAY - 1), won(TODAY - 2)], TODAY)).toBe(2);
    // A missed day breaks it.
    expect(currentStreak([won(TODAY), won(TODAY - 2)], TODAY)).toBe(1);
    // Last played two days ago: no current streak.
    expect(currentStreak([won(TODAY - 2), won(TODAY - 3)], TODAY)).toBe(0);
    // A loss today ends it.
    expect(currentStreak([dailyPlay(A, TODAY, { won: false }), won(TODAY - 1)], TODAY)).toBe(0);
  });

  it('ranks the streak board and hides players with no live streak', () => {
    const plays = [
      ...[TODAY, TODAY - 1, TODAY - 2, TODAY - 3].map((n) => dailyPlay(A, n)),
      ...[TODAY, TODAY - 1].map((n) => dailyPlay(B, n)),
      dailyPlay(C, TODAY, { won: false }),
    ];
    const { rows } = build(plays, 'streak');
    expect(rows.map((r) => [r.handle, r.value])).toEqual([
      ['alice', 4],
      ['bob', 2],
    ]);
  });

  it('with no notes, a hinted win breaks the run', () => {
    const plays = [dailyPlay(A, TODAY), dailyPlay(A, TODAY - 1, { hints: 1 }), dailyPlay(A, TODAY - 2)];
    expect(build(plays, 'streak', false).rows[0]!.value).toBe(3);
    expect(build(plays, 'streak', true).rows[0]!.value).toBe(1);
  });
});

describe('anti-cheat flags (Section 10.6)', () => {
  const fair = (id: string) => [TODAY, TODAY - 1, TODAY - 2].map((n) => dailyPlay(id, n, { takes: 4 }));

  it('flags more than oneTakeWinsFlagCount one-take wins within the window', () => {
    const n = LEADERBOARD.oneTakeWinsFlagCount;
    const ok = Array.from({ length: n }, (_, i) => dailyPlay(A, TODAY - i, { takes: 1 }));
    expect(detectFlag(ok)).toBeNull();
    const bad = Array.from({ length: n + 1 }, (_, i) => dailyPlay(A, TODAY - i, { takes: 1 }));
    expect(detectFlag(bad)).toMatch(/one-take/);
    // Spread wider than the window: fine.
    const spread = Array.from({ length: n + 1 }, (_, i) => dailyPlay(A, TODAY - i * LEADERBOARD.oneTakeWinsWindowDays, { takes: 1 }));
    expect(detectFlag(spread)).toBeNull();
  });

  it('flags a median time to first guess under minMedianFirstGuessMs', () => {
    const fast = LEADERBOARD.minMedianFirstGuessMs - 1000;
    const slow = LEADERBOARD.minMedianFirstGuessMs + 5000;
    expect(detectFlag([TODAY, TODAY - 1, TODAY - 2].map((n) => dailyPlay(A, n, { firstGuessMs: fast })))).toMatch(
      /median/,
    );
    expect(
      detectFlag([
        dailyPlay(A, TODAY, { firstGuessMs: fast }),
        dailyPlay(A, TODAY - 1, { firstGuessMs: slow }),
        dailyPlay(A, TODAY - 2, { firstGuessMs: slow }),
      ]),
    ).toBeNull();
  });

  it('hides flagged players (computed or profile.flagged) from every board', () => {
    const cheater = Array.from({ length: LEADERBOARD.oneTakeWinsFlagCount + 1 }, (_, i) =>
      dailyPlay(B, TODAY - i, { takes: 1 }),
    );
    const speedy = [TODAY, TODAY - 1, TODAY - 2].map((n) => dailyPlay(C, n, { takes: 5, firstGuessMs: 500 }));
    const plays = [...fair(A), ...cheater, ...speedy, ...fair(D)];
    const flaggedProfiles = [profile(A, 'alice'), profile(B, 'bob'), profile(C, 'cara'), profile(D, 'dana', { flagged: true })];
    for (const period of ['week', 'all', 'streak'] as const) {
      const { rows, flags } = buildLeaderboard({ period, noNotes: false, plays, profiles: flaggedProfiles, todayNumber: TODAY });
      expect(rows.map((r) => r.handle)).toEqual(['alice']);
      expect([...flags.keys()].sort()).toEqual([B, C]);
    }
  });
});

describe('getLeaderboard + GET /api/leaderboard', () => {
  afterEach(() => setRepoForTesting(undefined));

  const NOW = new Date('2026-11-09T18:00:00Z');

  async function seed() {
    const repo = createFixtureRepo(undefined, NOW);
    setRepoForTesting(repo);
    const { todayPuzzleNumber } = await import('@/lib/dates');
    const today = todayPuzzleNumber(NOW);
    expect(dateForPuzzleNumber(today)).toBe('2026-11-09');
    await repo.upsertProfile(profile(A, 'alice'));
    await repo.upsertProfile(profile(B, 'bob'));
    for (const n of [today, today - 1, today - 2]) await repo.savePlay(dailyPlay(A, n, { takes: 3 }));
    for (let i = 0; i <= LEADERBOARD.oneTakeWinsFlagCount; i++) await repo.savePlay(dailyPlay(B, today - i, { takes: 1 }));
    return repo;
  }

  it('reads server plays, hides and persists flags', async () => {
    const repo = await seed();
    const board = await getLeaderboard('week', false, NOW);
    expect(board).toMatchObject({ period: 'week', noNotes: false });
    expect(board.rows.map((r) => r.handle)).toEqual(['alice']);
    const bob = await repo.getProfile(B);
    expect(bob?.flagged).toBe(true);
    expect(bob?.flagReason).toMatch(/one-take/);
    expect((await repo.getProfile(A))?.flagged).toBe(false);
  });

  it('route validates input and caches for 60s', async () => {
    await seed();
    const bad = await GET(new Request('http://x/api/leaderboard?period=month'));
    expect(bad.status).toBe(400);
    const badBool = await GET(new Request('http://x/api/leaderboard?period=week&noNotes=maybe'));
    expect(badBool.status).toBe(400);
    const ok = await GET(new Request('http://x/api/leaderboard?period=all&noNotes=true'));
    expect(ok.status).toBe(200);
    expect(ok.headers.get('cache-control')).toContain('s-maxage=60');
    const body = await ok.json();
    expect(body).toMatchObject({ period: 'all', noNotes: true });
  });
});
