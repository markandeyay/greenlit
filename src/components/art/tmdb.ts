import type { TmdbImageSize } from '@/config/brand';

const LADDER: readonly [TmdbImageSize, number][] = [
  ['w92', 92],
  ['w154', 154],
  ['w185', 185],
  ['w342', 342],
  ['w500', 500],
];

/** Smallest TMDB width that covers `cssWidth` at 2x density (w92 .. w500). */
export function tmdbSizeFor(cssWidth: number): TmdbImageSize {
  const need = cssWidth * 2;
  for (const [size, px] of LADDER) if (px >= need) return size;
  return 'w500';
}
