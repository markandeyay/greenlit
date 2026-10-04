// POST /api/pitch (Section 9): create a custom challenge. Returns { slug, url } only.
import { z } from 'zod';
import { PITCH, RATE_LIMITS } from '@/config/game';
import { ApiFailure, json, parseBody } from '@/server/http';
import { gameRoute } from '@/server/engine/route';
import { checkRateLimit } from '@/server/ratelimit';
import { createPitch, creatorCookieHeader } from '@/server/pitch';

export const dynamic = 'force-dynamic';

const HOUR_SEC = 60 * 60;

const pitchSchema = z.object({
  filmId: z.number().int().positive().max(2_147_483_647),
  // Generous raw cap: the real limit (PITCH.noteMaxLength) applies after cleanup in moderateNote.
  note: z.string().max(PITCH.noteMaxLength * 4).nullish(),
});

export async function POST(request: Request): Promise<Response> {
  return gameRoute(request, async (identity) => {
    const body = await parseBody(request, pitchSchema);
    const rl = await checkRateLimit(`pitch:anon:${identity.anonId}`, RATE_LIMITS.pitchPerHourPerAnon, HOUR_SEC);
    if (!rl.ok) throw new ApiFailure('rate_limited', 'That is a lot of pitches. Take a break and try again later.');
    const { response } = await createPitch({ filmId: body.filmId, note: body.note }, { creatorId: identity.profileId });
    const res = json(response, { status: 201 });
    res.headers.append('Set-Cookie', creatorCookieHeader(response.slug));
    return res;
  });
}
