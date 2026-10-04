import { describe, expect, it } from 'vitest';
import { LOSS_SCORE } from '@/config/game';
import { RULES } from '@/config/rules';
import { summarize } from '@/lib/local-stats';
import type { LocalPlayRecord } from '@/lib/types';
import { distributionRows, mergeRecords, turnaroundLabel } from '@/components/stats/stats-model';
import { statsFromPlays } from '@/server/profile';
import { A, dailyPlay } from './helpers';

const rec = (ref: string, status: 'won' | 'lost', takes: number, extra: Partial<LocalPlayRecord> = {}): LocalPlayRecord => ({
  kind: 'daily',
  ref,
  status,
  takes,
  hintsUsed: 0,
  finishedAt: `2026-10-${ref.padStart(2, '0')}T12:00:00Z`,
  ...extra,
});

describe('stats distribution', () => {
  it('covers takes 1 to 10 plus a Sent to turnaround bucket', () => {
    const rows = distributionRows(Array(RULES.maxGuesses + 1).fill(0));
    expect(rows).toHaveLength(RULES.maxGuesses + 1);
    expect(rows.slice(0, RULES.maxGuesses).map((r) => r.label)).toEqual(
      Array.from({ length: RULES.maxGuesses }, (_, i) => `Take ${i + 1}`),
    );
    expect(rows[RULES.maxGuesses]).toMatchObject({ key: 'turnaround', isTurnaround: true });
    expect(turnaroundLabel()).toBe('Sent to turnaround');
  });

  it('places wins at 1..10 and losses in turnaround, with bar shares', () => {
    const file = mergeRecords([rec('1', 'won', 1), rec('2', 'won', 10), rec('3', 'lost', 10), rec('4', 'won', 10)]);
    const s = summarize(file);
    const rows = distributionRows(s.distribution);
    expect(rows[0]!.count).toBe(1);
    expect(rows[9]!.count).toBe(2);
    expect(rows[10]!.count).toBe(1);
    expect(rows[9]!.share).toBe(1);
    expect(rows[0]!.share).toBe(0.5);
    expect(s.averageTakes).toBe((1 + 10 + LOSS_SCORE + 10) / 4);
  });

  it('merges device and account records, keeping the earliest finish per reel', () => {
    const device = [rec('5', 'won', 3, { finishedAt: '2026-10-05T10:00:00Z' })];
    const account = [rec('5', 'lost', 10, { finishedAt: '2026-10-05T11:00:00Z' }), rec('6', 'won', 2)];
    const file = mergeRecords(device, account);
    expect(Object.keys(file.records).sort()).toEqual(['daily:5', 'daily:6']);
    expect(file.records['daily:5']!.status).toBe('won');
  });

  it('server stats summarize plays per kind (vault and pitch tallied separately)', () => {
    const plays = [
      dailyPlay(A, 1, { takes: 2 }),
      dailyPlay(A, 2, { won: false, hints: 2 }),
      dailyPlay(A, 3, { kind: 'vault', takes: 5 }),
      dailyPlay(A, 4, { kind: 'pitch', ref: 'k3x9q2ab', takes: 7 }),
      dailyPlay(A, 5, { status: 'in_progress', takes: null, finishedAt: null }),
    ];
    const s = statsFromPlays(plays);
    expect(s.daily).toMatchObject({ played: 2, wins: 1, hintedPlays: 1 });
    expect(s.daily.distribution[1]).toBe(1);
    expect(s.daily.distribution[RULES.maxGuesses]).toBe(1);
    expect(s.vault).toMatchObject({ played: 1, wins: 1 });
    expect(s.pitch).toMatchObject({ played: 1, wins: 1 });
    expect(s.records).toHaveLength(4);
    expect(JSON.stringify(s)).not.toMatch(/guesses|filmId/);
  });
});
