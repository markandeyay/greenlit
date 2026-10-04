// Pull ~4,000 films from TMDB into a raw per-movie cache under data/cache/.
//
//   pnpm exec tsx scripts/ingest/tmdb-fetch.ts [--target 4000] [--refresh] [--refresh-ids]
//
// Re-runnable and idempotent: candidate ids are cached in data/cache/ids.json and every movie is
// cached as data/cache/movies/<id>.json, so a re-run only fetches what is missing. --refresh
// refetches every movie (e.g. to pick up new revenue), --refresh-ids rebuilds the candidate list.
// Rate limits: 8 in flight, 40 requests per 10s, retries with backoff on 429/5xx (Retry-After).
import fs from 'node:fs';
import path from 'node:path';
import { CACHE_DIR, MOVIE_CACHE_DIR, ensureDir, isMain, loadEnvFiles, readJson, writeJson } from './io';
import { TmdbClient, TmdbHttpError, authFromEnv, mapLimit } from './tmdb-client';
import type { TmdbMovie } from './normalize';

export const APPEND = 'credits,release_dates,videos,keywords';
const IDS_PATH = path.join(CACHE_DIR, 'ids.json');
const GENRES_PATH = path.join(CACHE_DIR, 'genres.json');

interface ListPage {
  page: number;
  total_pages: number;
  results: { id: number; adult?: boolean; vote_count?: number }[];
}

export interface FetchOptions {
  target: number;
  refresh: boolean;
  refreshIds: boolean;
  popularPages: number;
  topRatedPages: number;
  discoverPagesPerDecade: number;
  minVoteCount: number;
}

export const DEFAULT_FETCH_OPTIONS: FetchOptions = {
  target: 4000,
  refresh: false,
  refreshIds: false,
  popularPages: 60, // 20 films per page
  topRatedPages: 60,
  discoverPagesPerDecade: 40,
  minVoteCount: 300,
};

/** Decades sampled by /discover so the library spans eras, not just recent popularity. */
export const DECADES: readonly [number, number][] = [
  [1960, 1969],
  [1970, 1979],
  [1980, 1989],
  [1990, 1999],
  [2000, 2009],
  [2010, 2019],
  [2020, new Date().getFullYear()],
];

export function parseArgs(argv: readonly string[]): FetchOptions {
  const o = { ...DEFAULT_FETCH_OPTIONS };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const num = () => {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n <= 0) throw new Error(`${a} needs a positive number`);
      return n;
    };
    if (a === '--target') o.target = num();
    else if (a === '--refresh') o.refresh = true;
    else if (a === '--refresh-ids') o.refreshIds = true;
    else if (a === '--popular-pages') o.popularPages = num();
    else if (a === '--top-rated-pages') o.topRatedPages = num();
    else if (a === '--discover-pages') o.discoverPagesPerDecade = num();
    else if (a === '--min-votes') o.minVoteCount = num();
    else throw new Error(`Unknown argument ${a}`);
  }
  return o;
}

async function collectList(client: TmdbClient, pathName: string, pages: number, params: Record<string, string | number> = {}): Promise<number[]> {
  const first = await client.get<ListPage>(pathName, { ...params, page: 1, language: 'en-US' });
  const last = Math.min(pages, first.total_pages, 500); // TMDB caps list pages at 500
  const rest = await mapLimit(
    Array.from({ length: Math.max(0, last - 1) }, (_, i) => i + 2),
    8,
    (page) => client.get<ListPage>(pathName, { ...params, page, language: 'en-US' }),
  );
  return [first, ...rest].flatMap((p) => p.results.filter((r) => !r.adult).map((r) => r.id));
}

/** Candidate ids, round-robin across sources so the target cut keeps every source represented. */
export function mergeCandidates(sources: readonly number[][], target: number): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  const longest = Math.max(0, ...sources.map((s) => s.length));
  for (let i = 0; i < longest && out.length < target; i++) {
    for (const s of sources) {
      const id = s[i];
      if (id === undefined || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
      if (out.length >= target) break;
    }
  }
  return out;
}

async function discoverCandidates(client: TmdbClient, o: FetchOptions): Promise<number[]> {
  console.log('Collecting candidate ids (popular, top rated, discover by decade)...');
  const popular = await collectList(client, '/movie/popular', o.popularPages);
  const topRated = await collectList(client, '/movie/top_rated', o.topRatedPages);
  const decades: number[][] = [];
  for (const [from, to] of DECADES) {
    decades.push(
      await collectList(client, '/discover/movie', o.discoverPagesPerDecade, {
        sort_by: 'vote_count.desc',
        include_adult: 'false',
        'primary_release_date.gte': `${from}-01-01`,
        'primary_release_date.lte': `${to}-12-31`,
        'vote_count.gte': o.minVoteCount,
      }),
    );
  }
  return mergeCandidates([popular, topRated, ...decades], o.target);
}

export const movieCachePath = (id: number) => path.join(MOVIE_CACHE_DIR, `${id}.json`);

export async function runFetch(o: FetchOptions): Promise<void> {
  loadEnvFiles();
  const auth = authFromEnv();
  if (!auth) {
    console.error('No TMDB credentials. Set TMDB_READ_TOKEN (preferred) or TMDB_API_KEY in .env.local.');
    process.exitCode = 1;
    return;
  }
  const client = new TmdbClient({
    auth,
    onRetry: ({ path: p, status, attempt, waitMs }) => console.warn(`  retry ${attempt} for ${p} (${status}), waiting ${waitMs}ms`),
  });
  ensureDir(MOVIE_CACHE_DIR);

  if (o.refresh || !fs.existsSync(GENRES_PATH)) {
    writeJson(GENRES_PATH, await client.get('/genre/movie/list', { language: 'en-US' }));
  }

  let ids: number[];
  if (!o.refreshIds && fs.existsSync(IDS_PATH)) {
    ids = readJson<{ ids: number[] }>(IDS_PATH).ids;
    if (ids.length < o.target) {
      console.log(`Cached id list has ${ids.length} < target ${o.target}; rebuilding.`);
      ids = await discoverCandidates(client, o);
    }
  } else {
    ids = await discoverCandidates(client, o);
  }
  ids = ids.slice(0, o.target);
  writeJson(IDS_PATH, { generatedAt: new Date().toISOString(), ids });

  const todo = o.refresh ? ids : ids.filter((id) => !fs.existsSync(movieCachePath(id)));
  console.log(`${ids.length} candidates, ${ids.length - todo.length} cached, ${todo.length} to fetch.`);

  let done = 0;
  const failed: { id: number; error: string }[] = [];
  await mapLimit(todo, 8, async (id) => {
    try {
      const movie = await client.get<TmdbMovie>(`/movie/${id}`, { append_to_response: APPEND, language: 'en-US' });
      writeJson(movieCachePath(id), movie);
    } catch (e) {
      failed.push({ id, error: e instanceof TmdbHttpError ? `HTTP ${e.status}` : String(e) });
    }
    done++;
    if (done % 100 === 0 || done === todo.length) console.log(`  fetched ${done}/${todo.length}`);
  });

  writeJson(path.join(CACHE_DIR, 'fetch-failures.json'), { generatedAt: new Date().toISOString(), failed });
  console.log(`Done. ${client.requests} requests, ${failed.length} failures (see data/cache/fetch-failures.json).`);
  console.log('Next: pnpm exec tsx scripts/ingest/build-library.ts');
}

if (isMain(import.meta.url)) {
  runFetch(parseArgs(process.argv.slice(2))).catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
