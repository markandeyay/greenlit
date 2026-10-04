// GET /api/leaderboard?period=week|all|streak&noNotes=bool (Section 9) -> LeaderboardResponse.
// Public and identical for every viewer, so it is cached briefly at the edge.
import { ApiFailure, handle, json } from '@/server/http';
import { getLeaderboard, isLeaderboardPeriod } from '@/server/leaderboard';

export const dynamic = 'force-dynamic';

const CACHE_SECONDS = 60;

function parseBool(v: string | null): boolean | null {
  if (v === null || v === '' || v === 'false' || v === '0') return false;
  if (v === 'true' || v === '1') return true;
  return null;
}

export async function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const params = new URL(request.url).searchParams;
    const period = params.get('period') ?? 'week';
    if (!isLeaderboardPeriod(period)) throw new ApiFailure('bad_request', 'period must be week, all or streak.');
    const noNotes = parseBool(params.get('noNotes'));
    if (noNotes === null) throw new ApiFailure('bad_request', 'noNotes must be true or false.');
    const board = await getLeaderboard(period, noNotes);
    return json(board, {
      cache: `public, max-age=0, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`,
    });
  });
}
