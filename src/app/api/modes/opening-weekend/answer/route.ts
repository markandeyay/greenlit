// POST /api/modes/opening-weekend/answer { token, pick: 'left' | 'right' }: resolves the token's
// pair. Returns correct / wrong with both grosses of that pair only, and the next pair on a hit.
import { json, parseBody } from '@/server/http';
import { answer } from '@/server/modes/opening-weekend/engine';
import { answerSchema, owRoute } from '@/server/modes/opening-weekend/route';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return owRoute(request, async (ctx) => {
    const body = await parseBody(request, answerSchema);
    return json(await answer(ctx, body.token, body.pick, new Date()));
  });
}
