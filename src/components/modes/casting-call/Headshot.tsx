import { tmdbImage } from '@/config/brand';
import { cx } from '@/components/ui/cx';
import { ArtImage } from '@/components/art/ArtImage';
import { PersonArt } from '@/components/art/PersonArt';
import { tmdbSizeFor } from '@/components/art/tmdb';

const PX = { sm: { w: 32, h: 40 }, md: { w: 48, h: 64 }, lg: { w: 72, h: 96 } } as const;

/**
 * Headshot tile: the TMDB profile image layered over a designed portrait tile (src/components/art),
 * which is the placeholder, the no-photo fallback and the error fallback. Decorative.
 */
export function Headshot({
  name,
  profilePath,
  size = 'md',
  className,
}: {
  name: string;
  profilePath: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const { w, h } = PX[size];
  const src = tmdbImage(profilePath, tmdbSizeFor(w));
  const box = size === 'sm' ? 'h-10 w-8' : size === 'lg' ? 'h-24 w-[4.5rem]' : 'h-16 w-12';
  return (
    <span
      aria-hidden="true"
      className={cx(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius)] border border-rule bg-surface-2',
        box,
        className,
      )}
    >
      <PersonArt person={{ name }} style={{ position: 'absolute', inset: 0 }} />
      <ArtImage src={src} alt="" width={w} height={h} />
    </span>
  );
}
