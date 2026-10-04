// Admin film library tools (WS8): search answer-eligible films, view details, basic edits.
// SERVER ONLY. Score is frozen at ingest (Section 4.2) and is never editable here.
import 'server-only';
import { getRepo } from '@/server/db';
import type { Repo } from '@/server/db/repo';
import { ApiFailure } from '@/server/http';
import type { Film } from '@/lib/types';
import { SCHEDULING } from '@/config/game';
import { addDays, dateInResetZone } from '@/lib/dates';
import { normalizeForSearch, scoreTitleMatch } from '@/lib/search';
import { missingRequiredFields } from './rules';
import { summarizeFilm } from './schedule';
import type { AdminFilmDetail, AdminFilmPatch, AdminFilmSummary } from './types';

export const ADMIN_SEARCH_LIMIT = 25;

export async function searchAdminFilms(
  q: string,
  opts: { eligibleOnly?: boolean; now?: Date } = {},
  repo: Repo = getRepo(),
): Promise<AdminFilmSummary[]> {
  const films = await repo.listFilms(opts.eligibleOnly ? { answerEligible: true } : {});
  const nq = normalizeForSearch(q);
  const ranked = nq
    ? films
        .map((f) => ({ f, s: Math.max(scoreTitleMatch(nq, f.title), f.originalTitle ? scoreTitleMatch(nq, f.originalTitle) : 0) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s || (b.f.popularity ?? 0) - (a.f.popularity ?? 0))
        .map((x) => x.f)
    : [...films].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
  const top = ranked.slice(0, ADMIN_SEARCH_LIMIT);
  const today = dateInResetZone(opts.now);
  const puzzles = await repo.listPuzzles({
    fromDate: addDays(today, -SCHEDULING.repeatCooldownDays),
    toDate: addDays(today, SCHEDULING.aheadDays + SCHEDULING.repeatCooldownDays),
  });
  return Promise.all(top.map((f) => summarizeFilm(repo, f, puzzles)));
}

export async function getAdminFilm(id: number, repo: Repo = getRepo()): Promise<AdminFilmDetail> {
  const film = await repo.getFilm(id);
  if (!film) throw new ApiFailure('not_found', 'Film not found.');
  const personIds = [...film.directorUnit.ids, ...(film.leadPersonId !== null ? [film.leadPersonId] : []), ...film.supportingIds];
  const [certifications, people, studio, genres] = await Promise.all([
    repo.getCertifications(id),
    repo.getPeople(personIds),
    film.studioId !== null ? repo.getStudio(film.studioId) : Promise.resolve(null),
    repo.listGenres(),
  ]);
  const name = (pid: number) => people.find((p) => p.id === pid)?.name ?? `#${pid}`;
  return {
    film,
    certifications,
    directorNames: film.directorUnit.ids.map(name),
    leadName: film.leadPersonId !== null ? name(film.leadPersonId) : null,
    supportingNames: film.supportingIds.map(name),
    studio,
    genres,
    missing: missingRequiredFields(film, certifications),
  };
}

/** Apply a basic edit. Marking a film answer-eligible requires every other required field. */
export async function updateAdminFilm(id: number, patch: AdminFilmPatch, repo: Repo = getRepo()): Promise<AdminFilmDetail> {
  const film = await repo.getFilm(id);
  if (!film) throw new ApiFailure('not_found', 'Film not found.');
  const next: Film = { ...film };
  if (patch.tagline !== undefined) next.tagline = patch.tagline?.trim() || null;
  if (patch.boxOfficeUsd !== undefined) next.boxOfficeUsd = patch.boxOfficeUsd;
  if (patch.keywords !== undefined) next.keywords = [...new Set(patch.keywords.map((k) => k.trim()).filter(Boolean))];
  if (patch.genreIds !== undefined) {
    const known = new Set((await repo.listGenres()).map((g) => g.id));
    const ids = [...new Set(patch.genreIds)];
    if (ids.some((g) => !known.has(g))) throw new ApiFailure('bad_request', 'Unknown genre id.');
    if (ids.length > 5) throw new ApiFailure('bad_request', 'A film has at most 5 genres.');
    next.genreIds = ids;
  }
  if (patch.isPlayable !== undefined) next.isPlayable = patch.isPlayable;
  if (patch.isAnswerEligible !== undefined) next.isAnswerEligible = patch.isAnswerEligible;
  if (next.isAnswerEligible) {
    if (!next.isPlayable) throw new ApiFailure('bad_request', 'An answer-eligible film must also be playable (searchable).');
    const missing = missingRequiredFields(next, await repo.getCertifications(id)).filter((m) => m !== 'answer eligible flag');
    if (missing.length) throw new ApiFailure('bad_request', `Cannot mark eligible. Missing: ${missing.join(', ')}.`);
  }
  await repo.upsertFilms([next]);
  return getAdminFilm(id, repo);
}
