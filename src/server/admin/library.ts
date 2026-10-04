// Builds the partial LibrarySnapshot the pure hint generator needs, from the Repo. SERVER ONLY.
import 'server-only';
import type { Repo, LibrarySnapshot } from '@/server/db/repo';
import type { Film } from '@/lib/types';

export function castOf(film: Film): number[] {
  return [film.leadPersonId, ...film.supportingIds].filter((x): x is number => x !== null);
}

/** Every library film (cast graph, filmography), the film's cast names and its awards. */
export async function hintLibraryFor(repo: Repo, film: Film, allFilms?: Film[]): Promise<LibrarySnapshot> {
  const [films, people, awards] = await Promise.all([
    allFilms ? Promise.resolve(allFilms) : repo.listFilms(),
    repo.getPeople(castOf(film)),
    repo.getAwards(film.id),
  ]);
  return {
    v: 1,
    generatedAt: new Date(0).toISOString(),
    source: 'tmdb',
    films,
    people,
    studios: [],
    studioAliases: [],
    genres: [],
    certifications: [],
    awards,
  };
}
