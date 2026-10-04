// Server-rendered first frame for game pages: the same PlayStateResponse /api/play returns,
// computed from the request cookies so the board paints without a client round trip.
// Safe by construction: getPlayState includes a reveal only for finished plays (Section 10).
import 'server-only';
import { headers } from 'next/headers';
import type { PlayKind, PlayStateResponse } from '@/lib/types';
import { getPlayState, resolveIdentity } from '@/server/plays';

export async function initialPlayFor(kind: PlayKind, ref: string): Promise<PlayStateResponse | null> {
  try {
    const h = await headers();
    const request = new Request('http://internal/', {
      headers: { cookie: h.get('cookie') ?? '', 'accept-language': h.get('accept-language') ?? '' },
    });
    const identity = await resolveIdentity(request);
    // A first-time visitor has no cookie yet; their play starts empty and the cookie is set on
    // the first guess, so nothing is persisted from here.
    if (identity.isNewAnon) return { kind, ref, status: 'in_progress', take: 0, feedback: [], hints: [] };
    return await getPlayState(identity, kind, ref);
  } catch {
    return null; // fall back to the client fetch
  }
}
