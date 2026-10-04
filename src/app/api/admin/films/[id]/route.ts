// GET /api/admin/films/[id] (WS8): full film record for the edit form. Admin only.
import { ApiFailure, json } from '@/server/http';
import { adminRoute } from '@/server/admin/access';
import { getAdminFilm } from '@/server/admin/films';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return adminRoute(async () => {
    const { id } = await params;
    if (!/^\d{1,10}$/.test(id)) throw new ApiFailure('bad_request', 'Film id is invalid.');
    return json(await getAdminFilm(Number(id)));
  });
}
