// Script Notes draft generator (Section 4.8, WS8). PURE: no I/O, no randomness, no mutation.
// Re-exported by scripts/schedule/generate-hints.ts. Signature matches HintGenerator in
// src/server/db/seed.ts so the orchestrator can plug it in as the default generator.
//
// Candidate sources, in priority order. Pass 1 picks for variety (one story clue: tagline or
// keywords; one people clue: cast or filmography; one context clue: awards or sequel), pass 2
// fills any remaining slots in this order. Types are always distinct (players pick by type).
//   1. tagline          film.tagline, with any title word masked as "___" (never leaks the title)
//   2. plot_keywords    3 to 5 TMDB keywords; keywords containing a title word are dropped
//   3. cast_connection  the most popular other library film sharing the lead or a supporting
//                       actor (lead preferred on ties); films whose title shares a title word are
//                       skipped (so "Toy Story 2" never hints "Toy Story")
//   4. filmography      up to 3 other films by any director in the unit, most popular first,
//                       shown in release order; title-sharing films skipped
//   5. awards           curated in-house blurb from lib.awards (skipped if it names the film)
//   6. sequel_status    only when honestly derivable from the title (a trailing sequel numeral
//                       or "Part N"); we never claim a film is an original
//   7. decade_vibe      "Released in the 1990s." (derived from release year, always honest)
//   8. first_letter     last resort only, never first, never the only non-last option
//
// Degenerate case (no tagline and no other source, so the film is not schedulable anyway): a
// second, finer decade line pads the list so the contract "exactly N candidates" holds; admin
// validation flags the duplicate type so a human edits it before it could be scheduled.
import type { Film, Hint, HintType, Person } from '@/lib/types';
import type { LibrarySnapshot } from '@/server/db/repo';
import { HINT_CANDIDATES_PER_PUZZLE } from '@/config/game';
import { normalizeForSearch } from '@/lib/search';

const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'in', 'on', 'to', 'for', 'at', 'by', 'with', 'from', 'part', 'chapter', 'episode', 'vol', 'volume']);
const ROMAN = new Set(['ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x']);
export const MASK = '___';

type TitleLike = Pick<Film, 'title' | 'originalTitle'>;

function words(s: string): string[] {
  return normalizeForSearch(s).split(' ').filter(Boolean);
}

/** Simple singular form so "rings" and "ring" match each other. */
function stem(w: string): string {
  return w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;
}

/**
 * The title words that would give the film away. Stop words, sequel numerals and words under
 * 3 characters are ignored unless the title has no other word ("Up", "It", "1917").
 */
export function titleTokens(film: TitleLike): Set<string> {
  const out = new Set<string>();
  for (const t of [film.title, film.originalTitle]) {
    if (!t) continue;
    const all = words(t);
    const strong = all.filter((w) => !STOP.has(w) && !ROMAN.has(w) && !/^\d{1,2}$/.test(w) && w.length >= 3);
    const chosen = strong.length ? strong : all.filter((w) => !STOP.has(w)).length ? all.filter((w) => !STOP.has(w)) : all;
    for (const w of chosen) out.add(stem(w));
  }
  return out;
}

/** True when the text names the film: its full title, or any significant title word. */
export function leaksTitle(text: string, film: TitleLike): boolean {
  const norm = normalizeForSearch(text);
  if (!norm) return false;
  for (const t of [film.title, film.originalTitle]) {
    const nt = t ? normalizeForSearch(t) : '';
    if (nt && ` ${norm} `.includes(` ${nt} `)) return true;
  }
  const tokens = titleTokens(film);
  return norm.split(' ').some((w) => tokens.has(stem(w)));
}

/** Replace every significant title word in `text` with MASK, keeping punctuation. */
export function maskTitle(text: string, film: TitleLike): string {
  const tokens = titleTokens(film);
  return text.replace(/[\p{L}\p{N}'’]+/gu, (word) => {
    const n = words(word).map(stem).filter((w) => w.length > 1);
    return n.length > 0 && n.every((w) => tokens.has(w)) ? MASK : word;
  });
}

