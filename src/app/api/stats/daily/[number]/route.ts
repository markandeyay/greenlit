// GET /api/stats/daily/[number] (Section 9): global take distribution for a released puzzle.
import { DAILY_STATS_CACHE_SECONDS } from '@/config/game';
import { ApiFailure, handle, json } from '@/server/http';
import { getDailyStatsPublic } from '@/server/stats';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ number: string }> },
): Promise<Response> {
  return handle(async () => {
    const { number } = await params;
    if (!/^\d{1,6}$/.test(number)) throw new ApiFailure('bad_request', 'Puzzle number is invalid.');
    const stats = await getDailyStatsPublic(Number(number));
    return json(stats, {
      cache: `public, max-age=0, s-maxage=${DAILY_STATS_CACHE_SECONDS}, stale-while-revalidate=${DAILY_STATS_CACHE_SECONDS}`,
    });
  });
}
