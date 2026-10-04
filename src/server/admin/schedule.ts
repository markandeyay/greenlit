// Admin scheduling service (WS8). SERVER ONLY. All writes are validated by ./rules.ts first.
import 'server-only';
import { getRepo } from '@/server/db';
import type { Repo } from '@/server/db/repo';
import { ApiFailure } from '@/server/http';
import type { Film, Hint, Puzzle } from '@/lib/types';
import { HINT_CANDIDATES_PER_PUZZLE, LAUNCH_DATE, SCHEDULING } from '@/config/game';
import { addDays, dateInResetZone, daysBetween, puzzleNumberForDate } from '@/lib/dates';
import {
  cooldownConflicts,
  cooldownWindow,
  isValidDate,
  missingRequiredFields,
  validateDateWindow,
  validateHints,
  validateSchedule,
  validateTheme,
  type ScheduleError,
} from './rules';
import { generateHints } from './hints-draft';
import { hintLibraryFor } from './library';
import type { AdminDay, AdminDraftResponse, AdminFilmSummary, AdminPuzzle, AdminScheduleResponse, AdminThemeResult } from './types';

/** How many past days the calendar shows (read-only). */
export const RECENT_PAST_DAYS = 14;

function fail(errors: ScheduleError[]): never {
  throw new ApiFailure('bad_request', errors.map((e) => e.message).join(' '));
}

export async function summarizeFilm(repo: Repo, film: Film, puzzles: Puzzle[] = []): Promise<AdminFilmSummary> {
  const certs = await repo.getCertifications(film.id);
  return {
    id: film.id,
    title: film.title,
    year: film.releaseYear,
    posterPath: film.posterPath,
    popularity: film.popularity,
    isAnswerEligible: film.isAnswerEligible,
    missing: missingRequiredFields(film, certs),
    scheduled: puzzles.filter((p) => p.filmId === film.id).map((p) => ({ number: p.number, date: p.date })),
  };
}

async function toAdminPuzzle(repo: Repo, p: Puzzle, films: Map<number, Film>, context: Puzzle[]): Promise<AdminPuzzle> {
  const film = films.get(p.filmId) ?? null;
  const problems: string[] = [];
  let summary: AdminFilmSummary | null = null;
  if (!film) problems.push('The film is missing from the library.');
  else {
    summary = await summarizeFilm(repo, film, context);
    if (summary.missing.length) problems.push(`Missing required fields: ${summary.missing.join(', ')}.`);
    const clashes = cooldownConflicts(p.filmId, p.date, context, p.number);
    if (clashes.length) problems.push(`Repeats within ${SCHEDULING.repeatCooldownDays} days: ${clashes.map((c) => c.date).join(', ')}.`);
  }
  problems.push(...validateHints(p.hints, film).map((e) => e.message));
  return { number: p.number, date: p.date, theme: p.theme, filmId: p.filmId, film: summary, hints: p.hints, problems };
}

export async function listSchedule(now: Date = new Date(), repo: Repo = getRepo()): Promise<AdminScheduleResponse> {
  const today = dateInResetZone(now);
  const startCandidate = addDays(today, -RECENT_PAST_DAYS);
  const from = startCandidate < LAUNCH_DATE ? LAUNCH_DATE : startCandidate;
  const to = addDays(today, SCHEDULING.aheadDays);
  // Load the surrounding cooldown window too, so problems include clashes outside the view.
  const context = await repo.listPuzzles({ fromDate: addDays(from, -SCHEDULING.repeatCooldownDays), toDate: addDays(to, SCHEDULING.repeatCooldownDays) });
  const filmIds = [...new Set(context.filter((p) => p.date >= from && p.date <= to).map((p) => p.filmId))];
  const films = new Map((await repo.getFilms(filmIds)).map((f) => [f.id, f]));
  const byDate = new Map(context.map((p) => [p.date, p]));
  const days: AdminDay[] = [];
  const total = Math.max(0, daysBetween(from, to)) + 1;
  for (let i = 0; i < total; i++) {
    const date = addDays(from, i);
    const p = byDate.get(date) ?? null;
    const isToday = date === today;
    const isPast = date < today;
    days.push({
      date,
      number: puzzleNumberForDate(date),
      isPast,
      isToday,
      editable: !isPast && !(isToday && p !== null),
      puzzle: p ? await toAdminPuzzle(repo, p, films, context) : null,
    });
  }
  return {
    today,
    launch: LAUNCH_DATE,
    aheadDays: SCHEDULING.aheadDays,
    cooldownDays: SCHEDULING.repeatCooldownDays,
    hintCount: HINT_CANDIDATES_PER_PUZZLE,
    days,
  };
}

