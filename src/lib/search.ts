// Title matching shared by server search and the client search box. Pure and isomorphic.

/** Lowercase, strip accents and punctuation, collapse whitespace, "&" -> "and". */
export function normalizeForSearch(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP = new Set(['the', 'a', 'an', 'of', 'and']);

function editDistanceAtMost1(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/**
 * Score how well a normalized query matches a title. 0 = no match. Higher is better.
 * Exact > prefix > every query word prefixes a title word > fuzzy (one typo per word, 5+ chars).
 */
export function scoreTitleMatch(normalizedQuery: string, title: string): number {
  const q = normalizedQuery;
  const t = normalizeForSearch(title);
  if (!q || !t) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  const tWithoutArticle = t.replace(/^(the|a|an) /, '');
  if (tWithoutArticle.startsWith(q)) return 75;
  if (t.includes(q)) return 60;
  const qWords = q.split(' ').filter((w) => w && !STOP.has(w));
  const tWords = t.split(' ');
  if (qWords.length === 0) return 0;
  let fuzzy = false;
  for (const qw of qWords) {
    if (tWords.some((tw) => tw.startsWith(qw))) continue;
    if (qw.length >= 5 && tWords.some((tw) => editDistanceAtMost1(qw, tw.slice(0, qw.length)) || editDistanceAtMost1(qw, tw))) {
      fuzzy = true;
      continue;
    }
    return 0;
  }
  return fuzzy ? 30 : 45;
}
