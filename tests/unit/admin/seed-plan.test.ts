// scripts/schedule/seed-puzzles.ts planner: fills the window, idempotent, popularity first,
// respects cooldown and required fields, --force never rewrites past or live puzzles.
import { describe, expect, it } from 'vitest';
import { planSeed } from '@/server/admin/seed-plan';
import { generateHints } from '@/server/admin/hints-draft';
import { parseSeedArgs, seedHorizon, MIN_SEED_DAYS } from '../../../scripts/schedule/seed-puzzles';
import { SCHEDULING } from '@/config/game';
import { addDays, puzzleNumberForDate } from '@/lib/dates';
import type { FilmCertification, Puzzle } from '@/lib/types';
import { CERTS, FILMS, LIB, TODAY, validHints } from './helpers';

const certs = new Map<number, FilmCertification[]>();
for (const c of CERTS) certs.set(c.filmId, [...(certs.get(c.filmId) ?? []), c]);
const base = { today: TODAY, films: FILMS, certifications: certs, generate: (f: (typeof FILMS)[number]) => generateHints(f, LIB) };
const puzzleOn = (date: string, filmId: number): Puzzle => ({ number: puzzleNumberForDate(date), date, filmId, theme: null, hints: validHints() });

describe('planSeed', () => {
  it('fills every date with complete films, most popular first, without repeats', () => {
    const plan = planSeed({ ...base, from: TODAY, through: addDays(TODAY, 4), existing: [] });
    // 6 complete films (100..105) but 102's hints are fine too; 5 dates -> 5 distinct films.
    expect(plan.write).toHaveLength(5);
    expect(new Set(plan.write.map((p) => p.filmId)).size).toBe(5);
    expect(plan.write[0]!.filmId).toBe(102); // popularity 99
    expect(plan.write.every((p) => p.number === puzzleNumberForDate(p.date))).toBe(true);
    expect(plan.write.map((p) => p.filmId).some((id) => id >= 200)).toBe(false); // incomplete never used
  });

  it('is idempotent: keeps existing puzzles and does not reuse their films in the cooldown', () => {
    const existing = [puzzleOn(addDays(TODAY, 1), 102), puzzleOn(addDays(TODAY, -100), 101)];
    const plan = planSeed({ ...base, from: TODAY, through: addDays(TODAY, 2), existing });
    expect(plan.kept.map((p) => p.date)).toEqual([addDays(TODAY, 1)]);
    expect(plan.write.map((p) => p.date)).toEqual([TODAY, addDays(TODAY, 2)]);
    expect(plan.write.map((p) => p.filmId)).not.toContain(102);
    expect(plan.write.map((p) => p.filmId)).not.toContain(101);
    // Running again over the result writes nothing.
    const again = planSeed({ ...base, from: TODAY, through: addDays(TODAY, 2), existing: [...existing, ...plan.write] });
    expect(again.write).toEqual([]);
  });

  it('--force replaces future puzzles only, never today or the past', () => {
    const existing = [puzzleOn(TODAY, 104), puzzleOn(addDays(TODAY, 1), 105)];
    const plan = planSeed({ ...base, from: TODAY, through: addDays(TODAY, 1), existing, force: true });
    expect(plan.kept.map((p) => p.date)).toEqual([TODAY]);
    expect(plan.write.map((p) => p.date)).toEqual([addDays(TODAY, 1)]);
  });

  it('reports dates it cannot fill when the pool is exhausted by the cooldown', () => {
    const plan = planSeed({ ...base, from: TODAY, through: addDays(TODAY, 9), existing: [] });
    expect(plan.write).toHaveLength(6);
    expect(plan.unfilled).toHaveLength(4);
  });
});

describe('seed CLI args', () => {
  it('parses flags', () => {
    expect(parseSeedArgs(['--days', '20', '--force', '--dry-run', '--from=2026-10-10'])).toEqual({ days: 20, from: '2026-10-10', force: true, dryRun: true });
    expect(() => parseSeedArgs(['--from', 'tomorrow'])).toThrow();
  });

  it(`clamps the horizon to [${MIN_SEED_DAYS}, aheadDays]`, () => {
    expect(seedHorizon(null, SCHEDULING.aheadDays)).toBe(SCHEDULING.aheadDays);
    expect(seedHorizon(3, SCHEDULING.aheadDays)).toBe(MIN_SEED_DAYS);
    expect(seedHorizon(10_000, SCHEDULING.aheadDays)).toBe(SCHEDULING.aheadDays);
  });
});
