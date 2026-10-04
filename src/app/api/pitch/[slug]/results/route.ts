// GET /api/pitch/[slug]/results (Section 9): how friends did. Creator only: the signed-in creator,
// or the holder of the httpOnly creator cookie issued when the pitch was made (keyless mode).
import { handle, json } from '@/server/http';
import { getCurrentUser } from '@/server/auth';
import { getPitchResults, readCreatorKey } from '@/server/pitch';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  return handle(async () => {
    const { slug: raw } = await params;
    let slug = raw;
    try {
      slug = decodeURIComponent(raw);
    } catch {
      slug = raw;
    }
    let userId: string | null = null;
    try {
      userId = (await getCurrentUser())?.id ?? null;
    } catch {
      userId = null;
    }
    const results = await getPitchResults(slug, { userId, creatorKey: readCreatorKey(request, slug) });
    return json(results);
  });
}