/** Every human-readable string inside a hint (first_letter excluded: it is a letter by design). */
export function hintTexts(hint: Hint): string[] {
  switch (hint.type) {
    case 'tagline':
    case 'awards':
    case 'sequel_status':
    case 'decade_vibe':
    case 'creator_note':
      return [hint.payload.text];
    case 'plot_keywords':
      return hint.payload.keywords;
    case 'cast_connection':
      return [hint.payload.personName, hint.payload.filmTitle];
    case 'filmography':
      return hint.payload.films.map((f) => f.title);
    case 'first_letter':
      return [];
  }
}

export function hintLeaksTitle(hint: Hint, film: TitleLike): boolean {
  return hintTexts(hint).some((t) => leaksTitle(t, film));
}

export function firstLetter(title: string): string {
  const stripped = title.replace(/^(the|a|an)\s+/i, '').trim();
  const ch = [...stripped].find((c) => /[\p{L}\p{N}]/u.test(c)) ?? stripped.charAt(0);
  return ch.toUpperCase();
}

function castOf(f: Film): number[] {
  return [f.leadPersonId, ...f.supportingIds].filter((x): x is number => x !== null);
}

const pop = (f: Film) => f.popularity ?? 0;

/** Stable ordering: most popular first, then older, then lower id. */
function byFame(a: Film, b: Film): number {
  return pop(b) - pop(a) || a.releaseYear - b.releaseYear || a.id - b.id;
}

function taglineHint(film: Film): Hint | null {
  const raw = film.tagline?.trim();
  if (!raw) return null;
  const text = leaksTitle(raw, film) ? maskTitle(raw, film) : raw;
  // If masking could not remove the leak (e.g. the title is a stop word phrase), skip it.
  if (leaksTitle(text, film)) return null;
  if (!text.replace(new RegExp(MASK, 'g'), '').replace(/[^\p{L}\p{N}]/gu, '')) return null;
  return { type: 'tagline', payload: { text } };
}

function keywordsHint(film: Film): Hint | null {
  const seen = new Set<string>();
  const kws: string[] = [];
  for (const k of film.keywords) {
    const kw = k.trim();
    const key = normalizeForSearch(kw);
    if (!kw || !key || seen.has(key) || leaksTitle(kw, film)) continue;
    seen.add(key);
    kws.push(kw);
    if (kws.length === 5) break;
  }
  return kws.length >= 3 ? { type: 'plot_keywords', payload: { keywords: kws } } : null;
}

function castConnectionHint(film: Film, lib: LibrarySnapshot, people: Map<number, Person>): Hint | null {
  const cast = castOf(film);
  let best: { person: Person; other: Film; rank: number } | null = null;
  cast.forEach((pid, rank) => {
    const person = people.get(pid);
    if (!person || leaksTitle(person.name, film)) return;
    for (const other of lib.films) {
      if (other.id === film.id || !castOf(other).includes(pid) || leaksTitle(other.title, film)) continue;
      if (
        !best ||
        pop(other) > pop(best.other) ||
        (pop(other) === pop(best.other) && (rank < best.rank || (rank === best.rank && byFame(other, best.other) < 0)))
      ) {
        best = { person, other, rank };
      }
    }
  });
  if (!best) return null;
  const b = best as { person: Person; other: Film };
  return { type: 'cast_connection', payload: { personName: b.person.name, filmTitle: b.other.title, filmYear: b.other.releaseYear } };
}

function filmographyHint(film: Film, lib: LibrarySnapshot): Hint | null {
  const dirs = new Set(film.directorUnit.ids);
  if (dirs.size === 0) return null;
  const others = lib.films
    .filter((f) => f.id !== film.id && f.directorUnit.ids.some((id) => dirs.has(id)) && !leaksTitle(f.title, film))
    .sort(byFame)
    .slice(0, 3)
    .sort((a, b) => a.releaseYear - b.releaseYear || a.id - b.id);
  if (others.length === 0) return null;
  return { type: 'filmography', payload: { films: others.map((f) => ({ title: f.title, year: f.releaseYear })) } };
}

