// The Call Sheet (Section 4.7): everything the player has learned, derived purely from the
// feedback the server returned. NEVER pass answer data in here (Section 10): the sheet is
// computed client-side from `GuessFeedback[]` only.
//
// Guess indices used throughout are 0-based positions in the `feedback` array, which is
// oldest first (the same order as `PlayStateResponse.feedback`).
//
// Numeric bounds invert the exact comparison math in src/lib/verdicts.ts:
//   Year / score (integers, inclusive bounds, band = RULES.yearClose / RULES.scoreClose):
//     match            -> [g, g]
//     close, up        -> [g + 1, g + band]       close, down -> [g - band, g - 1]
//     miss,  up        -> [g + band + 1, inf)     miss,  down -> (-inf, g - band - 1]
//   Box office (continuous, p = RULES.boxOfficeGreenPct, r = RULES.boxOfficeCloseRatio):
//     match            -> [g / (1 + p), g * (1 + p)]
//     close, up        -> (g * (1 + p), g * r]    close, down -> [g / r, g / (1 + p))
//     miss,  up        -> (g * r, inf)            miss,  down -> (0, g / r)
//   'na' cells (unknown value on either side) are skipped entirely.
// Box office bounds are widened outward by a tiny relative epsilon so floating point rounding
// at an exact threshold can never exclude the true answer.

import { RULES } from '@/config/rules';
import type { GuessFeedback, NumberFeedback, PersonFeedback, RegionCode, Verdict, Direction } from '@/lib/types';

// ---------------------------------------------------------------------------
// Types (WS5 imports these)
// ---------------------------------------------------------------------------

export type NumericAttribute = 'year' | 'boxOffice' | 'score';

/** One side of an interval. `from` is the guess index that produced the tightest bound. */
export interface RangeBound {
  value: number;
  inclusive: boolean;
  from: number;
}

/** A guess value plotted on the range bar. */
export interface RangeTick {
  value: number;
  verdict: Exclude<Verdict, 'na'>;
  direction: Direction;
  guessIndex: number;
}

export type NumericStatus = 'unknown' | 'range' | 'exact' | 'conflict';

export interface NumericRange {
  attribute: NumericAttribute;
  /** Lower bound, or null when unbounded below. */
  lo: RangeBound | null;
  /** Upper bound, or null when unbounded above. */
  hi: RangeBound | null;
  /**
   * 'unknown': no usable feedback yet. 'exact': year/score pinned to one value.
   * 'range': a (possibly half-open) interval. 'conflict': the clues have an empty intersection
   * (should never happen with real feedback; rendered defensively).
   */
  status: NumericStatus;
  /** The pinned value when status is 'exact', else null. */
  exact: number | null;
  /** True when any guess matched (box office: within the green band of a guess). */
  confirmed: boolean;
  /** Every non-'na' guess value, oldest first. */
  ticks: RangeTick[];
  /** Guess indices that produced this row (every non-'na' guess). */
  guessIndices: number[];
}

export interface DirectorEntry {
  display: string;
  personIds: number[];
  guessIndices: number[];
}

export interface DirectorState {
  confirmed: DirectorEntry | null;
  cut: DirectorEntry[];
  guessIndices: number[];
}

export interface CastEntry {
  personId: number;
  name: string;
  profilePath: string | null;
  status: 'confirmed' | 'cut';
  /** Where the actor sits in the answer (only present on confirmed entries, when known). */
  answerRole?: PersonFeedback['answerRole'];
  guessIndices: number[];
}

export interface CastState {
  confirmed: CastEntry[];
  cut: CastEntry[];
  guessIndices: number[];
}

export interface RatingEntry {
  value: string;
  region: RegionCode;
  guessIndices: number[];
}

export interface RatingState {
  confirmed: RatingEntry | null;
  cut: RatingEntry[];
  guessIndices: number[];
}

export interface StudioEntry {
  name: string;
  guessIndices: number[];
}

export interface StudioState {
  confirmed: StudioEntry | null;
  cut: StudioEntry[];
  guessIndices: number[];
}

export interface GenreEntry {
  id: number;
  name: string;
  guessIndices: number[];
}

export interface GenreState {
  confirmed: GenreEntry[];
  cut: GenreEntry[];
  /** Answer's total genre count (from feedback), or null before any guess. */
  total: number | null;
  /** Genres still unknown: total minus confirmed (never negative). */
  remaining: number | null;
  guessIndices: number[];
}

export interface CallSheetCounts {
  /** Confirmed facts, for the mobile strip ("Call Sheet · 4 confirmed"). */
  confirmed: number;
  /** Ruled-out facts (people, studios, ratings, genres). */
  cut: number;
}

