// Leak scanner (WS10, Section 10): pure functions that look for a puzzle answer inside captured
// response bodies, URLs and cookies. No browser or Node APIs here, so it is unit tested
// (tests/unit/qa/leak-scan.test.ts) and shared by tests/e2e/leak.spec.ts and scripts/qa/leak-test.ts.
//
// Matching rules
// - Title: case-insensitive, whole words, whitespace-flexible, after decoding HTML entities and
//   JSON / JS string escapes. Titles with a subtitle ("A: B") also match on the subtitle alone
//   when it is distinctive (8+ chars). Very short single-word titles ("Up", "Jaws") are matched
//   case-sensitively so ordinary English in a JS chunk does not trip the test.
// - Tagline: the answer's tagline (case-insensitive, normalized). It is the reveal card's copy and
//   a hint candidate, so it must not appear before the reveal unless that hint was requested.
// - TMDB id: as a whole number token. In JSON from /api/* every numeric value equal to the id is
//   flagged except under person / genre / studio id keys (those are other id spaces), and every
//   string containing the id as a token is flagged. In HTML, RSC, JS and CSS bodies a bare
//   number token is far too common (`120ms`, `w-[120px]`), so only film-id contexts are flagged:
//   `"filmId":120`, `"id":120` (also escaped inside RSC strings), `filmId=120`, `/films/120`, etc.
// - URLs (documents, fetches, images, OG images): title words and the id in a path segment or
//   query value.

export interface AnswerNeedles {
  id: number;
  title: string;
  /** Regexes for the title and its distinctive variants. */
  titlePatterns: RegExp[];
  /** Normalized tagline (lowercase, single spaces), or null. */
  tagline: string | null;
}

export interface LeakFinding {
  source: string;
  kind: 'title' | 'tagline' | 'id' | 'library';
  detail: string;
}

const ESCAPE_RE = /[.*+?^${}()|[\]\\]/g;
const escapeRe = (s: string) => s.replace(ESCAPE_RE, '\\$&');

const SHORT_TITLE_LEN = 5;

function titleRegex(text: string): RegExp {
  const words = text.trim().split(/\s+/).map(escapeRe);
  const body = words.join('\\s+');
  const single = words.length === 1;
  const flags = single && text.length <= SHORT_TITLE_LEN ? 'g' : 'gi';
  // Word-ish boundaries that also work when the title starts or ends with punctuation.
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, `${flags}u`);
}

export function buildNeedles(film: { id: number; title: string; tagline?: string | null }): AnswerNeedles {
  const patterns = [titleRegex(film.title)];
  const colon = film.title.indexOf(':');
  if (colon > 0) {
    const sub = film.title.slice(colon + 1).trim().replace(/^(the|a|an)\s+/i, '');
    if (sub.length >= 8) patterns.push(titleRegex(sub));
  }
  const tagline = film.tagline ? normalizeText(film.tagline).toLowerCase() : null;
  return { id: film.id, title: film.title, titlePatterns: patterns, tagline: tagline && tagline.length >= 12 ? tagline : null };
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

/** Decode HTML entities, JSON / JS unicode escapes and escaped quotes, collapse whitespace. */
export function normalizeText(raw: string): string {
  return raw
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+|#39);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\\(["'/\\])/g, '$1')
    .replace(/\\n/g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ');
}

function excerpt(text: string, index: number, len: number): string {
  return text.slice(Math.max(0, index - 40), index + len + 40).replace(/\s+/g, ' ');
}

export function findTitle(text: string, needles: AnswerNeedles): string | null {
  const norm = normalizeText(text);
  for (const re of needles.titlePatterns) {
    re.lastIndex = 0;
    const m = re.exec(norm);
    if (m) return excerpt(norm, m.index, m[0].length);
  }
  return null;
}

export function findTagline(text: string, needles: AnswerNeedles): string | null {
  if (!needles.tagline) return null;
  const norm = normalizeText(text).toLowerCase();
  const i = norm.indexOf(needles.tagline);
  return i >= 0 ? excerpt(norm, i, needles.tagline.length) : null;
}

/** Film-id contexts inside HTML / RSC / JS / CSS text. */
export function findIdInText(text: string, id: number): string | null {
  const n = String(id);
  const q = `\\\\*["']?`; // optional (escaped) quote around a key
  const patterns = [
    new RegExp(`${q}(?:filmId|film_id|answerId|answer_id|movieId|tmdbId|tmdb_id|id)${q}\\s*:\\s*${q}${n}(?![\\d.])`, 'g'),
    new RegExp(`[?&](?:filmId|film_id|film|movie|id|answer|tmdb)=${n}(?![\\d.])`, 'g'),
    new RegExp(`/(?:film|films|movie|movies|answer|puzzle-film)/${n}(?![\\d.])`, 'g'),
    new RegExp(`themoviedb\\.org/movie/${n}(?!\\d)`, 'g'),
  ];
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) return excerpt(text, m.index, m[0].length);
  }
  return null;
}

