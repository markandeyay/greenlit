import { describe, expect, it } from 'vitest';
import { describeRemaining, formatSlateMeta, formatTimecode, reelCode } from '@/components/chrome/timecode';
import { isActivePath } from '@/components/chrome/nav-items';
import { splitSlug } from '@/components/chrome/SceneHeading';
import { resetCityLabel, splitEndCredits } from '@/components/chrome/Footer';
import { COPY } from '@/config/brand';

describe('formatTimecode', () => {
  it('formats HH:MM:SS:FF at 24 fps', () => {
    expect(formatTimecode(0)).toBe('00:00:00:00');
    expect(formatTimecode(1000)).toBe('00:00:01:00');
    expect(formatTimecode(500)).toBe('00:00:00:12');
    expect(formatTimecode(999)).toBe('00:00:00:23');
    const ms = ((13 * 60 + 42) * 60 + 7) * 1000;
    expect(formatTimecode(ms)).toBe('13:42:07:00');
    expect(formatTimecode(24 * 3600 * 1000 - 1)).toBe('23:59:59:23');
  });
  it('clamps negatives and junk to zero', () => {
    expect(formatTimecode(-5000)).toBe('00:00:00:00');
    expect(formatTimecode(Number.NaN)).toBe('00:00:00:00');
  });
  it('frames never reach 24', () => {
    for (let ms = 0; ms < 3000; ms += 7) {
      const ff = Number(formatTimecode(ms).slice(-2));
      expect(ff).toBeLessThan(24);
    }
  });
});

describe('describeRemaining', () => {
  it('speaks hours and minutes', () => {
    expect(describeRemaining(30_000)).toBe('less than a minute');
    expect(describeRemaining(60_000)).toBe('1 minute');
    expect(describeRemaining((13 * 60 + 42) * 60_000 + 5000)).toBe('13 hours 42 minutes');
    expect(describeRemaining(3_600_000)).toBe('1 hour');
  });
});

describe('motif helpers', () => {
  it('reel codes and slate meta', () => {
    expect(reelCode(212)).toBe('212A');
    expect(reelCode(4)).toBe('004A');
    expect(formatSlateMeta({ roll: 2026, reel: 212, scene: 1, take: 4 })).toBe('Roll 2026 · Reel 212 · Sc 01 · Tk 04');
    expect(formatSlateMeta({ reel: 3 })).toBe('Reel 003');
  });
  it('splits sluglines', () => {
    expect(splitSlug('INT. THE CALL SHEET - NIGHT')).toEqual({ prefix: 'INT.', rest: 'THE CALL SHEET - NIGHT' });
    expect(splitSlug('ext. lot - day')).toEqual({ prefix: 'EXT.', rest: 'lot - day' });
    expect(splitSlug('NO PREFIX')).toEqual({ prefix: null, rest: 'NO PREFIX' });
  });
  it('active nav paths', () => {
    expect(isActivePath('/', '/')).toBe(true);
    expect(isActivePath('/vault', '/')).toBe(false);
    expect(isActivePath('/vault/12', '/vault')).toBe(true);
    expect(isActivePath('/vaulted', '/vault')).toBe(false);
    expect(isActivePath(null, '/')).toBe(false);
  });
  it('footer copy comes from config', () => {
    const { end, credit } = splitEndCredits();
    expect(`${end} · ${credit}`).toBe(COPY.endCredits);
    expect(resetCityLabel('America/New_York')).toBe('New York');
  });
});
