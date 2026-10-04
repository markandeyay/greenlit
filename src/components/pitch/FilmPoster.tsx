import Image from 'next/image';
import { tmdbImage } from '@/config/brand';
import { cx } from '@/components/ui/cx';

/**
 * Small poster thumb from TMDB's CDN (never rehosted), with a typographic fallback card (title
 * initials on film stock) when there is no poster. Decorative: the title is always shown as text
 * next to it, so the image has an empty alt.
 */
export function FilmPoster({
  title,
  posterPath,
  size = 'sm',
  className,
}: {
  title: string;
  posterPath: string | null;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const dims = size === 'md' ? { w: 92, h: 138, cls: 'h-[138px] w-[92px]' } : { w: 40, h: 60, cls: 'h-[60px] w-[40px]' };
  const src = tmdbImage(posterPath, size === 'md' ? 'w185' : 'w92');
  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={dims.w}
        height={dims.h}
        className={cx('shrink-0 border border-rule object-cover', dims.cls, className)}
      />
    );
  }
  const initials = title
    .replace(/^(the|a|an)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => [...w][0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      aria-hidden="true"
      className={cx(
        'flex shrink-0 items-center justify-center border border-rule bg-surface-2 font-display font-black uppercase text-ink-dim',
        size === 'md' ? 'text-3xl' : 'text-sm',
        dims.cls,
        className,
      )}
    >
      {initials || '?'}
    </span>
  );
}
