// Rating regions supported at launch (Section 4.6).
// Codes are TMDB / ISO 3166-1 codes. The UK is "GB" in TMDB data and is labeled "UK" in UI.

export const REGION_CODES = ['US', 'GB', 'CA', 'AU', 'IN', 'DE'] as const;

export type RegionCode = (typeof REGION_CODES)[number];

export const DEFAULT_REGION: RegionCode = 'US';

/** Region used when the answer has no certification for the player's region. */
export const FALLBACK_REGION: RegionCode = 'US';

export interface RegionInfo {
  code: RegionCode;
  label: string; // short UI label
  board: string; // ratings body
  name: string;
}

export const REGIONS: Record<RegionCode, RegionInfo> = {
  US: { code: 'US', label: 'US', board: 'MPA', name: 'United States' },
  GB: { code: 'GB', label: 'UK', board: 'BBFC', name: 'United Kingdom' },
  CA: { code: 'CA', label: 'CA', board: 'CHVRS', name: 'Canada' },
  AU: { code: 'AU', label: 'AU', board: 'ACB', name: 'Australia' },
  IN: { code: 'IN', label: 'IN', board: 'CBFC', name: 'India' },
  DE: { code: 'DE', label: 'DE', board: 'FSK', name: 'Germany' },
};

/** Cookie the server reads to resolve the player's region (set by /settings). */
export const REGION_COOKIE = 'gl_region';

export function isRegionCode(value: unknown): value is RegionCode {
  return typeof value === 'string' && (REGION_CODES as readonly string[]).includes(value);
}

/**
 * Best-effort region from an Accept-Language header, e.g. "en-GB,en;q=0.9" -> "GB".
 * Returns DEFAULT_REGION when nothing supported is found.
 */
export function regionFromAcceptLanguage(header: string | null | undefined): RegionCode {
  if (!header) return DEFAULT_REGION;
  for (const part of header.split(',')) {
    const tag = part.split(';')[0]?.trim();
    const country = tag?.split('-')[1]?.toUpperCase();
    if (country === 'UK') return 'GB';
    if (isRegionCode(country)) return country;
  }
  return DEFAULT_REGION;
}
