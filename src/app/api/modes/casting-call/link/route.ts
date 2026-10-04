// POST /api/modes/casting-call/link { date, filmId, personId } (WS9): add one film + actor link.
// Validated server-side against the cast graph.
import { parseBody } from '@/server/http';
import { gameRoute } from '@/server/engine/route';
import { addLink } from '@/server/modes/casting-call/engine';
import { linkSchema, stateResponse } from '@/server/modes/casting-call/route-helpers';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return gameRoute(request, async (identity) => {
    const body = await parseBody(request, linkSchema);
    return stateResponse(await addLink(request, identity, body));
  });
}
