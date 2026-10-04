// Instant client-side title search over public/search-index.json (Section 9). The index lists every
// playable film, so it reveals nothing about any answer. Loaded lazily, once per page view.
import { SEARCH } from '@/config/game';
import { normalizeForSearch, scoreTitleMatch } from '@/lib/search';
import type { SearchIndexEntry, SearchIndexFile, SearchResult } from '@/lib/types';

export const SEARCH_INDEX_URL = '/search-index.json';

let cached: Promise<SearchIndexEntry[]> | null = null;

/** Fetch the index once. A failed load clears the cache so a later call can retry. */
export function loadSearchIndex(fetcher: typeof fetch = fetch): Promise<SearchIndexEntry[]> {
  if (!cached) {
    cached = fetcher(SEARCH_INDEX_URL, { credentials: 'same-origin' })
      .then((r) => {
        if (!r.ok) throw new Error(`index ${r.status}`);
        return r.json() as Promise<SearchIndexFile>;
      })
      .then((file) => {
        if (!file || file.v !== 1 || !Array.isArray(file.films)) throw new Error('bad index');
        return file.films;
      })
      .catch((e) => {
        cached = null;
        throw e;
      });
  }
  return cached;
}

/** Tests only. */
export function __resetSearchIndexForTests(): void {
  cached = null;
}

/** Rank index entries for a query. Pure. Ties break toward the better known (shorter) title, then newer. */
export function searchIndex(
  films: readonly SearchIndexEntry[],
  query: string,
  limit: number = SEARCH.maxResults,
): SearchResult[] {
  const q = normalizeForSearch(query);
  if (q.length < SEARCH.minQueryLength) return [];
  const yearMatch = /\b(19|20)\d{2}\b/.exec(query);
  const year = yearMatch ? Number(yearMatch[0]) : null;
  const qNoYear = year ? normalizeForSearch(query.replace(String(year), '')) : q;
  const scored: { f: SearchIndexEntry; s: number }[] = [];
  for (const f of films) {
    let s = Math.max(scoreTitleMatch(q, f.title), f.originalTitle ? scoreTitleMatch(q, f.originalTitle) - 5 : 0);
    if (year && qNoYear.length >= 1) {
      const sy = Math.max(scoreTitleMatch(qNoYear, f.title), f.originalTitle ? scoreTitleMatch(qNoYear, f.originalTitle) - 5 : 0);
      if (sy > 0 && f.year === year) s = Math.max(s, sy + 10);
    }
    if (s > 0) scored.push({ f, s });
  }
  scored.sort((a, b) => b.s - a.s || a.f.title.length - b.f.title.length || b.f.year - a.f.year);
  return scored.slice(0, limit).map(({ f }) => ({ id: f.id, title: f.title, year: f.year, posterPath: f.posterPath }));
}
