import Image from 'next/image';
import { tmdbImage, type TmdbImageSize } from '@/config/brand';
import { cx } from '@/components/ui/cx';
import { hashString, initials } from '@/lib/format';

const SIZES: Record<'xs' | 'sm' | 'md' | 'lg', { w: number; tmdb: TmdbImageSize }> = {
  xs: { w: 32, tmdb: 'w92' },
  sm: { w: 48, tmdb: 'w92' },
  md: { w: 96, tmdb: 'w185' },
  lg: { w: 200, tmdb: 'w342' },
};

/**
 * A film poster from TMDB's CDN (never rehosted), or a typographic one-sheet fallback: kicker,
 * big initials, title and year, in one of four print styles picked from the title. Decorative by
 * default (the title is always printed next to it).
 */
export function Poster({
  title,
  year,
  posterPath,
  size = 'sm',
  alt = '',
  className,
  priority = false,
}: {
  title: string;
  year?: number | null;
  posterPath: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  alt?: string;
  className?: string;
  priority?: boolean;
}) {
  const { w, tmdb } = SIZES[size];
  const src = tmdbImage(posterPath, tmdb);
  return (
    <span
      className={cx('gm-poster block', `gm-poster--${size}`, className)}
      style={{ width: w }}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
    >
      {src ? (
        <Image src={src} alt="" fill sizes={`${w}px`} unoptimized priority={priority} />
      ) : (
        <span className="gm-sheet" data-v={hashString(title) % 4}>
          <span className="gm-sheet__kicker">A film</span>
          <span className="gm-sheet__mark">{initials(title)}</span>
          <span className="block w-full">
            <span className="gm-sheet__rule block" />
            <span className="gm-sheet__title">{title}</span>
            {year ? <span className="gm-sheet__year block">{year}</span> : null}
          </span>
        </span>
      )}
    </span>
  );
}
