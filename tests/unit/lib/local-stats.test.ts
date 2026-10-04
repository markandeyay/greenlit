import { describe, expect, it } from 'vitest';
import { summarize } from '@/lib/local-stats';
import type { LocalStatsFile } from '@/lib/types';

const rec = (ref: string, status: 'won' | 'lost', takes: number, hintsUsed = 0) => ({
  kind: 'daily' as const, ref, status, takes, hintsUsed, finishedAt: '2026-10-04T00:00:00Z',
});

describe('local stats summary', () => {
  it('covers takes 1 to 10 plus turnaround, streaks, and averages', () => {
    const file: LocalStatsFile = { v: 1, records: {} };
    for (const r of [rec('1', 'won', 3), rec('2', 'won', 10, 1), rec('3', 'lost', 10), rec('4', 'won', 1), rec('5', 'won', 4)]) {
      file.records[`daily:${r.ref}`] = r;
    }
    const s = summarize(file);
    expect(s.distribution).toHaveLength(11);
    expect(s.distribution[0]).toBe(1);
    expect(s.distribution[9]).toBe(1);
    expect(s.distribution[10]).toBe(1);
    expect(s.played).toBe(5);
    expect(s.wins).toBe(4);
    expect(s.currentStreak).toBe(2);
    expect(s.maxStreak).toBe(2);
    expect(s.averageTakes).toBe((3 + 10 + 11 + 1 + 4) / 5);
    expect(s.hintedPlays).toBe(1);
  });
});