export interface CallSheetState {
  guessCount: number;
  solved: boolean;
  director: DirectorState;
  cast: CastState;
  year: NumericRange;
  boxOffice: NumericRange;
  score: NumericRange;
  rating: RatingState;
  studio: StudioState;
  genres: GenreState;
  counts: CallSheetCounts;
  /** True when any numeric attribute has contradictory clues. */
  conflict: boolean;
}

// ---------------------------------------------------------------------------
// Numeric bounds
// ---------------------------------------------------------------------------

/** Score is a 0..100 value (Section 8). */
export const SCORE_MIN = 0;
export const SCORE_MAX = 100;
const BOX_EPS = 1e-9;

export interface GuessBounds {
  lo: { value: number; inclusive: boolean } | null;
  hi: { value: number; inclusive: boolean } | null;
}

/** Bounds on an integer answer implied by one guess. null = no information. */
export function integerBoundsFor(fb: NumberFeedback, band: number): GuessBounds | null {
  const g = fb.value;
  if (g === null || !Number.isFinite(g) || fb.verdict === 'na') return null;
  const inc = (value: number) => ({ value, inclusive: true });
  switch (fb.verdict) {
    case 'match':
      return { lo: inc(g), hi: inc(g) };
    case 'close':
      if (fb.direction === 'up') return { lo: inc(g + 1), hi: inc(g + band) };
      if (fb.direction === 'down') return { lo: inc(g - band), hi: inc(g - 1) };
      return { lo: inc(g - band), hi: inc(g + band) }; // defensive: direction missing
    case 'miss':
      if (fb.direction === 'up') return { lo: inc(g + band + 1), hi: null };
      if (fb.direction === 'down') return { lo: null, hi: inc(g - band - 1) };
      return null;
    default:
      return null;
  }
}

/** Bounds on a positive box office answer implied by one guess. null = no information. */
export function boxOfficeBoundsFor(fb: NumberFeedback): GuessBounds | null {
  const g = fb.value;
  if (g === null || !Number.isFinite(g) || g <= 0 || fb.verdict === 'na') return null;
  const green = 1 + RULES.boxOfficeGreenPct;
  const ratio = RULES.boxOfficeCloseRatio;
  // Widen outward so rounding at an exact threshold never excludes the truth.
  const down = (v: number) => v * (1 - BOX_EPS);
  const up = (v: number) => v * (1 + BOX_EPS);
  switch (fb.verdict) {
    case 'match':
      return { lo: { value: down(g / green), inclusive: true }, hi: { value: up(g * green), inclusive: true } };
    case 'close':
      if (fb.direction === 'up') {
        return { lo: { value: down(g * green), inclusive: false }, hi: { value: up(g * ratio), inclusive: true } };
      }
      if (fb.direction === 'down') {
        return { lo: { value: down(g / ratio), inclusive: true }, hi: { value: up(g / green), inclusive: false } };
      }
      return { lo: { value: down(g / ratio), inclusive: true }, hi: { value: up(g * ratio), inclusive: true } };
    case 'miss':
      if (fb.direction === 'up') return { lo: { value: down(g * ratio), inclusive: false }, hi: null };
      if (fb.direction === 'down') return { lo: null, hi: { value: up(g / ratio), inclusive: false } };
      return null;
    default:
      return null;
  }
}

function tighterLo(a: RangeBound | null, b: RangeBound): RangeBound {
  if (!a) return b;
  if (b.value > a.value) return b;
  if (b.value === a.value && !b.inclusive && a.inclusive) return b;
  return a;
}

function tighterHi(a: RangeBound | null, b: RangeBound): RangeBound {
  if (!a) return b;
  if (b.value < a.value) return b;
  if (b.value === a.value && !b.inclusive && a.inclusive) return b;
  return a;
}

function isEmpty(lo: RangeBound | null, hi: RangeBound | null): boolean {
  if (!lo || !hi) return false;
  if (lo.value > hi.value) return true;
  return lo.value === hi.value && !(lo.inclusive && hi.inclusive);
}

