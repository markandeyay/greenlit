// POST /api/guess (Section 9). Rate limited per anon id and per IP.
import { RATE_LIMITS } from '@/config/game';
import { ApiFailure, json, parseBody } from '@/server/http';
import { gameRoute } from '@/server/engine/route';
import { guessSchema } from '@/server/engine/schemas';
import { submitGuess } from '@/server/plays';
import { checkRateLimit, clientIp } from '@/server/ratelimit';

export const dynamic = 'force-dynamic';

const WINDOW_SEC = 60;

export async function POST(request: Request): Promise<Response> {
  return gameRoute(request, async (identity) => {
    const ip = clientIp(request);
    const [byAnon, byIp] = await Promise.all([
      checkRateLimit(`guess:anon:${identity.anonId}`, RATE_LIMITS.guessPerMinutePerAnon, WINDOW_SEC),
      ip ? checkRateLimit(`guess:ip:${ip}`, RATE_LIMITS.guessPerMinutePerIp, WINDOW_SEC) : Promise.resolve(null),
    ]);
    if (!byAnon.ok || (byIp && !byIp.ok)) {
      throw new ApiFailure('rate_limited', 'Too many guesses. Take a breath and try again in a minute.');
    }
    const body = await parseBody(request, guessSchema);
    return json(await submitGuess(identity, body.kind, body.ref, body.filmId));
  });
}
