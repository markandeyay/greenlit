// Loads FilmContext records from the Repo with batched lookups. Server only.
import 'server-only';
import type { Repo } from '@/server/db/repo';
import type { Film, Person, Studio } from '@/lib/types';
import type { RegionCode } from '@/config/regions';
import type { FilmContext } from '@/server/evaluate';
import { RULES } from '@/config/rules';

function personIdsOf(film: Film): number[] {
  const ids = [...film.directorUnit.ids, ...film.supportingIds.slice(0, RULES.maxSupportingCast)];
  if (film.leadPersonId !== null) ids.push(film.leadPersonId);
  return ids;
}

/** Build contexts for several films with one people lookup and one genre listing. Order is preserved. */
export async function loadFilmContexts(repo: Repo, films: Film[]): Promise<FilmContext[]> {
  if (films.length === 0) return [];
  const allPersonIds = [...new Set(films.flatMap(personIdsOf))];
  const studioIds = [...new Set(films.map((f) => f.studioId).filter((id): id is number => id !== null))];
  const [people, genres, studios, certs] = await Promise.all([
    repo.getPeople(allPersonIds),
    repo.listGenres(),
    Promise.all(studioIds.map((id) => repo.getStudio(id))),
    Promise.all(films.map((f) => repo.getCertifications(f.id))),
  ]);
  const peopleMap = new Map<number, Person>(people.map((p) => [p.id, p]));
  const studioMap = new Map<number, Studio>(studios.filter((s): s is Studio => !!s).map((s) => [s.id, s]));
  return films.map((film, i) => {
    const certifications: Partial<Record<RegionCode, string>> = {};
    for (const c of certs[i] ?? []) if (c.rating) certifications[c.region] = c.rating;
    const wanted = new Set(film.genreIds);
    return {
      film,
      people: peopleMap,
      studio: film.studioId !== null ? (studioMap.get(film.studioId) ?? null) : null,
      genres: genres.filter((g) => wanted.has(g.id)),
      certifications,
    };
  });
}

export async function loadFilmContext(repo: Repo, film: Film): Promise<FilmContext> {
  const [ctx] = await loadFilmContexts(repo, [film]);
  return ctx!;
}
