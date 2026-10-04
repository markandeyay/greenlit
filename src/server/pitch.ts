// Pitch: custom challenges (Sections 5, 8, 9, 9.1 item 17, 10.5). SERVER ONLY.
//
// - Slugs are PITCH.slugLength random characters from PITCH.slugAlphabet drawn with
//   crypto.getRandomValues (rejection sampling, no modulo bias). They are never derived from the
//   film. The Repo may replace the slug (keyless mode returns an opaque AES-GCM token); the
//   RETURNED slug is always the one used for URLs and cookies.
// - Notes: optional, cleaned to plain text, at most PITCH.noteMaxLength characters, rejected
//   (not masked) on profanity or links (see src/server/moderation.ts), and rejected when they
//   spell out the film's title (a note is a clue, not the answer).
// - Creator proof: a signed-in creator matches pitch.creatorId. Keyless / anonymous creators
//   get an httpOnly cookie `gl_pitch_<hash(slug)>` holding an HMAC of the slug (SESSION_SECRET via
//   src/server/db/secret.ts sign()), scoped with Path=/api/pitch/<slug> so it is only ever sent
//   to that pitch's results route. Either proof unlocks GET /api/pitch/[slug]/results.
import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { getRepo } from '@/server/db';
import type { Repo } from '@/server/db/repo';
import { sign } from '@/server/db/secret';
import { ApiFailure } from '@/server/http';
import { buildReveal } from '@/server/plays';
import { moderateNote } from '@/server/moderation';
import { leaksTitle } from '@/server/admin/hints-draft';
import { PITCH } from '@/config/game';
import { SITE_URL } from '@/config/brand';
import { readCookie } from '@/lib/anon';
import type { Pitch, PitchResponse, PitchResultRow, PitchResultsResponse, Play } from '@/lib/types';

/** How long the creator cookie lives (a cookie lifetime, not a game rule). */
export const CREATOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

/** Accepts both the 8-char base36 form and the keyless base64url token. */
export const PITCH_SLUG_RE = /^[A-Za-z0-9_-]{1,1024}$/;

type RandomFill = (buf: Uint8Array) => Uint8Array;
const defaultFill: RandomFill = (buf) => crypto.getRandomValues(buf);

/** Random slug: PITCH.slugLength chars of PITCH.slugAlphabet, unbiased. */
export function generatePitchSlug(fill: RandomFill = defaultFill): string {
  const alphabet = PITCH.slugAlphabet;
  const n = alphabet.length;
  const limit = 256 - (256 % n); // reject bytes >= limit to avoid modulo bias
  let out = '';
  while (out.length < PITCH.slugLength) {
    const buf = fill(new Uint8Array(PITCH.slugLength * 2));
    for (const b of buf) {
      if (b < limit) out += alphabet[b % n];
      if (out.length === PITCH.slugLength) break;
    }
  }
  return out;
}

export function pitchUrl(slug: string): string {
  return `${SITE_URL.replace(/\/$/, '')}/p/${encodeURIComponent(slug)}`;
}

// ---------------------------------------------------------------------------
// Creator proof cookie
// ---------------------------------------------------------------------------

export function creatorCookieName(slug: string): string {
  return `gl_pitch_${createHash('sha256').update(slug).digest('hex').slice(0, 16)}`;
}

/** HMAC of the slug (the MAC half of sign()), so the cookie never repeats the slug. */
export function creatorKeyFor(slug: string): string {
  return sign(`pitch-creator:${slug}`).split('.')[1]!;
}

