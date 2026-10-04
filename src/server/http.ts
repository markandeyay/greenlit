// JSON and error helpers for route handlers (WS2). Errors follow ApiError (Section 9.1 item 6).
// Messages are generic and never mention the answer.
import 'server-only';
import type { ZodType } from 'zod';
import type { ApiError, ApiErrorCode } from '@/lib/types';

export const ERROR_STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  hint_locked: 403,
  not_found: 404,
  already_guessed: 409,
  game_over: 409,
  hint_unavailable: 409,
  rate_limited: 429,
  internal: 500,
};

/** Thrown by engine modules; converted to an ApiError response by `handle`. */
export class ApiFailure extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  constructor(code: ApiErrorCode, message: string, status: number = ERROR_STATUS[code]) {
    super(message);
    this.name = 'ApiFailure';
    this.code = code;
    this.status = status;
  }
}

export const NO_STORE = 'no-store, max-age=0';

export function json<T>(data: T, init: { status?: number; headers?: HeadersInit; cache?: string } = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', init.cache ?? NO_STORE);
  return Response.json(data, { status: init.status ?? 200, headers });
}

export function errorResponse(code: ApiErrorCode, message: string, status: number = ERROR_STATUS[code]): Response {
  const body: ApiError = { error: { code, message } };
  return json(body, { status });
}

/** Wrap a handler so ApiFailure becomes an ApiError response and anything else a generic 500. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiFailure) return errorResponse(err.code, err.message, err.status);
    console.error('[api] unhandled error', err);
    return errorResponse('internal', 'Something went wrong. Please try again.');
  }
}

/** Parse and validate a JSON body. Throws ApiFailure('bad_request') on any problem. */
export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiFailure('bad_request', 'Request body must be valid JSON.');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new ApiFailure('bad_request', 'Request body is invalid.');
  return parsed.data;
}

/** Validate query parameters (as a plain object). Throws ApiFailure('bad_request'). */
export function parseQuery<T>(request: Request, schema: ZodType<T>): T {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = schema.safeParse(params);
  if (!parsed.success) throw new ApiFailure('bad_request', 'Query parameters are invalid.');
  return parsed.data;
}
