// Shared wrapper for play-specific routes: resolves the identity, converts failures to ApiError
// responses, and always attaches a freshly minted anon cookie (errors included, so rate limits
// keyed by anon id see a stable id from the second request on).
import 'server-only';
import { handle } from '@/server/http';
import { resolveIdentity, withIdentityCookie, type Identity } from '@/server/plays';

export async function gameRoute(request: Request, fn: (identity: Identity) => Promise<Response>): Promise<Response> {
  let identity: Identity | null = null;
  const res = await handle(async () => {
    identity = await resolveIdentity(request);
    return fn(identity);
  });
  return identity ? withIdentityCookie(res, identity) : res;
}
