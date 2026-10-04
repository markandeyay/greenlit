// Share artifact builders, validation and the /api/share/card query codec (design brief v2,
// principle 8). Pure and isomorphic: used by mode screens, the ShareArtifactPanel and the image
// route.
//
// SPOILER RULE. The card is a pure function of a tiny, strictly validated shape: mode, reel,
// date, outcome, stat, caption, verdict grid, hinted. The only free-ish text is `stat` and
// `statCaption`, and both are limited to a safe charset, a short length AND a closed vocabulary:
// every word must be a number-like token (3/10, X/10, 12, 60s, 2nd) or a word from
// ARTIFACT_WORDS. A film title, person name or any other answer data cannot pass, so it can
// never reach the image URL. `url` and `text` are never encoded into the image query.
import type { ArtifactCell, ArtifactMode, ShareArtifact } from './artifact';

/** The parts of an artifact that the card image is drawn from (never url or text). */
export type ArtifactCard = Omit<ShareArtifact, 'url' | 'text'>;

export type ArtifactFormat = 'portrait' | 'wide';

export const ARTIFACT_FORMATS: Record<ArtifactFormat, { width: number; height: number }> = {
  portrait: { width: 1080, height: 1350 },
  wide: { width: 1200, height: 630 },
};

export const ARTIFACT_MODES: readonly ArtifactMode[] = [
  'daily',
  'vault',
  'pitch',
  'unlimited',
  'opening_weekend',
  'release_order',
  'casting_call',
  'logline',
];

/** Modes that carry a reel number. Every other mode must pass reelNumber null. */
export const REEL_MODES: readonly ArtifactMode[] = ['daily', 'vault'];

export const ARTIFACT_LIMITS = {
  statMax: 12,
  captionMax: 24,
  rowsMax: 10,
  cellsMax: 10,
  reelMax: 999_999,
  queryMax: 700,
} as const;

/**
 * Words allowed in `stat` and `statCaption` (case-insensitive). Deliberately short, generic game
 * words. Never add a word that could plausibly be (part of) a film title on its own; the spoiler
 * test checks the whole fixture library against this list.
 */
export const ARTIFACT_WORDS: ReadonlySet<string> = new Set([
  'a', 'all', 'and', 'attempt', 'attempts', 'avg', 'best', 'call', 'calls', 'chain', 'correct',
  'day', 'days', 'film', 'films', 'first', 'for', 'guess', 'guesses', 'hint', 'hints', 'in',
  'link', 'links', 'max', 'min', 'miss', 'misses', 'no', 'notes', 'of', 'optimal', 'order',
  'out', 'par', 'pick', 'picks', 'placed', 'pts', 'right', 'round', 'rounds', 'row', 'score',
  'sec', 'secs', 'sent', 'solved', 'step', 'steps', 'streak', 'take', 'takes', 'to', 'total',
  'tries', 'try', 'turnaround', 'under', 'with', 'won', 'lost', 'wrong', 'x',
]);

const STAT_CHARSET = /^[0-9A-Za-z /.+-]*$/;
/** A number-like token: 3/10, X/10, 12, 2.5, +3, 60s, 1st, 3x. Must contain a digit or be X. */
const NUMBER_TOKEN = /^(?:[+-]?(?:[0-9]+(?:[./][0-9]+)*|X)(?:\/(?:[0-9]+|X))*(?:s|x|st|nd|rd|th)?\+?|X)$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export class ArtifactError extends Error {
  override readonly name = 'ArtifactError';
}

export type ArtifactCheck = { ok: true } | { ok: false; error: string };
const bad = (error: string): ArtifactCheck => ({ ok: false, error });
const OK: ArtifactCheck = { ok: true };

/** True when every word of a stat or caption is a number-like token or an allowed word. */
export function isSafePhrase(value: string, max: number): boolean {
  if (typeof value !== 'string' || value.length > max || !STAT_CHARSET.test(value)) return false;
  if (value !== value.trim() || /\s{2,}/.test(value)) return false;
  if (value === '') return true;
  return value.split(' ').every((w) => NUMBER_TOKEN.test(w) || ARTIFACT_WORDS.has(w.toLowerCase()));
}

function isRealDate(s: string): boolean {
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 2000 || y > 2999) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

const CELLS: readonly ArtifactCell[] = ['match', 'close', 'miss', 'empty'];
const OUTCOMES = ['won', 'lost', 'score'] as const;

