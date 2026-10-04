// Share artifact builders, validation, query codec and the spoiler guarantee (brief v2, P8).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { ArtifactCell, ArtifactMode, ShareArtifact } from '@/components/share/artifact';
import {
  ARTIFACT_LIMITS,
  ARTIFACT_MODES,
  ARTIFACT_WORDS,
  ArtifactError,
  REEL_MODES,
  artifactImageUrl,
  buildArtifact,
  checkArtifactCard,
  decodeArtifactQuery,
  encodeArtifactQuery,
  isSafePhrase,
  toCard,
  type ArtifactCard,
  type BuildArtifactInput,
} from '@/components/share/artifactCodec';
import { classicArtifact, classicCard } from '@/components/share/classicArtifact';
import { feedbackToCells, gridFromInput } from '@/components/share/shareGrid';
import { buildShareText, shareUrl } from '@/components/share/shareText';
import { COPY } from '@/config/brand';
import { RULES } from '@/config/rules';
import { dateForPuzzleNumber } from '@/lib/dates';
import library from '@/server/db/fixtures/library.json';
import { SECRET_FILM_ID, SECRET_TITLE, fb, specExample } from './fixtures';

const base: BuildArtifactInput = {
  mode: 'daily',
  reelNumber: 212,
  date: '2026-10-04',
  outcome: 'won',
  stat: '4/10',
  statCaption: 'takes',
  grid: [['match', 'close', 'miss', 'empty']],
  url: 'https://example.test/212',
  text: 'Result\nexample.test/212',
};

const decode = (qs: string) => decodeArtifactQuery(new URLSearchParams(qs));

describe('buildArtifact validation', () => {
  it('builds a valid artifact and keeps url and text', () => {
    const a = buildArtifact(base);
    expect(a).toMatchObject({ mode: 'daily', reelNumber: 212, stat: '4/10', url: base.url, text: base.text });
    expect(a.hinted).toBeUndefined();
    expect(buildArtifact({ ...base, hinted: true }).hinted).toBe(true);
  });

  it('accepts typical stats and captions for every mode', () => {
    const typical: [ArtifactMode, string, string][] = [
      ['daily', '3/10', 'takes'],
      ['vault', 'X/10', 'sent to turnaround'],
      ['pitch', '1/10', 'takes'],
      ['unlimited', '7/10', 'takes'],
      ['opening_weekend', '12', 'in a row'],
      ['release_order', '2/3', 'attempts'],
      ['casting_call', '3 links', 'optimal 2'],
      ['logline', '2/6', 'takes'],
      ['opening_weekend', '60s', 'best streak'],
      ['casting_call', 'X', 'no chain'],
    ];
    for (const [mode, stat, statCaption] of typical) {
      const reelNumber = REEL_MODES.includes(mode) ? 5 : null;
      expect(() => buildArtifact({ ...base, mode, reelNumber, stat, statCaption }), `${mode} ${stat}`).not.toThrow();
    }
  });

  it.each([
    ['a film title as the stat', { stat: 'Jaws' }],
    ['a title as the caption', { statCaption: 'The Matrix' }],
    ['free text', { statCaption: 'guess what film' }],
    ['an oversize stat', { stat: '1234567890123' }],
    ['an oversize caption', { statCaption: 'takes takes takes takes t' }],
    ['unsafe characters', { stat: '4/10 <b>' }],
    ['emoji', { stat: '4/10 🎬' }],
    ['leading space', { stat: ' 4/10' }],
    ['double space', { statCaption: 'in  a row' }],
    ['an empty stat', { stat: '' }],
    ['a bad mode', { mode: 'frame_lock' as ArtifactMode }],
    ['a bad outcome', { outcome: 'draw' as ShareArtifact['outcome'] }],
    ['a reel on a non reel mode', { mode: 'pitch' as ArtifactMode, reelNumber: 3 }],
    ['a zero reel', { reelNumber: 0 }],
    ['a fractional reel', { reelNumber: 2.5 }],
    ['a bad date', { date: '2026-02-30' }],
    ['a date with time', { date: '2026-10-04T00:00' }],
    ['too many rows', { grid: Array.from({ length: 11 }, () => ['match'] as ArtifactCell[]) }],
    ['too many cells', { grid: [Array.from({ length: 11 }, () => 'match' as ArtifactCell)] }],
    ['an empty row', { grid: [[]] }],
    ['a bad cell', { grid: [['match', 'title' as ArtifactCell]] }],
    ['a relative url', { url: '/212' }],
    ['empty text', { text: '  ' }],
  ])('rejects %s', (_label, patch) => {
    expect(() => buildArtifact({ ...base, ...(patch as Partial<BuildArtifactInput>) })).toThrow(ArtifactError);
  });

  it('isSafePhrase allows number tokens and game words only', () => {
    for (const ok of ['3/10', 'X/10', '12', '2.5', '+3', '10+', '60s', '1st', '3 films', 'optimal 2', '']) {
      expect(isSafePhrase(ok, 24), ok).toBe(true);
    }
    for (const bad of ['Up', 'Heat', 'Dune', 'abc', '3/10/', 'X/Y', '--', '3 jaws']) {
      expect(isSafePhrase(bad, 24), bad).toBe(false);
    }
  });
});

