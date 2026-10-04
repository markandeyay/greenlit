// Writes public/search-index.json (SearchIndexFile) for instant client-side search.
//
//   pnpm exec tsx scripts/ingest/build-search-index.ts [path/to/library.json]
//
// Source: the given library, else data/library.tmdb.json if present, else the fixture library.
// Contains every playable film and ONLY id, title, originalTitle, year and posterPath: never
// eligibility flags, schedule info or anything else that could hint at an answer (Section 10).
import fs from 'node:fs';
import path from 'node:path';
import type { SearchIndexEntry, SearchIndexFile } from '../../src/lib/types';
import type { LibrarySnapshot } from '../../src/server/db/repo';
import { FIXTURE_LIBRARY_PATH, SEARCH_INDEX_PATH, TMDB_LIBRARY_PATH, isMain, readJson, writeFileAtomic } from './io';
import { parseLibrary } from './schema';

export function buildSearchIndex(lib: Pick<LibrarySnapshot, 'films'>): SearchIndexFile {
  const films: SearchIndexEntry[] = lib.films
    .filter((f) => f.isPlayable)
    // Alphabetical, not by id or popularity, so ordering carries no signal.
    .sort((a, b) => a.title.localeCompare(b.title, 'en') || a.releaseYear - b.releaseYear || a.id - b.id)
    .map((f) => {
      const entry: SearchIndexEntry = { id: f.id, title: f.title, year: f.releaseYear, posterPath: f.posterPath };
      if (f.originalTitle && f.originalTitle !== f.title) entry.originalTitle = f.originalTitle;
      return entry;
    });
  return { v: 1, films };
}

/** Compact JSON: one entry per line. */
export function formatSearchIndex(index: SearchIndexFile): string {
  return `{"v":1,"films":[\n${index.films.map((f) => JSON.stringify(f)).join(',\n')}\n]}\n`;
}

export function resolveLibraryPath(arg?: string): string {
  if (arg) return path.resolve(arg);
  return fs.existsSync(TMDB_LIBRARY_PATH) ? TMDB_LIBRARY_PATH : FIXTURE_LIBRARY_PATH;
}

if (isMain(import.meta.url)) {
  const source = resolveLibraryPath(process.argv[2]);
  const lib = parseLibrary(readJson(source));
  const index = buildSearchIndex(lib);
  writeFileAtomic(SEARCH_INDEX_PATH, formatSearchIndex(index));
  console.log(`Wrote ${SEARCH_INDEX_PATH}: ${index.films.length} films from ${path.relative(process.cwd(), source)}`);
}
