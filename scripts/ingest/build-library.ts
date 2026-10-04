// Turns the raw TMDB cache (data/cache/movies/*.json) into data/library.tmdb.json (a
// LibrarySnapshot, source 'tmdb') plus data/ingest-report.json and a console summary.
//
//   pnpm exec tsx scripts/ingest/build-library.ts [--min-popularity 12]
//
// Idempotent: input is processed in film id order and studio ids are allocated deterministically,
// so the same cache always yields the same library (only generatedAt changes).
import fs from 'node:fs';
import path from 'node:path';
import type { Film, FilmAward, FilmCertification, Genre, Person } from '../../src/lib/types';
import { REGION_CODES } from '../../src/config/regions';
import type { LibrarySnapshot } from '../../src/server/db/repo';
import {
  CACHE_DIR,
  FIXTURE_LIBRARY_PATH,
  INGEST_REPORT_PATH,
  MOVIE_CACHE_DIR,
  TMDB_LIBRARY_PATH,
  formatLibraryJson,
  isMain,
  readJson,
  writeFileAtomic,
  writeJson,
} from './io';
import { ELIGIBLE_MIN_POPULARITY, ELIGIBLE_MIN_VOTES, TMDB_GENRES, eligibilityProblems, normalizeMovie, type TmdbMovie } from './normalize';
import { StudioRegistry, aliasMap, aliasRows } from './studios';
import { integrityProblems, parseLibrary } from './schema';

export interface BuildOptions {
  minPopularity?: number;
  minVotes?: number;
  genres?: readonly Genre[];
  /** Curated in-house awards blurbs (e.g. from the fixture library), kept for films present. */
  awards?: readonly FilmAward[];
  generatedAt?: string;
}

export interface IngestReport {
  generatedAt: string;
  totals: {
    raw: number;
    films: number;
    skipped: number;
    answerEligible: number;
    missingBoxOffice: number;
    missingUsCertification: number;
    missingAnyCertification: number;
  };
  missingCertificationsByRegion: Record<string, number>;
  skipped: { id: number; title: string; reason: string }[];
  missingBoxOffice: { id: number; title: string; year: number }[];
  missingCertifications: { id: number; title: string; year: number; missing: string[] }[];
  ineligibleReasons: Record<string, number>;
  unmappedStudios: { name: string; rawCompanyId: number | null; films: number }[];
}

export function buildTmdbLibrary(movies: readonly TmdbMovie[], opts: BuildOptions = {}): { lib: LibrarySnapshot; report: IngestReport } {
  const generatedAt = opts.generatedAt ?? new Date().toISOString();
  const aliases = aliasMap();
  const studios = new StudioRegistry();
  const people = new Map<number, Person>();
  const films: Film[] = [];
  const certifications: FilmCertification[] = [];
  const skipped: IngestReport['skipped'] = [];
  const ineligibleReasons: Record<string, number> = {};
  const unmapped = new Map<string, { rawCompanyId: number | null; films: number }>();

  const sorted = [...new Map(movies.map((m) => [m.id, m])).values()].sort((a, b) => a.id - b.id);
  for (const movie of sorted) {
    const n = normalizeMovie(movie, aliases);
    if (!n) {
      skipped.push({ id: movie.id, title: movie.title, reason: 'missing release year, director or genres' });
      continue;
    }
    const film = { ...n.film, studioId: n.studioName ? studios.idFor(n.studioName) : null };
    if (n.studioName && !n.studioMapped) {
      const u = unmapped.get(n.studioName) ?? { rawCompanyId: n.studioRawCompanyId, films: 0 };
      u.films++;
      unmapped.set(n.studioName, u);
    }
    const problems = eligibilityProblems(film, n.certifications, {
      minPopularity: opts.minPopularity ?? ELIGIBLE_MIN_POPULARITY,
      minVotes: opts.minVotes ?? ELIGIBLE_MIN_VOTES,
      voteCount: movie.vote_count,
    });
    film.isAnswerEligible = problems.length === 0;
    for (const p of problems) ineligibleReasons[p] = (ineligibleReasons[p] ?? 0) + 1;
    films.push(film);
    certifications.push(...n.certifications);
    for (const p of n.people) {
      const prev = people.get(p.id);
      // Keep the first profile path we saw; fill it in if an earlier credit lacked one.
      people.set(p.id, prev ? { ...prev, profilePath: prev.profilePath ?? p.profilePath } : p);
    }
  }

  const filmIds = new Set(films.map((f) => f.id));
  const lib: LibrarySnapshot = {
    v: 1,
    generatedAt,
    source: 'tmdb',
    films,
    people: [...people.values()].sort((a, b) => a.id - b.id),
    studios: studios.list(),
    studioAliases: aliasRows().sort((a, b) => a.rawCompanyId - b.rawCompanyId),
    genres: [...(opts.genres ?? TMDB_GENRES)],
    certifications,
    awards: (opts.awards ?? []).filter((a) => filmIds.has(a.filmId)),
  };

  const certsByFilm = new Map<number, Set<string>>();
  for (const c of certifications) {
    const s = certsByFilm.get(c.filmId) ?? new Set<string>();
    s.add(c.region);
    certsByFilm.set(c.filmId, s);
  }
  const missingCertifications = films
    .map((f) => ({ id: f.id, title: f.title, year: f.releaseYear, missing: REGION_CODES.filter((r) => !certsByFilm.get(f.id)?.has(r)) }))
    .filter((x) => x.missing.length > 0);
  const missingCertificationsByRegion = Object.fromEntries(
    REGION_CODES.map((r) => [r, missingCertifications.filter((x) => x.missing.includes(r)).length]),
  );
  const missingBoxOffice = films.filter((f) => f.boxOfficeUsd === null).map((f) => ({ id: f.id, title: f.title, year: f.releaseYear }));

  const report: IngestReport = {
    generatedAt,
    totals: {
      raw: sorted.length,
      films: films.length,
      skipped: skipped.length,
      answerEligible: films.filter((f) => f.isAnswerEligible).length,
      missingBoxOffice: missingBoxOffice.length,
      missingUsCertification: missingCertificationsByRegion.US ?? 0,
      missingAnyCertification: missingCertifications.length,
    },
    missingCertificationsByRegion,
    skipped,
    missingBoxOffice,
    missingCertifications,
    ineligibleReasons,
    unmappedStudios: [...unmapped.entries()]
      .map(([name, u]) => ({ name, ...u }))
      .sort((a, b) => b.films - a.films || a.name.localeCompare(b.name)),
  };
  return { lib, report };
}

