import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { APP_NAME } from '@/config/brand';
import { RULES } from '@/config/rules';
import { friendlyError, GameApiError } from '@/lib/game/api';
import { searchIndex } from '@/lib/game/search-index';
import { beatPercent, bucketFor, withSelf } from '@/lib/game/stats';
import { formatBoxOffice, formatSlateDate, formatShortDate, initials, percent, speakBoxOffice } from '@/lib/format';
import type { ApiErrorCode } from '@/lib/types';

describe('format', () => {
  it('formats money, dates and initials', () => {
    expect(formatBoxOffice(1_234_000_000)).toBe('$1.2B');
    expect(formatBoxOffice(null)).toBe('N/A');
    expect(speakBoxOffice(187_000_000)).toBe('187 million dollars');
    expect(formatSlateDate('2026-10-04')).toBe('Oct 04 2026');
    expect(formatShortDate('2026-10-04')).toBe('Sun, Oct 4, 2026');
    expect(initials('The Lord of the Rings')).toBe('LR');
    expect(initials('Heat')).toBe('H');
    expect(initials('Christopher Nolan')).toBe('CN');
    expect(percent(1, 3)).toBe(33);
    expect(percent(1, 0)).toBe(0);
  });
});

describe('stats', () => {
  it('buckets and counts the player in', () => {
    expect(bucketFor('won', 3)).toBe(2);
    expect(bucketFor('lost', 7)).toBe(RULES.maxGuesses);
    const v = withSelf({ puzzleNumber: 1, distribution: Array(11).fill(0), plays: 0, wins: 0 }, 2);
    expect(v.plays).toBe(1);
    expect(beatPercent(v, 2)).toBeNull();
    const dist = [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 2];
    const w = withSelf({ puzzleNumber: 1, distribution: dist, plays: 4, wins: 2 }, 2);
    expect(w.plays).toBe(4);
    expect(beatPercent(w, 2)).toBe(67);
    expect(beatPercent(w, RULES.maxGuesses)).toBeNull();
  });
});

describe('search index', () => {
  const films = [
    { id: 1, title: 'Alien', year: 1979, posterPath: null },
    { id: 2, title: 'Aliens', year: 1986, posterPath: null },
    { id: 3, title: 'The Thing', year: 1982, posterPath: null },
    { id: 4, title: 'Amelie', originalTitle: "Le Fabuleux Destin d'Amélie Poulain", year: 2001, posterPath: null },
  ];
  it('ranks exact and prefix matches first and matches original titles', () => {
    expect(searchIndex(films, 'alien').map((f) => f.id)).toEqual([1, 2]);
    expect(searchIndex(films, 'thing')[0]!.id).toBe(3);
    expect(searchIndex(films, 'fabuleux')[0]!.id).toBe(4);
    expect(searchIndex(films, 'a')).toEqual([]);
    expect(searchIndex(films, 'aliens 1986')[0]!.id).toBe(2);
  });
});

describe('friendly errors', () => {
  it('has copy for every code', () => {
    const codes: ApiErrorCode[] = ['bad_request', 'not_found', 'already_guessed', 'game_over', 'hint_locked', 'hint_unavailable', 'rate_limited', 'unauthorized', 'forbidden', 'internal'];
    for (const c of codes) expect(friendlyError(new GameApiError(c, 'x'))).toMatch(/\w/);
    expect(friendlyError(new GameApiError('rate_limited', 'x'))).toMatch(/Too many takes/);
  });
});

const root = fileURLToPath(new URL('../../../', import.meta.url));
function walk(dir: string): string[] {
  const abs = join(root, dir);
  try {
    statSync(abs);
  } catch {
    return [];
  }
  if (statSync(abs).isFile()) return [dir];
  return readdirSync(abs, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]));
}

const FILES = [
  ...walk('src/components/game'),
  ...walk('src/lib/game'),
  'src/lib/format.ts',
  'src/app/page.tsx',
  ...walk('src/app/vault'),
  ...walk('src/app/p'),
  ...walk('src/app/[number]'),
].filter((f) => /\.(tsx?|css)$/.test(f));

describe('copy rules (WS5 files)', () => {
  it('finds the files', () => {
    expect(FILES.length).toBeGreaterThan(20);
  });
  it('contains no em dashes', () => {
    expect(FILES.filter((f) => readFileSync(join(root, f), 'utf8').includes('—'))).toEqual([]);
  });
  it('never hardcodes the product name', () => {
    const re = new RegExp(`['"\`>]\\s*${APP_NAME}\\b`);
    expect(FILES.filter((f) => /\.tsx?$/.test(f) && re.test(readFileSync(join(root, f), 'utf8')))).toEqual([]);
  });
  it('never hardcodes the guess cap or note thresholds as literals in UI copy', () => {
    const offenders = FILES.filter((f) => /\.tsx$/.test(f) && /(after take|of) (5|8|10)\b/.test(readFileSync(join(root, f), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
