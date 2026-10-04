// Play lifecycle (Sections 4.1, 4.9, 9, 10). SERVER ONLY.
//
// Decisions:
// - Identity: anon id from the httpOnly ANON_COOKIE (created when missing; routes set the cookie
//   via `withIdentityCookie`). If a user is signed in, plays are looked up by profile first, then
//   by anon id, and carry profileId.
// - Guess validation order: game over -> film exists and is playable -> not already guessed.
//   A non-playable film is not_found even if it is the answer (so errors never single out the answer).
// - `takes` is null while in progress and set to the number of guesses when the play finishes
//   (win or loss; give up records the guesses made so far). LOSS_SCORE is applied by leaderboards.
// - Finishing a 'daily' play calls repo.recordDailyResult(number, takes on win, null on loss).
//   Vault and pitch plays never touch daily stats.
// - A Reveal is built only when the play is finished.
import 'server-only';
import { RULES } from '@/config/rules';
import { getRepo } from '@/server/db';
import { getCurrentUser } from '@/server/auth';
import { ApiFailure } from '@/server/http';
import { resolveTarget, type ResolvedTarget } from '@/server/puzzles';
import { evaluateGuess } from '@/server/evaluate';
import { loadFilmContexts } from '@/server/engine/context';
import { resolveRegion } from '@/server/region';
import { anonCookieHeader, newAnonId, readAnonId } from '@/lib/anon';
import type {
  Film,
  GiveUpResponse,
  GuessFeedback,
  GuessResponse,
  Hint,
  Play,
  PlayKind,
  PlayStateResponse,
  Reveal,
  UsedHint,
} from '@/lib/types';
import { playCookieHeader, readPlayCookie, upsertCookiePlay } from '@/server/engine/play-cookie';
import type { RegionCode } from '@/config/regions';

export interface Identity {
  anonId: string;
  /** True when the anon cookie was missing or invalid and a new id was minted. */
  isNewAnon: boolean;
  profileId: string | null;
  region: RegionCode;
  /** Keyless mode only: plays mirrored in the signed play cookie, and whether to rewrite it. */
  cookiePlays?: Play[];
  cookieDirty?: boolean;
}

async function safeCurrentUser() {
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
}

/** Resolve who is playing and their rating region from the request. */
export async function resolveIdentity(request: Request): Promise<Identity> {
  const existing = readAnonId(request);
  const user = await safeCurrentUser();
  let profileRegion: RegionCode | null = null;
  if (user) {
    try {
      profileRegion = (await getRepo().getProfile(user.id))?.region ?? null;
    } catch {
      profileRegion = null;
    }
  }
  return {
    anonId: existing ?? newAnonId(),
    isNewAnon: !existing,
    profileId: user?.id ?? null,
    region: resolveRegion(request, profileRegion),
    cookiePlays: getRepo().name === 'memory' ? readPlayCookie(request) : undefined,
  };
}

/** Attach the anon cookie to a response when the identity minted a new id. */
export function withIdentityCookie(response: Response, identity: Identity): Response {
  if (identity.isNewAnon) response.headers.append('Set-Cookie', anonCookieHeader(identity.anonId));
  if (identity.cookieDirty && identity.cookiePlays) response.headers.append('Set-Cookie', playCookieHeader(identity.cookiePlays));
  return response;
}

export async function loadPlay(identity: Identity, kind: PlayKind, ref: string): Promise<Play | null> {
  const repo = getRepo();
  if (identity.profileId) {
    const byProfile = await repo.getPlayByProfile(identity.profileId, kind, ref);
    if (byProfile) return byProfile;
  }
  let byAnon = await repo.getPlay(identity.anonId, kind, ref);
  if (!byAnon && identity.cookiePlays) {
    // Keyless mode: this instance may not have seen the play; restore it from the signed cookie.
    const fromCookie = identity.cookiePlays.find((p) => p.anonId === identity.anonId && p.kind === kind && p.ref === ref);
    if (fromCookie) {
      await repo.savePlay(fromCookie);
      byAnon = fromCookie;
    }
  }
  if (byAnon && identity.profileId && byAnon.profileId && byAnon.profileId !== identity.profileId) {
    // This device's play belongs to another account; start fresh for this one is not possible
    // under the (anon, kind, ref) unique key, so treat it as unavailable.
    throw new ApiFailure('forbidden', 'This play belongs to another account on this device.');
  }
  return byAnon;
}

export function newPlay(identity: Identity, kind: PlayKind, ref: string, now: Date): Play {
  return {
    id: crypto.randomUUID(),
    profileId: identity.profileId,
    anonId: identity.anonId,
    kind,
    ref,
    guesses: [],
    hintsUsed: [],
    status: 'in_progress',
    takes: null,
    startedAt: now.toISOString(),
    firstGuessAt: null,
    finishedAt: null,
  };
}

export async function savePlay(play: Play, identity: Identity): Promise<void> {
  if (identity.profileId && !play.profileId) play.profileId = identity.profileId;
  await getRepo().savePlay(play);
  if (identity.cookiePlays) {
    identity.cookiePlays = upsertCookiePlay(identity.cookiePlays, play);
    identity.cookieDirty = true;
  }
}

