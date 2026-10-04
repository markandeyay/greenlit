import { tmdbImage } from '@/config/brand';
import { cx } from '@/components/ui/cx';
import { ArtImage } from '@/components/art/ArtImage';
import { FilmArt } from '@/components/art/FilmArt';
import { tmdbSizeFor } from '@/components/art/tmdb';

const SIZES: Record<'xs' | 'sm' | 'md' | 'lg', number> = { xs: 32, sm: 48, md: 96, lg: 200 };

/**
 * A film poster: the TMDB image (never rehosted) layered over a designed, deterministic one-sheet
 * (src/components/art). The art is the loading placeholder, the fallback when there is no
 * `posterPath`, and the fallback when the image fails. xs and sm render the compact motif and
 * monogram card. Decorative by default (the title is always printed next to it); pass `alt` to
 * give it an accessible name.
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
  const w = SIZES[size];
  const h = Math.round(w * 1.5);
  const src = tmdbImage(posterPath, tmdbSizeFor(w));
  return (
    <span
      className={cx('gm-poster block', `gm-poster--${size}`, className)}
      // Positioning inline so the art never escapes when game.css is not on the page.
      style={{ width: w, position: 'relative', overflow: 'hidden', aspectRatio: '2 / 3', flex: 'none' }}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
    >
      <FilmArt film={{ title, year }} size={h} style={{ position: 'absolute', inset: 0 }} />
      <ArtImage src={src} alt={alt} width={w} height={h} priority={priority} />
    </span>
  );
}
