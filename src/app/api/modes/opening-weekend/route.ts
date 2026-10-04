// GET /api/modes/opening-weekend: today's date, this player's daily run, and today's top runs.
import { json } from '@/server/http';
import { status } from '@/server/modes/opening-weekend/engine';
import { owRoute } from '@/server/modes/opening-weekend/route';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  return owRoute(request, async (ctx) => json(await status(ctx, new Date())), { rateLimit: false });
}