/** Validate the card part of an artifact (everything the image is drawn from). */
export function checkArtifactCard(card: ArtifactCard): ArtifactCheck {
  if (!card || typeof card !== 'object') return bad('artifact must be an object');
  if (!ARTIFACT_MODES.includes(card.mode)) return bad('unknown mode');
  if (card.reelNumber !== null) {
    if (!REEL_MODES.includes(card.mode)) return bad(`reelNumber must be null for ${card.mode}`);
    if (!Number.isInteger(card.reelNumber) || card.reelNumber < 1 || card.reelNumber > ARTIFACT_LIMITS.reelMax) {
      return bad('reelNumber must be a positive integer');
    }
  }
  if (card.date !== null && (typeof card.date !== 'string' || !isRealDate(card.date))) {
    return bad('date must be YYYY-MM-DD');
  }
  if (!OUTCOMES.includes(card.outcome)) return bad('outcome must be won, lost or score');
  if (typeof card.stat !== 'string' || card.stat.length === 0) return bad('stat is required');
  if (!isSafePhrase(card.stat, ARTIFACT_LIMITS.statMax)) {
    return bad(`stat must be up to ${ARTIFACT_LIMITS.statMax} chars of numbers and game words`);
  }
  if (!isSafePhrase(card.statCaption, ARTIFACT_LIMITS.captionMax)) {
    return bad(`statCaption must be up to ${ARTIFACT_LIMITS.captionMax} chars of numbers and game words`);
  }
  if (!Array.isArray(card.grid) || card.grid.length > ARTIFACT_LIMITS.rowsMax) return bad('too many grid rows');
  for (const row of card.grid) {
    if (!Array.isArray(row) || row.length === 0 || row.length > ARTIFACT_LIMITS.cellsMax) {
      return bad(`each grid row must have 1 to ${ARTIFACT_LIMITS.cellsMax} cells`);
    }
    if (!row.every((c) => CELLS.includes(c))) return bad('unknown grid cell');
  }
  if (card.hinted !== undefined && typeof card.hinted !== 'boolean') return bad('hinted must be a boolean');
  return OK;
}

export interface BuildArtifactInput {
  mode: ArtifactMode;
  reelNumber?: number | null;
  date?: string | null;
  outcome: ShareArtifact['outcome'];
  stat: string;
  statCaption?: string;
  grid?: ArtifactCell[][];
  hinted?: boolean;
  /** Absolute http(s) URL of the shared puzzle or mode page. No answer data. */
  url: string;
  /** The full emoji share text, ending with the link line. */
  text: string;
}

/**
 * Build and validate a ShareArtifact. Throws ArtifactError on anything the card route would
 * reject (bad enums, oversize grids, titles or other free text in stat/statCaption).
 */
export function buildArtifact(input: BuildArtifactInput): ShareArtifact {
  const artifact: ShareArtifact = {
    mode: input.mode,
    reelNumber: input.reelNumber ?? null,
    date: input.date ?? null,
    outcome: input.outcome,
    stat: input.stat,
    statCaption: input.statCaption ?? '',
    grid: (input.grid ?? []).map((r) => [...r]),
    url: input.url,
    text: input.text,
  };
  if (input.hinted) artifact.hinted = true;
  const check = checkArtifactCard(artifact);
  if (!check.ok) throw new ArtifactError(check.error);
  if (typeof input.url !== 'string' || !/^https?:\/\/[^\s]+$/.test(input.url)) {
    throw new ArtifactError('url must be an absolute http(s) URL');
  }
  if (typeof input.text !== 'string' || input.text.trim() === '') throw new ArtifactError('text is required');
  return artifact;
}

// ---------------------------------------------------------------------------
// Query codec for GET /api/share/card
//   f = portrait | wide            image format (default portrait)
//   m = mode code                  d v p u ow ro cc ll
//   n = reel number                daily and vault only
//   d = YYYY-MM-DD                 optional
//   o = w | l | s                  outcome won, lost, score
//   s = stat                       safe phrase, max 12
//   c = caption                    safe phrase, max 24 (optional)
//   g = rows joined by '.'         cells g match, y close, b miss, e empty (optional)
//   h = 1                          hinted (optional)
// ---------------------------------------------------------------------------

