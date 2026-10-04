// The player's rating region for server-rendered game pages (Section 4.6, 9.1 item 3): the
// gl_region cookie, then Accept-Language. Used only to decide when to show a region tag.
import 'server-only';
import { cookies, headers } from 'next/headers';
import { DEFAULT_REGION, REGION_COOKIE, isRegionCode, regionFromAcceptLanguage, type RegionCode } from '@/config/regions';

export async function playerRegion(): Promise<RegionCode> {
  try {
    const c = (await cookies()).get(REGION_COOKIE)?.value?.toUpperCase();
    const fromCookie = c === 'UK' ? 'GB' : c;
    if (isRegionCode(fromCookie)) return fromCookie;
    return regionFromAcceptLanguage((await headers()).get('accept-language'));
  } catch {
    return DEFAULT_REGION;
  }
}
