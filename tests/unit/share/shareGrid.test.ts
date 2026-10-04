import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { RULES } from '@/config/rules';
import {
  decodeShareGrid,
  encodeGrid,
  encodeShareGrid,
  MAX_GRID_PARAM_LENGTH,
  shareImagePath,
  type ShareGrid,
} from '@/components/share/shareGrid';
import { SECRET_FILM_ID, SECRET_TITLE, specExample } from './fixtures';

const decode = (qs: string) => decodeShareGrid(new URLSearchParams(qs));
const valid = 'k=d&n=212&t=2&s=won&h=0&g=bbbgybgb-gggggggg';

describe('encodeShareGrid', () => {
  it('encodes verdicts only', () => {
    expect(encodeShareGrid(specExample())).toBe('k=d&n=212&t=4&s=won&h=0&g=bbbgybgb-gbbgygbb-ggbggggb-gggggggg');
    expect(encodeShareGrid(specExample({ kind: 'pitch', ref: 'secret12', reelNumber: null, hintsUsed: 2 }))).toBe(
      'k=p&t=4&s=won&h=1&g=bbbgybgb-gbbgygbb-ggbggggb-gggggggg',
    );
  });

  it('never leaks the title, id or pitch slug', () => {
    const qs = shareImagePath(specExample({ kind: 'pitch', ref: 'slugslug', reelNumber: null }));
    expect(qs.startsWith('/api/og/result?')).toBe(true);
    expect(qs).not.toContain('slugslug');
    expect(qs).not.toContain(String(SECRET_FILM_ID));
    expect(qs).not.toContain(encodeURIComponent(SECRET_TITLE));
  });

  it('round trips through decode', () => {
    const r = decode(encodeShareGrid(specExample()));
    expect(r.ok && r.grid.rows).toHaveLength(4);
    expect(r).toEqual({
      ok: true,
      grid: {
        kind: 'daily',
        reelNumber: 212,
        status: 'won',
        hintsUsed: false,
        rows: [
          ['miss', 'miss', 'miss', 'match', 'close', 'miss', 'match', 'miss'],
          ['match', 'miss', 'miss', 'match', 'close', 'match', 'miss', 'miss'],
          ['match', 'match', 'miss', 'match', 'match', 'match', 'match', 'miss'],
          Array(8).fill('match'),
        ],
      },
    });
  });

  it('round trips any legal grid (property)', () => {
    const cell = fc.constantFrom('match' as const, 'close' as const, 'miss' as const);
    const grid = fc
      .record({
        kind: fc.constantFrom('daily' as const, 'vault' as const, 'pitch' as const),
        reel: fc.integer({ min: 1, max: 999_999 }),
        rows: fc.array(fc.array(cell, { minLength: 8, maxLength: 8 }), { minLength: 1, maxLength: RULES.maxGuesses }),
        status: fc.constantFrom('won' as const, 'lost' as const),
        hintsUsed: fc.boolean(),
      })
      .map(
        ({ kind, reel, ...rest }): ShareGrid => ({ ...rest, kind, reelNumber: kind === 'pitch' ? null : reel }),
      );
    fc.assert(
      fc.property(grid, (g) => {
        const qs = encodeGrid(g);
        expect(new URLSearchParams(qs).get('g')!.length).toBeLessThanOrEqual(MAX_GRID_PARAM_LENGTH);
        expect(decode(qs)).toEqual({ ok: true, grid: g });
      }),
    );
  });

  it('allows a give up with zero takes', () => {
    expect(decode('k=d&n=3&t=0&s=lost&h=0&g=').ok).toBe(true);
  });
});

describe('decodeShareGrid rejects', () => {
  it('accepts the baseline', () => {
    expect(decode(valid).ok).toBe(true);
  });

  const cases: Array<[string, string]> = [
    ['missing g', 'k=d&n=212&t=2&s=won&h=0'],
    ['unknown key', `${valid}&title=Heat`],
    ['repeated key', `${valid}&s=lost`],
    ['bad kind', valid.replace('k=d', 'k=x')],
    ['missing reel for daily', valid.replace('n=212&', '')],
    ['reel for a pitch', valid.replace('k=d', 'k=p')],
    ['reel zero', valid.replace('n=212', 'n=0')],
    ['reel leading zero', valid.replace('n=212', 'n=0212')],
    ['reel too long', valid.replace('n=212', 'n=1234567')],
    ['reel not numeric', valid.replace('n=212', 'n=2e3')],
    ['bad status', valid.replace('s=won', 's=draw')],
    ['bad hints', valid.replace('h=0', 'h=2')],
    ['takes mismatch', valid.replace('t=2', 't=3')],
    ['takes over max', valid.replace('t=2', `t=${RULES.maxGuesses + 1}`)],
    ['takes not numeric', valid.replace('t=2', 't=two')],
    ['row too short', valid.replace('bbbgybgb', 'bbbgybg')],
    ['row too long', valid.replace('bbbgybgb', 'bbbgybgbb')],
    ['bad cell char', valid.replace('bbbgybgb', 'bbbgxbgb')],
    ['uppercase cell', valid.replace('bbbgybgb', 'BBBGYBGB')],
    ['trailing separator', `${valid}-`],
    ['win with no rows', 'k=d&n=1&t=0&s=won&h=0&g='],
    ['too many rows', `k=d&n=1&t=10&s=lost&h=0&g=${Array(11).fill('bbbbbbbb').join('-')}`],
    ['overlong value', `k=d&n=1&t=1&s=won&h=0&g=gggggggg&k=${'d'.repeat(200)}`],
  ];
  it.each(cases)('%s', (_label, qs) => {
    const r = decode(qs);
    expect(r.ok).toBe(false);
  });
});
