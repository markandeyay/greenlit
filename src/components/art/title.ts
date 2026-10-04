// Title typesetting for the poster art: balanced line breaks and auto-scaled sizes, computed from
// an advance-width table for Big Shoulders at weight 900 (uppercase). Pure, so it runs on the
// server and in tests. Every line also gets an SVG `textLength`, so a small error in the table
// only nudges letter spacing instead of overflowing the poster.

/** Advance widths in em for Big Shoulders 900 uppercase (calibrated against the live font). */
const ADVANCE: Record<string, number> = {
  A: 0.478, B: 0.472, C: 0.49, D: 0.495, E: 0.408, F: 0.406, G: 0.493, H: 0.485, I: 0.23, J: 0.453,
  K: 0.496, L: 0.402, M: 0.745, N: 0.543, O: 0.496, P: 0.47, Q: 0.496, R: 0.477, S: 0.474, T: 0.428,
  U: 0.487, V: 0.494, W: 0.8, X: 0.471, Y: 0.465, Z: 0.418,
  '0': 0.507, '1': 0.274, '2': 0.49, '3': 0.504, '4': 0.511, '5': 0.515, '6': 0.498, '7': 0.485,
  '8': 0.5, '9': 0.499,
  ' ': 0.22, '.': 0.25, ',': 0.25, ':': 0.25, ';': 0.25, "'": 0.203, '’': 0.203, '!': 0.25, '?': 0.48,
  '-': 0.446, '&': 0.619,
};
const DEFAULT_ADVANCE = 0.49;

/** Cap height as a fraction of the font size (measured: 0.80). */
export const CAP = 0.8;

export function upper(text: string): string {
  return text.toLocaleUpperCase('en-US');
}

/** Estimated width of `text` in em (uppercase it first). `tracking` is extra em per gap. */
export function widthEm(text: string, tracking = 0): number {
  let w = 0;
  for (const ch of text) w += ADVANCE[ch] ?? DEFAULT_ADVANCE;
  return w + tracking * Math.max(0, [...text].length - 1);
}

interface Token {
  text: string;
  /** What joins this token to the NEXT one on the same line. */
  glue: string;
}

/** Words, with long hyphenated words offered as two break points ("EXTRA-" / "TERRESTRIAL"). */
export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const parts = word.length > 9 && word.includes('-') ? word.split(/(?<=-)/) : [word];
    parts.forEach((p, i) => out.push({ text: p, glue: i < parts.length - 1 ? '' : ' ' }));
  }
  return out;
}

function join(tokens: Token[]): string {
  return tokens.map((t, i) => t.text + (i < tokens.length - 1 ? t.glue : '')).join('');
}

/** Split tokens into exactly `n` lines minimizing the widest line (balanced breaks). */
export function balance(tokens: Token[], n: number, tracking = 0): string[] {
  const k = Math.min(n, tokens.length);
  if (k <= 1) return [join(tokens)];
  let best: string[] = [join(tokens)];
  let bestW = Infinity;
  // Enumerate the k-1 cut positions among tokens.length-1 gaps. Titles are short, so brute force.
  const cuts: number[] = [];
  const walk = (start: number, left: number) => {
    if (left === 0) {
      const bounds = [0, ...cuts, tokens.length];
      const lines = bounds.slice(1).map((end, i) => join(tokens.slice(bounds[i], end)));
      const w = Math.max(...lines.map((l) => widthEm(l, tracking)));
      // Tie-break toward a heavier bottom line (posters read better bottom-weighted).
      const tie = w === bestW && widthEm(lines[lines.length - 1]!) > widthEm(best[best.length - 1]!);
      if (w < bestW - 1e-9 || tie) {
        bestW = w;
        best = lines;
      }
      return;
    }
    for (let c = start; c <= tokens.length - left; c++) {
      cuts.push(c);
      walk(c + 1, left - 1);
      cuts.pop();
    }
  };
  walk(1, k - 1);
  return best;
}

export interface TitleLine {
  text: string;
  /** Font size in viewBox units. */
  size: number;
  /** Baseline y, relative to the top of the title box. */
  y: number;
  /** Estimated rendered width (used as SVG textLength). */
  width: number;
}

export interface FitOptions {
  width: number;
  height: number;
  maxLines?: number;
  maxSize?: number;
  /** 'uniform': one size for every line. 'stack': each line scaled to the full width. */
  style?: 'uniform' | 'stack';
  /** Line gap as a fraction of the font size (between cap tops and the previous baseline). */
  gap?: number;
  tracking?: number;
}

export interface FitResult {
  lines: TitleLine[];
  /** Total block height from the first cap top to the last baseline. */
  height: number;
}

/**
 * Fit an (already uppercased) title into a box: try 1..maxLines balanced breaks and keep the one
 * that sets the type biggest. Fewer lines win ties.
 */
export function fitTitle(text: string, opts: FitOptions): FitResult {
  const { width: W, height: H, maxLines = 4, maxSize = 120, style = 'uniform', gap = 0.16, tracking = 0 } = opts;
  const tokens = tokenize(text);
  if (!tokens.length) return { lines: [], height: 0 };

  let bestLines: string[] = [join(tokens)];
  let bestSize = 0;
  for (let n = 1; n <= Math.min(maxLines, tokens.length); n++) {
    const lines = balance(tokens, n, tracking);
    const widest = Math.max(...lines.map((l) => widthEm(l, tracking)));
    const blockEm = n * CAP + (n - 1) * gap;
    const size = Math.min(maxSize, W / widest, H / blockEm);
    if (size > bestSize * 1.04) {
      bestSize = size;
      bestLines = lines;
    }
  }

  let sizes =
    style === 'stack'
      ? bestLines.map((l) => Math.min(bestSize * 1.9, maxSize * 1.4, W / widthEm(l, tracking)))
      : bestLines.map(() => bestSize);
  const gapPx = bestSize * gap;
  const total = (s: number[]) => s.reduce((sum, v) => sum + v * CAP, 0) + gapPx * (s.length - 1);
  const t = total(sizes);
  if (t > H) sizes = sizes.map((s) => (s * (H - gapPx * (sizes.length - 1))) / (t - gapPx * (sizes.length - 1)));

  let y = 0;
  const lines = bestLines.map((text, i) => {
    y += sizes[i]! * CAP + (i ? gapPx : 0);
    return { text, size: sizes[i]!, y, width: Math.min(W, widthEm(text, tracking) * sizes[i]!) };
  });
  return { lines, height: y };
}

/** Main title and optional subtitle: "Dune: Part Two" -> ["Dune", "Part Two"]. */
export function splitTitle(title: string): { main: string; sub: string | null } {
  const m = title.match(/^(.+?)(?::\s+|\s+-\s+)(.+)$/);
  if (m && m[1]!.trim().length >= 2) return { main: m[1]!.trim(), sub: m[2]!.trim() };
  return { main: title.trim(), sub: null };
}

/** 1 to 3 letter monogram for the compact poster: "The Dark Knight" -> "DK", "Up" -> "UP". */
export function monogram(title: string, max = 3): string {
  const { main } = splitTitle(title);
  const words = upper(main)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return '?';
  const meaningful = words.length > 1 ? words.filter((w) => !/^(THE|A|AN|OF|AND|TO|IN|ON|AT|FOR)$/.test(w)) : words;
  const list = meaningful.length ? meaningful : words;
  if (list.length === 1) {
    const w = list[0]!;
    // Short single words read whole ("UP", "JAWS" is too wide: "J").
    return w.length <= 2 ? w : w[0]!;
  }
  return list
    .slice(0, max)
    .map((w) => w[0])
    .join('');
}