const MODE_CODE: Record<ArtifactMode, string> = {
  daily: 'd',
  vault: 'v',
  pitch: 'p',
  unlimited: 'u',
  opening_weekend: 'ow',
  release_order: 'ro',
  casting_call: 'cc',
  logline: 'll',
};
const CODE_MODE = Object.fromEntries(Object.entries(MODE_CODE).map(([k, v]) => [v, k])) as Record<string, ArtifactMode>;
const CELL_CODE: Record<ArtifactCell, string> = { match: 'g', close: 'y', miss: 'b', empty: 'e' };
const CODE_CELL: Record<string, ArtifactCell> = { g: 'match', y: 'close', b: 'miss', e: 'empty' };
const OUTCOME_CODE = { won: 'w', lost: 'l', score: 's' } as const;
const CODE_OUTCOME: Record<string, ShareArtifact['outcome']> = { w: 'won', l: 'lost', s: 'score' };
const ALLOWED_KEYS = new Set(['f', 'm', 'n', 'd', 'o', 's', 'c', 'g', 'h']);

export const ARTIFACT_IMAGE_PATH = '/api/share/card';

/** Encode the card part of an artifact as the /api/share/card query (no leading '?'). */
export function encodeArtifactQuery(artifact: ArtifactCard, format: ArtifactFormat = 'portrait'): string {
  const p = new URLSearchParams();
  p.set('f', format);
  p.set('m', MODE_CODE[artifact.mode]);
  if (artifact.reelNumber !== null) p.set('n', String(artifact.reelNumber));
  if (artifact.date) p.set('d', artifact.date);
  p.set('o', OUTCOME_CODE[artifact.outcome]);
  p.set('s', artifact.stat);
  if (artifact.statCaption) p.set('c', artifact.statCaption);
  if (artifact.grid.length) p.set('g', artifact.grid.map((r) => r.map((c) => CELL_CODE[c]).join('')).join('.'));
  if (artifact.hinted) p.set('h', '1');
  return p.toString();
}

/** Relative URL of the card PNG for an artifact. */
export function artifactImageUrl(artifact: ArtifactCard, format: ArtifactFormat = 'portrait'): string {
  return `${ARTIFACT_IMAGE_PATH}?${encodeArtifactQuery(artifact, format)}`;
}

export type DecodedArtifact =
  | { ok: true; card: ArtifactCard; format: ArtifactFormat }
  | { ok: false; error: string };

const fail = (error: string): DecodedArtifact => ({ ok: false, error });

/** Strictly decode and validate /api/share/card params. Anything unexpected is rejected. */
export function decodeArtifactQuery(params: URLSearchParams): DecodedArtifact {
  const seen = new Set<string>();
  for (const [key, value] of params) {
    if (!ALLOWED_KEYS.has(key)) return fail(`unknown parameter "${key.slice(0, 16)}"`);
    if (seen.has(key)) return fail(`repeated parameter "${key}"`);
    if (value.length > 120) return fail(`parameter "${key}" too long`);
    seen.add(key);
  }
  const f = params.get('f') ?? 'portrait';
  if (f !== 'portrait' && f !== 'wide') return fail('f must be portrait or wide');

  const mode = CODE_MODE[params.get('m') ?? ''];
  if (!mode) return fail('m must be a mode code');

  const n = params.get('n');
  let reelNumber: number | null = null;
  if (n !== null) {
    if (!/^[1-9][0-9]{0,5}$/.test(n)) return fail('n must be a positive reel number');
    reelNumber = Number(n);
  }

  const outcome = CODE_OUTCOME[params.get('o') ?? ''];
  if (!outcome) return fail('o must be w, l or s');

  const h = params.get('h');
  if (h !== null && h !== '1') return fail('h must be 1 or absent');

  const g = params.get('g');
  const grid: ArtifactCell[][] = [];
  if (g !== null) {
    if (g === '') return fail('g must not be empty');
    for (const row of g.split('.')) {
      if (!/^[gybe]{1,10}$/.test(row)) return fail('each row must be 1 to 10 cells of g, y, b or e');
      grid.push([...row].map((c) => CODE_CELL[c]!));
    }
  }

  const card: ArtifactCard = {
    mode,
    reelNumber,
    date: params.get('d'),
    outcome,
    stat: params.get('s') ?? '',
    statCaption: params.get('c') ?? '',
    grid,
  };
  if (h === '1') card.hinted = true;
  const check = checkArtifactCard(card);
  if (!check.ok) return fail(check.error);
  return { ok: true, card, format: f };
}

/** Pick only the card fields (drops url and text). */
export function toCard(artifact: ShareArtifact | ArtifactCard): ArtifactCard {
  const card: ArtifactCard = {
    mode: artifact.mode,
    reelNumber: artifact.reelNumber,
    date: artifact.date,
    outcome: artifact.outcome,
    stat: artifact.stat,
    statCaption: artifact.statCaption,
    grid: artifact.grid,
  };
  if (artifact.hinted) card.hinted = true;
  return card;
}
