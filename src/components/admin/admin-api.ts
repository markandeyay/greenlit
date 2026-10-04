// Tiny fetch helpers for the admin console. Errors surface the server's ApiError message.
import type { ApiError, SearchResult } from '@/lib/types';
import type { AdminFilmSummary, AdminFilmsResponse } from '@/server/admin/types';

export class AdminError extends Error {}

async function parse<T>(r: Response): Promise<T> {
  const body = (await r.json().catch(() => null)) as T | ApiError | null;
  if (!r.ok || (body && typeof body === 'object' && 'error' in (body as object))) {
    const msg = body && typeof body === 'object' && 'error' in (body as object) ? (body as ApiError).error.message : `Request failed (${r.status}).`;
    throw new AdminError(msg);
  }
  return body as T;
}

export async function adminGet<T>(path: string): Promise<T> {
  return parse<T>(await fetch(path, { cache: 'no-store' }));
}

export async function adminPost<T>(path: string, body: unknown): Promise<T> {
  return parse<T>(
    await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  );
}

/** Admin film search, shaped for FilmPicker. Keeps the summaries for the caller. */
export function makeAdminSearch(eligibleOnly: boolean, sink?: (films: AdminFilmSummary[]) => void) {
  return async (q: string): Promise<SearchResult[]> => {
    const res = await adminGet<AdminFilmsResponse>(`/api/admin/films?q=${encodeURIComponent(q)}&eligible=${eligibleOnly ? '1' : '0'}`);
    sink?.(res.films);
    return res.films.map((f) => ({ id: f.id, title: f.title, year: f.year, posterPath: f.posterPath }));
  };
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.';
}
