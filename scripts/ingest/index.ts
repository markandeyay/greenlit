// Data ingest (WS1). Entry points (run each with `pnpm exec tsx <file>`):
//   scripts/ingest/build-fixtures.ts      fixture source -> src/server/db/fixtures/library.json
//   scripts/ingest/tmdb-fetch.ts          TMDB -> data/cache/ (raw, cached per movie)
//   scripts/ingest/build-library.ts       data/cache/ -> data/library.tmdb.json + data/ingest-report.json
//   scripts/ingest/build-search-index.ts  library -> public/search-index.json
//   scripts/ingest/load-supabase.ts       library -> Supabase (service role)
// See scripts/ingest/README.md.
export { STUDIO_ALIAS_SEED, HEADLINE_STUDIOS, pickHeadlineStudio, aliasRows } from './studios';
export { normalizeMovie, directorDisplay, eligibilityProblems } from './normalize';
export { librarySnapshotSchema, parseLibrary, integrityProblems } from './schema';
export { buildSearchIndex } from './build-search-index';
