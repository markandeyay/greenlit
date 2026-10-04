// Pure planner behind scripts/schedule/seed-puzzles.ts (Sections 13, 14, WS8). No I/O.
//
// For each date in [from, through]:
//   - an existing puzzle is KEPT (idempotent), unless `force` is set AND the date is after today
//     (past and live puzzles are never rewritten, even with --force);
//   - otherwise the most popular complete film (Section 14: seed with high-recognition films)
//     that is not used within SCHEDULING.repeatCooldownDays of the date (counting existing and
//     newly planned puzzles) and whose drafted hints pass validation is scheduled.
import type { Film, FilmCertification, Hint, Puzzle } from '@/lib/types';
import { LAUNCH_DATE } from '@/config/game';
import { addDays, puzzleNumberForDate } from '@/lib/dates';
import { cooldownConflicts, missingRequiredFields, validateDateWindow, validateHints } from './rules';

export interface SeedPlanInput {
  today: string;
  from: string;
  through: string;
  /** Candidate films (any order). Incomplete ones are filtered out here. */
  films: Film[];
  certifications: Map<number, FilmCertification[]>;
  /** Existing puzzles covering at least [from - cooldown, through + cooldown]. */
  existing: Puzzle[];
  generate: (film: Film) => Hint[];
  force?: boolean;
  launch?: string;
}

export interface SeedPlan {
  write: Puzzle[];
  kept: Puzzle[];
  /** Dates that could not be filled, with the reason. */
  unfilled: { date: string; reason: string }[];
}

export function planSeed(input: SeedPlanInput): SeedPlan {
  const launch = input.launch ?? LAUNCH_DATE;
  const candidates = input.films
    .filter((f) => missingRequiredFields(f, input.certifications.get(f.id) ?? []).length === 0)
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0) || a.id - b.id);
  const byDate = new Map(input.existing.map((p) => [p.date, p]));
  // Working set used for cooldown checks: existing puzzles, minus those we will replace, plus new ones.
  let working: Puzzle[] = [...input.existing];
  const plan: SeedPlan = { write: [], kept: [], unfilled: [] };

  for (let date = input.from; date <= input.through; date = addDays(date, 1)) {
    const existing = byDate.get(date) ?? null;
    const replace = existing !== null && input.force === true && date > input.today;
    if (existing && !replace) {
      plan.kept.push(existing);
      continue;
    }
    const dateErrors = validateDateWindow(date, input.today, { existingOnDate: existing !== null, allowTodayCreate: true, launch });
    if (dateErrors.length) {
      plan.unfilled.push({ date, reason: dateErrors[0]!.message });
      continue;
    }
    if (replace) working = working.filter((p) => p.date !== date);
    let chosen: Puzzle | null = null;
    for (const film of candidates) {
      if (cooldownConflicts(film.id, date, working).length) continue;
      const hints = input.generate(film);
      if (validateHints(hints, film).length) continue;
      chosen = { number: puzzleNumberForDate(date, launch), date, filmId: film.id, theme: existing?.theme ?? null, hints };
      break;
    }
    if (!chosen) {
      plan.unfilled.push({ date, reason: 'No complete film is outside the repeat cooldown.' });
      continue;
    }
    working.push(chosen);
    plan.write.push(chosen);
  }
  return plan;
}
