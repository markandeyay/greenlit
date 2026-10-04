// Default puzzle schedule for the in-memory repo: deterministic, so every serverless instance
// computes the same answer for the same day. Real deployments schedule via /admin (WS8).
import type { Film, FilmAward, Hint, Person, Puzzle } from '@/lib/types';
import { HINT_CANDIDATES_PER_PUZZLE, LAUNCH_DATE, SCHEDULING } from '@/config/game';
import { addDays, dateInResetZone, daysBetween } from '@/lib/dates';
import type { LibrarySnapshot } from './repo';

/** Small deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type HintGenerator = (film: Film, lib: LibrarySnapshot) => Hint[];

/** Simple fallback generator. WS8's generator (scripts/schedule/generate-hints) can replace it. */
export const defaultHintGenerator: HintGenerator = (film, lib) => {
  const out: Hint[] = [];
  const people = new Map<number, Person>(lib.people.map((p) => [p.id, p]));
  if (film.tagline) out.push({ type: 'tagline', payload: { text: film.tagline } });
  if (film.keywords.length >= 3) out.push({ type: 'plot_keywords', payload: { keywords: film.keywords.slice(0, 5) } });
  const award: FilmAward | undefined = lib.awards.find((a) => a.filmId === film.id);
  if (award) out.push({ type: 'awards', payload: { text: award.text } });
  const others = lib.films
    .filter((f) => f.id !== film.id && f.directorUnit.ids.some((id) => film.directorUnit.ids.includes(id)))
    .slice(0, 3);
  if (others.length) out.push({ type: 'filmography', payload: { films: others.map((f) => ({ title: f.title, year: f.releaseYear })) } });
  const castIds = [film.leadPersonId, ...film.supportingIds].filter((x): x is number => x !== null);
  for (const pid of castIds) {
    const other = lib.films.find((f) => f.id !== film.id && (f.leadPersonId === pid || f.supportingIds.includes(pid)));
    const person = people.get(pid);
    if (other && person) {
      out.push({ type: 'cast_connection', payload: { personName: person.name, filmTitle: other.title, filmYear: other.releaseYear } });
      break;
    }
  }
  const pick = out.slice(0, HINT_CANDIDATES_PER_PUZZLE - 1);
  pick.push({ type: 'first_letter', payload: { letter: film.title.replace(/^(The|A|An)\s+/i, '').charAt(0).toUpperCase() } });
  return pick;
};

/** Schedule eligible films from LAUNCH_DATE through today + SCHEDULING.aheadDays. */
export function buildDefaultSchedule(
  lib: LibrarySnapshot,
  opts: { now?: Date; launch?: string; generator?: HintGenerator } = {},
): Puzzle[] {
  const launch = opts.launch ?? LAUNCH_DATE;
  const generator = opts.generator ?? defaultHintGenerator;
  const eligible = lib.films
    .filter((f) => f.isAnswerEligible && f.boxOfficeUsd !== null)
    .sort((a, b) => a.id - b.id);
  if (eligible.length === 0) return [];
  const end = addDays(dateInResetZone(opts.now), SCHEDULING.aheadDays);
  const days = Math.max(0, daysBetween(launch, end)) + 1;
  // Shuffle in cycles so a film repeats only after the whole pool is used.
  const order: Film[] = [];
  let cycle = 0;
  while (order.length < days) {
    const r = rng(0x9e3779b1 ^ cycle);
    const pool = [...eligible];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    order.push(...pool);
    cycle++;
  }
  return Array.from({ length: days }, (_, i) => {
    const film = order[i]!;
    return { number: i + 1, date: addDays(launch, i), filmId: film.id, theme: null, hints: generator(film, lib) };
  });
}
