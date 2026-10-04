// /api/admin/schedule (Section 9 "/api/admin/*", WS8). Admin only.
//   GET                         calendar: recent past through today + SCHEDULING.aheadDays
//   POST { action: 'schedule', date, filmId, theme?, hints? }   schedule or swap a film
//   POST { action: 'delete', number }                           remove a future puzzle
//   POST { action: 'hints', number, hints }                     hand-edit hint candidates
//   POST { action: 'draft', filmId }                            preview generated candidates
//   POST { action: 'theme', fromDate, toDate, theme }           themed weeks (null clears)
import { z } from 'zod';
import { json, parseBody } from '@/server/http';
import { adminRoute } from '@/server/admin/access';
import { hintsArraySchema } from '@/server/admin/hint-schema';
import { draftHints, listSchedule, removePuzzle, schedulePuzzle, setTheme, updateHints } from '@/server/admin/schedule';

export const dynamic = 'force-dynamic';

const id = z.number().int().positive().max(2_147_483_647);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const theme = z.string().max(200).nullable();

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('schedule'), date, filmId: id, theme: theme.optional(), hints: hintsArraySchema.optional() }),
  z.object({ action: z.literal('delete'), number: id }),
  z.object({ action: z.literal('hints'), number: id, hints: hintsArraySchema }),
  z.object({ action: z.literal('draft'), filmId: id }),
  z.object({ action: z.literal('theme'), fromDate: date, toDate: date, theme }),
]);

export async function GET(): Promise<Response> {
  return adminRoute(async () => json(await listSchedule()));
}

export async function POST(request: Request): Promise<Response> {
  return adminRoute(async () => {
    const body = await parseBody(request, bodySchema);
    switch (body.action) {
      case 'schedule':
        return json({ puzzle: await schedulePuzzle({ date: body.date, filmId: body.filmId, theme: body.theme, hints: body.hints }) });
      case 'delete':
        await removePuzzle(body.number);
        return json({ ok: true });
      case 'hints':
        return json({ puzzle: await updateHints(body.number, body.hints) });
      case 'draft':
        return json(await draftHints(body.filmId));
      case 'theme':
        return json(await setTheme(body.fromDate, body.toDate, body.theme));
    }
  });
}
