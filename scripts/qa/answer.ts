// Node-side knowledge of the keyless fixture schedule (WS10), for e2e win flows and the leak test.
// The browser never gets this from the app: tests compute it here from the same deterministic
// inputs the in-memory repo uses (fixture library + buildDefaultSchedule + New York calendar).
import fixture from '../../src/server/db/fixtures/library.json';
import type { LibrarySnapshot } from '../../src/server/db/repo';
import { buildDefaultSchedule } from '../../src/server/db/seed';
import { todayPuzzleNumber } from '../../src/lib/dates';
import type { Film } from '../../src/lib/types';

export const library = fixture as unknown as LibrarySnapshot;

const schedule = buildDefaultSchedule(library, { generator: () => [] });

export function filmById(id: number): Film {
  const f = library.films.find((x) => x.id === id);
  if (!f) throw new Error(`Film ${id} not in fixture library`);
  return f;
}

export function puzzleFilm(number: number): Film {
  const p = schedule.find((x) => x.number === number);
  if (!p) throw new Error(`Reel ${number} is not scheduled`);
  return filmById(p.filmId);
}

export function todayNumber(): number {
  return todayPuzzleNumber();
}

export function todayAnswer(): Film {
  return puzzleFilm(todayNumber());
}

/** True when typing this title into search would surface `film` as the first hit unambiguously. */
function titleIsDistinct(film: Film): boolean {
  const t = film.title.toLowerCase();
  return !library.films.some((o) => o.id !== film.id && o.isPlayable && o.title.toLowerCase() === t);
}

/**
 * Playable films that are not the answer and do not share a title prefix with it, so a wrong
 * guess can never select the answer by accident. Deterministic order.
 */
export function wrongFilms(answer: Film, count: number): Film[] {
  const a = answer.title.toLowerCase();
  const out = library.films
    .filter((f) => f.isPlayable && f.id !== answer.id && titleIsDistinct(f))
    .filter((f) => {
      const t = f.title.toLowerCase();
      return !t.includes(a) && !a.includes(t);
    })
    .sort((x, y) => x.id - y.id);
  if (out.length < count) throw new Error(`Only ${out.length} wrong films available`);
  return out.slice(0, count);
}
