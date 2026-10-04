// Brand and thematic copy. The product name lives ONLY here (see doc header). Never hardcode it in UI.

export const APP_NAME = 'Greenlit';

export const APP_TAGLINE = 'The daily movie deduction game';

/** Canonical site URL, used for share links and OG metadata. */
export const SITE_URL: string = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

/** Host shown in share text, e.g. "greenlit.example/212". */
export function shareHost(): string {
  return SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/** Thematic copy (Section 2.6). No em dashes anywhere in user-facing copy. */
export const COPY = {
  winStamp: 'GREENLIT',
  lossStamp: 'SENT TO TURNAROUND',
  takeLabel: (take: number, max: number) => `TAKE ${take} / ${max}`,
  reelLabel: (n: number) => `Reel No. ${String(n).padStart(3, '0')}`,
  giveUp: 'Walk away',
  pitchCta: 'Pitch a film',
  endCredits: `The End · A ${APP_NAME} production`,
  hintsName: 'Script Notes',
  callSheet: 'CALL SHEET',
  confirmed: 'CONFIRMED',
  ruledOut: 'CUT',
} as const;

/** Required TMDB attribution (Section 15). Show in footer and How to Play. */
export const TMDB_ATTRIBUTION =
  'This product uses the TMDB API but is not endorsed or certified by TMDB.';

export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export type TmdbImageSize = 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original';

export function tmdbImage(path: string | null | undefined, size: TmdbImageSize = 'w185'): string | null {
  return path ? `${TMDB_IMAGE_BASE}/${size}${path}` : null;
}
