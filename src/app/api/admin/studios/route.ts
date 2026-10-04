// /api/admin/studios (Section 4.5, WS8). Admin only.
//   GET                                                  studios + aliases
//   POST { action: 'create', name, logoPath? }           new headline studio
//   POST { action: 'alias', rawCompanyId, studioId }     fold a TMDB company into a studio
//   POST { action: 'unalias', rawCompanyId }             remove a mapping
import { z } from 'zod';
import { json, parseBody } from '@/server/http';
import { adminRoute } from '@/server/admin/access';
import { createStudio, listStudioData, removeAlias, setAlias } from '@/server/admin/studios';

export const dynamic = 'force-dynamic';

const id = z.number().int().positive().max(2_147_483_647);
const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), name: z.string().min(1).max(120), logoPath: z.string().max(200).nullish() }),
  z.object({ action: z.literal('alias'), rawCompanyId: id, studioId: id }),
  z.object({ action: z.literal('unalias'), rawCompanyId: id }),
]);

export async function GET(): Promise<Response> {
  return adminRoute(async () => json(await listStudioData()));
}

export async function POST(request: Request): Promise<Response> {
  return adminRoute(async () => {
    const body = await parseBody(request, bodySchema);
    switch (body.action) {
      case 'create': {
        const studio = await createStudio(body.name, body.logoPath ?? null);
        return json({ studio, ...(await listStudioData()) });
      }
      case 'alias':
        return json(await setAlias(body.rawCompanyId, body.studioId));
      case 'unalias':
        return json(await removeAlias(body.rawCompanyId));
    }
  });
}
