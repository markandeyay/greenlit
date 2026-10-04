// POST /api/modes/unlimited/new { band, after? } -> { ref, band } (Section 5, 9.1 item 19).
// Deals a random film from a difficulty band as an OPAQUE encrypted ref. The film, its id and
// its title never appear in the response. `after` is the previous ref, so the next reel is a
// different film. Rate limited per anon id with the guess budget.
import { z } from 'zod';
import { RATE_LIMITS } from '@/config/game';
import { UNLIMITED } from '@/config/modes';
import { ApiFailure, json, parseBody } from '@/server/http';
import { gameRoute } from '@/server/engine/route';
import { refSchema } from '@/server/engine/schemas';
import { newUnlimitedReel, UNLIMITED_BANDS } from '@/server/modes/unlimited';
import { checkRateLimit, clientIp } from '@/server/ratelimit';

export const dynamic = 'force-dynamic';

const WINDOW_SEC = 60;

const bodySchema = z.object({
  band: z.enum(UNLIMITED_BANDS).default(UNLIMITED.defaultBand),
  after: refSchema.optional(),
});

export async function POST(request: Request): Promise<Response> {
  return gameRoute(request, async (identity) => {
    const ip = clientIp(request);
    const [byAnon, byIp] = await Promise.all([
      checkRateLimit(`unlimited:anon:${identity.anonId}`, RATE_LIMITS.guessPerMinutePerAnon, WINDOW_SEC),
      ip ? checkRateLimit(`unlimited:ip:${ip}`, RATE_LIMITS.guessPerMinutePerIp, WINDOW_SEC) : Promise.resolve(null),
    ]);
    if (!byAnon.ok || (byIp && !byIp.ok)) {
      throw new ApiFailure('rate_limited', 'Too many new reels. Take a breath and try again in a minute.');
    }
    const body = await parseBody(request, bodySchema);
    return json(await newUnlimitedReel(body.band, body.after ?? null));
  });
}
