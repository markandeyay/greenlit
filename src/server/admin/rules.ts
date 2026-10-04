// Scheduling rules (Section 12 WS8 acceptance, Sections 4.2, 4.8, 13). PURE: callers load data.
//
// A puzzle may be written only when ALL of these hold:
//   - the date is a valid YYYY-MM-DD on or after LAUNCH_DATE;
//   - the date is not in the past. Today is allowed only to CREATE a missing puzzle (an empty
//     today breaks the game); editing or replacing today's live puzzle is forbidden because
//     plays in progress are evaluated against it. Past puzzles are frozen;
//   - the date is at most SCHEDULING.aheadDays after today;
//   - number === puzzleNumberForDate(date);
//   - the film exists and has every required field (missingRequiredFields);
//   - the film is not scheduled on any other date within SCHEDULING.repeatCooldownDays before or
//     after the date (inclusive: exactly repeatCooldownDays apart is still a conflict);
//   - exactly HINT_CANDIDATES_PER_PUZZLE hints, valid shapes, distinct types, no creator_note,
//     first_letter only as the last candidate, and no hint names the film.
import type { Film, FilmCertification, Hint, Puzzle } from '@/lib/types';
import { HINT_CANDIDATES_PER_PUZZLE, LAUNCH_DATE, SCHEDULING } from '@/config/game';
import { NOT_IN_SLOT_1 } from '@/config/hints';
import { addDays, daysBetween, puzzleNumberForDate } from '@/lib/dates';
import { hintSchema } from './hint-schema';
import { hintLeaksTitle } from './hints-draft';

export type ScheduleErrorCode =
  | 'bad_date'
  | 'pre_launch'
  | 'past'
  | 'today_locked'
  | 'too_far'
  | 'number_mismatch'
  | 'film_missing'
  | 'film_incomplete'
  | 'cooldown'
  | 'hint_count'
  | 'hint_invalid'
  | 'hint_duplicate'
  | 'hint_order'
  | 'hint_leak'
  | 'theme_invalid';

