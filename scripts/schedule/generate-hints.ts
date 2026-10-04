// Script Notes generator (WS8). The pure implementation lives in src/server/admin/hints-draft.ts
// so server code (admin API) and these scripts share it. Its signature matches HintGenerator in
// src/server/db/seed.ts, so it can be plugged in as the default generator.
//
// Preview the drafted candidates for one or more films:
//   pnpm exec tsx scripts/schedule/generate-hints.ts <filmId> [filmId...]
// Uses data/library.tmdb.json when present, otherwise the fixture library.
import fs from 'node:fs';
import type { LibrarySnapshot } from '../../src/server/db/repo';
import type { HintGenerator } from '../../src/server/db/seed';
import { generateHints as generate } from '../../src/server/admin/hints-draft';
import { FIXTURE_LIBRARY_PATH, TMDB_LIBRARY_PATH, isMain, readJson } from '../ingest/io';

export const generateHints: HintGenerator = generate;
export { leaksTitle, maskTitle, titleTokens, hintLeaksTitle } from '../../src/server/admin/hints-draft';

export function loadLocalLibrary(): LibrarySnapshot {
  return readJson<LibrarySnapshot>(fs.existsSync(TMDB_LIBRARY_PATH) ? TMDB_LIBRARY_PATH : FIXTURE_LIBRARY_PATH);
}

function main(argv: string[]): void {
  const ids = argv.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) {
    console.log('Usage: pnpm exec tsx scripts/schedule/generate-hints.ts <filmId> [filmId...]');
    process.exitCode = 1;
    return;
  }
  const lib = loadLocalLibrary();
  for (const id of ids) {
    const film = lib.films.find((f) => f.id === id);
    if (!film) {
      console.log(`#${id}: not in the library`);
      continue;
    }
    console.log(`#${id} ${film.title} (${film.releaseYear})`);
    for (const h of generateHints(film, lib)) console.log(`  ${h.type.padEnd(16)} ${JSON.stringify(h.payload)}`);
  }
}

if (isMain(import.meta.url)) main(process.argv.slice(2));