function awardsHint(film: Film, lib: LibrarySnapshot): Hint | null {
  const award = lib.awards.find((a) => a.filmId === film.id && a.text.trim() && !leaksTitle(a.text, film));
  return award ? { type: 'awards', payload: { text: award.text.trim() } } : null;
}

const SEQUEL_RE = /(?:\s|:)(?:part\s+)?(2|3|4|5|6|7|8|9|ii|iii|iv|v|vi|vii|viii|ix)(?:\s*$|\s*:)/i;
const PART_RE = /\bpart\s+(two|three|four|five|2|3|4|5|ii|iii|iv|v)\b/i;

/** "This film is a sequel." only when the title itself says so. Never claims an original. */
function sequelHint(film: Film): Hint | null {
  const t = film.title;
  if (SEQUEL_RE.test(t) || PART_RE.test(t)) return { type: 'sequel_status', payload: { text: 'This film is a sequel.' } };
  return null;
}

export function decadeOf(year: number): number {
  return Math.floor(year / 10) * 10;
}

function decadeHint(film: Film): Hint {
  return { type: 'decade_vibe', payload: { text: `Released in the ${decadeOf(film.releaseYear)}s.` } };
}

function eraPad(film: Film): Hint {
  const y = film.releaseYear % 10;
  const part = y <= 3 ? 'early' : y <= 6 ? 'mid' : 'late';
  return { type: 'decade_vibe', payload: { text: `A ${part} ${decadeOf(film.releaseYear)}s release.` } };
}

/** Variety groups for the first pass. decade_vibe is a filler only, so it is not in a group. */
const DIVERSITY_GROUPS: HintType[][] = [
  ['tagline', 'plot_keywords'],
  ['cast_connection', 'filmography'],
  ['awards', 'sequel_status'],
];
const PRIORITY: HintType[] = ['tagline', 'plot_keywords', 'cast_connection', 'filmography', 'awards', 'sequel_status', 'decade_vibe'];

/**
 * Draft exactly HINT_CANDIDATES_PER_PUZZLE hint candidates for a film. Pure and deterministic.
 * first_letter appears only as the last candidate, and only when nothing better exists.
 */
export function generateHints(film: Film, lib: LibrarySnapshot): Hint[] {
  const n = HINT_CANDIDATES_PER_PUZZLE;
  const people = new Map<number, Person>(lib.people.map((p) => [p.id, p]));
  const valid = (h: Hint | null): Hint | null => (h && !hintLeaksTitle(h, film) ? h : null);
  const all: Partial<Record<HintType, Hint>> = {};
  for (const h of [
    taglineHint(film),
    keywordsHint(film),
    castConnectionHint(film, lib, people),
    filmographyHint(film, lib),
    awardsHint(film, lib),
    sequelHint(film),
    decadeHint(film),
  ]) {
    const v = valid(h);
    if (v) all[v.type] = v;
  }
  const out: Hint[] = [];
  const used = new Set<HintType>();
  const take = (type: HintType): boolean => {
    const h = all[type];
    if (!h || used.has(type) || out.length >= n) return false;
    out.push(h);
    used.add(type);
    return true;
  };
  // Pass 1, variety: one story clue, one people clue, one context clue (when available).
  for (const group of DIVERSITY_GROUPS) group.some(take);
  // Pass 2, fill by overall priority.
  PRIORITY.forEach(take);
  if (out.length < n) {
    // Degenerate films only: pad so first_letter can stay strictly last.
    while (out.length < n - 1) out.push(eraPad(film));
    // first_letter: last resort, always the final candidate, never the only option.
    out.push({ type: 'first_letter', payload: { letter: firstLetter(film.title) } });
  }
  return out.slice(0, n);
}
