// Small Node helpers shared by the ingest CLIs: paths, .env.local loading, JSON writing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { LibrarySnapshot } from '../../src/server/db/repo';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATA_DIR = path.join(ROOT, 'data');
export const CACHE_DIR = path.join(DATA_DIR, 'cache');
export const MOVIE_CACHE_DIR = path.join(CACHE_DIR, 'movies');
export const FIXTURE_LIBRARY_PATH = path.join(ROOT, 'src', 'server', 'db', 'fixtures', 'library.json');
export const TMDB_LIBRARY_PATH = path.join(DATA_DIR, 'library.tmdb.json');
export const INGEST_REPORT_PATH = path.join(DATA_DIR, 'ingest-report.json');
export const SEARCH_INDEX_PATH = path.join(ROOT, 'public', 'search-index.json');

/** True when the module at `metaUrl` is the script being run (`tsx scripts/ingest/x.ts`). */
export function isMain(metaUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  const a = pathToFileURL(path.resolve(entry)).href;
  return process.platform === 'win32' ? a.toLowerCase() === metaUrl.toLowerCase() : a === metaUrl;
}

/** Parse dotenv-style text: KEY=value, optional quotes, # comments. */
export function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = m[2]!.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      const hash = value.indexOf(' #');
      if (hash !== -1) value = value.slice(0, hash).trim();
    }
    out[m[1]!] = value;
  }
  return out;
}

/** Load .env.local then .env into process.env without overriding variables already set. */
export function loadEnvFiles(files = ['.env.local', '.env']): void {
  for (const f of files) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    for (const [k, v] of Object.entries(parseEnv(fs.readFileSync(p, 'utf8')))) {
      if (process.env[k] === undefined || process.env[k] === '') process.env[k] = v;
    }
  }
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

/** Write atomically (temp file + rename) so an interrupted run never leaves half a file. */
export function writeFileAtomic(file: string, contents: string): void {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, contents);
  fs.renameSync(tmp, file);
}

export function writeJson(file: string, data: unknown): void {
  writeFileAtomic(file, `${JSON.stringify(data, null, 2)}\n`);
}

/** Library JSON with one record per line: compact, but diffs stay readable. */
export function formatLibraryJson(lib: LibrarySnapshot): string {
  const arr = (items: unknown[]) => (items.length ? `[\n${items.map((x) => `    ${JSON.stringify(x)}`).join(',\n')}\n  ]` : '[]');
  return [
    '{',
    `  "v": ${lib.v},`,
    `  "generatedAt": ${JSON.stringify(lib.generatedAt)},`,
    `  "source": ${JSON.stringify(lib.source)},`,
    `  "films": ${arr(lib.films)},`,
    `  "people": ${arr(lib.people)},`,
    `  "studios": ${arr(lib.studios)},`,
    `  "studioAliases": ${arr(lib.studioAliases)},`,
    `  "genres": ${arr(lib.genres)},`,
    `  "certifications": ${arr(lib.certifications)},`,
    `  "awards": ${arr(lib.awards)}`,
    '}',
    '',
  ].join('\n');
}
