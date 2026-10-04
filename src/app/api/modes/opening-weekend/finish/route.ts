// POST /api/modes/opening-weekend/finish { token }: ends a daily run at its current score when the
// clock runs out. The unanswered pair is never resolved.
import { json, parseBody } from '@/server/http';
import { finishRun } from '@/server/modes/opening-weekend/engine';
import { finishSchema, owRoute } from '@/server/modes/opening-weekend/route';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return owRoute(request, async (ctx) => {
    const body = await parseBody(request, finishSchema);
    return json(await finishRun(ctx, body.token, new Date()));
  });
}
