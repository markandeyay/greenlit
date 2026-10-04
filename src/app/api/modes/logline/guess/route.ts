// POST /api/modes/logline/guess { filmId } (WS9): one take at today's logline. Returns the new
// round state; a miss earns the next tier. Rate limited per anon id like classic guesses.
import { z } from 'zod';
import { json, parseBody } from '@/server/http';
import { gameRoute } from '@/server/engine/route';
import { readStateToken, stateCookieHeader, submitLoglineGuess } from '@/server/modes/logline';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ filmId: z.number().int().positive().max(2_147_483_647) });

export async function POST(request: Request): Promise<Response> {
  return gameRoute(request, async (identity) => {
    const body = await parseBody(request, bodySchema);
    const { state, token } = await submitLoglineGuess(identity, readStateToken(request), body.filmId);
    const res = json(state);
    res.headers.append('Set-Cookie', stateCookieHeader(token));
    return res;
  });
}
