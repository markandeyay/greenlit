// GET /api/play?kind=&ref= (Section 9, 9.1 item 5): current play state for resume.
import { json, parseQuery } from '@/server/http';
import { gameRoute } from '@/server/engine/route';
import { targetSchema } from '@/server/engine/schemas';
import { getPlayState } from '@/server/plays';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  return gameRoute(request, async (identity) => {
    const q = parseQuery(request, targetSchema);
    return json(await getPlayState(identity, q.kind, q.ref));
  });
}
