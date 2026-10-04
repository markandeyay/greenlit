// Client fetch wrappers for /api/modes/opening-weekend/*.
import type {
  OwAnswerResponse,
  OwFinishResponse,
  OwMode,
  OwSide,
  OwStartResponse,
  OwStatusResponse,
} from '@/server/modes/opening-weekend/types';

const BASE = '/api/modes/opening-weekend';

export class OwApiError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error;
    throw new OwApiError(err?.code ?? 'internal', err?.message ?? 'Something went wrong. Please try again.');
  }
  return data as T;
}

export const owApi = {
  status: () => call<OwStatusResponse>(''),
  start: (mode: OwMode) => call<OwStartResponse>('/start', { mode }),
  answer: (token: string, pick: OwSide) => call<OwAnswerResponse>('/answer', { token, pick }),
  finish: (token: string) => call<OwFinishResponse>('/finish', { token }),
};
