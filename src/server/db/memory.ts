// In-memory Repo backed by a LibrarySnapshot (fixtures by default). Used when Supabase env vars
// are absent. State lives on globalThis so it survives dev hot reloads within one process.
import type {
  DailyStats,
  Film,
  FilmAward,
  FilmCertification,
  Person,
  Pitch,
  Play,
  PlayKind,
  Profile,
  Puzzle,
  SearchResult,
  Studio,
  StudioAlias,
  Genre,
} from '@/lib/types';
import type { LibrarySnapshot, PlayFilter, Repo } from './repo';
import { normalizeForSearch, scoreTitleMatch } from '@/lib/search';
import { decrypt, encrypt } from './secret';

interface MemoryState {
  films: Map<number, Film>;
  people: Map<number, Person>;
  studios: Map<number, Studio>;
  studioAliases: Map<number, StudioAlias>;
  genres: Map<number, Genre>;
  certifications: FilmCertification[];
  awards: FilmAward[];
  puzzles: Map<number, Puzzle>;
  pitches: Map<string, Pitch>;
  plays: Map<string, Play>; // by id
  profiles: Map<string, Profile>;
  dailyStats: Map<number, DailyStats>;
}

const clone = <T>(v: T): T => structuredClone(v);

export function createMemoryState(lib: LibrarySnapshot): MemoryState {
  return {
    films: new Map(lib.films.map((f) => [f.id, f])),
    people: new Map(lib.people.map((p) => [p.id, p])),
    studios: new Map(lib.studios.map((s) => [s.id, s])),
    studioAliases: new Map(lib.studioAliases.map((a) => [a.rawCompanyId, a])),
    genres: new Map(lib.genres.map((g) => [g.id, g])),
    certifications: [...lib.certifications],
    awards: [...lib.awards],
    puzzles: new Map(),
    pitches: new Map(),
    plays: new Map(),
    profiles: new Map(),
    dailyStats: new Map(),
  };
}

export class MemoryRepo implements Repo {
  readonly name = 'memory' as const;
  constructor(private s: MemoryState) {}