export async function draftHints(filmId: number, repo: Repo = getRepo()): Promise<AdminDraftResponse> {
  const film = await repo.getFilm(filmId);
  if (!film) throw new ApiFailure('not_found', 'Film not found.');
  const hints = generateHints(film, await hintLibraryFor(repo, film));
  return { hints, problems: validateHints(hints, film).map((e) => e.message) };
}

export interface ScheduleRequest {
  date: string;
  filmId: number;
  /** undefined keeps the existing theme; null clears it. */
  theme?: string | null;
  /** undefined drafts fresh hints (or keeps them when the film is unchanged). */
  hints?: Hint[];
}

/** Schedule or swap the film for a date. Throws bad_request listing every broken rule. */
export async function schedulePuzzle(req: ScheduleRequest, now: Date = new Date(), repo: Repo = getRepo()): Promise<AdminPuzzle> {
  if (!isValidDate(req.date)) fail([{ code: 'bad_date', message: 'Dates use the YYYY-MM-DD format.' }]);
  const today = dateInResetZone(now);
  const [existing, film, nearby] = await Promise.all([
    repo.getPuzzleByDate(req.date),
    repo.getFilm(req.filmId),
    repo.listPuzzles(cooldownWindow(req.date)),
  ]);
  const certifications = film ? await repo.getCertifications(film.id) : [];
  let hints: Hint[];
  if (req.hints) hints = req.hints;
  else if (existing && existing.filmId === req.filmId) hints = existing.hints;
  else hints = film ? generateHints(film, await hintLibraryFor(repo, film)) : [];
  const theme = req.theme === undefined ? (existing?.theme ?? null) : req.theme?.trim() || null;
  const puzzle: Puzzle = { number: puzzleNumberForDate(req.date), date: req.date, filmId: req.filmId, theme, hints };
  const errors = validateSchedule({ ...puzzle, hints }, { today, film, certifications, nearby, existing });
  if (errors.length) fail(errors);
  await repo.upsertPuzzle(puzzle);
  const films = new Map(film ? [[film.id, film]] : []);
  return toAdminPuzzle(repo, puzzle, films, [...nearby.filter((p) => p.number !== puzzle.number), puzzle]);
}

async function editablePuzzle(repo: Repo, number: number, now: Date): Promise<Puzzle> {
  const puzzle = await repo.getPuzzle(number);
  if (!puzzle) throw new ApiFailure('not_found', 'No puzzle with that reel number.');
  const errors = validateDateWindow(puzzle.date, dateInResetZone(now), { existingOnDate: true });
  if (errors.length) fail(errors);
  return puzzle;
}

export async function updateHints(number: number, hints: Hint[], now: Date = new Date(), repo: Repo = getRepo()): Promise<AdminPuzzle> {
  const puzzle = await editablePuzzle(repo, number, now);
  const film = await repo.getFilm(puzzle.filmId);
  const errors = validateHints(hints, film);
  if (errors.length) fail(errors);
  const next: Puzzle = { ...puzzle, hints };
  await repo.upsertPuzzle(next);
  const nearby = await repo.listPuzzles(cooldownWindow(puzzle.date));
  return toAdminPuzzle(repo, next, new Map(film ? [[film.id, film]] : []), nearby);
}

export async function removePuzzle(number: number, now: Date = new Date(), repo: Repo = getRepo()): Promise<void> {
  await editablePuzzle(repo, number, now);
  await repo.deletePuzzle(number);
}

/** Set (or clear, with null) the theme on every scheduled puzzle in an inclusive date range. */
export async function setTheme(
  fromDate: string,
  toDate: string,
  theme: string | null,
  now: Date = new Date(),
  repo: Repo = getRepo(),
): Promise<AdminThemeResult> {
  const today = dateInResetZone(now);
  if (!isValidDate(fromDate) || !isValidDate(toDate)) fail([{ code: 'bad_date', message: 'Dates use the YYYY-MM-DD format.' }]);
  if (toDate < fromDate) fail([{ code: 'bad_date', message: 'The range ends before it starts.' }]);
  const errors = [
    ...validateDateWindow(fromDate, today, { existingOnDate: true }),
    ...validateDateWindow(toDate, today, { existingOnDate: true }),
    ...validateTheme(theme),
  ];
  if (errors.length) fail(errors);
  const clean = theme?.trim() || null;
  const puzzles = await repo.listPuzzles({ fromDate, toDate });
  const have = new Set(puzzles.map((p) => p.date));
  for (const p of puzzles) await repo.upsertPuzzle({ ...p, theme: clean });
  const skipped: string[] = [];
  for (let d = fromDate; d <= toDate; d = addDays(d, 1)) if (!have.has(d)) skipped.push(d);
  return { updated: puzzles.map((p) => p.number), skipped };
}
