// WS8 acceptance: cannot schedule a film used within the cooldown window, cannot schedule a film
// missing required fields, plus the date window, reel number and hint rules.
import { describe, expect, it } from 'vitest';
import {
  cooldownConflicts,
  missingRequiredFields,
  validateDateWindow,
  validateHints,
  validateSchedule,
  type ScheduleContext,
  type ScheduleInput,
} from '@/server/admin/rules';
import { HINT_CANDIDATES_PER_PUZZLE, LAUNCH_DATE, SCHEDULING } from '@/config/game';
import { addDays, puzzleNumberForDate } from '@/lib/dates';
import type { Film, Puzzle } from '@/lib/types';
import { CERTS, FILMS, HERO, TODAY, validHints } from './helpers';

const certsFor = (id: number) => CERTS.filter((c) => c.filmId === id);
const byId = (id: number) => FILMS.find((f) => f.id === id)!;
const TOMORROW = addDays(TODAY, 1);

function input(over: Partial<ScheduleInput> = {}): ScheduleInput {
  const date = over.date ?? TOMORROW;
  return { number: puzzleNumberForDate(date), date, filmId: HERO.id, theme: null, hints: validHints(), ...over };
}
function ctx(over: Partial<ScheduleContext> = {}): ScheduleContext {
  const f = over.film === undefined ? HERO : over.film;
  return { today: TODAY, film: f, certifications: f ? certsFor(f.id) : [], nearby: [], existing: null, ...over };
}
const codes = (errs: { code: string }[]) => errs.map((e) => e.code);
const puzzleOn = (date: string, filmId: number): Puzzle => ({ number: puzzleNumberForDate(date), date, filmId, theme: null, hints: validHints() });

describe('missingRequiredFields', () => {
  it('accepts a complete eligible film', () => {
    expect(missingRequiredFields(HERO, certsFor(HERO.id))).toEqual([]);
  });

  it.each([
    [200, 'box office'],
    [201, 'tagline'],
    [202, 'answer eligible flag'],
    [203, 'lead actor'],
    [204, 'genre'],
    [205, 'director'],
    [206, 'US certification'],
  ])('film %i is missing %s', (id, field) => {
    expect(missingRequiredFields(byId(id), certsFor(id))).toContain(field);
  });

  it('requires a score snapshot and a non-blank US rating', () => {
    expect(missingRequiredFields({ ...HERO, scoreSnapshot: null } as Film, certsFor(HERO.id))).toContain('score snapshot');
    expect(missingRequiredFields(HERO, [{ filmId: HERO.id, region: 'GB', rating: '12A' }])).toContain('US certification');
  });
});

describe('cannot schedule a film missing required fields', () => {
  it.each([200, 201, 202, 203, 204, 205, 206])('rejects film %i', (id) => {
    const f = byId(id);
    const errs = validateSchedule(input({ filmId: id, hints: validHints() }), ctx({ film: f, certifications: certsFor(id) }));
    expect(codes(errs)).toContain('film_incomplete');
  });

  it('rejects an unknown film', () => {
    expect(codes(validateSchedule(input({ filmId: 424242 }), ctx({ film: null })))).toContain('film_missing');
  });

  it('accepts a complete film with valid hints', () => {
    expect(validateSchedule(input(), ctx())).toEqual([]);
  });
});

