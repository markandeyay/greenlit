// Typed client for the game API (Section 9). Client-safe. Cookies are httpOnly and handled by the
// server; every call uses credentials 'same-origin'. Errors surface as GameApiError with the
// server's ApiErrorCode so the UI can pick friendly copy.
import type {
  ApiError,
  ApiErrorCode,
  DailyStatsResponse,
  GiveUpResponse,
  GuessResponse,
  HintOptionsResponse,
  HintResponse,
  HintSlot,
  HintType,
  PlayKind,
  PlayStateResponse,
  SearchResponse,
  TodayResponse,
} from '@/lib/types';

export type ClientErrorCode = ApiErrorCode | 'network';

export class GameApiError extends Error {
  readonly code: ClientErrorCode;
  readonly status: number;
  constructor(code: ClientErrorCode, message: string, status = 0) {
    super(message);
    this.name = 'GameApiError';
    this.code = code;
    this.status = status;
  }
}

export interface Target {
  kind: PlayKind;
  ref: string;
}

type Fetcher = typeof fetch;

function isApiError(body: unknown): body is ApiError {
  return (
    !!body &&
    typeof body === 'object' &&
    'error' in body &&
    !!(body as ApiError).error &&
    typeof (body as ApiError).error.code === 'string'
  );
}

async function request<T>(path: string, init: RequestInit = {}, fetcher: Fetcher = fetch): Promise<T> {
  let res: Response;
  try {
    res = await fetcher(path, {
      credentials: 'same-origin',
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new GameApiError('network', 'Network error', 0);
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    if (isApiError(body)) throw new GameApiError(body.error.code, body.error.message, res.status);
    throw new GameApiError(res.status === 429 ? 'rate_limited' : 'internal', `Request failed (${res.status})`, res.status);
  }
  return body as T;
}

const qs = (t: Target) => `kind=${encodeURIComponent(t.kind)}&ref=${encodeURIComponent(t.ref)}`;

export const gameApi = {
  today: (f?: Fetcher) => request<TodayResponse>('/api/today', {}, f),
  search: (q: string, f?: Fetcher, signal?: AbortSignal) =>
    request<SearchResponse>(`/api/search?q=${encodeURIComponent(q)}`, { signal }, f),
  play: (t: Target, f?: Fetcher) => request<PlayStateResponse>(`/api/play?${qs(t)}`, { cache: 'no-store' }, f),
  guess: (t: Target, filmId: number, f?: Fetcher) =>
    request<GuessResponse>('/api/guess', { method: 'POST', body: JSON.stringify({ kind: t.kind, ref: t.ref, filmId }) }, f),
  giveUp: (t: Target, f?: Fetcher) =>
    request<GiveUpResponse>('/api/giveup', { method: 'POST', body: JSON.stringify({ kind: t.kind, ref: t.ref }) }, f),
  hintOptions: (t: Target, f?: Fetcher) =>
    request<HintOptionsResponse>(`/api/hint/options?${qs(t)}`, { cache: 'no-store' }, f),
  hint: (t: Target, slot: HintSlot, hintType: HintType, f?: Fetcher) =>
    request<HintResponse>(
      '/api/hint',
      { method: 'POST', body: JSON.stringify({ kind: t.kind, ref: t.ref, slot, hintType }) },
      f,
    ),
  dailyStats: (n: number, f?: Fetcher) => request<DailyStatsResponse>(`/api/stats/daily/${n}`, {}, f),
};

export type GameApi = typeof gameApi;

/** Friendly, on-theme copy for an error. No em dashes. */
export function friendlyError(err: unknown): string {
  const code: ClientErrorCode = err instanceof GameApiError ? err.code : 'internal';
  switch (code) {
    case 'rate_limited':
      return 'Easy, director. Too many takes too fast. Give it a few seconds.';
    case 'already_guessed':
      return 'You already shot that one. Pick a different film.';
    case 'game_over':
      return 'That round has wrapped. No more takes on this reel.';
    case 'not_found':
      return 'We could not find that reel or film in the archive.';
    case 'hint_locked':
      return 'That note is still locked. Keep rolling.';
    case 'hint_unavailable':
      return 'That note is not available.';
    case 'bad_request':
      return 'Something about that request did not look right. Try again.';
    case 'network':
      return 'Lost the signal to the booth. Check your connection and try again.';
    case 'unauthorized':
    case 'forbidden':
      return 'You do not have access to that.';
    default:
      return 'The projector jammed. Try that again.';
  }
}