export function readCachedMovies(dir: string = MOVIE_CACHE_DIR): TmdbMovie[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d+\.json$/.test(f))
    .map((f) => readJson<TmdbMovie>(path.join(dir, f)));
}

export function printSummary(report: IngestReport): void {
  const t = report.totals;
  console.log(`Films: ${t.films} (from ${t.raw} cached, ${t.skipped} skipped)`);
  console.log(`Answer eligible: ${t.answerEligible}`);
  console.log(`Missing box office: ${t.missingBoxOffice}`);
  console.log(`Missing certification by region: ${Object.entries(report.missingCertificationsByRegion).map(([r, n]) => `${r} ${n}`).join(', ')}`);
  console.log(`Ineligible reasons: ${Object.entries(report.ineligibleReasons).map(([r, n]) => `${r} ${n}`).join(', ') || 'none'}`);
  const sample = (xs: { title: string; year: number }[]) => xs.slice(0, 15).map((x) => `${x.title} (${x.year})`).join('; ');
  if (report.missingBoxOffice.length) console.log(`  e.g. no box office: ${sample(report.missingBoxOffice)}`);
  const noUs = report.missingCertifications.filter((x) => x.missing.includes('US'));
  if (noUs.length) console.log(`  e.g. no US certification: ${sample(noUs)}`);
  if (report.unmappedStudios.length) {
    console.log(`Top unmapped studios (consider adding aliases): ${report.unmappedStudios.slice(0, 10).map((s) => `${s.name} [${s.rawCompanyId}] x${s.films}`).join(', ')}`);
  }
  console.log(`Full report: ${INGEST_REPORT_PATH}`);
}

function parseArgs(argv: readonly string[]): { minPopularity?: number; minVotes?: number } {
  const out: { minPopularity?: number; minVotes?: number } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--min-popularity') out.minPopularity = Number(argv[++i]);
    else if (argv[i] === '--min-votes') out.minVotes = Number(argv[++i]);
    else throw new Error(`Unknown argument ${argv[i]}`);
  }
  return out;
}

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const movies = readCachedMovies();
  if (movies.length === 0) {
    console.error('No cached movies in data/cache/movies. Run: pnpm exec tsx scripts/ingest/tmdb-fetch.ts');
    process.exitCode = 1;
  } else {
    const genresFile = path.join(CACHE_DIR, 'genres.json');
    const genres = fs.existsSync(genresFile) ? readJson<{ genres: Genre[] }>(genresFile).genres : undefined;
    const fixtureAwards = fs.existsSync(FIXTURE_LIBRARY_PATH) ? readJson<LibrarySnapshot>(FIXTURE_LIBRARY_PATH).awards : [];
    const { lib, report } = buildTmdbLibrary(movies, { ...args, genres, awards: fixtureAwards });
    parseLibrary(lib);
    const problems = integrityProblems(lib);
    if (problems.length) {
      console.error(`Library failed integrity checks:\n${problems.slice(0, 50).join('\n')}`);
      process.exitCode = 1;
    } else {
      writeFileAtomic(TMDB_LIBRARY_PATH, formatLibraryJson(lib));
      writeJson(INGEST_REPORT_PATH, report);
      console.log(`Wrote ${TMDB_LIBRARY_PATH}`);
      printSummary(report);
      console.log('Next: pnpm exec tsx scripts/ingest/build-search-index.ts');
    }
  }
}
