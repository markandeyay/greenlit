import { describe, expect, it } from 'vitest';
import { createFixtureRepo } from '@/server/db';
import { buildDefaultSchedule } from '@/server/db/seed';
import lib from '@/server/db/fixtures/library.json';
import type { LibrarySnapshot } from '@/server/db';

describe('fixture repo', () => {
  it('schedules every day from launch with 3 hints, deterministically', () => {
    const now = new Date('2026-10-04T12:00:00Z');
    const a = buildDefaultSchedule(lib as LibrarySnapshot, { now, launch: '2026-10-01' });
    const b = buildDefaultSchedule(lib as LibrarySnapshot, { now, launch: '2026-10-01' });
    expect(a).toEqual(b);
    expect(a[0]!.date).toBe('2026-10-01');
    expect(a.length).toBe(4 + 60);
    for (const p of a) {
      expect(p.hints).toHaveLength(3);
      expect(p.hints[0]!.type).not.toBe('first_letter');
    }
  });
  it('searches, saves plays, and records stats', async () => {
    const repo = createFixtureRepo();
    expect((await repo.searchFilms('dark', 5))[0]!.title).toBe('The Dark Knight');
    const play = {
      id: 'p1', profileId: null, anonId: 'a1', kind: 'daily' as const, ref: '1', guesses: [155],
      hintsUsed: [], status: 'in_progress' as const, takes: null, startedAt: new Date().toISOString(),
      firstGuessAt: null, finishedAt: null,
    };
    await repo.savePlay(play);
    await expect(repo.savePlay({ ...play, id: 'p2' })).rejects.toThrow();
    expect((await repo.getPlay('a1', 'daily', '1'))?.guesses).toEqual([155]);
    expect(await repo.assignPlaysToProfile('a1', 'u1')).toBe(1);
    await repo.recordDailyResult(1, 3);
    await repo.recordDailyResult(1, null);
    const st = await repo.getDailyStats(1);
    expect(st?.distribution[2]).toBe(1);
    expect(st?.distribution[10]).toBe(1);
    expect(st?.plays).toBe(2);
  });
});