  // Library -----------------------------------------------------------------
  async getFilm(id: number) {
    const f = this.s.films.get(id);
    return f ? clone(f) : null;
  }
  async getFilms(ids: number[]) {
    return ids.map((id) => this.s.films.get(id)).filter((f): f is Film => !!f).map(clone);
  }
  async listFilms(opts: { playable?: boolean; answerEligible?: boolean } = {}) {
    return [...this.s.films.values()]
      .filter((f) => (opts.playable === undefined || f.isPlayable === opts.playable))
      .filter((f) => (opts.answerEligible === undefined || f.isAnswerEligible === opts.answerEligible))
      .map(clone);
  }
  async searchFilms(q: string, limit: number): Promise<SearchResult[]> {
    const nq = normalizeForSearch(q);
    if (!nq) return [];
    return [...this.s.films.values()]
      .filter((f) => f.isPlayable)
      .map((f) => ({
        f,
        score: Math.max(scoreTitleMatch(nq, f.title), f.originalTitle ? scoreTitleMatch(nq, f.originalTitle) : 0),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || (b.f.popularity ?? 0) - (a.f.popularity ?? 0))
      .slice(0, limit)
      .map(({ f }) => ({ id: f.id, title: f.title, year: f.releaseYear, posterPath: f.posterPath }));
  }
  async upsertFilms(films: Film[]) {
    for (const f of films) this.s.films.set(f.id, clone(f));
  }
  async getPeople(ids: number[]) {
    return ids.map((id) => this.s.people.get(id)).filter((p): p is Person => !!p).map(clone);
  }
  async upsertPeople(people: Person[]) {
    for (const p of people) this.s.people.set(p.id, clone(p));
  }
  async getStudio(id: number) {
    const s = this.s.studios.get(id);
    return s ? clone(s) : null;
  }
  async listStudios() {
    return [...this.s.studios.values()].map(clone).sort((a, b) => a.name.localeCompare(b.name));
  }
  async upsertStudio(studio: Omit<Studio, 'id'> & { id?: number }) {
    const existing = [...this.s.studios.values()].find((s) => s.name === studio.name);
    const id = studio.id ?? existing?.id ?? Math.max(0, ...this.s.studios.keys()) + 1;
    const row: Studio = { id, name: studio.name, logoPath: studio.logoPath ?? null };
    this.s.studios.set(id, row);
    return clone(row);
  }
  async listStudioAliases() {
    return [...this.s.studioAliases.values()].map(clone);
  }
  async setStudioAlias(alias: StudioAlias) {
    this.s.studioAliases.set(alias.rawCompanyId, clone(alias));
  }
  async deleteStudioAlias(rawCompanyId: number) {
    this.s.studioAliases.delete(rawCompanyId);
  }
  async listGenres() {
    return [...this.s.genres.values()].map(clone);
  }
  async getCertifications(filmId: number) {
    return this.s.certifications.filter((c) => c.filmId === filmId).map(clone);
  }
  async getAwards(filmId: number) {
    return this.s.awards.filter((a) => a.filmId === filmId).map(clone);
  }

  // Puzzles -----------------------------------------------------------------
  async getPuzzle(number: number) {
    const p = this.s.puzzles.get(number);
    return p ? clone(p) : null;
  }
  async getPuzzleByDate(date: string) {
    const p = [...this.s.puzzles.values()].find((x) => x.date === date);
    return p ? clone(p) : null;
  }
  async listPuzzles(range: { fromDate?: string; toDate?: string }) {
    return [...this.s.puzzles.values()]
      .filter((p) => (!range.fromDate || p.date >= range.fromDate) && (!range.toDate || p.date <= range.toDate))
      .sort((a, b) => a.number - b.number)
      .map(clone);
  }
  async upsertPuzzle(puzzle: Puzzle) {
    for (const [n, p] of this.s.puzzles) {
      if (p.date === puzzle.date && n !== puzzle.number) throw new Error(`date ${puzzle.date} already scheduled`);
    }
    this.s.puzzles.set(puzzle.number, clone(puzzle));
  }
  async deletePuzzle(number: number) {
    this.s.puzzles.delete(number);
  }

  // Pitches -----------------------------------------------------------------
  async createPitch(pitch: Pitch) {
    // Opaque, instance-independent slug: AES-GCM of the pitch (not derivable from the film).
    const slug = encrypt(JSON.stringify({ f: pitch.filmId, n: pitch.note, c: pitch.creatorId, t: pitch.createdAt }));
    const stored: Pitch = { ...pitch, slug };
    this.s.pitches.set(slug, clone(stored));
    // The caller's random slug also resolves on this instance.
    if (!this.s.pitches.has(pitch.slug)) this.s.pitches.set(pitch.slug, clone(pitch));
    return clone(stored);
  }
  async getPitch(slug: string) {
    const p = this.s.pitches.get(slug);
    if (p) return clone(p);
    const raw = slug.length > 28 ? decrypt(slug) : null;
    if (!raw) return null;
    try {
      const d = JSON.parse(raw) as { f: number; n: string | null; c: string | null; t: string };
      const restored: Pitch = { slug, filmId: d.f, note: d.n, creatorId: d.c, createdAt: d.t };
      this.s.pitches.set(slug, restored);
      return clone(restored);
    } catch {
      return null;
    }
  }
  async listPitchesByCreator(creatorId: string) {
    return [...this.s.pitches.values()].filter((p) => p.creatorId === creatorId).map(clone);
  }

  // Plays -------------------------------------------------------------------
  async getPlay(anonId: string, kind: PlayKind, ref: string) {
    const p = [...this.s.plays.values()].find((x) => x.anonId === anonId && x.kind === kind && x.ref === ref);
    return p ? clone(p) : null;
  }
  async getPlayByProfile(profileId: string, kind: PlayKind, ref: string) {
    const p = [...this.s.plays.values()].find((x) => x.profileId === profileId && x.kind === kind && x.ref === ref);
    return p ? clone(p) : null;
  }
  async savePlay(play: Play) {
    for (const p of this.s.plays.values()) {
      if (p.id !== play.id && p.anonId === play.anonId && p.kind === play.kind && p.ref === play.ref) {
        throw new Error('duplicate play for anon/kind/ref');
      }
    }
    this.s.plays.set(play.id, clone(play));
  }
  async listPlays(f: PlayFilter) {
    return [...this.s.plays.values()]
      .filter((p) => !f.kind || p.kind === f.kind)
      .filter((p) => !f.ref || p.ref === f.ref)
      .filter((p) => !f.refs || f.refs.includes(p.ref))
      .filter((p) => !f.profileId || p.profileId === f.profileId)
      .filter((p) => !f.anonId || p.anonId === f.anonId)
      .filter((p) => !f.status || p.status === f.status)
      .filter((p) => !f.finishedSince || (p.finishedAt !== null && p.finishedAt >= f.finishedSince))
      .map(clone);
  }
  async assignPlaysToProfile(anonId: string, profileId: string) {
    let n = 0;
    for (const p of this.s.plays.values()) {
      if (p.anonId === anonId && p.profileId === null) {
        p.profileId = profileId;
        n++;
      }
    }
    return n;
  }

  // Profiles ----------------------------------------------------------------
  async getProfile(id: string) {
    const p = this.s.profiles.get(id);
    return p ? clone(p) : null;
  }
  async getProfileByHandle(handle: string) {
    const h = handle.toLowerCase();
    const p = [...this.s.profiles.values()].find((x) => x.handle?.toLowerCase() === h);
    return p ? clone(p) : null;
  }
  async listProfiles(ids: string[]) {
    return ids.map((id) => this.s.profiles.get(id)).filter((p): p is Profile => !!p).map(clone);
  }
  async upsertProfile(profile: Profile) {
    if (profile.handle) {
      const taken = await this.getProfileByHandle(profile.handle);
      if (taken && taken.id !== profile.id) throw new Error('handle taken');
    }
    this.s.profiles.set(profile.id, clone(profile));
  }

  // Aggregates --------------------------------------------------------------
  async getDailyStats(puzzleNumber: number) {
    const d = this.s.dailyStats.get(puzzleNumber);
    return d ? clone(d) : null;
  }
  async recordDailyResult(puzzleNumber: number, takes: number | null) {
    const d = this.s.dailyStats.get(puzzleNumber) ?? {
      puzzleNumber,
      distribution: Array<number>(11).fill(0),
      plays: 0,
      wins: 0,
    };
    d.plays += 1;
    if (takes !== null) {
      d.wins += 1;
      d.distribution[takes - 1]! += 1;
    } else {
      d.distribution[10]! += 1;
    }
    this.s.dailyStats.set(puzzleNumber, d);
  }
}
