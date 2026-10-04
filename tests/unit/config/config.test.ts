import { describe, expect, it } from 'vitest';
import { RULES } from '@/config/rules';
import { REGION_CODES, regionFromAcceptLanguage, isRegionCode } from '@/config/regions';
import { APP_NAME, COPY, tmdbImage } from '@/config/brand';
import { HINT_TYPE_LABELS, NOT_IN_SLOT_1 } from '@/config/hints';
import { PITCH, LOSS_SCORE } from '@/config/game';

describe('RULES (Section 4.3)', () => {
  it('matches the spec exactly', () => {
    expect(RULES).toEqual({
      maxGuesses: 10,
      yearClose: 3,
      boxOfficeGreenPct: 0.1,
      boxOfficeCloseRatio: 2.0,
      scoreClose: 5,
      maxSupportingCast: 4,
      hintUnlockAfter: [5, 8],
    });
  });
  it('loss score is one more than max guesses', () => {
    expect(LOSS_SCORE).toBe(RULES.maxGuesses + 1);
  });
});

describe('regions (Section 4.6)', () => {
  it('supports the six launch regions', () => {
    expect([...REGION_CODES]).toEqual(['US', 'GB', 'CA', 'AU', 'IN', 'DE']);
  });
  it('resolves Accept-Language', () => {
    expect(regionFromAcceptLanguage('en-GB,en;q=0.9')).toBe('GB');
    expect(regionFromAcceptLanguage('de-DE')).toBe('DE');
    expect(regionFromAcceptLanguage('fr-FR,fr')).toBe('US');
    expect(regionFromAcceptLanguage(null)).toBe('US');
    expect(isRegionCode('UK')).toBe(false);
  });
});

describe('brand and copy', () => {
  it('has the app name in one place and no em dashes in copy', () => {
    expect(APP_NAME.length).toBeGreaterThan(0);
    const strings = [
      ...(Object.values(COPY) as unknown[]).filter((v): v is string => typeof v === 'string'),
      COPY.takeLabel(4, 10),
      COPY.reelLabel(7),
      ...Object.values(HINT_TYPE_LABELS),
    ];
    for (const s of strings) expect(s).not.toMatch(/—/);
    expect(COPY.takeLabel(4, 10)).toBe('TAKE 4 / 10');
    expect(COPY.reelLabel(7)).toBe('Reel No. 007');
  });
  it('builds TMDB image urls', () => {
    expect(tmdbImage('/x.jpg', 'w92')).toBe('https://image.tmdb.org/t/p/w92/x.jpg');
    expect(tmdbImage(null)).toBeNull();
  });
});

describe('hints and pitch config', () => {
  it('never offers first_letter in note 1', () => {
    expect(NOT_IN_SLOT_1).toContain('first_letter');
  });
  it('pitch slugs are 8 char base36', () => {
    expect(PITCH.slugLength).toBe(8);
    expect(PITCH.slugAlphabet).toHaveLength(36);
  });
});