function computeRange(
  attribute: NumericAttribute,
  feedback: GuessFeedback[],
  boundsFor: (fb: NumberFeedback) => GuessBounds | null,
  clamp?: { min: number; max: number },
): NumericRange {
  let lo: RangeBound | null = null;
  let hi: RangeBound | null = null;
  let confirmed = false;
  const ticks: RangeTick[] = [];
  const guessIndices: number[] = [];

  feedback.forEach((guess, i) => {
    const fb = guess[attribute];
    if (!fb) return;
    const b = boundsFor(fb);
    if (!b || fb.value === null || fb.verdict === 'na') return;
    ticks.push({ value: fb.value, verdict: fb.verdict, direction: fb.direction, guessIndex: i });
    guessIndices.push(i);
    if (fb.verdict === 'match') confirmed = true;
    if (b.lo) lo = tighterLo(lo, { ...b.lo, from: i });
    if (b.hi) hi = tighterHi(hi, { ...b.hi, from: i });
  });

  if (clamp && guessIndices.length > 0) {
    const first = guessIndices[0];
    const loB = lo as RangeBound | null;
    const hiB = hi as RangeBound | null;
    if (!loB || loB.value < clamp.min) lo = { value: clamp.min, inclusive: true, from: loB?.from ?? first };
    if (!hiB || hiB.value > clamp.max) hi = { value: clamp.max, inclusive: true, from: hiB?.from ?? first };
  }

  const loF = lo as RangeBound | null;
  const hiF = hi as RangeBound | null;
  let status: NumericStatus;
  let exact: number | null = null;
  if (guessIndices.length === 0) status = 'unknown';
  else if (isEmpty(loF, hiF)) status = 'conflict';
  else if (attribute !== 'boxOffice' && loF && hiF && loF.value === hiF.value) {
    status = 'exact';
    exact = loF.value;
  } else status = 'range';

  return { attribute, lo: loF, hi: hiF, status, exact, confirmed, ticks, guessIndices };
}

export function computeYearRange(feedback: GuessFeedback[]): NumericRange {
  return computeRange('year', feedback, (fb) => integerBoundsFor(fb, RULES.yearClose));
}

export function computeScoreRange(feedback: GuessFeedback[]): NumericRange {
  return computeRange('score', feedback, (fb) => integerBoundsFor(fb, RULES.scoreClose), {
    min: SCORE_MIN,
    max: SCORE_MAX,
  });
}

export function computeBoxOfficeRange(feedback: GuessFeedback[]): NumericRange {
  return computeRange('boxOffice', feedback, boxOfficeBoundsFor);
}

