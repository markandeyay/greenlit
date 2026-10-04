// /api/admin/films (WS8). Admin only.
//   GET ?q=&eligible=1     search the library (answer-eligible only with eligible=1)
//   POST { id, patch }     basic edit of eligibility / required fields
import { z } from 'zod';
import { json, parseBody, parseQuery } from '@/server/http';
import { adminRoute } from '@/server/admin/access';
import { searchAdminFilms, updateAdminFilm } from '@/server/admin/films';

export const dynamic = 'force-dynamic';

const querySchema = z.object({ q: z.string().max(100).optional(), eligible: z.enum(['0', '1']).optional() });

const patchSchema = z
  .object({
    tagline: z.string().max(300).nullable(),
    boxOfficeUsd: z.number().int().positive().max(1e11).nullable(),
    keywords: z.array(z.string().max(60)).max(30),
    genreIds: z.array(z.number().int().positive()).min(1).max(5),
    isAnswerEligible: z.boolean(),
    isPlayable: z.boolean(),
  })
  .partial();

const bodySchema = z.object({ id: z.number().int().positive(), patch: patchSchema });

export async function GET(request: Request): Promise<Response> {
  return adminRoute(async () => {
    const q = parseQuery(request, querySchema);
    return json({ films: await searchAdminFilms(q.q ?? '', { eligibleOnly: q.eligible === '1' }) });
  });
}

export async function POST(request: Request): Promise<Response> {
  return adminRoute(async () => {
    const body = await parseBody(request, bodySchema);
    return json(await updateAdminFilm(body.id, body.patch));
  });
}