describe('query codec', () => {
  it('encodes compactly and never includes url or text', () => {
    const a = buildArtifact({ ...base, text: `${SECRET_TITLE}\nexample.test/212`, url: `https://example.test/${SECRET_FILM_ID}` });
    const url = artifactImageUrl(a, 'portrait');
    expect(url.startsWith('/api/share/card?')).toBe(true);
    expect(decodeURIComponent(url)).not.toContain(SECRET_TITLE);
    expect(url).not.toContain(String(SECRET_FILM_ID));
    expect(url).not.toContain('example.test');
  });

  it('a 10 x 10 grid with the longest stat and caption stays under the query limit', () => {
    const big = buildArtifact({
      ...base,
      reelNumber: 999_999,
      stat: '10/10 takes',
      statCaption: 'sent to turnaround x',
      grid: Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => 'close' as ArtifactCell)),
      hinted: true,
    });
    for (const f of ['portrait', 'wide'] as const) {
      expect(artifactImageUrl(big, f).length).toBeLessThan(ARTIFACT_LIMITS.queryMax);
    }
  });

  it.each([
    ['an unknown key', 'f=portrait&m=d&o=w&s=1&title=Jaws'],
    ['a repeated key', 'm=d&m=v&o=w&s=1'],
    ['a bad format', 'f=square&m=d&o=w&s=1'],
    ['a bad mode', 'm=zz&o=w&s=1'],
    ['a bad outcome', 'm=d&o=x&s=1'],
    ['a title stat', 'm=d&o=w&s=Jaws'],
    ['a missing stat', 'm=d&o=w'],
    ['a bad grid char', 'm=d&o=w&s=1&g=gq'],
    ['an empty grid', 'm=d&o=w&s=1&g='],
    ['an 11 cell row', 'm=d&o=w&s=1&g=ggggggggggg'],
    ['a bad hinted flag', 'm=d&o=w&s=1&h=true'],
    ['a reel on pitch', 'm=p&n=5&o=w&s=1'],
    ['a bad reel', 'm=d&n=0&o=w&s=1'],
    ['a long value', `m=d&o=w&s=1&c=${'a'.repeat(200)}`],
  ])('decode rejects %s', (_l, qs) => {
    expect(decode(qs).ok).toBe(false);
  });

  const wordArb = fc.constantFrom(...[...ARTIFACT_WORDS]);
  const numArb = fc.oneof(
    fc.nat({ max: 999 }).map(String),
    fc.tuple(fc.nat({ max: 10 }), fc.integer({ min: 1, max: 10 })).map(([a, b]) => `${a}/${b}`),
    fc.integer({ min: 1, max: 10 }).map((b) => `X/${b}`),
  );
  const phraseArb = (max: number) =>
    fc
      .array(fc.oneof(numArb, wordArb), { minLength: 1, maxLength: 4 })
      .map((ws) => ws.join(' '))
      .filter((s) => s.length <= max);
  const dateArb = fc
    .date({ min: new Date('2024-01-01T00:00:00Z'), max: new Date('2030-12-31T00:00:00Z'), noInvalidDate: true })
    .map((d) => d.toISOString().slice(0, 10));
  const cellArb = fc.constantFrom<ArtifactCell>('match', 'close', 'miss', 'empty');
  const cardArb: fc.Arbitrary<ArtifactCard> = fc
    .record({
      mode: fc.constantFrom(...ARTIFACT_MODES),
      reel: fc.integer({ min: 1, max: 999_999 }),
      useReel: fc.boolean(),
      date: fc.option(dateArb, { nil: null }),
      outcome: fc.constantFrom<ShareArtifact['outcome']>('won', 'lost', 'score'),
      stat: phraseArb(ARTIFACT_LIMITS.statMax),
      statCaption: fc.oneof(fc.constant(''), phraseArb(ARTIFACT_LIMITS.captionMax)),
      grid: fc.array(fc.array(cellArb, { minLength: 1, maxLength: 10 }), { maxLength: 10 }),
      hinted: fc.boolean(),
    })
    .map(({ mode, reel, useReel, hinted, ...rest }) => {
      const card: ArtifactCard = { mode, reelNumber: useReel && REEL_MODES.includes(mode) ? reel : null, ...rest };
      if (hinted) card.hinted = true;
      return card;
    });

  it('round trips every valid card through the query (fast-check)', () => {
    fc.assert(
      fc.property(cardArb, fc.constantFrom('portrait' as const, 'wide' as const), (card, format) => {
        expect(checkArtifactCard(card)).toEqual({ ok: true });
        const qs = encodeArtifactQuery(card, format);
        expect(qs.length).toBeLessThan(ARTIFACT_LIMITS.queryMax);
        const out = decode(qs);
        expect(out).toEqual({ ok: true, card, format });
      }),
      { numRuns: 300 },
    );
  });

  it('toCard drops url and text', () => {
    const card = toCard(buildArtifact(base));
    expect(card).not.toHaveProperty('url');
    expect(card).not.toHaveProperty('text');
  });
});

