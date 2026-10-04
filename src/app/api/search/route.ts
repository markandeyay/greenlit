// GET /api/search?q= (Section 9): fuzzy title search over playable films. Public library data.
import { SEARCH } from '@/config/game';
import { handle, json } from '@/server/http';
import { getRepo } from '@/server/db';
import type { SearchResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

const MAX_QUERY_LENGTH = 100;
const SEARCH_CACHE = 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600';

export async function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const q = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, MAX_QUERY_LENGTH);
    if (q.length < SEARCH.minQueryLength) return json<SearchResponse>({ results: [] }, { cache: SEARCH_CACHE });
    const results = await getRepo().searchFilms(q, SEARCH.maxResults);
    return json<SearchResponse>({ results: results.slice(0, SEARCH.maxResults) }, { cache: SEARCH_CACHE });
  });
}
