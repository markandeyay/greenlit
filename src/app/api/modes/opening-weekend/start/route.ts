// POST /api/modes/opening-weekend/start { mode: 'daily' | 'practice' }: deals the first pair (cards
// only, no grosses) and a run token. A daily run resumes if one is in progress and reports the
// result if today's run is already over.
import { json, parseBody } from '@/server/http';
import { startRun } from '@/server/modes/opening-weekend/engine';
import { owRoute, startSchema } from '@/server/modes/opening-weekend/route';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return owRoute(request, async (ctx) => {
    const body = await parseBody(request, startSchema);
    return json(await startRun(ctx, body.mode, new Date()));
  });
}
