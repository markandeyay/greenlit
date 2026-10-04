import { tmdbImage } from '@/config/brand';
import { cx } from '@/components/ui/cx';
import { ArtImage } from '@/components/art/ArtImage';
import { FilmArt } from '@/components/art/FilmArt';
import { tmdbSizeFor } from '@/components/art/tmdb';

/**
 * Poster thumb: the TMDB image (never rehosted) layered over the designed one-sheet
 * (src/components/art), which is the placeholder, the no-poster fallback and the error fallback.
 * Decorative: the title is always shown as text next to it.
 */
export function FilmPoster({
  title,
  year,
  posterPath,
  size = 'sm',
  className,
}: {
  title: string;
  year?: number | null;
  posterPath: string | null;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const dims = size === 'md' ? { w: 92, h: 138, cls: 'h-[138px] w-[92px]' } : { w: 40, h: 60, cls: 'h-[60px] w-[40px]' };
  const src = tmdbImage(posterPath, tmdbSizeFor(dims.w));
  return (
    <span aria-hidden="true" className={cx('relative block shrink-0 overflow-hidden border border-rule', dims.cls, className)}>
      <FilmArt film={{ title, year }} size={dims.h} style={{ position: 'absolute', inset: 0 }} />
      <ArtImage src={src} alt="" width={dims.w} height={dims.h} />
    </span>
  );
}