export function buildReveal(film: Film): Reveal {
  return {
    filmId: film.id,
    title: film.title,
    year: film.releaseYear,
    posterPath: film.posterPath,
    director: film.directorUnit.display,
    tagline: film.tagline,
    trailerYoutube: film.trailerYoutube,
  };
}

async function answerFilm(target: ResolvedTarget): Promise<Film> {
  const film = await getRepo().getFilm(target.answerFilmId);
  if (!film) throw new ApiFailure('internal', 'This puzzle is unavailable right now.');
  return film;
}

async function finish(play: Play, status: 'won' | 'lost', target: ResolvedTarget, now: Date): Promise<void> {
  play.status = status;
  play.takes = play.guesses.length;
  play.finishedAt = now.toISOString();
  if (target.kind === 'daily' && target.puzzleNumber !== null) {
    await getRepo().recordDailyResult(target.puzzleNumber, status === 'won' ? play.takes : null);
  }
}

function isFinished(play: Play): boolean {
  return play.status !== 'in_progress';
}

export async function submitGuess(
  identity: Identity,
  kind: PlayKind,
  rawRef: string,
  filmId: number,
  now: Date = new Date(),
): Promise<GuessResponse> {
  const repo = getRepo();
  const target = await resolveTarget(kind, rawRef, now);
  const play = (await loadPlay(identity, kind, target.ref)) ?? newPlay(identity, kind, target.ref, now);

  if (isFinished(play) || play.guesses.length >= RULES.maxGuesses) {
    throw new ApiFailure('game_over', 'This round is already over.');
  }
  const guessed = await repo.getFilm(filmId);
  if (!guessed || !guessed.isPlayable) throw new ApiFailure('not_found', 'That film is not in the library.');
  if (play.guesses.includes(filmId)) throw new ApiFailure('already_guessed', 'You already guessed that film.');

  const answer = guessed.id === target.answerFilmId ? guessed : await answerFilm(target);
  const [guessCtx, answerCtx] = await loadFilmContexts(repo, [guessed, answer]);
  const feedback = evaluateGuess(guessCtx!, answerCtx!, identity.region);

  play.guesses.push(filmId);
  if (!play.firstGuessAt) play.firstGuessAt = now.toISOString();
  if (feedback.isCorrect) await finish(play, 'won', target, now);
  else if (play.guesses.length >= RULES.maxGuesses) await finish(play, 'lost', target, now);
  await savePlay(play, identity);

  const res: GuessResponse = { feedback, take: play.guesses.length, status: play.status };
  if (isFinished(play)) res.reveal = buildReveal(answer);
  return res;
}

export async function giveUp(
  identity: Identity,
  kind: PlayKind,
  rawRef: string,
  now: Date = new Date(),
): Promise<GiveUpResponse> {
  const target = await resolveTarget(kind, rawRef, now);
  const play = (await loadPlay(identity, kind, target.ref)) ?? newPlay(identity, kind, target.ref, now);
  if (play.status === 'won') throw new ApiFailure('game_over', 'This round is already over.');
  if (play.status === 'in_progress') {
    await finish(play, 'lost', target, now);
    await savePlay(play, identity);
  }
  return { status: 'lost', reveal: buildReveal(await answerFilm(target)) };
}

/** Hint content for a used type, looked up in the target's candidates. */
export function hintContent(target: ResolvedTarget, type: Play['hintsUsed'][number]): Hint | null {
  return target.hints.find((h) => h.type === type) ?? null;
}

export function usedHints(target: ResolvedTarget, play: Play | null): UsedHint[] {
  if (!play) return [];
  const out: UsedHint[] = [];
  play.hintsUsed.forEach((type, i) => {
    if (!type || (i !== 0 && i !== 1)) return;
    const hint = hintContent(target, type);
    if (hint) out.push({ slot: (i + 1) as 1 | 2, hint });
  });
  return out;
}

/** Re-evaluate stored guesses (oldest first) against the answer for the identity's region. */
export async function reevaluate(play: Play, target: ResolvedTarget, region: RegionCode): Promise<GuessFeedback[]> {
  if (play.guesses.length === 0) return [];
  const repo = getRepo();
  const answer = await answerFilm(target);
  const films = await repo.getFilms(play.guesses);
  const byId = new Map(films.map((f) => [f.id, f]));
  const ordered = play.guesses.map((id) => byId.get(id)).filter((f): f is Film => !!f);
  const [answerCtx, ...guessCtxs] = await loadFilmContexts(repo, [answer, ...ordered]);
  return guessCtxs.map((g) => evaluateGuess(g, answerCtx!, region));
}

export async function getPlayState(
  identity: Identity,
  kind: PlayKind,
  rawRef: string,
  now: Date = new Date(),
): Promise<PlayStateResponse> {
  const target = await resolveTarget(kind, rawRef, now);
  const play = await loadPlay(identity, kind, target.ref);
  if (!play) return { kind, ref: target.ref, status: 'in_progress', take: 0, feedback: [], hints: [] };
  const res: PlayStateResponse = {
    kind,
    ref: target.ref,
    status: play.status,
    take: play.guesses.length,
    feedback: await reevaluate(play, target, identity.region),
    hints: usedHints(target, play),
  };
  if (isFinished(play)) res.reveal = buildReveal(await answerFilm(target));
  return res;
}
