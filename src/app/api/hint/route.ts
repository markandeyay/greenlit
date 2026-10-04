// POST /api/hint (Section 9): reveal a Script Note once its slot is unlocked server-side.
import { json, parseBody } from '@/server/http';
import { gameRoute } from '@/server/engine/route';
import { hintSchema } from '@/server/engine/schemas';
import { revealHint } from '@/server/hints';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return gameRoute(request, async (identity) => {
    const body = await parseBody(request, hintSchema);
    return json(await revealHint(identity, body.kind, body.ref, body.slot, body.hintType));
  });
}
