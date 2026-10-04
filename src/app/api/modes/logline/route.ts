// GET /api/modes/logline (WS9): today's Logline round for this player, for resume. Earned tiers
// only; the title and film id appear only once the round is over (Section 10).
import { json } from '@/server/http';
import { gameRoute } from '@/server/engine/route';
import { getLoglineState, readStateToken, stateCookieHeader } from '@/server/modes/logline';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  return gameRoute(request, async (identity) => {
    const { state, token } = await getLoglineState(identity, readStateToken(request));
    const res = json(state);
    res.headers.append('Set-Cookie', stateCookieHeader(token));
    return res;
  });
}
