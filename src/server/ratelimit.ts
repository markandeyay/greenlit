// Rate limiting (Sections 9, 10.7). Upstash Redis sliding window when UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN are set, otherwise an in-process sliding window (per instance; fine for
// dev and tests). Upstash failures fail open so an outage never blocks play.
import 'server-only';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  /** Epoch ms when the window frees up. */
  resetAt: number;
}

function upstashConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

const limiters = new Map<string, Ratelimit>();
function upstashLimiter(limit: number, windowSec: number): Ratelimit {
  const id = `${limit}:${windowSec}`;
  let l = limiters.get(id);
  if (!l) {
    l = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
      prefix: 'gl:rl',
    });
    limiters.set(id, l);
  }
  return l;
}

const g = globalThis as unknown as { __glRateWindows?: Map<string, number[]> };
function windows(): Map<string, number[]> {
  if (!g.__glRateWindows) g.__glRateWindows = new Map();
  return g.__glRateWindows;
}

function memoryCheck(key: string, limit: number, windowSec: number, now: number): RateLimitResult {
  const store = windows();
  const windowMs = windowSec * 1000;
  const hits = (store.get(key) ?? []).filter((t) => t > now - windowMs);
  if (hits.length >= limit) {
    store.set(key, hits);
    return { ok: false, limit, remaining: 0, resetAt: hits[0]! + windowMs };
  }
  hits.push(now);
  store.set(key, hits);
  // Opportunistic cleanup so the map does not grow without bound.
  if (store.size > 10_000) {
    for (const [k, v] of store) if (!v.some((t) => t > now - windowMs)) store.delete(k);
  }
  return { ok: true, limit, remaining: limit - hits.length, resetAt: hits[0]! + windowMs };
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSec: number,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  if (upstashConfigured()) {
    try {
      const r = await upstashLimiter(limit, windowSec).limit(key);
      return { ok: r.success, limit: r.limit, remaining: r.remaining, resetAt: r.reset };
    } catch (err) {
      console.error('[ratelimit] upstash error, failing open', err);
      return { ok: true, limit, remaining: limit, resetAt: now + windowSec * 1000 };
    }
  }
  return memoryCheck(key, limit, windowSec, now);
}

/** Client IP from proxy headers, or null when unknown. */
export function clientIp(request: Request): string | null {
  const xff = request.headers.get('x-forwarded-for');
  const first = xff?.split(',')[0]?.trim();
  if (first) return first;
  return request.headers.get('x-real-ip')?.trim() || null;
}

/** Tests only. */
export function resetRateLimitsForTesting(): void {
  windows().clear();
}
