// Shared plumbing for the /api/modes/opening-weekend/* route handlers. SERVER ONLY.
import 'server-only';
import { z } from 'zod';
import { gameRoute } from '@/server/engine/route';
import { ApiFailure } from '@/server/http';
import { checkRateLimit, clientIp } from '@/server/ratelimit';
import type { OwContext } from './engine';
import { readRunCookie, runCookieHeader } from './token';

/** Per minute. A fast player answers about one pair a second during the 60s run. */
export const OW_RATE_LIMITS = {
  perAnon: 150,
  perIp: 600,
} as const;

export const startSchema = z.object({ mode: z.enum(['daily', 'practice']) });
export const answerSchema = z.object({ token: z.string().min(1).max(2048), pick: z.enum(['left', 'right']) });
export const finishSchema = z.object({ token: z.string().min(1).max(2048) });

export async function owRoute(
  request: Request,
  fn: (ctx: OwContext) => Promise<Response>,
  opts: { rateLimit?: boolean } = {},
): Promise<Response> {
  return gameRoute(request, async (identity) => {
    if (opts.rateLimit !== false) {
      const anon = await checkRateLimit(`ow:anon:${identity.anonId}`, OW_RATE_LIMITS.perAnon, 60);
      const ip = clientIp(request);
      const byIp = ip ? await checkRateLimit(`ow:ip:${ip}`, OW_RATE_LIMITS.perIp, 60) : null;
      if (!anon.ok || (byIp && !byIp.ok)) throw new ApiFailure('rate_limited', 'Slow down a little and try again.');
    }
    const ctx: OwContext = { identity, cookieRecord: readRunCookie(request) };
    const res = await fn(ctx);
    if (ctx.nextCookie) res.headers.append('Set-Cookie', runCookieHeader(ctx.nextCookie));
    return res;
  });
}
