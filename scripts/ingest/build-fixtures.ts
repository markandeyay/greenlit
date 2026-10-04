// Compiles the hand-entered fixture source (scripts/ingest/fixture-source) into
// src/server/db/fixtures/library.json, the LibrarySnapshot the app runs on without a TMDB key.
//
//   pnpm exec tsx scripts/ingest/build-fixtures.ts
//
// Deterministic: the same source always produces byte-identical output.
import type { Film, FilmAward, FilmCertification, Person } from '../../src/lib/types';
import { REGION_CODES } from '../../src/config/regions';
import { RULES } from '../../src/config/rules';
import type { LibrarySnapshot } from '../../src/server/db/repo';
import { FIXTURE_FILMS, type FixtureFilmSource } from './fixture-source/films';
import { personIdFor } from './fixture-source/people';
import { directorDisplay, TMDB_GENRES } from './normalize';
import { aliasRows, headlineStudioId, HEADLINE_STUDIOS } from './studios';
import { integrityProblems, parseLibrary } from './schema';
import { FIXTURE_LIBRARY_PATH, formatLibraryJson, isMain, writeFileAtomic } from './io';

export const FIXTURE_GENERATED_AT = '2026-10-04T00:00:00.000Z';

const split = (s: string, sep: string) => s.split(sep).map((x) => x.trim()).filter(Boolean);

export function buildFixtureLibrary(source: readonly FixtureFilmSource[] = FIXTURE_FILMS): LibrarySnapshot {
  const genreByName = new Map(TMDB_GENRES.map((g) => [g.name, g.id]));
  const people = new Map<number, Person>();
  const films: Film[] = [];
  const certifications: FilmCertification[] = [];
  const awards: FilmAward[] = [];

  const person = (name: string): number => {
    const id = personIdFor(name);
    const existing = people.get(id);
    if (existing && existing.name !== name) throw new Error(`Person id ${id} collides: "${existing.name}" vs "${name}"`);
    people.set(id, { id, name, profilePath: null });
    return id;
  };

  for (const s of source) {
    const where = `${s.t} (${s.id})`;
    const studioId = headlineStudioId(s.st);
    if (studioId === null) throw new Error(`${where}: unknown studio "${s.st}"`);
    if (s.cast.length < 1) throw new Error(`${where}: needs a lead`);
    if (s.cast.length - 1 > RULES.maxSupportingCast) throw new Error(`${where}: too many supporting cast`);
    const genreIds = split(s.g, ',').map((name) => {
      const id = genreByName.get(name);
      if (id === undefined) throw new Error(`${where}: unknown genre "${name}"`);
      return id;
    });
    const certParts = s.c.split('|');
    if (certParts.length !== REGION_CODES.length) throw new Error(`${where}: certs need ${REGION_CODES.length} slots`);
    const certs: FilmCertification[] = [];
    REGION_CODES.forEach((region, i) => {
      const rating = certParts[i]!.trim();
      if (rating) certs.push({ filmId: s.id, region, rating });
    });
    const eligible = s.el ?? s.bo !== null;
    if (eligible && (s.bo === null || !s.tag || !certs.some((c) => c.region === 'US'))) {
      throw new Error(`${where}: eligible films need box office, a tagline and a US certification`);
    }

    films.push({
      id: s.id,
      title: s.t,
      originalTitle: s.ot ?? null,
      releaseYear: Number(s.d.slice(0, 4)),
      releaseDate: s.d,
      posterPath: null,
      backdropPath: null,
      runtimeMin: s.rt,
      boxOfficeUsd: s.bo,
      scoreSnapshot: s.sc,
      studioId,
      directorUnit: { ids: s.dir.map(person), display: directorDisplay(s.dir) },
      leadPersonId: person(s.cast[0]!),
      supportingIds: s.cast.slice(1).map(person),
      genreIds,
      trailerYoutube: null,
      tagline: s.tag,
      keywords: split(s.kw, '|'),
      popularity: s.pop,
      isPlayable: true,
      isAnswerEligible: eligible,
    });
    certifications.push(...certs);
    if (s.aw) for (const text of split(s.aw, '|')) awards.push({ filmId: s.id, text });
  }

  films.sort((a, b) => a.id - b.id);
  const filmOrder = new Map(films.map((f, i) => [f.id, i]));
  const byFilm = (a: { filmId: number }, b: { filmId: number }) => filmOrder.get(a.filmId)! - filmOrder.get(b.filmId)!;

  const lib: LibrarySnapshot = {
    v: 1,
    generatedAt: FIXTURE_GENERATED_AT,
    source: 'fixture',
    films,
    people: [...people.values()].sort((a, b) => a.id - b.id),
    studios: HEADLINE_STUDIOS.map((name, i) => ({ id: i + 1, name, logoPath: null })),
    studioAliases: aliasRows().sort((a, b) => a.rawCompanyId - b.rawCompanyId),
    genres: [...TMDB_GENRES],
    certifications: certifications.sort(byFilm),
    awards: awards.sort(byFilm),
  };
  parseLibrary(lib);
  const problems = integrityProblems(lib);
  if (problems.length) throw new Error(`Fixture library is inconsistent:\n${problems.join('\n')}`);
  return lib;
}

if (isMain(import.meta.url)) {
  const lib = buildFixtureLibrary();
  writeFileAtomic(FIXTURE_LIBRARY_PATH, formatLibraryJson(lib));
  const eligible = lib.films.filter((f) => f.isAnswerEligible).length;
  console.log(`Wrote ${FIXTURE_LIBRARY_PATH}: ${lib.films.length} films (${eligible} answer eligible), ${lib.people.length} people.`);
}