describe(`cannot schedule a film used within ${SCHEDULING.repeatCooldownDays} days`, () => {
  const days = SCHEDULING.repeatCooldownDays;

  it('rejects when the film ran in the last cooldown window (before the date)', () => {
    const date = addDays(TODAY, 10);
    const prior = puzzleOn(addDays(date, -days + 5), HERO.id);
    const errs = validateSchedule(input({ date, number: puzzleNumberForDate(date) }), ctx({ nearby: [prior] }));
    expect(codes(errs)).toContain('cooldown');
  });

  it('rejects when the film is already scheduled later within the window (after the date)', () => {
    const later = puzzleOn(addDays(TOMORROW, 20), HERO.id);
    expect(codes(validateSchedule(input(), ctx({ nearby: [later] })))).toContain('cooldown');
  });

  it('treats exactly the cooldown distance as a conflict and one more day as fine', () => {
    expect(cooldownConflicts(HERO.id, TOMORROW, [puzzleOn(addDays(TOMORROW, -days), HERO.id)])).toHaveLength(1);
    expect(cooldownConflicts(HERO.id, TOMORROW, [puzzleOn(addDays(TOMORROW, -days - 1), HERO.id)])).toHaveLength(0);
  });

  it('ignores the puzzle being replaced and other films', () => {
    const existing = puzzleOn(TOMORROW, HERO.id);
    expect(validateSchedule(input(), ctx({ existing, nearby: [existing, puzzleOn(addDays(TOMORROW, 3), 101)] }))).toEqual([]);
  });
});

describe('date window and reel number', () => {
  it('forbids the past', () => {
    const date = addDays(TODAY, -1);
    expect(codes(validateSchedule(input({ date, number: puzzleNumberForDate(date) }), ctx()))).toContain('past');
  });

  it("locks today's live puzzle but allows creating a missing one", () => {
    const today = input({ date: TODAY, number: puzzleNumberForDate(TODAY) });
    expect(codes(validateSchedule(today, ctx({ existing: puzzleOn(TODAY, 101) })))).toContain('today_locked');
    expect(validateSchedule(today, ctx())).toEqual([]);
  });

  it(`forbids more than ${SCHEDULING.aheadDays} days ahead`, () => {
    const ok = addDays(TODAY, SCHEDULING.aheadDays);
    const tooFar = addDays(TODAY, SCHEDULING.aheadDays + 1);
    expect(validateSchedule(input({ date: ok, number: puzzleNumberForDate(ok) }), ctx())).toEqual([]);
    expect(codes(validateSchedule(input({ date: tooFar, number: puzzleNumberForDate(tooFar) }), ctx()))).toContain('too_far');
  });

  it('requires the reel number to equal puzzleNumberForDate(date)', () => {
    expect(codes(validateSchedule(input({ number: puzzleNumberForDate(TOMORROW) + 1 }), ctx()))).toContain('number_mismatch');
  });

  it('rejects malformed and pre-launch dates', () => {
    expect(codes(validateDateWindow('2026-13-40', TODAY, { existingOnDate: false }))).toEqual(['bad_date']);
    expect(codes(validateDateWindow(addDays(LAUNCH_DATE, -1), addDays(LAUNCH_DATE, -5), { existingOnDate: false }))).toEqual(['pre_launch']);
  });
});

describe('hint rules', () => {
  it(`requires exactly ${HINT_CANDIDATES_PER_PUZZLE} hints`, () => {
    expect(codes(validateHints(validHints().slice(0, 2), HERO))).toContain('hint_count');
    expect(codes(validateHints([...validHints(), { type: 'decade_vibe', payload: { text: 'x' } }], HERO))).toContain('hint_count');
  });

  it('rejects bad shapes, duplicates, creator notes, misplaced first letters and title leaks', () => {
    const [a, b] = validHints();
    expect(codes(validateHints([a, b, { type: 'plot_keywords', payload: { keywords: ['one'] } }], HERO))).toContain('hint_invalid');
    expect(codes(validateHints([a, b, { type: 'nope', payload: {} }], HERO))).toContain('hint_invalid');
    expect(codes(validateHints([a, a, b], HERO))).toContain('hint_duplicate');
    expect(codes(validateHints([a, b, { type: 'creator_note', payload: { text: 'hi' } }], HERO))).toContain('hint_invalid');
    expect(codes(validateHints([{ type: 'first_letter', payload: { letter: 'S' } }, a, b], HERO))).toContain('hint_order');
    expect(codes(validateHints([a, b, { type: 'awards', payload: { text: 'The Silver Harbor won big' } }], HERO))).toContain('hint_leak');
    expect(validateHints([a, b, { type: 'first_letter', payload: { letter: 'S' } }], HERO)).toEqual([]);
  });
});