describe('classicArtifact', () => {
  it('maps a daily win to the take stat, takes caption and the 8-cell rows', () => {
    const input = specExample({ hintsUsed: 1 });
    const a = classicArtifact(input);
    expect(a.mode).toBe('daily');
    expect(a.reelNumber).toBe(212);
    expect(a.date).toBe(dateForPuzzleNumber(212));
    expect(a.outcome).toBe('won');
    expect(a.stat).toBe(`4/${RULES.maxGuesses}`);
    expect(a.statCaption).toBe('takes');
    expect(a.hinted).toBe(true);
    expect(a.grid).toEqual(input.feedback.map(feedbackToCells));
    expect(a.grid.every((r) => r.length === 8)).toBe(true);
    expect(a.text).toBe(buildShareText(input));
    expect(a.url).toBe(shareUrl(input));
  });

  it('maps a loss to X and the turnaround caption', () => {
    const a = classicArtifact(specExample({ status: 'lost', feedback: [fb('bbbbbbbb'), fb('gbbbybbb')] }));
    expect(a.outcome).toBe('lost');
    expect(a.stat).toBe(`X/${RULES.maxGuesses}`);
    expect(a.statCaption).toBe(COPY.lossStamp.toLowerCase());
    expect(a.hinted).toBeUndefined();
  });

  it('pitches and unlimited reels carry no reel or date', () => {
    for (const kind of ['pitch', 'unlimited'] as const) {
      const a = classicArtifact(specExample({ kind, ref: 'abc12345', reelNumber: null }));
      expect(a.mode).toBe(kind);
      expect(a.reelNumber).toBeNull();
      expect(a.date).toBeNull();
      expect(artifactImageUrl(a)).not.toContain('abc12345');
    }
  });

  it('a vault play keeps its reel number', () => {
    const a = classicArtifact(specExample({ kind: 'vault', ref: '40', reelNumber: 40 }));
    expect(a).toMatchObject({ mode: 'vault', reelNumber: 40, date: dateForPuzzleNumber(40) });
  });

  it('classicCard drops the date for absurd reel numbers instead of failing', () => {
    const grid = gridFromInput(specExample({ reelNumber: 999_999, ref: '999999' }));
    expect(classicCard(grid).date).toBeNull();
  });
});

describe('spoiler guarantee', () => {
  const lib = library as unknown as { films: { title: string }[]; people: { name: string }[] };
  const secrets = [...lib.films.map((f) => f.title), ...lib.people.map((p) => p.name), SECRET_TITLE];

  it('finds the fixture library', () => {
    expect(lib.films.length).toBeGreaterThan(50);
    expect(lib.people.length).toBeGreaterThan(50);
  });

  it('no film title or person name can be placed in stat or caption', () => {
    for (const s of secrets) {
      for (const field of ['stat', 'statCaption'] as const) {
        const max = field === 'stat' ? ARTIFACT_LIMITS.statMax : ARTIFACT_LIMITS.captionMax;
        // Upper and lower case, truncated to the field limit (a prefix is still a spoiler).
        for (const v of [s, s.toUpperCase(), s.toLowerCase()].map((x) => x.slice(0, max).trim())) {
          expect(() => buildArtifact({ ...base, [field]: v }), `${field}=${v}`).toThrow(ArtifactError);
          const qs = new URLSearchParams(encodeArtifactQuery(toCard({ ...buildArtifact(base), [field]: v })));
          expect(decodeArtifactQuery(qs).ok, `decode ${field}=${v}`).toBe(false);
        }
      }
    }
  });

  it('no allowed word is itself a fixture title or name', () => {
    const lower = new Set(secrets.map((s) => s.toLowerCase()));
    expect([...ARTIFACT_WORDS].filter((w) => lower.has(w))).toEqual([]);
  });

  it('a constructed artifact never carries a title into the image URL, whatever its text and url', () => {
    const titles = lib.films.map((f) => f.title.toLowerCase());
    fc.assert(
      fc.property(fc.constantFrom(...titles), fc.constantFrom(...ARTIFACT_MODES), (title, mode) => {
        const a = buildArtifact({
          ...base,
          mode,
          reelNumber: REEL_MODES.includes(mode) ? 7 : null,
          text: `I guessed ${title}!\nexample.test/7`,
          url: `https://example.test/${encodeURIComponent(title)}`,
        });
        for (const f of ['portrait', 'wide'] as const) {
          const url = decodeURIComponent(artifactImageUrl(a, f).replace(/\+/g, ' ')).toLowerCase();
          expect(url).not.toMatch(new RegExp(`\\b${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`));
        }
      }),
      { numRuns: 200 },
    );
  });
});
