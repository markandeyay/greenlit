// GET /api/today (Section 9): today's reel number, date, theme, and next reset. No answer.
import { handle, json } from '@/server/http';
import { getToday } from '@/server/puzzles';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return handle(async () => json(await getToday()));
}