/** Keys whose numbers live in another id space (people, genres, studios) or are not ids. */
const NON_FILM_NUMBER_KEYS = new Set([
  'personId',
  'personIds',
  'studioId',
  'genreIds',
  'take',
  'takes',
  'number',
  'value',
  'genreCount',
  'year',
  'plays',
  'wins',
  'distribution',
  'rank',
  'played',
  'filmYear',
]);

/** Walk parsed JSON and report where the answer id appears. `path` is a dotted key path. */
export function findIdInJson(value: unknown, id: number, path: string[] = []): string | null {
  const key = path[path.length - 1] ?? '';
  const inGenres = path.includes('genres');
  if (typeof value === 'number') {
    if (value !== id) return null;
    const parentKey = /^\d+$/.test(key) ? (path[path.length - 2] ?? '') : key;
    if (NON_FILM_NUMBER_KEYS.has(parentKey) || (inGenres && parentKey === 'id')) return null;
    return `${path.join('.') || '(root)'} = ${value}`;
  }
  if (typeof value === 'string') {
    return new RegExp(`(?<![\\w.])${id}(?![\\w.])`).test(value) ? `${path.join('.')} = ${JSON.stringify(value).slice(0, 120)}` : null;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const hit = findIdInJson(value[i], id, [...path, String(i)]);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const hit = findIdInJson(v, id, [...path, k]);
      if (hit) return hit;
    }
  }
  return null;
}

/** The id as a path segment or query value of a URL. */
export function findIdInUrl(url: string, id: number): boolean {
  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    /* keep raw */
  }
  return new RegExp(`(?:/|=)${id}(?=$|[/?#&.])`).test(decoded);
}

export interface CapturedBody {
  url: string;
  /** Lowercase content-type header, may be empty. */
  contentType: string;
  body: string;
}

export interface ScanOptions {
  /** Skip title and tagline checks (e.g. the search index, which lists every playable film). */
  skipTitle?: boolean;
  /** Skip the tagline check (e.g. a requested hint response, which may legitimately be the tagline). */
  skipTagline?: boolean;
}

/** Scan one captured response (URL + body) for the answer. */
export function scanCaptured(item: CapturedBody, needles: AnswerNeedles, opts: ScanOptions = {}): LeakFinding[] {
  const out: LeakFinding[] = [];
  const src = item.url;
  if (!opts.skipTitle) {
    const urlTitle = findTitle(safeDecode(item.url).replace(/[+_-]/g, ' '), needles);
    if (urlTitle) out.push({ source: src, kind: 'title', detail: `in URL: ${urlTitle}` });
  }
  if (findIdInUrl(item.url, needles.id)) out.push({ source: src, kind: 'id', detail: 'id in URL' });
  if (!item.body) return out;

  if (!opts.skipTitle) {
    const t = findTitle(item.body, needles);
    if (t) out.push({ source: src, kind: 'title', detail: t });
    if (!opts.skipTagline) {
      const tg = findTagline(item.body, needles);
      if (tg) out.push({ source: src, kind: 'tagline', detail: tg });
    }
  }

  const isJson = item.contentType.includes('json');
  if (isJson) {
    try {
      const hit = findIdInJson(JSON.parse(item.body), needles.id);
      if (hit) out.push({ source: src, kind: 'id', detail: hit });
    } catch {
      const hit = findIdInText(item.body, needles.id);
      if (hit) out.push({ source: src, kind: 'id', detail: hit });
    }
  } else {
    const hit = findIdInText(item.body, needles.id);
    if (hit) out.push({ source: src, kind: 'id', detail: hit });
  }
  return out;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export interface LibraryLike {
  films: { title: string; tagline: string | null }[];
}

/**
 * Heuristic for the server film library leaking into a client chunk: real library data, not field
 * names (the admin console legitimately references `isAnswerEligible`). Flags a chunk with 3+
 * library taglines, 12+ distinct library titles, or serialized answer-eligibility flags.
 */
export function findLibraryInChunk(body: string, lib: LibraryLike): string | null {
  const taglines = lib.films
    .map((f) => f.tagline)
    .filter((t): t is string => !!t && t.length > 15)
    .filter((t) => body.includes(t));
  if (taglines.length >= 3) return `${taglines.length} library taglines, e.g. "${taglines[0]}"`;
  const titles = new Set(lib.films.map((f) => f.title).filter((t) => t.length >= 6 && body.includes(t)));
  if (titles.size >= 12) return `${titles.size} library titles, e.g. ${[...titles].slice(0, 4).join(', ')}`;
  if (/["']?isAnswerEligible["']?\s*:\s*(?:true|false|!0|!1)/.test(body)) return 'serialized isAnswerEligible flags';
  return null;
}

/** Decode the payload half of a `sign()`ed cookie value (`<b64url payload>.<b64url mac>`). */
export function decodeSignedCookie(value: string): string | null {
  const raw = safeDecode(value);
  const [p] = raw.split('.');
  if (!p) return null;
  try {
    const b64 = p.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}
