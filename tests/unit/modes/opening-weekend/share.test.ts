import { describe, expect, it } from 'vitest';
import { APP_NAME } from '@/config/brand';
import { OW_GRID_MAX, owArtifact, shareText } from '@/components/modes/opening-weekend/share';
import { checkArtifactCard, toCard } from '@/components/share/artifactCodec';

const BASE = 'https://example.test';

describe('Opening Weekend share artifact', () => {
  it('daily run ended on a wrong pick: streak stat, matches then a miss', () => {
    const a = owArtifact(3, 'daily', '2026-10-04', 'wrong', BASE);
    expect(a).toMatchObject({
      mode: 'opening_weekend',
      reelNumber: null,
      date: '2026-10-04',
      outcome: 'score',
      stat: '3',
      statCaption: 'in a row',
      url: `${BASE}/modes/opening-weekend`,
    });
    expect(a.grid).toEqual([['match', 'match', 'match', 'miss']]);
    expect(a.text).toBe(shareText(3, 'daily', '2026-10-04', BASE));
    expect(a.text.split('\n')[0]).toBe(`${APP_NAME} · Opening Weekend · Oct 4 · 3 in a row`);
  });

  it('caps the row at 10 cells and keeps the final miss', () => {
    const a = owArtifact(25, 'daily', '2026-10-04', 'wrong', BASE);
    expect(a.grid[0]).toHaveLength(OW_GRID_MAX);
    expect(a.grid[0]!.at(-1)).toBe('miss');
    expect(a.stat).toBe('25');
    const t = owArtifact(25, 'daily', '2026-10-04', 'time', BASE);
    expect(t.grid[0]).toEqual(Array(OW_GRID_MAX).fill('match'));
  });

  it('practice has no date; a zero run on the clock has no grid', () => {
    const a = owArtifact(0, 'practice', '2026-10-04', 'time', BASE);
    expect(a.date).toBeNull();
    expect(a.grid).toEqual([]);
    expect(a.text).toContain('Practice');
  });

  it('stays within the contract limits', () => {
    const a = owArtifact(123456, 'daily', '2026-10-04', 'wrong', BASE);
    expect(a.stat.length).toBeLessThanOrEqual(12);
    expect(a.statCaption.length).toBeLessThanOrEqual(24);
  });
});

describe('Opening Weekend artifact passes the card route validation', () => {
  it.each([
    [0, 'practice', 'time'],
    [3, 'daily', 'wrong'],
    [42, 'daily', 'time'],
    [999, 'practice', 'wrong'],
  ] as const)('score %i %s %s', (score, mode, outcome) => {
    expect(checkArtifactCard(toCard(owArtifact(score, mode, '2026-10-04', outcome, BASE)))).toEqual({ ok: true });
  });
});
