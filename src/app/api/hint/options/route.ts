// GET /api/hint/options?kind=&ref= (Section 9): hint type ids per slot. Never content.
import { json, parseQuery } from '@/server/http';
import { gameRoute } from '@/server/engine/route';
import { targetSchema } from '@/server/engine/schemas';
import { getHintOptions } from '@/server/hints';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  return gameRoute(request, async (identity) => {
    const q = parseQuery(request, targetSchema);
    return json(await getHintOptions(identity, q.kind, q.ref));
  });
}
