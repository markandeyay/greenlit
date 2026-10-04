// Minimal TMDB v3 client with a concurrency cap, a sliding-window request budget, and retries
// with backoff on 429 / 5xx (honoring Retry-After). Dependencies are injectable for tests.

export const TMDB_API_BASE = 'https://api.themoviedb.org/3';

export interface TmdbAuth {
  /** v4 read access token (Bearer). Preferred. */
  readToken?: string;
  /** v3 api key (query param). */
  apiKey?: string;
}

export interface TmdbClientOptions {
  auth: TmdbAuth;
  /** Max requests in flight. */
  concurrency?: number;
  /** Max requests started per window. */
  budget?: number;
  windowMs?: number;
  maxRetries?: number;
  baseBackoffMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  baseUrl?: string;
  onRetry?: (info: { path: string; status: number | string; attempt: number; waitMs: number }) => void;
}

export class TmdbHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    body: string,
  ) {
    super(`TMDB ${status} for ${path}: ${body.slice(0, 200)}`);
  }
}

export const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Retry-After header: delta seconds or an HTTP date. Returns ms, or null when absent/invalid. */
export function parseRetryAfter(value: string | null | undefined, now: number = Date.now()): number | null {
  if (!value) return null;
  const secs = Number(value);
  if (Number.isFinite(secs) && secs >= 0) return Math.ceil(secs * 1000);
  const at = Date.parse(value);
  if (Number.isFinite(at)) return Math.max(0, at - now);
  return null;
}

export function authFromEnv(env: NodeJS.ProcessEnv = process.env): TmdbAuth | null {
  const readToken = env.TMDB_READ_TOKEN?.trim();
  const apiKey = env.TMDB_API_KEY?.trim();
  if (!readToken && !apiKey) return null;
  return { readToken: readToken || undefined, apiKey: apiKey || undefined };
}

export class TmdbClient {
  private readonly o: Required<Omit<TmdbClientOptions, 'onRetry'>> & Pick<TmdbClientOptions, 'onRetry'>;
  private inFlight = 0;
  private waiters: (() => void)[] = [];
  private starts: number[] = [];
  private gate: Promise<void> = Promise.resolve();
  requests = 0;

  constructor(opts: TmdbClientOptions) {
    if (!opts.auth.readToken && !opts.auth.apiKey) throw new Error('TMDB auth missing: set TMDB_READ_TOKEN or TMDB_API_KEY');
    this.o = {
      concurrency: 8,
      budget: 40,
      windowMs: 10_000,
      maxRetries: 6,
      baseBackoffMs: 1000,
      fetchImpl: globalThis.fetch.bind(globalThis),
      sleep: defaultSleep,
      now: () => Date.now(),
      baseUrl: TMDB_API_BASE,
      ...opts,
    };
  }

  private async acquireSlot(): Promise<void> {
    if (this.inFlight < this.o.concurrency) {
      this.inFlight++;
      return;
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.inFlight++;
  }

  private releaseSlot(): void {
    this.inFlight--;
    const next = this.waiters.shift();
    if (next) next();
  }

  /** Sliding window: at most `budget` request starts in any `windowMs`. Serialized via a gate. */
  private throttle(): Promise<void> {
    const run = async () => {
      for (;;) {
        const now = this.o.now();
        this.starts = this.starts.filter((t) => now - t < this.o.windowMs);
        if (this.starts.length < this.o.budget) {
          this.starts.push(now);
          return;
        }
        await this.o.sleep(this.o.windowMs - (now - this.starts[0]!) + 5);
      }
    };
    const p = this.gate.then(run);
    this.gate = p.catch(() => undefined);
    return p;
  }

  buildUrl(path: string, params: Record<string, string | number | undefined> = {}): string {
    const url = new URL(this.o.baseUrl + path);
    for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, String(v));
    if (!this.o.auth.readToken && this.o.auth.apiKey) url.searchParams.set('api_key', this.o.auth.apiKey);
    return url.toString();
  }

  async get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    const url = this.buildUrl(path, params);
    const headers: Record<string, string> = { accept: 'application/json' };
    if (this.o.auth.readToken) headers.authorization = `Bearer ${this.o.auth.readToken}`;

    for (let attempt = 0; ; attempt++) {
      await this.acquireSlot();
      let res: Response | null = null;
      let networkError: unknown = null;
      try {
        await this.throttle();
        this.requests++;
        res = await this.o.fetchImpl(url, { headers });
        if (res.ok) return (await res.json()) as T;
      } catch (e) {
        networkError = e;
      } finally {
        this.releaseSlot();
      }

      const status = res?.status ?? 'network';
      const retryable = networkError !== null || status === 429 || (typeof status === 'number' && status >= 500);
      if (!retryable || attempt >= this.o.maxRetries) {
        if (networkError) throw networkError;
        throw new TmdbHttpError(res!.status, path, await res!.text().catch(() => ''));
      }
      const retryAfter = parseRetryAfter(res?.headers.get('retry-after'), this.o.now());
      const backoff = this.o.baseBackoffMs * 2 ** attempt + Math.floor(Math.random() * 250);
      const waitMs = Math.min(retryAfter ?? backoff, 60_000);
      this.o.onRetry?.({ path, status, attempt: attempt + 1, waitMs });
      await this.o.sleep(waitMs);
    }
  }
}

/** Run `fn` over items with at most `limit` in flight. Results keep input order. */
export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return out;
}
