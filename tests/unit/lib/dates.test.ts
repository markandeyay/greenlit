import { describe, expect, it } from 'vitest';
import { addDays, dateInResetZone, nextResetAt, puzzleNumberForDate, dateForPuzzleNumber } from '@/lib/dates';

describe('dates (Section 4.10)', () => {
  it('uses America/New_York for the calendar day', () => {
    // 03:30 UTC on Oct 5 is 23:30 EDT on Oct 4
    expect(dateInResetZone(new Date('2026-10-05T03:30:00Z'))).toBe('2026-10-04');
    expect(dateInResetZone(new Date('2026-10-05T04:30:00Z'))).toBe('2026-10-05');
  });
  it('numbers reels from launch day as 1', () => {
    expect(puzzleNumberForDate('2026-10-01', '2026-10-01')).toBe(1);
    expect(puzzleNumberForDate('2027-10-01', '2026-10-01')).toBe(366);
    expect(dateForPuzzleNumber(212, '2026-10-01')).toBe(addDays('2026-10-01', 211));
  });
  it('next reset is midnight New York, across DST', () => {
    expect(nextResetAt(new Date('2026-10-04T12:00:00Z')).toISOString()).toBe('2026-10-05T04:00:00.000Z');
    expect(nextResetAt(new Date('2026-12-04T12:00:00Z')).toISOString()).toBe('2026-12-05T05:00:00.000Z');
    // Night DST ends (Nov 1 2026): reset into Nov 2 is at 05:00Z
    expect(nextResetAt(new Date('2026-11-01T12:00:00Z')).toISOString()).toBe('2026-11-02T05:00:00.000Z');
    // Day DST starts (Mar 8 2026): reset into Mar 8 at 05:00Z, into Mar 9 at 04:00Z
    expect(nextResetAt(new Date('2026-03-07T12:00:00Z')).toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(nextResetAt(new Date('2026-03-08T12:00:00Z')).toISOString()).toBe('2026-03-09T04:00:00.000Z');
  });
});
