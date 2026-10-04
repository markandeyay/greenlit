// Pure functions that turn raw TMDB movie JSON (with append_to_response=credits,release_dates,
// videos,keywords) into Greenlit domain records. No I/O here, so everything is unit-testable.
import type { DirectorUnit, Film, FilmCertification, Genre, Person } from '../../src/lib/types';
import { REGION_CODES, type RegionCode } from '../../src/config/regions';
import { RULES } from '../../src/config/rules';
import { pickHeadlineStudio, aliasMap, type ProductionCompany } from './studios';

// ---------------------------------------------------------------------------
// Raw TMDB shapes (only the fields we read)
// ---------------------------------------------------------------------------

export interface TmdbCastMember {
  id: number;
  name: string;
  order: number;
  profile_path?: string | null;
  character?: string;
}
export interface TmdbCrewMember {
  id: number;
  name: string;
  job: string;
  department?: string;
  profile_path?: string | null;
}
export interface TmdbReleaseDate {
  certification: string;
  release_date: string; // ISO instant
  type: number; // 1 premiere, 2 limited, 3 theatrical, 4 digital, 5 physical, 6 TV
  note?: string;
}
export interface TmdbVideo {
  key: string;
  site: string;
  type: string;
  official?: boolean;
  published_at?: string;
  name?: string;
}
export interface TmdbMovie {
  id: number;
  title: string;
  original_title?: string;
  release_date?: string; // YYYY-MM-DD or ''
  poster_path?: string | null;
  backdrop_path?: string | null;
  runtime?: number | null;
  revenue?: number | null;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  tagline?: string | null;
  adult?: boolean;
  genres?: { id: number; name: string }[];
  production_companies?: (ProductionCompany & { logo_path?: string | null })[];
  credits?: { cast?: TmdbCastMember[]; crew?: TmdbCrewMember[] };
  release_dates?: { results?: { iso_3166_1: string; release_dates: TmdbReleaseDate[] }[] };
  videos?: { results?: TmdbVideo[] };
  keywords?: { keywords?: { id: number; name: string }[] };
}

// ---------------------------------------------------------------------------
// Director units (Section 4.4)
// ---------------------------------------------------------------------------

/** Known co-directing units, keyed by the sorted member names. */
export const KNOWN_UNITS: readonly { names: readonly string[]; display: string }[] = [
  { names: ['Joel Coen', 'Ethan Coen'], display: 'The Coens' },
  { names: ['Anthony Russo', 'Joe Russo'], display: 'The Russo Brothers' },
  { names: ['Daniel Kwan', 'Daniel Scheinert'], display: 'Daniels' },
  { names: ['Phil Lord', 'Christopher Miller'], display: 'Lord and Miller' },
  { names: ['Lana Wachowski', 'Lilly Wachowski'], display: 'The Wachowskis' },
  { names: ['Josh Safdie', 'Benny Safdie'], display: 'The Safdie Brothers' },
];

const unitKey = (names: readonly string[]) => [...names].map((n) => n.trim().toLowerCase()).sort().join('|');
const KNOWN_UNIT_MAP = new Map(KNOWN_UNITS.map((u) => [unitKey(u.names), u.display]));

/** Display name for a directing credit: nickname for known units, else "A", "A and B", "A, B and C". */
export function directorDisplay(names: readonly string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0]!;
  const known = KNOWN_UNIT_MAP.get(unitKey(names));
  if (known) return known;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Every crew member with job "Director", deduplicated, in credit order. */
