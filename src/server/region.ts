// Rating region resolution (Section 4.6, 9.1 item 3): REGION_COOKIE, then the signed-in
// profile's region, then Accept-Language, else DEFAULT_REGION.
import 'server-only';
import { DEFAULT_REGION, REGION_COOKIE, isRegionCode, regionFromAcceptLanguage, type RegionCode } from '@/config/regions';
import { readCookie } from '@/lib/anon';

export function resolveRegion(request: Request, profileRegion: RegionCode | null = null): RegionCode {
  const cookie = readCookie(request, REGION_COOKIE);
  if (cookie) {
    const upper = cookie.toUpperCase() === 'UK' ? 'GB' : cookie.toUpperCase();
    if (isRegionCode(upper)) return upper;
  }
  if (profileRegion && isRegionCode(profileRegion)) return profileRegion;
  const header = request.headers.get('accept-language');
  return header ? regionFromAcceptLanguage(header) : DEFAULT_REGION;
}