export interface ScheduleError {
  code: ScheduleErrorCode;
  message: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const THEME_MAX_LENGTH = 60;

export function isValidDate(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

/** Human labels of the fields a daily answer must have. Empty when schedulable. */
export function missingRequiredFields(film: Film, certifications: FilmCertification[]): string[] {
  const missing: string[] = [];
  if (!film.isAnswerEligible) missing.push('answer eligible flag');
  if (film.boxOfficeUsd === null || !(film.boxOfficeUsd > 0)) missing.push('box office');
  if (!certifications.some((c) => c.region === 'US' && c.rating.trim())) missing.push('US certification');
  if (!film.directorUnit || film.directorUnit.ids.length === 0 || !film.directorUnit.display.trim()) missing.push('director');
  if (film.leadPersonId === null) missing.push('lead actor');
  if (film.genreIds.length === 0) missing.push('genre');
  if (!film.tagline || !film.tagline.trim()) missing.push('tagline');
  if (film.scoreSnapshot === null) missing.push('score snapshot');
  return missing;
}

/** Other puzzles that use the same film within the cooldown window around `date`. */
export function cooldownConflicts(filmId: number, date: string, puzzles: Puzzle[], ignoreNumber?: number): Puzzle[] {
  return puzzles.filter(
    (p) =>
      p.filmId === filmId &&
      p.number !== ignoreNumber &&
      p.date !== date &&
      Math.abs(daysBetween(p.date, date)) <= SCHEDULING.repeatCooldownDays,
  );
}

/** The date range a caller must load to check cooldown for `date`. */
export function cooldownWindow(date: string): { fromDate: string; toDate: string } {
  return { fromDate: addDays(date, -SCHEDULING.repeatCooldownDays), toDate: addDays(date, SCHEDULING.repeatCooldownDays) };
}

export function validateHints(hints: unknown[], film: Pick<Film, 'title' | 'originalTitle'> | null): ScheduleError[] {
  const errors: ScheduleError[] = [];
  if (hints.length !== HINT_CANDIDATES_PER_PUZZLE) {
    errors.push({ code: 'hint_count', message: `A puzzle needs exactly ${HINT_CANDIDATES_PER_PUZZLE} hint candidates (has ${hints.length}).` });
  }
  const parsed: Hint[] = [];
  hints.forEach((h, i) => {
    const r = hintSchema.safeParse(h);
    if (!r.success) errors.push({ code: 'hint_invalid', message: `Hint ${i + 1} has an invalid type or payload.` });
    else parsed.push(r.data);
  });
  if (parsed.some((h) => h.type === 'creator_note')) {
    errors.push({ code: 'hint_invalid', message: 'Creator notes belong to pitches, not daily puzzles.' });
  }
  const types = parsed.map((h) => h.type);
  if (new Set(types).size !== types.length) {
    errors.push({ code: 'hint_duplicate', message: 'Each hint candidate needs a different type (players pick by type).' });
  }
  const lastOnly = parsed.findIndex((h) => NOT_IN_SLOT_1.includes(h.type));
  if (lastOnly !== -1 && lastOnly !== parsed.length - 1) {
    errors.push({ code: 'hint_order', message: 'First letter is a last resort: put it last.' });
  }
  if (parsed.length > 0 && parsed.every((h) => NOT_IN_SLOT_1.includes(h.type))) {
    errors.push({ code: 'hint_order', message: 'Note 1 needs at least one hint that is not a first letter.' });
  }
  if (film) {
    parsed.forEach((h, i) => {
      if (hintLeaksTitle(h, film)) errors.push({ code: 'hint_leak', message: `Hint ${i + 1} gives away the title.` });
    });
  }
  return errors;
}

export function validateTheme(theme: string | null | undefined): ScheduleError[] {
  if (theme === null || theme === undefined) return [];
  if (theme.trim().length > THEME_MAX_LENGTH) {
    return [{ code: 'theme_invalid', message: `Themes are at most ${THEME_MAX_LENGTH} characters.` }];
  }
  return [];
}

/** Date checks shared by schedule, delete, hint edits and themes. */
export function validateDateWindow(
  date: string,
  today: string,
  opts: { existingOnDate: boolean; allowTodayCreate?: boolean; launch?: string },
): ScheduleError[] {
  if (!isValidDate(date)) return [{ code: 'bad_date', message: 'Dates use the YYYY-MM-DD format.' }];
  const launch = opts.launch ?? LAUNCH_DATE;
  if (date < launch) return [{ code: 'pre_launch', message: `Reel No. 1 premieres on ${launch}.` }];
  if (date < today) return [{ code: 'past', message: 'Past puzzles are frozen and cannot be edited.' }];
  if (date === today && (opts.existingOnDate || !opts.allowTodayCreate)) {
    return [{ code: 'today_locked', message: "Today's reel is live. It cannot be changed while people are playing it." }];
  }
  if (daysBetween(today, date) > SCHEDULING.aheadDays) {
    return [{ code: 'too_far', message: `Puzzles can be scheduled at most ${SCHEDULING.aheadDays} days ahead.` }];
  }
  return [];
}

export interface ScheduleInput {
  number: number;
  date: string;
  filmId: number;
  theme: string | null;
  hints: unknown[];
}

export interface ScheduleContext {
  today: string;
  film: Film | null;
  certifications: FilmCertification[];
  /** Puzzles inside cooldownWindow(date) (may include the one being replaced). */
  nearby: Puzzle[];
  /** The puzzle currently stored on this date, if any. */
  existing: Puzzle | null;
  launch?: string;
}

/** Every reason the puzzle cannot be written. Empty means it is valid. */
export function validateSchedule(input: ScheduleInput, ctx: ScheduleContext): ScheduleError[] {
  const dateErrors = validateDateWindow(input.date, ctx.today, {
    existingOnDate: ctx.existing !== null,
    allowTodayCreate: true,
    launch: ctx.launch,
  });
  if (dateErrors.some((e) => e.code === 'bad_date')) return dateErrors;
  const errors: ScheduleError[] = [...dateErrors];
  const expected = puzzleNumberForDate(input.date, ctx.launch);
  if (input.number !== expected) {
    errors.push({ code: 'number_mismatch', message: `The reel number for ${input.date} is ${expected}, not ${input.number}.` });
  }
  if (!ctx.film || ctx.film.id !== input.filmId) {
    errors.push({ code: 'film_missing', message: 'That film is not in the library.' });
  } else {
    const missing = missingRequiredFields(ctx.film, ctx.certifications);
    if (missing.length) errors.push({ code: 'film_incomplete', message: `Missing required fields: ${missing.join(', ')}.` });
    const clashes = cooldownConflicts(input.filmId, input.date, ctx.nearby, ctx.existing?.number);
    if (clashes.length) {
      const dates = clashes.map((p) => `${p.date} (Reel ${p.number})`).join(', ');
      errors.push({
        code: 'cooldown',
        message: `This film is already scheduled within ${SCHEDULING.repeatCooldownDays} days: ${dates}.`,
      });
    }
  }
  errors.push(...validateTheme(input.theme));
  errors.push(...validateHints(input.hints, ctx.film));
  return errors;
}