export function directorsFromCrew(crew: readonly TmdbCrewMember[] | undefined): TmdbCrewMember[] {
  const seen = new Set<number>();
  const out: TmdbCrewMember[] = [];
  for (const c of crew ?? []) {
    if (c.job !== 'Director' || seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}

export function directorUnitFromCrew(crew: readonly TmdbCrewMember[] | undefined): DirectorUnit {
  const ds = directorsFromCrew(crew);
  return { ids: ds.map((d) => d.id), display: directorDisplay(ds.map((d) => d.name)) };
}

// ---------------------------------------------------------------------------
// Cast
// ---------------------------------------------------------------------------

/** Lead = lowest billing order (order 0), supporting = next RULES.maxSupportingCast. */
export function billedCast(cast: readonly TmdbCastMember[] | undefined): { lead: TmdbCastMember | null; supporting: TmdbCastMember[] } {
  const seen = new Set<number>();
  const sorted = [...(cast ?? [])]
    .sort((a, b) => a.order - b.order)
    .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
  return { lead: sorted[0] ?? null, supporting: sorted.slice(1, 1 + RULES.maxSupportingCast) };
}

// ---------------------------------------------------------------------------
// Release year and certifications (Section 4.6)
// ---------------------------------------------------------------------------

const THEATRICAL = 3;

function allReleases(movie: TmdbMovie) {
  return (movie.release_dates?.results ?? []).flatMap((r) => r.release_dates.map((d) => ({ country: r.iso_3166_1, ...d })));
}

/** Earliest theatrical (type 3) release, falling back to release_date. */
export function theatricalReleaseDate(movie: TmdbMovie): string | null {
  const theatrical = allReleases(movie)
    .filter((d) => d.type === THEATRICAL && d.release_date)
    .map((d) => d.release_date.slice(0, 10))
    .sort();
  if (theatrical[0]) return theatrical[0];
  return movie.release_date ? movie.release_date.slice(0, 10) : null;
}

export function theatricalReleaseYear(movie: TmdbMovie): number | null {
  const d = theatricalReleaseDate(movie);
  const y = d ? Number(d.slice(0, 4)) : NaN;
  return Number.isFinite(y) && y > 1800 ? y : null;
}

/** One certification per supported region: theatrical (type 3) preferred, any non-empty otherwise. */
export function certificationsFor(movie: TmdbMovie): FilmCertification[] {
  const out: FilmCertification[] = [];
  for (const region of REGION_CODES) {
    const entry = movie.release_dates?.results?.find((r) => r.iso_3166_1 === region);
    if (!entry) continue;
    const withCert = entry.release_dates.filter((d) => d.certification && d.certification.trim());
    const pick = withCert.find((d) => d.type === THEATRICAL) ?? withCert[0];
    if (pick) out.push({ filmId: movie.id, region: region as RegionCode, rating: pick.certification.trim() });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Numbers, trailer, keywords
// ---------------------------------------------------------------------------

/** TMDB revenue -> nominal worldwide USD. 0 or missing means unknown. */
export function boxOfficeFrom(revenue: number | null | undefined): number | null {
  return typeof revenue === 'number' && revenue > 0 ? Math.round(revenue) : null;
}

/** vote_average x10, rounded, clamped to 0..100. Null when nobody has voted. */
export function scoreFrom(voteAverage: number | undefined, voteCount?: number): number | null {
  if (typeof voteAverage !== 'number' || !Number.isFinite(voteAverage)) return null;
  if (voteCount === 0) return null;
  return Math.max(0, Math.min(100, Math.round(voteAverage * 10)));
}

/** Official YouTube trailer key; unofficial trailers only as a fallback. Oldest first (the original trailer). */
export function trailerKey(videos: readonly TmdbVideo[] | undefined): string | null {
  const trailers = (videos ?? []).filter((v) => v.site === 'YouTube' && v.type === 'Trailer' && v.key);
  if (trailers.length === 0) return null;
  const byDate = (a: TmdbVideo, b: TmdbVideo) => (a.published_at ?? '').localeCompare(b.published_at ?? '');
  const official = trailers.filter((v) => v.official === true).sort(byDate);
  return (official[0] ?? [...trailers].sort(byDate)[0])!.key;
}

export function keywordNames(movie: TmdbMovie): string[] {
  return (movie.keywords?.keywords ?? []).map((k) => k.name.trim()).filter(Boolean);
}

/** Taglines and other text: trim, collapse whitespace, replace em dashes (never allowed in copy) with a comma. */
export function cleanText(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.replace(/\s*—\s*/g, ', ').replace(/\s+/g, ' ').trim();
  return t || null;
}

// ---------------------------------------------------------------------------
// Whole movie
// ---------------------------------------------------------------------------

export interface NormalizedMovie {
  /** studioId is null here; the library builder assigns ids from `studioName`. */
  film: Film;
  studioName: string | null;
  studioMapped: boolean;
  studioRawCompanyId: number | null;
  people: Person[];
  certifications: FilmCertification[];
}

export function normalizeMovie(movie: TmdbMovie, aliases: Map<number, string> = aliasMap()): NormalizedMovie | null {
  const releaseYear = theatricalReleaseYear(movie);
  if (releaseYear === null) return null; // films.release_year is not null
  const directors = directorsFromCrew(movie.credits?.crew);
  if (directors.length === 0) return null; // films.director_unit needs at least one id
  const genreIds = (movie.genres ?? []).map((g) => g.id).slice(0, 5);
  if (genreIds.length === 0) return null; // films.genre_ids is 1..5

  const { lead, supporting } = billedCast(movie.credits?.cast);
  const studio = pickHeadlineStudio(movie.production_companies, aliases);
  const people = new Map<number, Person>();
  for (const p of [...directors, ...(lead ? [lead] : []), ...supporting]) {
    if (!people.has(p.id)) people.set(p.id, { id: p.id, name: p.name, profilePath: p.profile_path ?? null });
  }

  const film: Film = {
    id: movie.id,
    title: movie.title.trim(),
    originalTitle: movie.original_title && movie.original_title.trim() !== movie.title.trim() ? movie.original_title.trim() : null,
    releaseYear,
    releaseDate: theatricalReleaseDate(movie),
    posterPath: movie.poster_path ?? null,
    backdropPath: movie.backdrop_path ?? null,
    runtimeMin: movie.runtime && movie.runtime > 0 ? movie.runtime : null,
    boxOfficeUsd: boxOfficeFrom(movie.revenue),
    scoreSnapshot: scoreFrom(movie.vote_average, movie.vote_count),
    studioId: null,
    directorUnit: { ids: directors.map((d) => d.id), display: directorDisplay(directors.map((d) => d.name)) },
    leadPersonId: lead?.id ?? null,
    supportingIds: supporting.map((s) => s.id),
    genreIds,
    trailerYoutube: trailerKey(movie.videos?.results),
    tagline: cleanText(movie.tagline),
    keywords: keywordNames(movie),
    popularity: typeof movie.popularity === 'number' ? Math.round(movie.popularity * 1000) / 1000 : null,
    isPlayable: !movie.adult,
    isAnswerEligible: false,
  };
  return {
    film,
    studioName: studio?.name ?? null,
    studioMapped: studio?.mapped ?? false,
    studioRawCompanyId: studio?.rawCompanyId ?? null,
    people: [...people.values()],
    certifications: certificationsFor(movie),
  };
}

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

/** Popularity floor for answer eligibility. Tune so roughly 1,500 of 4,000 films qualify. */
export const ELIGIBLE_MIN_POPULARITY = 12;
/** Vote count floor so the frozen score is meaningful. */
export const ELIGIBLE_MIN_VOTES = 1500;

export interface EligibilityOptions {
  minPopularity?: number;
  minVotes?: number;
  voteCount?: number;
}

/** Reasons a film is not answer eligible (empty array = eligible). */
export function eligibilityProblems(film: Film, certs: readonly FilmCertification[], opts: EligibilityOptions = {}): string[] {
  const minPop = opts.minPopularity ?? ELIGIBLE_MIN_POPULARITY;
  const problems: string[] = [];
  if (film.boxOfficeUsd === null) problems.push('no box office');
  if (!certs.some((c) => c.filmId === film.id && c.region === 'US')) problems.push('no US certification');
  if (film.directorUnit.ids.length === 0) problems.push('no director');
  if (film.leadPersonId === null) problems.push('no lead');
  if (film.genreIds.length === 0) problems.push('no genres');
  if (!film.tagline) problems.push('no tagline');
  if (film.scoreSnapshot === null) problems.push('no score');
  if ((film.popularity ?? 0) < minPop) problems.push('popularity below threshold');
  if (opts.voteCount !== undefined && opts.voteCount < (opts.minVotes ?? ELIGIBLE_MIN_VOTES)) problems.push('too few votes');
  if (!film.isPlayable) problems.push('not playable');
  return problems;
}

// ---------------------------------------------------------------------------
// Genres
// ---------------------------------------------------------------------------

/** TMDB movie genre list (stable; used when /genre/movie/list is not cached). */
export const TMDB_GENRES: readonly Genre[] = [
  { id: 28, name: 'Action' },
  { id: 12, name: 'Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 14, name: 'Fantasy' },
  { id: 36, name: 'History' },
  { id: 27, name: 'Horror' },
  { id: 10402, name: 'Music' },
  { id: 9648, name: 'Mystery' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Science Fiction' },
  { id: 10770, name: 'TV Movie' },
  { id: 53, name: 'Thriller' },
  { id: 10752, name: 'War' },
  { id: 37, name: 'Western' },
];
