// Region cookie (Section 9.1 item 3). The server reads REGION_COOKIE to pick the rating region.
// A plain (non-httpOnly) cookie, SameSite=Lax, one year. Auto (null) clears it.
import { REGION_COOKIE } from '@/config/regions';
import type { RegionCode } from '@/lib/types';

export const REGION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** The document.cookie string that stores (or clears) the region. Pure. */
export function regionCookieString(region: RegionCode | null, secure: boolean): string {
  const attrs = region
    ? [`${REGION_COOKIE}=${region}`, 'Path=/', `Max-Age=${REGION_COOKIE_MAX_AGE}`, 'SameSite=Lax']
    : [`${REGION_COOKIE}=`, 'Path=/', 'Max-Age=0', 'SameSite=Lax'];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}

/** Write the region cookie in the browser. Never throws. */
export function writeRegionCookie(region: RegionCode | null): void {
  try {
    if (typeof document === 'undefined') return;
    const secure = typeof location !== 'undefined' && location.protocol === 'https:';
    document.cookie = regionCookieString(region, secure);
  } catch {
    /* cookies blocked */
  }
}

/** Read the region cookie in the browser, or null. */
export function readRegionCookie(): string | null {
  try {
    if (typeof document === 'undefined') return null;
    for (const part of document.cookie.split(';')) {
      const [k, ...v] = part.trim().split('=');
      if (k === REGION_COOKIE) return decodeURIComponent(v.join('=')) || null;
    }
  } catch {
    /* cookies blocked */
  }
  return null;
}
