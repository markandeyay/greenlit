// POST /api/modes/casting-call/giveup { date } (WS9): end the round and reveal an optimal chain.
import { parseBody } from '@/server/http';
import { gameRoute } from '@/server/engine/route';
import { giveUpCasting } from '@/server/modes/casting-call/engine';
import { giveUpSchema, stateResponse } from '@/server/modes/casting-call/route-helpers';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return gameRoute(request, async (identity) => {
    const body = await parseBody(request, giveUpSchema);
    return stateResponse(await giveUpCasting(request, identity, body));
  });
}