export function verifyCreatorKey(slug: string, key: string | null | undefined): boolean {
  if (!key) return false;
  const expected = Buffer.from(creatorKeyFor(slug));
  const got = Buffer.from(key);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export function creatorCookieHeader(slug: string, secure: boolean = process.env.NODE_ENV === 'production'): string {
  const attrs = [
    `${creatorCookieName(slug)}=${creatorKeyFor(slug)}`,
    `Path=/api/pitch/${encodeURIComponent(slug)}`,
    `Max-Age=${CREATOR_COOKIE_MAX_AGE}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}

export function readCreatorKey(request: Request, slug: string): string | null {
  return readCookie(request, creatorCookieName(slug));
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export interface CreatePitchInput {
  filmId: number;
  note?: string | null;
}

const MAX_SLUG_ATTEMPTS = 4;

/**
 * Validate and store a pitch. Returns the stored pitch (with the Repo's slug) and the response.
 * The response holds only the slug and URL: never the film id or title.
 */
export async function createPitch(
  input: CreatePitchInput,
  ctx: { creatorId: string | null; now?: Date; repo?: Repo; fill?: RandomFill },
): Promise<{ pitch: Pitch; response: PitchResponse }> {
  const repo = ctx.repo ?? getRepo();
  const film = await repo.getFilm(input.filmId);
  if (!film || !film.isPlayable) throw new ApiFailure('not_found', 'That film is not in the library.');
  const mod = moderateNote(input.note, PITCH.noteMaxLength);
  if (!mod.ok) throw new ApiFailure('bad_request', mod.message);
  if (mod.text && leaksTitle(mod.text, film)) {
    throw new ApiFailure('bad_request', 'Your note gives the title away. Try a subtler clue.');
  }
  const createdAt = (ctx.now ?? new Date()).toISOString();
  let lastError: unknown = null;
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = generatePitchSlug(ctx.fill);
    if (await repo.getPitch(slug)) continue; // vanishingly rare collision; draw again
    try {
      const stored = await repo.createPitch({ slug, filmId: film.id, note: mod.text, creatorId: ctx.creatorId, createdAt });
      return { pitch: stored, response: { slug: stored.slug, url: pitchUrl(stored.slug) } };
    } catch (err) {
      lastError = err; // unique violation from a concurrent insert: retry with a new slug
    }
  }
  console.error('[pitch] could not store pitch', lastError);
  throw new ApiFailure('internal', 'Could not create the challenge. Please try again.');
}

// ---------------------------------------------------------------------------
// Results (creator only)
// ---------------------------------------------------------------------------

export function isPitchCreator(pitch: Pitch, proof: { userId: string | null; creatorKey: string | null }): boolean {
  if (pitch.creatorId && proof.userId && pitch.creatorId === proof.userId) return true;
  return verifyCreatorKey(pitch.slug, proof.creatorKey);
}

function rowOrder(a: Play, b: Play): number {
  const fa = a.finishedAt ?? '';
  const fb = b.finishedAt ?? '';
  if (fa && fb) return fa.localeCompare(fb);
  if (fa) return -1;
  if (fb) return 1;
  return a.startedAt.localeCompare(b.startedAt);
}

export async function getPitchResults(
  slug: string,
  proof: { userId: string | null; creatorKey: string | null },
  repo: Repo = getRepo(),
): Promise<PitchResultsResponse> {
  if (!PITCH_SLUG_RE.test(slug)) throw new ApiFailure('not_found', 'Challenge not found.');
  const pitch = await repo.getPitch(slug);
  if (!pitch) throw new ApiFailure('not_found', 'Challenge not found.');
  if (!isPitchCreator(pitch, proof)) {
    throw new ApiFailure('forbidden', 'Only the person who pitched this film can see how friends did.');
  }
  const film = await repo.getFilm(pitch.filmId);
  if (!film) throw new ApiFailure('not_found', 'Challenge not found.');
  const plays = (await repo.listPlays({ kind: 'pitch', ref: pitch.slug }))
    // The creator's own test runs are not "friends".
    .filter((p) => !(pitch.creatorId && p.profileId === pitch.creatorId))
    .filter((p) => p.guesses.length > 0 || p.status !== 'in_progress')
    .sort(rowOrder);
  const profileIds = [...new Set(plays.map((p) => p.profileId).filter((id): id is string => !!id))];
  const profiles = profileIds.length ? await repo.listProfiles(profileIds) : [];
  const handles = new Map(profiles.map((p) => [p.id, p.handle]));
  const results: PitchResultRow[] = plays.map((p) => ({
    handle: p.profileId ? (handles.get(p.profileId) ?? null) : null,
    status: p.status,
    takes: p.status === 'in_progress' ? p.guesses.length : (p.takes ?? p.guesses.length),
    hintsUsed: p.hintsUsed.length,
    finishedAt: p.finishedAt,
  }));
  return { slug: pitch.slug, film: buildReveal(film), results };
}
