// Release Order (WS9, Section 9.1 item 19).
//   GET  /api/modes/release-order                       -> ReleaseOrderState (resume or fresh)
//   POST /api/modes/release-order { date, order }       -> ReleaseOrderState after scoring
// Dates and years of the set appear only in `reveal`, once the round is won or lost.
import { z } from 'zod';
import { RATE_LIMITS } from '@/config/game';
import { readCookie } from '@/lib/anon';
import { gameRoute } from '@/server/engine/route';
import { ApiFailure, json, parseBody } from '@/server/http';
import {
  getReleaseOrderRound,
  RELEASE_ORDER_COOKIE,
  roundCookieHeader,
  submitReleaseOrderAttempt,
  type RoundResult,
} from '@/server/modes/release-order';
import { checkRateLimit } from '@/server/ratelimit';

export const dynamic = 'force-dynamic';

const attemptSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  order: z.array(z.number().int()).max(20),
});

function respond({ state, token }: RoundResult): Response {
  const res = json(state);
  if (token) res.headers.append('Set-Cookie', roundCookieHeader(token));
  return res;
}

export async function GET(request: Request): Promise<Response> {
  return gameRoute(request, async (identity) =>
    respond(await getReleaseOrderRound(identity, readCookie(request, RELEASE_ORDER_COOKIE))),
  );
}

export async function POST(request: Request): Promise<Response> {
  return gameRoute(request, async (identity) => {
    const limit = await checkRateLimit(`release_order:anon:${identity.anonId}`, RATE_LIMITS.guessPerMinutePerAnon, 60);
    if (!limit.ok) throw new ApiFailure('rate_limited', 'Too many attempts. Try again in a minute.');
    const body = await parseBody(request, attemptSchema);
    return respond(await submitReleaseOrderAttempt(identity, readCookie(request, RELEASE_ORDER_COOKIE), body));
  });
}