/** True when `value` satisfies the range's bounds (ignores status). */
export function rangeContains(range: Pick<NumericRange, 'lo' | 'hi'>, value: number): boolean {
  const { lo, hi } = range;
  if (lo && (lo.inclusive ? value < lo.value : value <= lo.value)) return false;
  if (hi && (hi.inclusive ? value > hi.value : value >= hi.value)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Sets: people, rating, studio, genres
// ---------------------------------------------------------------------------

function pushUnique(list: number[], i: number) {
  if (list[list.length - 1] !== i && !list.includes(i)) list.push(i);
}

function computeDirector(feedback: GuessFeedback[]): DirectorState {
  let confirmed: DirectorEntry | null = null;
  const cut = new Map<string, DirectorEntry>();
  const guessIndices: number[] = [];
  feedback.forEach((g, i) => {
    const d = g.director;
    if (!d) return;
    pushUnique(guessIndices, i);
    const key = [...d.personIds].sort((a, b) => a - b).join(',') || `name:${d.display}`;
    if (d.verdict === 'match') {
      if (!confirmed) confirmed = { display: d.display, personIds: [...d.personIds], guessIndices: [i] };
      else pushUnique(confirmed.guessIndices, i);
    } else {
      const existing = cut.get(key);
      if (existing) pushUnique(existing.guessIndices, i);
      else cut.set(key, { display: d.display, personIds: [...d.personIds], guessIndices: [i] });
    }
  });
  return { confirmed, cut: [...cut.values()], guessIndices };
}

function computeCast(feedback: GuessFeedback[]): CastState {
  const entries = new Map<number, CastEntry>();
  const guessIndices: number[] = [];
  feedback.forEach((g, i) => {
    const people = [g.lead, ...(g.supporting ?? [])].filter((p): p is PersonFeedback => !!p);
    for (const p of people) {
      pushUnique(guessIndices, i);
      const existing = entries.get(p.personId);
      if (existing) {
        pushUnique(existing.guessIndices, i);
        // A match always wins (a miss and a match for the same person cannot both be true).
        if (p.verdict === 'match' && existing.status === 'cut') existing.status = 'confirmed';
        if (p.verdict === 'match' && p.answerRole && !existing.answerRole) existing.answerRole = p.answerRole;
      } else {
        entries.set(p.personId, {
          personId: p.personId,
          name: p.name,
          profilePath: p.profilePath,
          status: p.verdict === 'match' ? 'confirmed' : 'cut',
          ...(p.verdict === 'match' && p.answerRole ? { answerRole: p.answerRole } : {}),
          guessIndices: [i],
        });
      }
    }
  });
  const all = [...entries.values()];
  return {
    confirmed: all.filter((e) => e.status === 'confirmed'),
    cut: all.filter((e) => e.status === 'cut'),
    guessIndices,
  };
}

function computeRating(feedback: GuessFeedback[]): RatingState {
  let confirmed: RatingEntry | null = null;
  const cut = new Map<string, RatingEntry>();
  const guessIndices: number[] = [];
  feedback.forEach((g, i) => {
    const r = g.rating;
    if (!r || r.verdict === 'na' || r.value === null) return;
    pushUnique(guessIndices, i);
    if (r.verdict === 'match') {
      if (!confirmed) confirmed = { value: r.value, region: r.region, guessIndices: [i] };
      else pushUnique(confirmed.guessIndices, i);
    } else {
      const key = `${r.region}:${r.value}`;
      const existing = cut.get(key);
      if (existing) pushUnique(existing.guessIndices, i);
      else cut.set(key, { value: r.value, region: r.region, guessIndices: [i] });
    }
  });
  return { confirmed, cut: [...cut.values()], guessIndices };
}

function computeStudio(feedback: GuessFeedback[]): StudioState {
  let confirmed: StudioEntry | null = null;
  const cut = new Map<string, StudioEntry>();
  const guessIndices: number[] = [];
  feedback.forEach((g, i) => {
    const s = g.studio;
    if (!s || !s.name) return;
    pushUnique(guessIndices, i);
    if (s.verdict === 'match') {
      if (!confirmed) confirmed = { name: s.name, guessIndices: [i] };
      else pushUnique(confirmed.guessIndices, i);
    } else {
      const existing = cut.get(s.name);
      if (existing) pushUnique(existing.guessIndices, i);
      else cut.set(s.name, { name: s.name, guessIndices: [i] });
    }
  });
  return { confirmed, cut: [...cut.values()], guessIndices };
}

function computeGenres(feedback: GuessFeedback[]): GenreState {
  const confirmed = new Map<number, GenreEntry>();
  const cut = new Map<number, GenreEntry>();
  const guessIndices: number[] = [];
  let total: number | null = null;
  feedback.forEach((g, i) => {
    if (typeof g.genreCount === 'number' && Number.isFinite(g.genreCount)) total = g.genreCount;
    for (const genre of g.genres ?? []) {
      pushUnique(guessIndices, i);
      const target = genre.verdict === 'match' ? confirmed : cut;
      const existing = target.get(genre.id);
      if (existing) pushUnique(existing.guessIndices, i);
      else target.set(genre.id, { id: genre.id, name: genre.name, guessIndices: [i] });
    }
  });
  // A match wins over a (contradictory) miss for the same genre id.
  for (const id of confirmed.keys()) cut.delete(id);
  const totalF = total as number | null;
  const remaining = totalF === null ? null : Math.max(0, totalF - confirmed.size);
  if (totalF !== null && feedback.length > 0) pushUnique(guessIndices, feedback.length - 1);
  guessIndices.sort((a, b) => a - b);
  return { confirmed: [...confirmed.values()], cut: [...cut.values()], total: totalF, remaining, guessIndices };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/** Pure: derive the Call Sheet from feedback only (oldest first). Never throws on odd input. */
export function computeCallSheet(feedback: readonly GuessFeedback[]): CallSheetState {
  const list = Array.isArray(feedback) ? feedback.filter(Boolean) : [];
  const director = computeDirector(list);
  const cast = computeCast(list);
  const year = computeYearRange(list);
  const boxOffice = computeBoxOfficeRange(list);
  const score = computeScoreRange(list);
  const rating = computeRating(list);
  const studio = computeStudio(list);
  const genres = computeGenres(list);

  const confirmedCount =
    (director.confirmed ? 1 : 0) +
    cast.confirmed.length +
    (year.status === 'exact' ? 1 : 0) +
    (boxOffice.confirmed && boxOffice.status !== 'conflict' ? 1 : 0) +
    (score.status === 'exact' ? 1 : 0) +
    (rating.confirmed ? 1 : 0) +
    (studio.confirmed ? 1 : 0) +
    genres.confirmed.length;
  const cutCount =
    director.cut.length + cast.cut.length + rating.cut.length + studio.cut.length + genres.cut.length;

  return {
    guessCount: list.length,
    solved: list.some((g) => g.isCorrect),
    director,
    cast,
    year,
    boxOffice,
    score,
    rating,
    studio,
    genres,
    counts: { confirmed: confirmedCount, cut: cutCount },
    conflict: [year, boxOffice, score].some((r) => r.status === 'conflict'),
  };
}
