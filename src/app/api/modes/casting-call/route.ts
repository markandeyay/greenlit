// GET /api/modes/casting-call (WS9): today's pair, the player's chain, and the current actor's
// filmography. The optimal path is included only once the round is finished.
import { gameRoute } from '@/server/engine/route';
import { getCastingState } from '@/server/modes/casting-call/engine';
import { stateResponse } from '@/server/modes/casting-call/route-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  return gameRoute(request, async (identity) => stateResponse(await getCastingState(request, identity)));
}
