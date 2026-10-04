// Share grid (WS6, Section 7). Pure and isomorphic: used by the share text, the ShareSheet and
// the /api/og/result route. A grid is ONLY verdicts: never a title, film id, poster or any answer
// attribute (Section 10).
import { RULES } from '@/config/rules';
import type { GuessFeedback, PlayKind } from '@/lib/types';
import type { ShareInput } from './types';

/** One share square. 'na' verdicts collapse to 'miss' (rendered as a black square). */
export type ShareCell = 'match' | 'close' | 'miss';

/**
 * The 8 share columns, in order (Section 7.1). Score is intentionally absent: the spec lists
 * exactly these 8 squares.
 */
export const SHARE_COLUMNS = [
  'Director',
  'Lead',
  'Supporting',
  'Year',
  'Box office',
  'Rating',
  'Studio',
  'Genres',
] as const;

export const CELLS_PER_ROW = SHARE_COLUMNS.length;

export interface ShareGrid {
  kind: PlayKind;
  /** Reel number for daily and vault plays, null for pitches. */
  reelNumber: number | null;
  /** Oldest first. */
  rows: ShareCell[][];
  status: 'won' | 'lost';
  hintsUsed: boolean;
}

const binary = (v: string | undefined): ShareCell => (v === 'match' ? 'match' : 'miss');
const numeric = (v: string): ShareCell => (v === 'match' ? 'match' : v === 'close' ? 'close' : 'miss');
const anyMatch = (list: readonly { verdict: string }[]): ShareCell =>
  list.some((x) => x.verdict === 'match') ? 'match' : 'miss';

/** Collapse one guess's feedback to its 8 share cells. */
export function feedbackToCells(fb: GuessFeedback): ShareCell[] {
  return [
    binary(fb.director.verdict),
    binary(fb.lead?.verdict),
    anyMatch(fb.supporting),
    numeric(fb.year.verdict),
    numeric(fb.boxOffice.verdict),
    binary(fb.rating.verdict),
    binary(fb.studio.verdict),
    anyMatch(fb.genres),
  ];
}

/** Build the verdict-only grid from a finished play. */
export function gridFromInput(input: ShareInput): ShareGrid {
  return {
    kind: input.kind,
    reelNumber: input.kind === 'pitch' ? null : input.reelNumber,
    rows: input.feedback.map(feedbackToCells),
    status: input.status,
    hintsUsed: input.hintsUsed > 0,
  };
}

// ---------------------------------------------------------------------------
// Query encoding for /api/og/result
//   k = d | v | p           kind (daily, vault, pitch)
//   n = reel number         daily and vault only, absent for pitches
//   t = takes               0..RULES.maxGuesses, equals the number of rows
//   s = won | lost
//   h = 0 | 1               Script Notes used
//   g = rows joined by '-'  each row exactly 8 chars from {g, y, b}
// ---------------------------------------------------------------------------

const CELL_CODE: Record<ShareCell, string> = { match: 'g', close: 'y', miss: 'b' };
const CODE_CELL: Record<string, ShareCell> = { g: 'match', y: 'close', b: 'miss' };
const KIND_CODE: Record<PlayKind, string> = { daily: 'd', vault: 'v', pitch: 'p' };
const CODE_KIND: Record<string, PlayKind> = { d: 'daily', v: 'vault', p: 'pitch' };

const ALLOWED_KEYS = new Set(['k', 'n', 't', 's', 'h', 'g']);
/** Longest legal `g`: maxGuesses rows of 8 cells plus separators. */
export const MAX_GRID_PARAM_LENGTH = RULES.maxGuesses * (CELLS_PER_ROW + 1) - 1;
const MAX_REEL_DIGITS = 6;

/** Encode a grid as the query string (no leading '?') for /api/og/result. */
export function encodeGrid(grid: ShareGrid): string {
  const params = new URLSearchParams();
  params.set('k', KIND_CODE[grid.kind]);
  if (grid.kind !== 'pitch' && grid.reelNumber !== null) params.set('n', String(grid.reelNumber));
  params.set('t', String(grid.rows.length));
  params.set('s', grid.status);
  params.set('h', grid.hintsUsed ? '1' : '0');
  params.set('g', grid.rows.map((r) => r.map((c) => CELL_CODE[c]).join('')).join('-'));
  return params.toString();
}

/** Encode a finished play's grid (verdicts only) as the /api/og/result query string. */
export function encodeShareGrid(input: ShareInput): string {
  return encodeGrid(gridFromInput(input));
}

/** Relative URL of the share image for a finished play. */
export function shareImagePath(input: ShareInput): string {
  return `/api/og/result?${encodeShareGrid(input)}`;
}

export type DecodeResult = { ok: true; grid: ShareGrid } | { ok: false; error: string };

const fail = (error: string): DecodeResult => ({ ok: false, error });

/**
 * Strictly validate and decode /api/og/result query params. Anything unexpected (unknown or
 * repeated keys, bad lengths, bad characters, inconsistent take count) is rejected.
 */
export function decodeShareGrid(params: URLSearchParams): DecodeResult {
  const seen = new Set<string>();
  for (const [key, value] of params) {
    if (!ALLOWED_KEYS.has(key)) return fail(`unknown parameter "${key.slice(0, 16)}"`);
    if (seen.has(key)) return fail(`repeated parameter "${key}"`);
    if (value.length > MAX_GRID_PARAM_LENGTH) return fail(`parameter "${key}" too long`);
    seen.add(key);
  }

  const kind = CODE_KIND[params.get('k') ?? ''];
  if (!kind) return fail('k must be d, v or p');

  const n = params.get('n');
  let reelNumber: number | null = null;
  if (kind === 'pitch') {
    if (n !== null) return fail('n is not allowed for pitches');
  } else {
    if (n === null || !new RegExp(`^[1-9][0-9]{0,${MAX_REEL_DIGITS - 1}}$`).test(n)) {
      return fail('n must be a positive reel number');
    }
    reelNumber = Number(n);
  }

  const s = params.get('s');
  if (s !== 'won' && s !== 'lost') return fail('s must be won or lost');

  const h = params.get('h');
  if (h !== '0' && h !== '1') return fail('h must be 0 or 1');

  const t = params.get('t');
  if (t === null || !/^(0|[1-9][0-9]?)$/.test(t)) return fail('t must be a take count');
  const takes = Number(t);
  if (takes > RULES.maxGuesses) return fail('t exceeds the take limit');

  const g = params.get('g');
  if (g === null) return fail('g is required');
  const rowStrings = g === '' ? [] : g.split('-');
  if (rowStrings.length > RULES.maxGuesses) return fail('too many rows');
  const rowPattern = new RegExp(`^[gyb]{${CELLS_PER_ROW}}$`);
  const rows: ShareCell[][] = [];
  for (const row of rowStrings) {
    if (!rowPattern.test(row)) return fail(`each row must be ${CELLS_PER_ROW} cells of g, y or b`);
    rows.push([...row].map((c) => CODE_CELL[c]!));
  }
  if (rows.length !== takes) return fail('t must equal the number of rows');
  if (s === 'won' && rows.length === 0) return fail('a win needs at least one row');

  return { ok: true, grid: { kind, reelNumber, rows, status: s, hintsUsed: h === '1' } };
}
