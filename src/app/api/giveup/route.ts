// POST /api/giveup (Section 9): "Walk away". Ends the round as lost and returns the reveal.
import { json, parseBody } from '@/server/http';
import { gameRoute } from '@/server/engine/route';
import { giveUpSchema } from '@/server/engine/schemas';
import { giveUp } from '@/server/plays';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return gameRoute(request, async (identity) => {
    const body = await parseBody(request, giveUpSchema);
    return json(await giveUp(identity, body.kind, body.ref));
  });
}
